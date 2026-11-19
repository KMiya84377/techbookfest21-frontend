import html
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Literal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from pydantic import BaseModel, Field
from strands import tool

from batch.log import log_event

# AWS の最新情報(What's New)の RSS
FEED_URL = "https://aws.amazon.com/about-aws/whats-new/recent/feed/"
# 本文は、長いので、切り詰める(エージェントに渡す量を抑える)
TEXT_LIMIT = 700
NEWS_FEED = "aws-whats-new"
# fetch_news の期間と、list_saved_quests の件数の上限(モデルが大きな値を渡しても、抑える)
MAX_DAYS = 30
MAX_LIST_LIMIT = 200


def _plain_text(markup: str) -> str:
    """HTML のタグを取り除いて、空白を整える"""
    text = re.sub(r"<[^>]+>", " ", markup or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _services_of(categories: list[str]) -> list[str]:
    """category(例: general:products/amazon-ec2,marketing:marchitecture/compute)から、サービス名(amazon-ec2)を取り出す

    1 つの category に、カンマ区切りで、複数の値が入っている
    """
    services: list[str] = []
    for category in categories:
        for value in category.split(","):
            if "products/" in value:
                services.append(value.split("products/", 1)[1].strip())
    return services


@tool
def fetch_news(days: int = 1, keyword: str = "") -> list[dict]:
    """AWS の最新情報(What's New の RSS)を取得する。

    Args:
        days: 何日前までのニュースを対象にするか(1〜30。RSS には、直近 1 週間ほどしかない)
        keyword: 指定すると、タイトル、本文、サービス名に、この文字列(英語。大文字小文字は区別しない)を含むものだけを返す

    Returns:
        ニュースの一覧。id は、save_quests の id に、そのまま使う
    """
    days = min(max(days, 1), MAX_DAYS)
    request = urllib.request.Request(FEED_URL, headers={"User-Agent": "quest-agent/0.1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        root = ET.fromstring(response.read())

    since = datetime.now(timezone.utc) - timedelta(days=days)
    wanted = keyword.lower()
    news: list[dict] = []
    for item in root.iter("item"):
        try:
            published = parsedate_to_datetime(item.findtext("pubDate", default=""))
        except (TypeError, ValueError):
            # 公開日時のない・壊れた項目は、期間で絞れないので飛ばす(1 件のために、取得全体を失敗させない)
            continue
        if published < since:
            continue
        categories = [category.text or "" for category in item.findall("category")]
        title = _plain_text(item.findtext("title", default=""))
        text = _plain_text(item.findtext("description", default=""))
        services = _services_of(categories)
        if wanted and wanted not in " ".join([title, text, *services]).lower():
            continue
        news.append(
            {
                "id": (item.findtext("guid", default="") or "")[:12],
                "title": title,
                "published_at": published.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                "services": services,
                "link": item.findtext("link", default=""),
                "text": text[:TEXT_LIMIT],
            }
        )
    news.sort(key=lambda entry: entry["published_at"], reverse=True)
    return news


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


@tool
def save_quests(quests: list[QuestInput]) -> dict:
    """クエストの共通情報を News(ニュースマスター)に保存する。すでにあるニュースは上書きしない。

    定期実行なので、ユーザーごとの状態は作らない(ユーザーが詳細を開いたときに、Web アプリが作る)。

    Args:
        quests: 保存するクエスト
    """
    log_event("INFO", "save_quests", count=len(quests))

    news_table = _news_table()
    saved: list[str] = []
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
    return {"saved": saved, "skipped_existing": skipped}


@tool
def list_saved_quests(limit: int = 50) -> list[dict]:
    """ニュースマスターに保存済みのクエスト(新しい順)の、id、タイトル、公開日時を返す。

    新しいクエストを作る前に、ユーザーをまたいで同じニュースを重複生成しないよう確認する。

    Args:
        limit: 返す件数の上限(1〜200)
    """
    limit = min(max(limit, 1), MAX_LIST_LIMIT)
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
