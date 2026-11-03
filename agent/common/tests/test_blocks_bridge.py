import io
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from common.tools import _local_blocks_request, _news_item


class BlocksBridgeTests(unittest.TestCase):
    def test_local_cookie_is_a_header_not_model_or_news_data(self):
        result = io.BytesIO(json.dumps({"saved": ["news-a"]}).encode())
        context = SimpleNamespace(invocation_state={"local_auth_cookie": "local-session=test"})
        with patch.dict(os.environ, {"BLOCKS_WEB_URL": "http://localhost:4321"}), patch("urllib.request.urlopen", return_value=result) as request:
            self.assertEqual(_local_blocks_request("POST", context, [{"newsId": "news-a"}]), {"saved": ["news-a"]})
        sent = request.call_args.args[0]
        self.assertEqual(sent.full_url, "http://localhost:4321/api/agent-news")
        self.assertEqual(sent.get_header("Cookie"), "local-session=test")
        self.assertEqual(json.loads(sent.data), [{"newsId": "news-a"}])

    def test_both_storage_paths_share_the_news_format(self):
        item = _news_item({
            "id": "news-a", "title": "ニュース", "services": ["Amazon Bedrock"],
            "summary": "更新内容", "importance": "high", "minutes": 5,
            "published_at": "2026-10-31T00:00:00Z", "source_label": "AWS", "source_url": "https://aws.amazon.com/",
            "changes": ["変更"], "before": "前", "after": "後", "impact_changes": "影響", "impact_unchanged": "変更なし",
            "impact_check": "確認", "checks": ["確認事項"],
        })
        self.assertEqual(item["newsId"], "news-a")
        self.assertEqual(item["feed"], "aws-whats-new")
        self.assertEqual(item["publishedAt"], "2026-10-31T00:00:00Z")
        self.assertNotIn("userId", item)
        self.assertNotIn("local_auth_cookie", item)


if __name__ == "__main__":
    unittest.main()
