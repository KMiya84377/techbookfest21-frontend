import html
import os
import re
import traceback
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Literal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from pydantic import BaseModel, Field
from strands import ToolContext, tool

# AWS の最新情報(What's New)の RSS
FEED_URL = "https://aws.amazon.com/about-aws/whats-new/recent/feed/"
# 本文は、長いので、切り詰める(エージェントに渡す量を抑える)
TEXT_LIMIT = 700


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
def fetch_news(days: int = 7, keyword: str = "", limit: int = 20) -> list[dict]:
    """AWS の最新情報(What's New の RSS)を取得する。

    Args:
        days: 何日前までのニュースを対象にするか(RSS には、直近 1 週間ほどしかない)
        keyword: 指定すると、タイトル、本文、サービス名に、この文字列(英語。大文字小文字は区別しない)を含むものだけを返す
        limit: 返す件数の上限(新しい順)

    Returns:
        ニュースの一覧。id は、save_quests の id に、そのまま使う
    """
    request = urllib.request.Request(FEED_URL, headers={"User-Agent": "quest-agent/0.1"})
    with urllib.request.urlopen(request, timeout=20) as response:
        root = ET.fromstring(response.read())

    since = datetime.now(timezone.utc) - timedelta(days=days)
    wanted = keyword.lower()
    news: list[dict] = []
    for item in root.iter("item"):
        published = parsedate_to_datetime(item.findtext("pubDate", default=""))
        if published < since:
            continue
        categories = [c.text or "" for c in item.findall("category")]
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
    news.sort(key=lambda n: n["published_at"], reverse=True)
    return news[:limit]


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


def _quest_table():
    return boto3.resource(
        "dynamodb", region_name=os.environ.get("AWS_REGION", "ap-northeast-1")
    ).Table(os.environ["QUEST_TABLE"])


@tool(context=True)
def save_quests(quests: list[QuestInput], tool_context: ToolContext) -> dict:
    """クエストを、ユーザーのクエストとして、DynamoDB に保存する。すでにあるクエスト(同じニュース)は、保存しない。

    保存したら、続けて reload_quests を呼んで、画面のクエストボードを更新すること。

    Args:
        quests: 保存するクエスト
    """
    user_id = tool_context.invocation_state.get("user_id")
    print(f"save_quests: user_id={'あり' if user_id else 'なし'}, 件数={len(quests)}", flush=True)
    if not user_id:
        return {"error": "ユーザーが特定できないため、保存できません"}

    table = _quest_table()
    saved: list[str] = []
    skipped: list[str] = []
    for raw in quests:
        # ツールの引数は、辞書で渡されることがある
        q = raw if isinstance(raw, QuestInput) else QuestInput.model_validate(raw)
        item = {
            "userId": user_id,
            # 「公開日時#ニュースの id」。新しい順に取れる(画面の API と同じ形)
            "questId": f"{q.published_at}#{q.id}",
            "title": q.title,
            "services": q.services,
            "summary": q.summary,
            "importance": q.importance,
            "minutes": q.minutes,
            "status": "todo",
            "publishedAt": q.published_at,
            "source": {"label": q.source_label, "url": q.source_url},
            "changes": q.changes,
            "before": q.before,
            "after": q.after,
            "impact": {
                "changes": q.impact_changes,
                "unchanged": q.impact_unchanged,
                "check": q.impact_check,
            },
            "checks": q.checks,
        }
        try:
            # 同じクエストは、上書きしない(重要度などが、毎回変わらないようにする)
            table.put_item(Item=item, ConditionExpression="attribute_not_exists(questId)")
            saved.append(q.id)
        except ClientError as error:
            if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
                skipped.append(q.id)
                continue
            traceback.print_exc()
            return {"error": f"保存に失敗しました({q.id}): {error}", "saved": saved}
        except Exception as error:  # 想定外の形のデータなど
            traceback.print_exc()
            return {"error": f"保存に失敗しました({q.id}): {type(error).__name__}: {error}", "saved": saved}
    return {"saved": saved, "skipped_existing": skipped}


@tool(context=True)
def list_saved_quests(tool_context: ToolContext, limit: int = 50) -> list[dict]:
    """保存済みのクエスト(新しい順)の、id、タイトル、公開日時を返す。

    新しいクエストを作る前に、同じニュースを、重複して作らないよう、確認するために呼ぶ。

    Args:
        limit: 返す件数の上限
    """
    user_id = tool_context.invocation_state.get("user_id")
    if not user_id:
        return []
    result = _quest_table().query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False,
        Limit=limit,
        ProjectionExpression="questId, title, publishedAt",
    )
    return [
        {
            "id": item["questId"].split("#", 1)[1],
            "title": item["title"],
            "published_at": item["publishedAt"],
        }
        for item in result.get("Items", [])
    ]
