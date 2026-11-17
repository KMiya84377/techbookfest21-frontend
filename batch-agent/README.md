# 定期実行用エージェント

毎朝6時(東京時間)に呼ばれ、AWSの最新情報(What's New)を取得して、共通のニュース(ニュースマスター)だけを保存する、Strands Agentsのエージェント(HTTP)です。ユーザーごとの状態は作りません。チャット用のエージェント([chat-agent](../chat-agent/README.md))とは、環境を完全に分けています。

このフォルダで、次のように起動・テストします(Python 3.12以上とuvが必要)。

```bash
uv run python -m batch.main
uv run --with pytest python -m pytest tests
```

- `POST /invocations` に `{"days": 1}` を送ると、その日数分のニュースを取得・保存します(1〜30日)。
- AWS上では、EventBridge Scheduler から Lambda(`webapp/infra/jobs/daily-quests/handler.py`)経由で呼ばれます。失敗するとアラームが鳴ります(`webapp/infra/agents.ts`)。
- ツール(`batch/tools.py`)は、チャット用エージェントの `chat/tools.py` から、定期実行に必要なものだけを持っています。ニュースの保存形式を変えるときは、両方を合わせてください。
- ログは、標準の `logging` にJSON整形を付けた `batch/log.py` で、ライブラリのログも含めて、標準出力に1行のJSONとして出します。
