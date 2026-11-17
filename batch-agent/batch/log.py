"""JSON の 1 行ログ。CloudWatch Logs Insights で、項目ごとに集計できる

標準の logging に JSON の整形を付けている。アプリのログ(log_event)も、Strands・boto3・uvicorn など
ライブラリのログも、同じ書式で標準出力に出る。起動時に configure_logging() を 1 度呼ぶ。
"""

import json
import logging
import sys
from datetime import datetime, timezone

# JSON の項目名と重ならないよう、log_event の項目がこれらの名前なら、先頭に field_ を付ける
_RESERVED = {"level", "message", "time", "logger", "exception"}
_configured = False


class _StdoutHandler(logging.StreamHandler):
    """その時点の sys.stdout に書く(テストで標準出力を差し替えても、拾える)"""

    def __init__(self) -> None:
        logging.Handler.__init__(self)

    @property
    def stream(self):
        return sys.stdout


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "level": record.levelname,
            "message": record.getMessage(),
            "time": datetime.fromtimestamp(record.created, timezone.utc).isoformat(),
            "logger": record.name,
        }
        for key, value in getattr(record, "fields", {}).items():
            entry[f"field_{key}" if key in _RESERVED else key] = value
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False, default=str)


def configure_logging(level: int = logging.INFO) -> None:
    """ルートのロガーを、JSON を標準出力に出す設定にする(何度呼んでも、同じ結果)"""
    global _configured
    handler = _StdoutHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    _configured = True


def log_event(level: str, message: str, **fields) -> None:
    """アプリの出来事を、JSON の 1 行で記録する(例外などは、文字列にして入れる)

    fields は、JSON の項目になる(例: log_event("INFO", "保存した", count=3))。
    """
    if not _configured:
        configure_logging()
    logging.getLogger("questboard").log(
        logging.getLevelNamesMapping()[level.upper()], message, extra={"fields": fields}
    )
