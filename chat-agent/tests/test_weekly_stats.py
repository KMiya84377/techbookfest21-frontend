import unittest
from datetime import datetime, timezone

from chat.weekly_stats import compute_weekly_stats

# 2026-11-04 12:00(日本時間)
NOW = datetime(2026, 11, 4, 3, 0, tzinfo=timezone.utc)


def record(news_id, status="viewed", **fields):
    return {"newsId": news_id, "status": status, **fields}


class ComputeWeeklyStatsTests(unittest.TestCase):
    def test_counts_views_clears_and_daily_volume_in_the_period(self):
        records = [
            record("a", "cleared", firstViewedAt="2026-11-02T01:00:00+00:00", learnedAt="2026-11-03T01:00:00+00:00"),
            record("b", "viewed", firstViewedAt="2026-11-03T05:00:00+00:00"),
            record("c", "viewed", firstViewedAt="2026-10-20T05:00:00+00:00"),  # 期間外
        ]
        stats = compute_weekly_stats(records, NOW, days=7)
        self.assertEqual(stats["viewed_news"], 2)
        self.assertEqual(stats["cleared_quests"], 1)
        daily = {day["date"]: day["count"] for day in stats["daily"]}
        self.assertEqual(daily["2026-11-02"], 1)  # a を閲覧
        self.assertEqual(daily["2026-11-03"], 2)  # a をクリア、b を閲覧
        self.assertEqual(len(stats["daily"]), 7)
        self.assertEqual(stats["daily"][-1]["date"], "2026-11-04")
        self.assertEqual(stats["period"], {"start": "2026-10-29", "end": "2026-11-04", "days": 7})

    def test_same_quest_viewed_and_cleared_on_one_day_counts_once(self):
        records = [
            record("a", "cleared", firstViewedAt="2026-11-03T01:00:00+00:00", learnedAt="2026-11-03T02:00:00+00:00")
        ]
        daily = {day["date"]: day["count"] for day in compute_weekly_stats(records, NOW)["daily"]}
        self.assertEqual(daily["2026-11-03"], 1)

    def test_first_try_accuracy_uses_only_answers_in_the_period(self):
        records = [
            record(
                "a",
                quizAnswers=[
                    {"answeredAt": "2026-11-03T01:00:00+00:00", "correct": True},
                    {"answeredAt": "2026-11-03T02:00:00+00:00", "correct": False},
                    {"answeredAt": "2026-10-01T02:00:00+00:00", "correct": False},  # 期間外
                ],
            ),
            record("b", quizAnswers=[{"answeredAt": "2026-11-04T01:00:00+00:00", "correct": True}]),
        ]
        stats = compute_weekly_stats(records, NOW)
        self.assertEqual(stats["quiz_answers"], 3)
        self.assertEqual(stats["first_try_accuracy_percent"], 66.7)

    def test_accuracy_is_none_without_answers(self):
        stats = compute_weekly_stats([record("a", firstViewedAt="2026-11-03T01:00:00+00:00")], NOW)
        self.assertEqual(stats["quiz_answers"], 0)
        self.assertIsNone(stats["first_try_accuracy_percent"])

    def test_days_are_split_by_japan_time(self):
        # UTC では 11/3 の 16:00 でも、日本時間では 11/4 の 01:00
        records = [record("a", firstViewedAt="2026-11-03T16:00:00+00:00")]
        daily = {day["date"]: day["count"] for day in compute_weekly_stats(records, NOW)["daily"]}
        self.assertEqual(daily["2026-11-04"], 1)
        self.assertEqual(daily["2026-11-03"], 0)

    def test_old_records_without_first_viewed_at_use_updated_at(self):
        records = [record("a", "viewed", updatedAt="2026-11-02T01:00:00+00:00")]
        self.assertEqual(compute_weekly_stats(records, NOW)["viewed_news"], 1)

    def test_ignores_todo_and_system_records(self):
        records = [
            record("a", "todo", updatedAt="2026-11-03T01:00:00+00:00"),
            record("__learning_insight__#10#0000000003", "viewed", updatedAt="2026-11-03T01:00:00+00:00"),
        ]
        stats = compute_weekly_stats(records, NOW)
        self.assertEqual(stats["viewed_news"], 0)
        self.assertEqual(sum(day["count"] for day in stats["daily"]), 0)

    def test_days_are_clamped(self):
        self.assertEqual(len(compute_weekly_stats([], NOW, days=0)["daily"]), 1)
        self.assertEqual(len(compute_weekly_stats([], NOW, days=999)["daily"]), 30)


if __name__ == "__main__":
    unittest.main()


class GetWeeklyStatsToolTests(unittest.TestCase):
    class _Context:
        def __init__(self, state):
            self.invocation_state = state

    def test_returns_error_without_user_id(self):
        from chat.weekly_stats import get_weekly_stats

        result = get_weekly_stats(self._Context({}))
        self.assertIn("error", result)

    def test_reads_records_of_the_signed_in_user_and_aggregates(self):
        from unittest import mock

        from chat import weekly_stats

        seen = {}

        def fake_fetch(tool_context, user_id):
            seen["user_id"] = user_id
            return [record("a", firstViewedAt=datetime.now(timezone.utc).isoformat())]

        with mock.patch.object(weekly_stats, "_fetch_records", fake_fetch):
            result = weekly_stats.get_weekly_stats(self._Context({"user_id": "u-1"}), days=3)
        self.assertEqual(seen["user_id"], "u-1")
        self.assertEqual(result["viewed_news"], 1)
        self.assertEqual(len(result["daily"]), 3)

    def test_returns_error_when_reading_fails(self):
        from unittest import mock

        from chat import weekly_stats

        with mock.patch.object(weekly_stats, "_fetch_records", side_effect=RuntimeError("boom")):
            result = weekly_stats.get_weekly_stats(self._Context({"user_id": "u-1"}))
        self.assertIn("error", result)
        self.assertNotIn("boom", result["error"])
