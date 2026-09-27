import os

from ag_ui_strands import StrandsAgent, StrandsAgentConfig, create_strands_app
from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    PersistenceMode,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)
from strands import Agent
from strands.models import BedrockModel

from tools import fetch_news, list_saved_quests, save_quests

REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
MODEL_ID = os.environ.get("MODEL_ID", "jp.anthropic.claude-sonnet-4-6")
# 記憶(AgentCore Memory)の ID。ないときは、記憶なしで動く(ローカルなど)
MEMORY_ID = os.environ.get("MEMORY_ID")

SYSTEM_PROMPT = """\
あなたは、AWS の最新情報を、RPG のクエストのように学べるアプリの、学習アシスタントです。日本語で、簡潔に答えます。

# 画面の状況
リクエストの context に、次の情報が入っています。
- クエストボードにあるクエストの一覧(id つき)
- ユーザーが、いま詳細を開いているクエスト
- クエストボードで、適用中の検索条件
クエストの id は、context にあるものを、そのまま使います。推測して作りません。

# ツールの使い方
- 絞り込みの依頼(期間、サービス、重要度、想定学習時間、状態): update_quest_filter を呼びます。条件を変えるだけで、クエストは作りません。
- 理解度チェックの依頼: show_quiz を 1 回だけ呼びます。
  - 「このクエスト」は、詳細を開いているクエストです。開いていなくて、対象が決まらないときは、どのクエストか、聞き返します。
  - 問題は、そのクエストの内容(context の情報)に基づく、単一選択(4 択)にします。questId は、context のクエストの id です。
  - 問題の内容は、クエストに書かれていることだけを根拠にします。
  - ユーザーの回答(選んだ選択肢と、正誤)が返ってきたら、短く講評します。解説は、explanation に書くので、繰り返しません。
- 詳細を開いているクエストについての質問:
  - 短い説明は、チャットで答えます。
  - 比較(これまでと更新後の違い)や、影響の整理など、広い表示が向くものは、update_quest_detail で、クエストの詳細に出します。詳細に出したら、チャットには、要点を 1〜2 文で伝えます(表の内容を、繰り返しません)。
  - 表示の種類: comparison(比較表)、impact(項目ごとの影響)、text(短い文章)。context の chatAddedSections に、すでに追加した表示があります。内容を直すときは、同じ id で呼びます。
  - 詳細を開いていないときは使いません。どのクエストか聞き返します。内容は、クエストに書かれていることだけを根拠にします。
- 新しいクエストの依頼(「最新のニュースを探して」「クエストを更新して」など):
  1. fetch_news で、ニュースを取得します(ユーザーが、サービスや話題を指定したら、keyword に、英語で入れます)。
  2. すでにあるニュース(id が同じ)は、除きます。context にクエスト一覧がないときは、list_saved_quests で、保存済みのクエストを確認します。
  3. 学ぶ価値の高いものを、最大 5 件選び、クエストにして、save_quests で保存します。
  4. 保存したら、reload_quests を呼びます(画面がなく、このツールがない定期実行のときは、呼びません)。
  5. 何件を保存したか、どんなクエストか、短く伝えます。
  クエストの内容は、ニュースの本文に書かれていることだけを根拠にし、書かれていないことを足しません。「変わらないこと」や「要検証」も、本文から言える範囲で書きます。
- 記憶: 過去の会話から取り出した、ユーザーの好み、事実、エピソード(過去のやりとりの要点)が、<user_context> として、会話の前に与えられることがあります。ユーザーの好み(関心のあるサービス、問題の難しさ、答え方など)は、尊重します。クエストを作るときは、関心のありそうなニュースを優先し、理解度チェックは、これまでの正答の傾向に合わせます。記憶に、書かれていないことは、推測しません。
- 上のどれでもない質問: 通常の会話で、簡潔に答えます。クエストの内容についての質問は、context の情報を根拠にし、わからないことは、わからないと言います。
"""

strands_agent = Agent(
    model=BedrockModel(model_id=MODEL_ID, region_name=REGION),
    system_prompt=SYSTEM_PROMPT,
    tools=[fetch_news, list_saved_quests, save_quests],
)

def session_manager_provider(input_data):
    """会話(スレッド)ごとの、記憶のセッションマネージャー

    - 短期記憶: 会話のイベントを保存し、会話の続きを再現する(session_id はスレッド)
    - 長期記憶: 好み、事実、エピソードを、会話の前に取り出して、プロンプトに入れる
    ユーザー(actor_id)は、Web アプリのサーバーが、検証して、forwardedProps.userId に入れたもの
    """
    if not MEMORY_ID:
        return None
    props = input_data.forwarded_props
    actor_id = props.get("userId") if isinstance(props, dict) else None
    config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=input_data.thread_id,
        actor_id=actor_id or "anonymous",
        retrieval_config={
            "/preferences/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
            "/facts/{actorId}/": RetrievalConfig(top_k=10, relevance_score=0.3),
            "/episodes/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
        },
        async_mode=True,
        # 毎朝の定期実行(batch)は、記憶を使うが、記憶に、この会話を残さない
        persistence_mode=(
            PersistenceMode.NONE
            if isinstance(props, dict) and props.get("batch")
            else PersistenceMode.FULL
        ),
    )
    return AgentCoreMemorySessionManager(config, region_name=REGION)


# AG-UI のプロトコルに対応させる
agui_agent = StrandsAgent(
    agent=strands_agent,
    name="assistant",
    description="AWS の最新情報を、クエストとして学ぶための学習アシスタント",
    config=StrandsAgentConfig(session_manager_provider=session_manager_provider),
)


def invocation_state(request, input_data) -> dict:
    """ツールに渡す、リクエスト単位の情報

    Web アプリのサーバーが、検証したユーザー ID を、forwardedProps.userId に入れて送る
    (画面が送った値は、サーバーが上書きする)
    """
    props = input_data.forwarded_props
    user_id = props.get("userId") if isinstance(props, dict) else None
    return {"user_id": user_id} if user_id else {}


# AgentCore Runtime の契約: ポート 8080 の /invocations(AG-UI)と /ping(ヘルスチェック)
app = create_strands_app(
    agui_agent,
    path="/invocations",
    ping_path="/ping",
    cors_enabled=False,
    invocation_state_provider=invocation_state,
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
