"""毎朝、EventBridge Scheduler から呼ばれて、ユーザーごとに、エージェントにクエストの作成を頼む

流れ: Cognito のユーザーを一覧 → ユーザーごとに、AgentCore Runtime のエージェントを呼び出す
      (エージェントが、ニュースを取得して、クエストを作り、DynamoDB に保存する)
AgentCore Runtime の呼び出しは、SigV4 で署名した HTTPS リクエストで行う(Web アプリのサーバーと同じ)。
"""

import datetime
import json
import os
import urllib.parse
import urllib.request
import uuid

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest

RUNTIME_ARN = os.environ["RUNTIME_ARN"]
USER_POOL_ID = os.environ["USER_POOL_ID"]
REGION = RUNTIME_ARN.split(":")[3]

# エージェントへの依頼(定期実行であることを、伝える)
PROMPT = (
    "毎朝の定期実行です。AWS の最新のニュース(直近 {days} 日)から、学ぶ価値の高いものを、最大 {limit} 件、"
    "クエストにして保存してください。すでに保存済みのものは、除いてください。"
    "記憶にある、ユーザーの関心に合うニュースを、優先してください。"
    "画面はないので、reload_quests は呼ばず、保存した件数だけを、短く報告してください。"
)


def list_user_ids() -> list[str]:
    """確認済み(CONFIRMED)のユーザーの sub の一覧"""
    client = boto3.client("cognito-idp", region_name=REGION)
    ids: list[str] = []
    for page in client.get_paginator("list_users").paginate(UserPoolId=USER_POOL_ID):
        for user in page["Users"]:
            if user.get("UserStatus") != "CONFIRMED":
                continue
            attrs = {a["Name"]: a["Value"] for a in user["Attributes"]}
            if "sub" in attrs:
                ids.append(attrs["sub"])
    return ids


def run_agent(user_id: str, days: int, limit: int) -> dict:
    """1 人分の、エージェントの実行。応答(SSE)を最後まで読んで、結果をまとめる"""
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d")
    thread_id = f"daily-quests-{today}-{user_id}"
    body = json.dumps(
        {
            "threadId": thread_id,
            "runId": str(uuid.uuid4()),
            "messages": [
                {
                    "id": str(uuid.uuid4()),
                    "role": "user",
                    "content": PROMPT.format(days=days, limit=limit),
                }
            ],
            "tools": [],
            "context": [],
            "state": {},
            # ユーザー ID と、定期実行であること(記憶に、この会話を残さない)を、エージェントに伝える
            "forwardedProps": {"userId": user_id, "batch": True},
        }
    )
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
            "accept": "text/event-stream",
            # セッション ID は、33 文字以上
            "x-amzn-bedrock-agentcore-runtime-session-id": thread_id.ljust(33, "0")[:256],
        },
    )
    credentials = boto3.Session().get_credentials().get_frozen_credentials()
    SigV4Auth(credentials, "bedrock-agentcore", REGION).add_auth(request)

    http_request = urllib.request.Request(
        url, data=body.encode(), headers=dict(request.headers), method="POST"
    )
    text: list[str] = []
    tools: list[str] = []
    error: str | None = None
    with urllib.request.urlopen(http_request, timeout=600) as response:
        for raw in response:  # SSE: "data: {...}" の行
            line = raw.decode("utf-8", errors="replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                event = json.loads(line[len("data:"):])
            except json.JSONDecodeError:
                continue
            kind = event.get("type")
            if kind == "TEXT_MESSAGE_CONTENT":
                text.append(event.get("delta", ""))
            elif kind == "TOOL_CALL_START":
                tools.append(event.get("toolCallName", ""))
            elif kind == "RUN_ERROR":
                error = event.get("message", "RUN_ERROR")
    return {"user_id": user_id, "tools": tools, "reply": "".join(text), "error": error}


def handler(event, context):
    """event: {"days": 2, "limit": 5, "user_id": "省略すると、全ユーザー"}"""
    event = event or {}
    days = int(event.get("days", 2))
    limit = int(event.get("limit", 5))
    user_ids = [event["user_id"]] if event.get("user_id") else list_user_ids()

    results = []
    for user_id in user_ids:
        try:
            result = run_agent(user_id, days, limit)
        except Exception as error:  # 1 人の失敗で、ほかのユーザーを止めない
            result = {"user_id": user_id, "error": f"{type(error).__name__}: {error}"}
        print(json.dumps(result, ensure_ascii=False))
        results.append(result)

    failed = [r for r in results if r.get("error")]
    if failed:
        # 失敗を、実行の失敗として記録する(CloudWatch のエラーとして見える)
        raise RuntimeError(f"{len(failed)} / {len(results)} 人の実行に失敗しました")
    return {"users": len(results)}
