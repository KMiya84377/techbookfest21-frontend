# チャット用エージェント

Webアプリのチャットから呼ばれる、Strands Agentsのエージェント（AG-UI）です。Jevによる表示先の推奨、記憶（AgentCore Memory）、新着ニュースの選定、学習内容の関連分析、週間レポートの集計を担当します。定期実行用のエージェント（[batch-agent](../batch-agent/README.md)）とは、環境を完全に分けています。

このフォルダで、次のように起動・テストします（Python 3.12以上とuvが必要）。

```bash
uv run python -m chat.main
uv run --with pytest python -m pytest tests
```

AWSの構成(Runtime・記憶・IAM)は、`infra/stack.ts` のCDKで定義しています。CDKのアプリは `webapp/` にあり、`webapp/cdk-blocks/index.cdk.ts` から呼ばれます(`npm run deploy:agent`)。

## 本との対応

| 本の章・節 | 内容 | ファイル |
| --- | --- | --- |
| 第1章1.4.1 | Strands Agentsのエージェントを`StrandsAgent`でAG-UIに対応させ、`create_strands_app`で`POST /invocations`と`GET /ping`を公開する。会話履歴は、`StrandsAgentConfig`の`session_manager_provider`でAgentCore Memoryに保存する | [chat/main.py](chat/main.py) |
| 第1章1.4.2 | AgentCore RuntimeのプロトコルにAG-UIを指定する(`protocolConfiguration: AGUI`) | [infra/stack.ts](infra/stack.ts) |
| 第3章3.6.3〜3.6.5 | F-03のクイズ(`show_quiz`)、F-04の図解(`generateSandboxedUi`)、F-05の週間レポート(A2UIの部品の使い方)を、システムプロンプトで指示する | [chat/main.py](chat/main.py)の`SYSTEM_PROMPT` |
| 第3章3.6.5 | F-05の週間レポートの数値を、ツールのコードで集計する | [chat/weekly_stats.py](chat/weekly_stats.py) |

本にない追加機能のファイルは、次のとおりです。

- 表示先の推奨(Jev UIルーター): [chat/ui_router.py](chat/ui_router.py)・[chat/jev_client.py](chat/jev_client.py)（下の「Jev UIルーターを有効にする」）
- 新着ニュースの選定: [chat/news_review.py](chat/news_review.py)（下の「新着ニュースの選定」）
- 学習内容の関連分析: [chat/learning_review.py](chat/learning_review.py)
- 学習設定の受け取り: [chat/user_settings.py](chat/user_settings.py)

## Jev UIルーターを有効にする

JevはホストされたAPIとして呼び出します。AgentCore Runtimeやアプリの実行基盤は追加せず、Strands Agentの`before_model_call`介入で、モデルを呼ぶ前に、この依頼に合う表示先(CopilotKitのUIツール)をJevに聞きます。結果は「表示先の推奨」として、その回のモデル呼び出しの間だけシステムプロンプトに足します。Jevは推奨するだけで、どのツールを呼ぶか、ツール引数や表示内容の生成は、Strands Agentが担当します。

- 候補は、そのリクエストで使えるUIツールだけです。詳細を開いていないときは`update_quest_detail`を外します(画面の`context`の`[opened_quest]`で判定)。
- Jevに送るのは、直近の会話のテキストと、画面の状態(詳細を開いているか)と、候補の一覧です。ツールの引数は送りません。
- 確信度が`JEV_UI_MIN_CONFIDENCE`未満なら、推奨を付けず、モデルに任せます。
- 判定ごとに、`event` が `jev_ui_route` のJSONを1行、標準出力に出します（`outcome` などの項目つき。下の「ログ」を参照）。

### ローカル開発

TypeSafe APIキーを環境変数に設定してエージェントを起動します。

```bash
export TYPESAFE_API_KEY='your-api-key'
uv run python -m chat.main
```

### AgentCore Runtime

