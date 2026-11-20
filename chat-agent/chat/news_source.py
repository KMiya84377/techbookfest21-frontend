"""AWS What's New のRSSを取得し、モデルへ渡すニュース一覧に整える。"""

import html
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from strands import tool

FEED_URL = "https://aws.amazon.com/about-aws/whats-new/recent/feed/"
# 長い本文は切り詰め、モデルへ渡す量を抑える。
TEXT_LIMIT = 700
NEWS_FEED = "aws-whats-new"
MAX_DAYS = 30


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
