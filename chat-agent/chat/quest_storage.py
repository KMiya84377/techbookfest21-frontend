"""クエストの保存形式と、News・UserQuestへの読み書き。"""

import os
from typing import Literal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from pydantic import BaseModel, Field
from strands import ToolContext, tool

from chat.local_bridge import _local_blocks_request
from chat.log import log_event
from chat.news_source import NEWS_FEED

# モデルが大きな件数を渡しても、読み出し件数を抑える。
MAX_LIST_LIMIT = 200


class QuestInput(BaseModel):
    """保存する 1 件のクエスト(1 件のニュースに対応する)"""

    id: str = Field(description="ニュースの id(fetch_news の id をそのまま使う)")
    title: str = Field(description="クエストのタイトル(日本語。ニュースの内容がわかる短い題)")
    services: list[str] = Field(description="対象の AWS サービス名(例: Amazon EC2)")
    summary: str = Field(description="要約(日本語で 2 文まで。ニュースに書かれていることだけ)")
    importance: Literal["high", "medium", "low"] = Field(
        description="重要度。多くの利用者の構成、料金、仕様に影響するなら high、一部の利用者なら medium、限られた場合なら low"
    )
    minutes: int = Field(description="想定学習時間(分。3〜10)")
    published_at: str = Field(description="ニュースの公開日時(fetch_news の published_at をそのまま使う)")
    source_label: str = Field(description="元情報の名前(例: AWS What's New)")
    source_url: str = Field(description="元情報の URL(fetch_news の link をそのまま使う)")
    changes: list[str] = Field(description="何が変わったか(2〜3 個。ニュースの事実だけ)")
    before: str = Field(description="従来との違い: これまで(ニュースから読み取れる範囲で)")
    after: str = Field(description="従来との違い: 更新後")
    impact_changes: str = Field(description="ユーザーへの影響: 変わること")
    impact_unchanged: str = Field(description="ユーザーへの影響: 変わらないこと")
    impact_check: str = Field(description="ユーザーへの影響: 要検証のこと")
    checks: list[str] = Field(description="確認すべき事項(1〜3 個)")


def _dynamodb():
    return boto3.resource(
        "dynamodb", region_name=os.environ.get("AWS_REGION", "ap-northeast-1")
    )


def _news_table():
    return _dynamodb().Table(os.environ["NEWS_TABLE"])


# ユーザーごとの状態のテーブル(weekly_stats.py も使う)
def user_quest_table():
    return _dynamodb().Table(os.environ["USER_QUEST_TABLE"])


def _news_item(raw) -> dict:
    quest = raw if isinstance(raw, QuestInput) else QuestInput.model_validate(raw)
    return {
        "newsId": quest.id,
        "feed": NEWS_FEED,
        "title": quest.title,
        "services": quest.services,
        "summary": quest.summary,
        "importance": quest.importance,
        "minutes": quest.minutes,
        "status": "todo",
        "publishedAt": quest.published_at,
        "source": {"label": quest.source_label, "url": quest.source_url},
        "changes": quest.changes,
        "before": quest.before,
        "after": quest.after,
        "impact": {
            "changes": quest.impact_changes,
            "unchanged": quest.impact_unchanged,
            "check": quest.impact_check,
        },
        "checks": quest.checks,
    }


def _save_failed(message: str, quest_id: str, error: Exception, saved: list[str]) -> dict:
    """詳細(例外の本文)はログだけに残し、モデルには、種類だけを返す"""
    log_event("ERROR", message, questId=quest_id, errorType=type(error).__name__, err=str(error))
    return {"error": f"{message}({quest_id}): {type(error).__name__}", "saved": saved}


@tool(context=True)
def save_quests(quests: list[QuestInput], tool_context: ToolContext) -> dict:
    """クエストの共通情報を News に保存し、必要ならユーザーの状態を UserQuest に作る。

    ニュース本文とクエストの説明はユーザー間で共有する。ユーザー ID がある場合だけ、
    そのユーザーの未着手状態を作る。すでにあるニュースは上書きしない。

    Web アプリからの呼び出しでは、保存後に AG-UI Shared State の更新要求が画面へ通知される。
    画面はその要求を受けて、この API からクエスト一覧を再取得する。

    Args:
        quests: 保存するクエスト
    """
    user_id = tool_context.invocation_state.get("user_id")
    log_event("INFO", "save_quests", hasUserId=bool(user_id), count=len(quests))

    if os.environ.get("BLOCKS_WEB_URL"):
        return _local_blocks_request("POST", tool_context, [_news_item(raw) for raw in quests])

    news_table = _news_table()
    saved: list[str] = []
    assigned: list[str] = []
    skipped: list[str] = []
    for raw in quests:
        # ツールの引数は、辞書で渡されることがある
        quest = raw if isinstance(raw, QuestInput) else QuestInput.model_validate(raw)
        item = _news_item(quest)
        try:
            # 同じクエストは、上書きしない(重要度などが、毎回変わらないようにする)
            news_table.put_item(Item=item, ConditionExpression="attribute_not_exists(newsId)")
            saved.append(quest.id)
        except ClientError as error:
            if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                skipped.append(quest.id)
            else:
                return _save_failed("保存に失敗しました", quest.id, error, saved)
        except Exception as error:  # 想定外の形のデータなど
            return _save_failed("保存に失敗しました", quest.id, error, saved)

        if user_id:
            try:
                # version は、Web アプリの条件付き書き込み(webapp/src/pages/api/_server/blocks/userQuestRecords.ts)が使う
                user_quest_table().put_item(
                    Item={"userId": user_id, "newsId": quest.id, "status": "todo", "version": 1},
                    ConditionExpression="attribute_not_exists(userId) AND attribute_not_exists(newsId)",
                )
            except ClientError as error:
                if error.response["Error"]["Code"] != "ConditionalCheckFailedException":
                    return _save_failed("ユーザー状態の保存に失敗しました", quest.id, error, saved)
            except Exception as error:
                return _save_failed("ユーザー状態の保存に失敗しました", quest.id, error, saved)
            assigned.append(quest.id)
    return {"saved": saved, "assigned": assigned, "skipped_existing": skipped}


@tool(context=True)
def list_saved_quests(tool_context: ToolContext, limit: int = 50) -> list[dict]:
    """ニュースマスターに保存済みのクエスト(新しい順)の、id、タイトル、公開日時を返す。

    新しいクエストを作る前に、ユーザーをまたいで同じニュースを重複生成しないよう確認する。

    Args:
        limit: 返す件数の上限(1〜200)
    """
    limit = min(max(limit, 1), MAX_LIST_LIMIT)
    if os.environ.get("BLOCKS_WEB_URL"):
        return _local_blocks_request("GET", tool_context)["quests"][:limit]
    result = _news_table().query(
        IndexName="ByFeedPublishedAt",
        KeyConditionExpression=Key("feed").eq(NEWS_FEED),
        ScanIndexForward=False,
        Limit=limit,
        ProjectionExpression="newsId, title, publishedAt",
    )
    return [
        {
            "id": item["newsId"],
            "title": item["title"],
            "published_at": item["publishedAt"],
        }
        for item in result.get("Items", [])
    ]