AgentCore Identityに、名前`typesafe-jev-api`のAPI key credential providerを作成してください。TypeSafeのAPIキーをIdentityに登録するか、Secrets Managerに保存したキーを参照させます。Runtimeは`@requires_api_key`相当のSDK機能で呼び出し時にキーを受け取り、Jev APIへのAuthorizationヘッダーに使用します。

CDKはチャット用Runtimeにprovider名を渡し、`bedrock-agentcore:GetResourceApiKey`をこのproviderに限定して許可します。RuntimeがAPIキーを取り出せるよう、同provider用のAgentCore Identity管理シークレットに限り`secretsmanager:GetSecretValue`も許可します。AgentCore Runtimeがリクエストに付けるWorkload Access Tokenは、AG-UIアプリのミドルウェアでSDKのリクエストコンテキストへ引き継ぎます。配置やネットワーク構成は変更していません。

ローカルでは`TYPESAFE_API_KEY`、Runtimeでは`JEV_API_KEY_PROVIDER_NAME`を使います。両方は同時に設定しません。どちらも未設定なら、Jevルーターを無効にして既存のエージェント動作を維持します。Jev APIやIdentityが利用できない場合も、ルーターは既存動作へフォールバックします。

`JEV_MODEL`は既定で`jev-latest`、`JEV_UI_MIN_CONFIDENCE`は既定で`0.5`、`JEV_TIMEOUT`(秒)は既定で`2.0`です。Jevは依頼のたびにモデルより先に呼ぶため、タイムアウトを短くしています。しきい値は検証用の初期値であり、アプリ固有の入力例で調整します。APIキーそのものはリポジトリやCDKに保存しません。

## 新着ニュースの選定

Webアプリの `/api/news-notifications` が、通常のチャットとは別のAG-UIスレッドで選定を依頼します。`forwardedProps.newsReview` が真の場合、`chat/news_review.py` の指示を使い、会話のMemoryとテンプレートのRSS取得・DB保存ツールを外します。渡された候補と保存済み設定から選び、`submit_news_recommendations` にニュースIDと理由を返します。通知の保存と既読管理はWebアプリ側が担当します。

共通ニュースの取得・保存は、定期実行用のエージェントが担当し、個人別通知の作成は行いません。

## Blocksのローカル保存を使う

WebアプリとBlocksのローカル認証APIを起動し、`BLOCKS_WEB_URL=http://localhost:4321 uv run python -m chat.main` で起動します。Web側から `AGENT_URL=http://localhost:8080/invocations` へ接続します。ニュースの保存・保存済みニュースの取得は、Webサーバーが確認したCookieを使い、Webアプリの `/api/agent-news` 経由でBlocksへ中継します。Cookieはツール実行用のメタデータにだけ保持し、ユーザー入力やモデル用コンテキストへは入れません。

AWS用のRuntimeにはBLOCKS_WEB_URLを設定せず、Blocksが構築したDynamoDBのテーブル名を渡します。

## 週間レポート

「今週どれくらい学習できたか」などの依頼で、`chat/weekly_stats.py` の `get_weekly_stats` を呼びます。回答数・初回正解率などの数値は、LLMに数えさせず、このツールのコードで集計します（日付の区切りは日本時間、期間は1〜30日で既定7日）。エージェントは、返った値を変えずに、A2UIのカード・グラフ（`generate_a2ui`）で見せます。記録はAWSではDynamoDBから、ローカルではWebアプリの `/api/agent-learning-records` から読みます。

## ログ

ログは、標準の `logging` にJSON整形を付けた `chat/log.py` で、標準出力に1行のJSONとして出します。アプリのログ（`log_event`）も、Jevの判定ログ（`jev_ui_route`）も、Strands・boto3・uvicornなどライブラリのログも、同じ書式です（`level`・`message`・`time`・`logger` と、ログごとの項目）。起動時に `configure_logging()` を1度呼びます（`uvicorn.run` は `log_config=None`）。

CloudWatch Logs Insightsでの集計例:

```
filter event = "jev_ui_route" | stats count(*) by outcome
```

トレース（モデル・ツールの呼び出しごとの時間など）は、まだ出していません（OpenTelemetryは未導入）。
