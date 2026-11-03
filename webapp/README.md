# AWS Quest Board — Webアプリ

Astro・React・CopilotKit V2で画面とCopilotKit Runtimeを動かし、AWS Blocksで認証・保存・ホスティングを定義します。AWS Blocks 0.8.0、共通ホスティングパッケージ0.4.1を使用しています。

## ローカル開発

Node.js 22.12以降を使い、このディレクトリで実行します。

```sh
npm ci
npm run seed
```

seedはローカルのBlocks保存領域へ、共通ニュースを追加します。既存ニュースは上書きしません。保存領域を読み込む前に反映するため、サーバーを起動する前に実行してください。

次の2つを起動します。

```sh
# ターミナル1：Blocksのローカル認証API
npm run dev:backend

# ターミナル2：Astroの開発サーバー
npm run dev -- --background
```

http://localhost:4321 を開き、ユーザー登録・ログインします。ローカルの確認コードはバックエンドのターミナルへ出ます。AWSのCognito、DynamoDBには接続しません。学習状態や通知は `.bb-data/` に保存します。

AI応答だけをモックにし、Blocksの認証・保存を確認する場合は、Astroの起動を次へ置き換えます。

```sh
npm run dev:blocks-mock
```

実際のPythonエージェントへ接続する場合は、別のターミナルで起動し、Astroの環境変数に `AGENT_URL=http://localhost:8080/invocations` を設定します。

```sh
cd ../agent
BLOCKS_WEB_URL=http://localhost:4321 uv run --project chat python -m chat.main
```

ローカルのニュース取得・保存ツールは、認証済みリクエストのCookieを使い、Webアプリの `/api/agent-news` 経由でBlocksの保存領域へ接続します。週間レポートの記録は `/api/agent-learning-records` から読みます。どちらも `astro dev` のときだけ登録されるローカル専用のAPIです。Cookieはツール実行用のメタデータとして渡し、モデルへのコンテキストには含めません。AWS上のPythonエージェントは、引き続きDynamoDBへ接続します。

画面・AG-UIだけを確認する従来の `npm run mock` と `npm run dev:mock -- --background` も残しています。このモードは認証を省略するため、Blocksの認証・保存の検証には使いません。

## 実装の配置

| 場所 | 内容 |
| --- | --- |
| aws-blocks/storage.ts | DistributedTableによるニュース・学習状態・設定と、AIエージェントの接続設定を定義します |
| aws-blocks/auth.ts・index.ts | AuthCognitoと認証APIを定義します |
| aws-blocks/index.cdk.ts | BlocksStackとHosting BlockでWebアプリの配信基盤を定義します |
| infra/agents.ts | 対話用・定期取得用のPythonエージェントをAgentCore Runtimeへ配置し、記憶、毎朝の定期ニュース取得、その失敗アラームを定義します |
| src/server/ | サーバー(SSR)専用のコードです。認証・保存・AgentCore接続を置き、ブラウザーのコードからは読み込みません |
| src/lib/ | ブラウザーでも使う型・定数・純粋関数だけを置きます |
| mock/ | mockモードのメモリ上の保存先とAIを置きます。モードのフラグが真のときだけ動的に読み込み、本番ビルドでは空のスタブに差し替えます（`astro.config.mjs` の `strip-mock`） |
| src/server/blocks/records.ts | 部分更新の代わりに、versionによる条件付き書き込みで競合を扱います |
| src/pages/api/ | JWT検証後に、クエスト・設定・新着の通知・学習の関連分析・理解度チェックの回答・CopilotKitを扱います。一覧は [API設計書](../doc/API設計書.md) です |
| src/components/ | 画面とCopilotKitのUIを構成します（`generative-ui/` はエージェントが呼ぶUI） |
| src/hooks/ | 画面の状態とAPI呼び出しをまとめたフックです |
| tests/ | Node標準のテストランナーによるテストです |

AWS用のビルドでは `aws-runtime` 条件でBlocksのAWS実装を選びます。Lambdaでモック実装を読み込んだ場合はエラーにし、ローカル保存へ書き込ませません。

## 関心に合う新着の通知（第3章 UC-05）

Webアプリの起動時と表示中の1分ごとに、未確認・未着手のニュースを新しい順に最大20件ずつ確認します。バックエンドのAG-UIクライアントが、保存済みの学習分野と候補を、通常のチャットとは別のスレッドでAIエージェントへ渡します。

AIエージェントが返したニュースIDと理由を検証し、通知と既読状態をユーザー別に保存します。同じニュースは繰り返し通知せず、該当なしも確認済みとして記録します。通知を押すと既存の詳細画面を開きます。ブラウザーを閉じている間の選定・プッシュ通知は行いません。

## 検証

```sh
npm test
npm run typecheck
npm run synth -- --no-lookups
```

synthはCloudFormationテンプレートの生成までを行い、デプロイしません。CDKは設定されたAWSプロファイルから対象アカウント・リージョンを解決します。

Blocksの認証・保存を含むAPI検証は、ローカルのBlocksサーバーと `blocks-mock` モードのAstroサーバーを起動してから実行します。

```sh
BLOCKS_TEST_URL=http://localhost:4321 npm test
```

## AWSへのデプロイ

Web（`QuestBoardWeb`）、対話用AIエージェント（`QuestBoardAgent`）、定期取得用AIエージェント（`QuestBoardBatch`）を個別のスタック・GitHub Actionsワークフローに分けています。ワークフローは手動実行（`workflow_dispatch`）です。

GitHubのリポジトリのVariablesに、`AWS_ROLE_ARN`（デプロイに使うIAMロール）と、任意で `ALERT_EMAIL`（アラームの通知先メール。未設定なら通知なし）を登録します。コマンドは `npm run deploy:agent` / `deploy:batch` / `deploy:web` です。
