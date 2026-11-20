"""毎朝、EventBridge Scheduler から呼ばれて、共通ニュースを更新する

流れ: AgentCore Runtime のエージェントを 1 回呼び出す
      (エージェントが、ニュースを取得し、クエスト情報を News に保存する)
AgentCore Runtime の呼び出しは、SigV4 で署名した HTTPS リクエストで行う。
"""

import json
import os
import urllib.parse
import urllib.request
import uuid

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

RUNTIME_ARN = os.environ["RUNTIME_ARN"]
REGION = RUNTIME_ARN.split(":")[3]

def run_agent(days: int) -> dict:
    """HTTP Runtimeを1回呼び出し、JSONの結果を受け取る。"""
    execution_id = f"daily-quests-{uuid.uuid4()}"
    body = json.dumps({"days": days})
    url = (
        f"https://bedrock-agentcore.{REGION}.amazonaws.com"
        f"/runtimes/{urllib.parse.quote(RUNTIME_ARN, safe='')}/invocations?qualifier=DEFAULT"
    )
    request = AWSRequest(
        method="POST",
        url=url,
        data=body,
        headers={
            "content-type": "application/json",
            "accept": "application/json",
            # HTTP Runtimeのセッションは、会話ではなく1回のバッチ実行に割り当てる。
            "x-amzn-bedrock-agentcore-runtime-session-id": execution_id,
        },
    )
    credentials = boto3.Session().get_credentials().get_frozen_credentials()
    SigV4Auth(credentials, "bedrock-agentcore", REGION).add_auth(request)

    http_request = urllib.request.Request(
        url, data=body.encode(), headers=dict(request.headers), method="POST"
    )
    with urllib.request.urlopen(http_request, timeout=600) as response:
        result = json.loads(response.read().decode("utf-8"))
    if not isinstance(result, dict):
        raise RuntimeError("HTTP Runtimeの応答がJSONオブジェクトではありません")
    return result


def handler(event, context):
    """event: {"days": 1}(省略すると 1 日分)"""
    event = event or {}
    days = int(event.get("days", 1))
    try:
        result = run_agent(days)
    except Exception as error:
        result = {"error": f"{type(error).__name__}: {error}"}
    print(json.dumps(result, ensure_ascii=False))
    if result.get("ok") is not True:
        raise RuntimeError("共通ニュースの更新に失敗しました")
    return {"runs": 1}
