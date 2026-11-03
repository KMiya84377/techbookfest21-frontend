"""週間レポートの数値を、ツールの中のコードで集計する

LLM に数えさせたり割り算させたりすると間違えるため、集計はここで行い、
エージェント(LLM)は、返った値を、どのカードやグラフで見せるかを決めるだけにする。
"""

from __future__ import annotations

import json
import os
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from strands import ToolContext, tool

# 日付の区切りは、日本時間にする(サンプルアプリの利用者を、日本のユーザーと想定する)
JST = timezone(timedelta(hours=9))
DEFAULT_DAYS = 7
MAX_DAYS = 30
# userQuests テーブルには、クエストの状態のほかに、関連分析などの記録も入る(newsId が __ で始まる)
SYSTEM_RECORD_PREFIX = "__"


def _parse(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def compute_weekly_stats(
    records: list[dict[str, Any]], now: datetime, days: int = DEFAULT_DAYS
) -> dict[str, Any]:
    """ユーザーのクエストの記録から、直近 days 日(今日を含む)の学習の数値を集計する

    - 閲覧したニュース数: 対象期間に、初めて詳細を開いたクエストの数
    - クリアしたクエスト数: 対象期間に、初めてクリアしたクエストの数
    - 理解度チェックの回答数と初回正解率: 対象期間の、初回の回答(再回答は含めない)
    - 日別の学習量: 各日に、閲覧またはクリアしたクエストの数(同じクエストは 1 つと数える)
    firstViewedAt のない古い記録は、updatedAt を、初めて開いた日時の代わりにする
    """
    days = min(max(int(days), 1), MAX_DAYS)
    today = now.astimezone(JST).date()
    first_day = today - timedelta(days=days - 1)

    def day_of(moment: datetime | None):
        if moment is None:
            return None
        day = moment.astimezone(JST).date()
        return day if first_day <= day <= today else None

    quests_by_day: dict = defaultdict(set)
    viewed: set[str] = set()
    cleared: set[str] = set()
    answers_correct = 0
    answers_total = 0

    for record in records:
        news_id = record.get("newsId")
        if not isinstance(news_id, str) or news_id.startswith(SYSTEM_RECORD_PREFIX):
            continue
        status = record.get("status")
        if status in ("viewed", "cleared"):
            moment = _parse(record.get("firstViewedAt")) or _parse(record.get("updatedAt"))
            day = day_of(moment)
            if day:
                viewed.add(news_id)
                quests_by_day[day].add(news_id)
        if status == "cleared":
            day = day_of(_parse(record.get("learnedAt")) or _parse(record.get("updatedAt")))
            if day:
                cleared.add(news_id)
                quests_by_day[day].add(news_id)
        for answer in record.get("quizAnswers") or []:
            if not isinstance(answer, dict) or day_of(_parse(answer.get("answeredAt"))) is None:
                continue
            answers_total += 1
            if answer.get("correct") is True:
                answers_correct += 1

    daily = []
    for offset in range(days):
        day = first_day + timedelta(days=offset)
        daily.append(
            {
                "date": day.isoformat(),
                "label": f"{day.month}/{day.day}",
                "count": len(quests_by_day.get(day, ())),
            }
        )

    return {
        "period": {"start": first_day.isoformat(), "end": today.isoformat(), "days": days},
        "viewed_news": len(viewed),
        "cleared_quests": len(cleared),
        "quiz_answers": answers_total,
        # 回答が 0 件のときは、算出しない(None)。0% と区別して、「未回答」と伝える
        "first_try_accuracy_percent": (
            round(answers_correct / answers_total * 100, 1) if answers_total else None
        ),
        "daily": daily,
    }


def _user_quest_table():
    return boto3.resource(
        "dynamodb", region_name=os.environ.get("AWS_REGION", "ap-northeast-1")
    ).Table(os.environ["USER_QUEST_TABLE"])


def _fetch_records(tool_context: ToolContext, user_id: str) -> list[dict[str, Any]]:
    """ユーザー自身のクエストの記録を読む(AWS は DynamoDB から、ローカルは Web アプリ経由で)"""
    if os.environ.get("BLOCKS_WEB_URL"):
        url = os.environ["BLOCKS_WEB_URL"].rstrip("/") + "/api/agent-learning-records"
        cookie = tool_context.invocation_state.get("local_auth_cookie", "")
        request = urllib.request.Request(url, headers={"Cookie": cookie})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)["records"]

    table = _user_quest_table()
    records: list[dict[str, Any]] = []
    kwargs: dict[str, Any] = {
        "KeyConditionExpression": Key("userId").eq(user_id),
        "ProjectionExpression": "newsId, #s, firstViewedAt, learnedAt, updatedAt, quizAnswers",
        "ExpressionAttributeNames": {"#s": "status"},
    }
    while True:
        page = table.query(**kwargs)
        records.extend(page.get("Items", []))
        if "LastEvaluatedKey" not in page:
            return records
        kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]


@tool(context=True)
def get_weekly_stats(tool_context: ToolContext, days: int = DEFAULT_DAYS) -> dict:
    """ログイン中のユーザーの、直近の学習状況を集計して返す(週間レポート用)

    数値は、このツールが数えた値を、そのまま使う。自分で足したり割ったりしない。

    Args:
        days: 何日分を集計するか(1〜30。既定は 7。今日を含む)

    Returns:
        period(開始日・終了日・日数)、viewed_news(閲覧したニュース数)、cleared_quests(クリアしたクエスト数)、
        quiz_answers(理解度チェックの回答数)、first_try_accuracy_percent(初回正解率。回答 0 件なら null)、
        daily(日別の学習量。date、label、count)
    """
    user_id = tool_context.invocation_state.get("user_id")
    if not user_id:
        return {"error": "ログインしているユーザーを特定できないため、集計できません"}
    try:
        records = _fetch_records(tool_context, user_id)
    except Exception as error:  # ツールの失敗は、エージェントに伝えて、会話を続ける
        return {"error": f"学習の記録を読み込めませんでした: {type(error).__name__}"}
    return compute_weekly_stats(records, datetime.now(timezone.utc), days)
