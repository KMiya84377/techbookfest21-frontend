import io
import unittest
from datetime import datetime, timezone
from email.utils import format_datetime
from unittest.mock import patch

from common.tools import fetch_news

NOW = format_datetime(datetime.now(timezone.utc))
FEED = f"""<?xml version="1.0"?>
<rss><channel>
<item><guid>aaaaaaaaaaaaaaaa</guid><title>New</title><description>text</description>
<pubDate>{NOW}</pubDate></item>
<item><guid>bbbbbbbbbbbbbbbb</guid><title>No date</title><description>text</description></item>
<item><guid>cccccccccccccccc</guid><title>Broken date</title><description>text</description>
<pubDate>not a date</pubDate></item>
</channel></rss>""".encode()


class FetchNewsTests(unittest.TestCase):
    def test_skips_items_without_a_valid_pub_date(self):
        with patch("urllib.request.urlopen", return_value=io.BytesIO(FEED)):
            news = fetch_news._tool_func(days=1)

        self.assertEqual([item["id"] for item in news], ["aaaaaaaaaaaa"])


if __name__ == "__main__":
    unittest.main()
