"""ローカル開発で、Webアプリの保存APIを呼び出す。AWS上では使わない。"""

import json
import os
import urllib.request

from strands import ToolContext


def _local_blocks_request(method: str, tool_context: ToolContext, items=None):
    """ローカルのBlocks保存へ中継する。認証Cookieはモデル入力へ含めない。"""
    url = os.environ["BLOCKS_WEB_URL"].rstrip("/") + "/api/agent-news"
    cookie = tool_context.invocation_state.get("local_auth_cookie", "")
    request = urllib.request.Request(
        url,
        method=method,
        data=json.dumps(items).encode("utf-8") if items is not None else None,
        headers={"Content-Type": "application/json", "Cookie": cookie},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)
