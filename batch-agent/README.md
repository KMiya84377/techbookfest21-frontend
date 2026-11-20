# 定期実行用エージェント

毎朝6時(東京時間)に呼ばれ、AWSの最新情報(What's New)を取得して、共通のニュース(ニュースマスター)だけを保存する、Strands Agentsのエージェント(HTTP)です。ユーザーごとの状態は作りません。チャット用のエージェント([chat-agent](../chat-agent/README.md))とは、環境を完全に分けています。

このフォルダで、次のように起動・テストします(Python 3.12以上とuvが必要)。

```bash
uv run python -m batch.main
uv run --with pytest python -m pytest tests
```

- `POST /invocations` に `{"days": 1}` を送ると、その日数分のニュースを取得・保存します(1〜30日)。
- AWS上では、EventBridge Scheduler から Lambda(`scheduler/handler.py`)経由で呼ばれます。失敗するとアラームが鳴ります。
- AWSの構成(Runtime・Scheduler・Lambda・アラーム)は、`infra/stack.ts` のCDKで定義しています。CDKのアプリは `webapp/` にあり、`webapp/aws-blocks/index.cdk.ts` から呼ばれます(`npm run deploy:batch`)。
- ツール(`batch/tools.py`)は、チャット用エージェントの `chat/tools.py` から、定期実行に必要なものだけを持っています。ニュースの保存形式を変えるときは、両方を合わせてください。
- ログは、標準の `logging` にJSON整形を付けた `batch/log.py` で、ライブラリのログも含めて、標準出力に1行のJSONとして出します。

## 本との対応

| 本の章・節 | 内容 | ファイル |
| --- | --- | --- |
| 第4章4.4.3 | 定期取得は、BlocksのCronJobではなく、CDKで定義する(EventBridge Scheduler、Lambda、AgentCore Runtime) | [infra/stack.ts](infra/stack.ts)、[scheduler/handler.py](scheduler/handler.py) |
| 第4章4.4.4 | Webアプリやチャット用エージェントとは別のワークフローで、手動実行してデプロイする | [../.github/workflows/deploy-batch.yml](../.github/workflows/deploy-batch.yml) |

AgentCore Runtimeのプロトコルは、チャット用(AG-UI)と違い、HTTPです。画面とつながらず、1回の取得の結果をJSONで返すだけのためです。

ユーザーの関心に合うニュースを選ぶ処理は、このエージェントではなく、Webアプリの「[関心に合う新着の通知](../webapp/README.md#関心に合う新着の通知)」が、チャット用エージェントを呼んで行います。
