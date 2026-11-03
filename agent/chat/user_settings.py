"""ユーザーが明示した学習設定を、検証してからプロンプトに入れる"""

from __future__ import annotations

import json
from typing import Any

_TOPICS = {
    "ai_ml",
    "compute",
    "containers",
    "database",
    "networking",
    "security",
    "storage",
    "serverless",
}
_TOPIC_LABELS = {
    "ai_ml": "AI・機械学習",
    "compute": "コンピューティング",
    "containers": "コンテナ",
    "database": "データベース",
    "networking": "ネットワーク",
    "security": "セキュリティ",
    "storage": "ストレージ",
    "serverless": "サーバーレス",
}
_DIFFICULTIES = {"beginner", "intermediate", "advanced"}
_ANSWER_DETAILS = {"concise", "standard", "detailed"}


def user_settings_context(state: dict[str, Any]) -> str | None:
    """許可した値だけの、小さなプロンプトのブロックを返す。不正な状態なら None(使わない)"""
    settings = state.get("userSettings")
    if not isinstance(settings, dict):
        return None

    topics = settings.get("learningTopics")
    difficulty = settings.get("difficulty")
    answer_detail = settings.get("answerDetail")
    if (
        not isinstance(topics, list)
        or len(topics) > len(_TOPICS)
        or any(not isinstance(topic, str) or topic not in _TOPICS for topic in topics)
        or len(set(topics)) != len(topics)
        or not isinstance(difficulty, str)
        or difficulty not in _DIFFICULTIES
        or not isinstance(answer_detail, str)
        or answer_detail not in _ANSWER_DETAILS
    ):
        return None

    safe_settings = {
        "learningTopics": [_TOPIC_LABELS[topic] for topic in topics],
        "difficulty": difficulty,
        "answerDetail": answer_detail,
    }
    return (
        "<user_learning_settings>\n"
        f"{json.dumps(safe_settings, ensure_ascii=False, separators=(',', ':'))}\n"
        "</user_learning_settings>"
    )
