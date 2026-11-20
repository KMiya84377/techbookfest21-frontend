import os

from ag_ui_strands import (
    StrandsAgent,
    StrandsAgentConfig,
    ToolBehavior,
    create_strands_app,
)
from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    PersistenceMode,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from bedrock_agentcore.runtime import BedrockAgentCoreContext
from strands import Agent
from strands.models import BedrockModel

from chat.jev_client import JevClient
from chat.learning_review import (
    is_learning_review,
    learning_review_context,
    template_tools_for_request,
)
from chat.log import configure_logging
from chat.news_review import is_news_review, news_review_context
from chat.prompts import SYSTEM_PROMPT
from chat.tools import fetch_news, list_saved_quests, save_quests
from chat.ui_router import UiRouterIntervention
from chat.user_settings import user_settings_context
from chat.weekly_stats import get_weekly_stats

# ログは、ライブラリのものも含めて、JSON の 1 行で標準出力に出す
configure_logging()

REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
MODEL_ID = os.environ.get("MODEL_ID", "moonshotai.kimi-k2.5")
# 記憶(AgentCore Memory)の ID。ないときは、記憶なしで動く(ローカルなど)
MEMORY_ID = os.environ.get("MEMORY_ID")
# Jev(UI ルーター)の API キー。ローカルは TYPESAFE_API_KEY、AWS は AgentCore Identity の名前で渡す(どちらか 1 つ)
TYPESAFE_API_KEY = os.environ.get("TYPESAFE_API_KEY")
JEV_API_KEY_PROVIDER_NAME = os.environ.get("JEV_API_KEY_PROVIDER_NAME")
JEV_MODEL = os.environ.get("JEV_MODEL", "jev-latest")
JEV_UI_MIN_CONFIDENCE = float(os.environ.get("JEV_UI_MIN_CONFIDENCE", "0.5"))
# Jev は依頼のたびにモデルより先に呼ぶため、待ち時間を短くする
JEV_TIMEOUT = float(os.environ.get("JEV_TIMEOUT", "2.0"))

# どちらも未設定なら、UI ルーターを使わない(両方の設定は、JevClient がエラーにする)
jev_client = (
    JevClient(
        api_key=TYPESAFE_API_KEY,
        api_key_provider_name=JEV_API_KEY_PROVIDER_NAME,
        model=JEV_MODEL,
        timeout=JEV_TIMEOUT,
    )
    if TYPESAFE_API_KEY or JEV_API_KEY_PROVIDER_NAME
    else None
)

interventions = (
    [
        UiRouterIntervention(
            jev_client,
            min_confidence=JEV_UI_MIN_CONFIDENCE,
        )
    ]
    if jev_client
    else []
)

strands_agent = Agent(
    model=BedrockModel(model_id=MODEL_ID, region_name=REGION),
    system_prompt=SYSTEM_PROMPT,
    tools=[fetch_news, list_saved_quests, save_quests, get_weekly_stats],
    interventions=interventions,
)


def _verified_user_id(input_data) -> str | None:
    """Web アプリのサーバーが検証して、forwardedProps.userId に入れたユーザー ID(画面が送った値は、サーバーが上書きする)"""
    props = input_data.forwarded_props
    user_id = props.get("userId") if isinstance(props, dict) else None
    return user_id if isinstance(user_id, str) and user_id else None


def session_manager_provider(input_data):
    """会話(スレッド)ごとの、記憶のセッションマネージャー

    - 短期記憶: 会話のイベントを保存し、会話の続きを再現する(session_id はスレッド)
    - 長期記憶: 好み、事実、エピソードを、会話の前に取り出して、プロンプトに入れる
    ユーザー(actor_id)は、Web アプリのサーバーが、検証して、forwardedProps.userId に入れたもの
    """
    # 関連分析はチャットから独立した実行。自動生成した提案をユーザーの会話記憶へ書かない。
    if not MEMORY_ID or is_learning_review(input_data) or is_news_review(input_data):
        return None
    actor_id = _verified_user_id(input_data)
    if not actor_id:
        # ユーザーが特定できないときは、記憶を使わない(共通の ID に保存すると、別人の記憶が混ざる)
        return None
    config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=input_data.thread_id,
        actor_id=actor_id,
        retrieval_config={
            "/preferences/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
            "/facts/{actorId}/": RetrievalConfig(top_k=10, relevance_score=0.3),
            "/episodes/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
        },
        async_mode=True,
        persistence_mode=PersistenceMode.FULL,
    )
    return AgentCoreMemorySessionManager(config, region_name=REGION)


