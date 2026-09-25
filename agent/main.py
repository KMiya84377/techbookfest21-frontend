import os

from ag_ui_strands import StrandsAgent, create_strands_app
from strands import Agent
from strands.models import BedrockModel

REGION = os.environ.get("AWS_REGION", "ap-northeast-1")
MODEL_ID = os.environ.get("MODEL_ID", "jp.anthropic.claude-sonnet-4-6")

strands_agent = Agent(
    model=BedrockModel(model_id=MODEL_ID, region_name=REGION),
    system_prompt="あなたは親切なアシスタントです。日本語で簡潔に答えてください。",
)

# AG-UI のプロトコルに対応させる
agui_agent = StrandsAgent(
    agent=strands_agent,
    name="assistant",
    description="A helpful assistant",
)

# AgentCore Runtime の契約: ポート 8080 の /invocations(AG-UI)と /ping(ヘルスチェック)
app = create_strands_app(
    agui_agent,
    path="/invocations",
    ping_path="/ping",
    cors_enabled=False,
)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
