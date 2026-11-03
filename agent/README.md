# Agent

Strands Agentsのエージェントです。**2つのエージェントは、環境を完全に分けた別々のuvプロジェクト**です（それぞれに `pyproject.toml`・`uv.lock`・`.venv`）。

| フォルダ | 役割 |
| --- | --- |
| `chat/` | チャット用（AG-UI）。Jevによる表示先の推奨、記憶（AgentCore Memory）、新着ニュースの選定、学習内容の関連分析、週間レポートの集計 |
| `batch/` | 毎朝の定期実行用（HTTP）。ニュースを取得し、共通のニュースだけを保存する |
| `common/` | 両方が使うツール（`tools.py`: RSSの取得、クエストの保存。`log.py`: JSON 1行のログ）。ソースだけを共有し、依存は両方の `pyproject.toml` に宣言する |

バッチをローカルで起動するときは、`uv run --project batch python -m batch.main` を実行します。

## Jev UIルーターを有効にする

JevはホストされたAPIとして呼び出します。AgentCore Runtimeやアプリの実行基盤は追加せず、Strands Agentの`before_model_call`介入で、モデルを呼ぶ前に、この依頼に合う表示先(CopilotKitのUIツール)をJevに聞きます。結果は「表示先の推奨」として、その回のモデル呼び出しの間だけシステムプロンプトに足します。Jevは推奨するだけで、どのツールを呼ぶか、ツール引数や表示内容の生成は、Strands Agentが担当します。

- 候補は、そのリクエストで使えるUIツールだけです。詳細を開いていないときは`update_quest_detail`を外します(画面の`context`の`[opened_quest]`で判定)。
- Jevに送るのは、直近の会話のテキストと、画面の状態(詳細を開いているか)と、候補の一覧です。ツールの引数は送りません。
- 確信度が`JEV_UI_MIN_CONFIDENCE`未満なら、推奨を付けず、モデルに任せます。
- 判定ごとに、`{"event": "jev_ui_route", "outcome": ...}`のJSONを1行、標準出力に出します。

### ローカル開発

TypeSafe APIキーを環境変数に設定してエージェントを起動します。

```bash
cd agent
export TYPESAFE_API_KEY='your-api-key'
uv run --project chat python -m chat.main
```

### AgentCore Runtime

AgentCore Identityに、名前`typesafe-jev-api`のAPI key credential providerを作成してください。TypeSafeのAPIキーをIdentityに登録するか、Secrets Managerに保存したキーを参照させます。Runtimeは`@requires_api_key`相当のSDK機能で呼び出し時にキーを受け取り、Jev APIへのAuthorizationヘッダーに使用します。

CDKはチャット用Runtimeにprovider名を渡し、`bedrock-agentcore:GetResourceApiKey`をこのproviderに限定して許可します。RuntimeがAPIキーを取り出せるよう、同provider用のAgentCore Identity管理シークレットに限り`secretsmanager:GetSecretValue`も許可します。AgentCore Runtimeがリクエストに付けるWorkload Access Tokenは、AG-UIアプリのミドルウェアでSDKのリクエストコンテキストへ引き継ぎます。配置やネットワーク構成は変更していません。

ローカルでは`TYPESAFE_API_KEY`、Runtimeでは`JEV_API_KEY_PROVIDER_NAME`を使います。両方は同時に設定しません。どちらも未設定なら、Jevルーターを無効にして既存のエージェント動作を維持します。Jev APIやIdentityが利用できない場合も、ルーターは既存動作へフォールバックします。

`JEV_MODEL`は既定で`jev-latest`、`JEV_UI_MIN_CONFIDENCE`は既定で`0.5`、`JEV_TIMEOUT`(秒)は既定で`2.0`です。Jevは依頼のたびにモデルより先に呼ぶため、タイムアウトを短くしています。しきい値は検証用の初期値であり、アプリ固有の入力例で調整します。APIキーそのものはリポジトリやCDKに保存しません。

## 新着ニュースの選定

Webアプリの `/api/news-notifications` が、通常のチャットとは別のAG-UIスレッドで選定を依頼します。`forwardedProps.newsReview` が真の場合、`chat/news_review.py` の指示を使い、会話のMemoryとテンプレートのRSS取得・DB保存ツールを外します。渡された候補と保存済み設定から選び、`submit_news_recommendations` にニュースIDと理由を返します。通知の保存と既読管理はWebアプリ側が担当します。

`batch/main.py` は共通ニュースの取得・保存を引き続き担当し、個人別通知の作成は行いません。AWS・LLMを呼び出さない確認は、`agent` で `uv run --project chat --with pytest python -m pytest chat/tests common/tests` を実行します（chat の環境で動かします）。

## Blocksのローカル保存を使う

WebアプリとBlocksのローカル認証APIを起動し、`BLOCKS_WEB_URL=http://localhost:4321 uv run --project chat python -m chat.main` で起動します。Web側から `AGENT_URL=http://localhost:8080/invocations` へ接続します。ニュースの保存・保存済みニュースの取得は、Webサーバーが確認したCookieを使い、Webアプリの `/api/agent-news` 経由でBlocksへ中継します。Cookieはツール実行用のメタデータにだけ保持し、ユーザー入力やモデル用コンテキストへは入れません。

AWS用のRuntimeにはBLOCKS_WEB_URLを設定せず、Blocksが構築したDynamoDBのテーブル名を渡します。

## 週間レポート

「今週どれくらい学習できたか」などの依頼で、`chat/weekly_stats.py` の `get_weekly_stats` を呼びます。回答数・初回正解率などの数値は、LLMに数えさせず、このツールのコードで集計します（日付の区切りは日本時間、期間は1〜30日で既定7日）。エージェントは、返った値を変えずに、A2UIのカード・グラフ（`generate_a2ui`）で見せます。記録はAWSではDynamoDBから、ローカルではWebアプリの `/api/agent-learning-records` から読みます。

## ログ

ツールとバッチのログは、`common/log.py` のJSON 1行です。Jevの判定ログ（`jev_ui_route`）は別の書式で、どちらもCloudWatch Logs Insightsで集計できます。