def build_state_context(input_data, user_message: str) -> str:
    """検証済みのユーザー設定だけを、モデル入力に含める。

    この結果はユーザーメッセージとして記憶(Memory)に保存されるため、小さな設定だけを入れる。
    クエスト一覧は、画面が AG-UI の context で渡す(履歴に保存されない)。
    """
    if is_news_review(input_data):
        return news_review_context(user_message)
    if is_learning_review(input_data):
        return learning_review_context(
            user_message, ui=input_data.forwarded_props.get("learningUI") is True
        )
    state = input_data.state if isinstance(input_data.state, dict) else {}
    preferences = user_settings_context(state)
    if not preferences:
        return user_message
    return f"{user_message}\n\n{preferences}"


def request_quest_board_refresh(tool_result) -> dict | None:
    """保存後、ブラウザーが永続 API を読み直すよう Shared State で通知する。"""
    input_state = tool_result.input_data.state
    result = tool_result.result_data
    if not isinstance(input_state, dict) or not isinstance(result, dict):
        return None

    current_board = input_state.get("questBoard")
    if not isinstance(current_board, dict):
        # 定期実行など、画面からのリクエストでない場合は通知しない。
        return None
    if not result.get("saved") and not result.get("skipped_existing"):
        return None

    next_state = dict(input_state)
    next_state["questBoard"] = {
        **current_board,
        "refreshRequested": True,
    }
    return next_state


# AG-UI のプロトコルに対応させる
agui_agent = StrandsAgent(
    agent=strands_agent,
    name="assistant",
    description="AWS の最新情報を、クエストとして学ぶための学習アシスタント",
    config=StrandsAgentConfig(
        # 分析時はRSS取得・DB書き込みツールを渡さず、構造化結果を返すツールだけを使う。
        template_tools_provider=template_tools_for_request,
        session_manager_provider=session_manager_provider,
        state_context_builder=build_state_context,
        tool_behaviors={
            "save_quests": ToolBehavior(
                state_from_result=request_quest_board_refresh,
            )
        },
    ),
)


def invocation_state(request, input_data) -> dict:
    """ツールに渡す、リクエスト単位の情報

    Web アプリのサーバーが、検証したユーザー ID を、forwardedProps.userId に入れて送る
    (画面が送った値は、サーバーが上書きする)
    """
    props = input_data.forwarded_props
    user_id = _verified_user_id(input_data)
    state = {"user_id": user_id} if user_id else {}
    if os.environ.get("BLOCKS_WEB_URL") and isinstance(props, dict):
        cookie = props.get("localAuthCookie")
        if isinstance(cookie, str):
            state["local_auth_cookie"] = cookie
    return state


# AgentCore Runtime の契約: ポート 8080 の /invocations(AG-UI)と /ping(ヘルスチェック)
app = create_strands_app(
    agui_agent,
    path="/invocations",
    ping_path="/ping",
    cors_enabled=False,
    invocation_state_provider=invocation_state,
)


@app.middleware("http")
async def set_agentcore_identity_context(request, call_next):
    """Runtime が渡すワークロードのトークンを、AgentCore Identity の SDK(requires_api_key)から使えるようにする"""
    workload_access_token = (
        request.headers.get("X-Amz-Bedrock-AgentCore-Identity-WAT")
        or request.headers.get("WorkloadAccessToken")
    )
    if workload_access_token:
        BedrockAgentCoreContext.set_workload_access_token(workload_access_token)
    return await call_next(request)


if __name__ == "__main__":
    import uvicorn

    # log_config=None: uvicorn 自身のログ設定を使わず、上の JSON のログ設定に合わせる
    uvicorn.run(app, host="0.0.0.0", port=8080, log_config=None)
