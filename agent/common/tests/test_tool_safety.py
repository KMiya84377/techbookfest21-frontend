import io
import json
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

from common.tools import MAX_LIST_LIMIT, _save_failed, list_saved_quests


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
        with patch("common.tools._news_table") as table:
            table.return_value.query.return_value = {"Items": []}
            list_saved_quests._tool_func(tool_context=None, limit=10_000)
            list_saved_quests._tool_func(tool_context=None, limit=-5)

        limits = [call.kwargs["Limit"] for call in table.return_value.query.call_args_list]
        self.assertEqual(limits, [MAX_LIST_LIMIT, 1])


if __name__ == "__main__":
    unittest.main()
