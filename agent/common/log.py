"""JSON の 1 行ログ。CloudWatch Logs Insights で、項目ごとに集計できる"""

import json
import sys
from datetime import datetime, timezone


def log_event(level: str, message: str, **fields) -> None:
    """標準出力に、JSON を 1 行出す(例外などは、str にして入れる)"""
    record = {
        "level": level,
        "message": message,
        "time": datetime.now(timezone.utc).isoformat(),
        **fields,
    }
    print(json.dumps(record, ensure_ascii=False, default=str), file=sys.stdout, flush=True)
