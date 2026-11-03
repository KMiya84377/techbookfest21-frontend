"""定期実行用のHTTP AgentCore Runtime。

チャット用のAG-UI Runtimeとは分け、1回のニュース更新をJSONの
リクエスト/レスポンスとして処理する。
"""

import os

from fastapi import FastAPI, HTTPException
from botocore.config import Config as BotocoreConfig
from pydantic import BaseModel, Field
from strands import Agent
from strands.models import BedrockModel

from common.log import log_event
from common.tools import fetch_news, list_saved_quests, save_quests

REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
MODEL_ID = os.environ.get("MODEL_ID", "moonshotai.kimi-k2.5")

BATCH_SYSTEM_PROMPT = """\
あなたは、AWS What's New のニュースをクエストとして保存する定期実行エージェントです。
日本語で、簡潔に処理結果を返します。

依頼された日数のニュースを fetch_news で取得し、list_saved_quests で既存ニュースを確認します。
新しいニュースはすべてクエストにして save_quests で保存してください。件数上限は設けません。
ニュース本文に書かれていることだけを根拠にクエストを作り、画面用のツールは呼びません。
定期実行なので、ユーザーごとの状態は作らず、ニュースマスターだけに保存します。
最後に、取得件数・新規保存件数・既存件数を短く報告してください。
"""


class BatchRequest(BaseModel):
    """1回分のニュース更新依頼。"""

    days: int = Field(default=1, ge=1, le=30)


app = FastAPI(title="AWS News Batch Agent")


def create_agent() -> Agent:
    """リクエストごとに会話状態を持たないAgentを作る。"""
    return Agent(
        model=BedrockModel(
            model_id=MODEL_ID,
            region_name=REGION,
            boto_client_config=BotocoreConfig(
                connect_timeout=30,
                read_timeout=600,
                retries={"mode": "standard", "max_attempts": 2},
            ),
        ),
        system_prompt=BATCH_SYSTEM_PROMPT,
        tools=[fetch_news, list_saved_quests, save_quests],
    )


@app.get("/ping")
async def ping() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/invocations")
async def invoke(payload: BatchRequest) -> dict[str, object]:
    """ニュース更新を1回実行し、通常のJSONで結果を返す。"""
    prompt = (
        f"直近{payload.days}日分のAWSニュースをすべて調べ、"
        "新しいものをクエストとしてニュースマスターに保存してください。"
    )
    try:
        # ユーザー ID は渡さない(ニュースマスターだけに保存する)
        result = await create_agent().invoke_async(prompt)
    except Exception as error:
        log_event("ERROR", "ニュース更新に失敗しました", days=payload.days, errorType=type(error).__name__, err=str(error))
        raise HTTPException(
            status_code=500,
            detail=f"ニュース更新に失敗しました: {type(error).__name__}",
        ) from error
    log_event("INFO", "ニュース更新が完了しました", days=payload.days, stopReason=str(result.stop_reason))

    return {
        "ok": True,
        "stop_reason": str(result.stop_reason),
        "message": str(result.message),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
