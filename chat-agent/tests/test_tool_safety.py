import io
import json
import os
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch

from chat.tools import MAX_LIST_LIMIT, _save_failed, list_saved_quests, save_quests

QUEST = {
    "id": "news-a",
    "title": "タイトル",
    "services": ["Amazon EC2"],
    "summary": "要約",
    "importance": "medium",
    "minutes": 5,
    "published_at": "2026-11-19T00:00:00Z",
    "source_label": "AWS What's New",
    "source_url": "https://aws.amazon.com/new/",
    "changes": ["変更"],
    "before": "これまで",
    "after": "更新後",
    "impact_changes": "変わる",
    "impact_unchanged": "変わらない",
    "impact_check": "要検証",
    "checks": ["確認"],
}


class ToolSafetyTests(unittest.TestCase):
    def test_save_failure_hides_exception_text_from_the_model(self):
        out = io.StringIO()
        with redirect_stdout(out):
            result = _save_failed("保存に失敗しました", "news-a", RuntimeError("table secret-name"), ["x"])

        self.assertNotIn("secret-name", json.dumps(result, ensure_ascii=False))
        self.assertEqual(result["saved"], ["x"])
        # 詳細は、ログに残る
        self.assertEqual(json.loads(out.getvalue())["err"], "table secret-name")

    def test_list_limit_is_capped(self):
        with patch("chat.tools._news_table") as table:
            table.return_value.query.return_value = {"Items": []}
            list_saved_quests._tool_func(tool_context=None, limit=10_000)
            list_saved_quests._tool_func(tool_context=None, limit=-5)

        limits = [call.kwargs["Limit"] for call in table.return_value.query.call_args_list]
        self.assertEqual(limits, [MAX_LIST_LIMIT, 1])

    def test_user_record_has_version_for_conditional_writes(self):
        # Web アプリは version を条件に書き戻すので、作る記録には必ず version を入れる
        context = SimpleNamespace(invocation_state={"user_id": "user-1"})
        with (
            patch.dict(os.environ, {"BLOCKS_WEB_URL": ""}),
            patch("chat.tools._news_table"),
            patch("chat.tools.user_quest_table") as table,
            redirect_stdout(io.StringIO()),
        ):
            result = save_quests._tool_func(quests=[QUEST], tool_context=context)

        item = table.return_value.put_item.call_args.kwargs["Item"]
        self.assertEqual(item, {"userId": "user-1", "newsId": "news-a", "status": "todo", "version": 1})
        self.assertEqual(result["assigned"], ["news-a"])


if __name__ == "__main__":
    unittest.main()
