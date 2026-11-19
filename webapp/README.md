# AWS Quest Board — Webアプリ

Astro・React・CopilotKit V2で画面とCopilotKit Runtimeを動かし、AWS Blocksで認証・保存・ホスティングを定義します。AWS Blocks 0.9.0、共通ホスティングパッケージ0.5.0を使用しています。

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
cd ../chat-agent
BLOCKS_WEB_URL=http://localhost:4321 uv run python -m chat.main
```

ローカルのニュース取得・保存ツールは、認証済みリクエストのCookieを使い、Webアプリの `/api/agent-news` 経由でBlocksの保存領域へ接続します。週間レポートの記録は `/api/agent-learning-records` から読みます。どちらも `astro dev` のときだけ登録されるローカル専用のAPIです。Cookieはツール実行用のメタデータとして渡し、モデルへのコンテキストには含めません。AWS上のPythonエージェントは、引き続きDynamoDBへ接続します。

画面・AG-UIだけを確認する従来の `npm run mock` と `npm run dev:mock -- --background` も残しています。このモードは認証を省略するため、Blocksの認証・保存の検証には使いません。

## 実装の配置

| 場所 | 内容 |
| --- | --- |
| aws-blocks/storage.ts | DistributedTableによるニュース・学習状態・設定と、AIエージェントの接続設定を定義します |
| aws-blocks/auth.ts・index.ts | AuthCognitoと認証APIを定義します |
| aws-blocks/index.cdk.ts | BlocksStackとHosting BlockでWebアプリの配信基盤を定義します。`hostingTimeout.ts`（ストリーミング統合のタイムアウト）は、Hostingの制約を補う部品です |
| aws-blocks/index.cdk.ts から呼ぶ ../chat-agent/infra/stack.ts・../batch-agent/infra/stack.ts | 対話用・定期取得用のエージェントのAWS構成（AgentCore Runtime、記憶、毎朝の定期取得とその失敗アラーム）。それぞれのエージェントのフォルダに置いています |
| src/server/ | サーバー(SSR)専用のコードです。認証・保存・AgentCore接続を置き、ブラウザーのコードからは読み込みません |
| src/lib/ | ブラウザーでも使う型・定数・純粋関数だけを置きます |
| mock/ | mockモードのメモリ上の保存先とAIを置きます。モードのフラグが真のときだけ動的に読み込み、本番ビルドでは空のスタブに差し替えます（`astro.config.mjs` の `strip-mock`） |
| src/server/blocks/records.ts | 部分更新の代わりに、versionによる条件付き書き込みで競合を扱います |
| src/middleware.ts | 画面（HTML）の応答にCSPを付けます。通信先を同じオリジンに限り、Open Generative UIが生成したUI（sandboxのiframe）からも、外部への通信・画像・スクリプトの読み込みをさせません |
| src/pages/api/ | JWT検証後に、クエスト・設定・新着の通知・学習の関連分析・理解度チェックの回答・CopilotKitを扱います。一覧は [API設計書](../doc/API設計書.md) です |
| src/components/ | 画面を構成します。共通のチャット用カード枠は `chat/` に置きます |
| src/components/copilotkit/ | CopilotKit連携用のフックを呼ぶコンポーネントです（[詳細](src/components/copilotkit/README.md)） |
| src/components/human-in-the-loop/ | ユーザーの回答を待つクイズ・選択肢のUIです（[詳細](src/components/human-in-the-loop/README.md)） |
| src/components/generative-ui/ | A2UIの描画・カタログと、ツールの結果を表示するカードです（[詳細](src/components/generative-ui/README.md)） |
| src/hooks/ | 画面の状態とAPI呼び出しをまとめたフックです |
| src/hooks/copilotkit/ | CopilotKitとの状態共有・コンテキスト・フロントエンドツール・Human in the Loopの登録フックです（[詳細](src/hooks/copilotkit/README.md)） |
| tests/ | Node標準のテストランナーによるテストです |

AWS用のビルドでは `aws-runtime` 条件でBlocksのAWS実装を選びます。Lambdaでモック実装を読み込んだ場合はエラーにし、ローカル保存へ書き込ませません。

## 関心に合う新着の通知

本のF-05「週間レポート」とは別の追加機能です。

Webアプリの起動時と表示中の1分ごとに、未確認・未着手のニュースを新しい順に最大20件ずつ確認します。バックエンドのAG-UIクライアントが、保存済みの学習分野と候補を、通常のチャットとは別のスレッドでAIエージェントへ渡します。

AIエージェントが返したニュースIDと理由を検証し、通知と既読状態をユーザー別に保存します。同じニュースは繰り返し通知せず、該当なしも確認済みとして記録します。通知を押すと既存の詳細画面を開きます。ブラウザーを閉じている間の選定・プッシュ通知は行いません。

## 2つの図解の違い

アプリには、仕組みの異なる図解が2つあります。

| | ニュースの図解（F-04） | 学習内容のつながりの図 |
| --- | --- | --- |
| 何を図解するか | 1件のニュースの内容（アーキテクチャなど） | 学習済みのニュース同士の関係 |
| きっかけ | チャットで依頼する（例:「このアップデートのアーキテクチャを図解して」） | クエストのクリア数が設定の件数に達すると、自動で分析する |
| 表示する場所 | チャット欄 | 通知の一覧から開くダイアログ |
| 作り方 | Open Generative UI。AIエージェントがHTML・CSS・JavaScriptを生成し、サンドボックスのiframeに表示する（デザインの指示は `src/lib/generative-ui/design-skill.md`） | 関係のJSONを検証した後、Open Generative UIで図解を生成する。通知から開く際は、保存済みのUIを公式レンダラーのiframeに表示する |
| 保存 | アプリのデータとしては保存しない（会話の一部として、エージェントの記憶に残る） | 関係の分析結果と、完成したUIをユーザーごとに保存し、既読を管理する |

### 学習内容のつながりの生成・表示

1. 閾値に達したら、学習済みニュースの関係を分析する。ニュースID・参照先・重複などをWebアプリで検証する。
2. 関係がある場合だけ、別の実行で `generateSandboxedUi` を呼ばせる。同じデザインスキルと検証済みの関係を渡す。関係がなければUIは生成しない。
3. CopilotKit 1.73.3の公式 `OpenGenerativeUIMiddleware` が作った完成済みactivityを検証し、分析結果と一緒にユーザー別に保存する。
4. 通知を開くと `OpenGenerativeUIActivityRenderer` で再表示する。再表示時はAIを呼ばない。既読管理、新着ニュース通知、週間レポートの処理は変えない。

生成UIは `sandbox="allow-scripts"` のiframeだけで動かす。iframe内のCSPで、外部・同一オリジンへの通信、外部スクリプト、子iframe、フォーム送信を禁止する。ホストの操作用関数は公開しない。HTMLをホストDOMへ直接挿入しない。なお、分析のJSONは検証するが、生成された図の意味まで自動検証できるわけではない。

保存UIにはサイズと高さの上限を設ける。分析とUI生成はそれぞれ最大45秒で、関係がある場合はモデル実行が2段階になる。AWSでの所要時間・配信経路のタイムアウトは別途確認が必要。今回はAWS設定やタイムアウトを変更していない。

旧通知にはUIが保存されていないため、既読や履歴を維持したまま関係を文章で表示する。旧通知の自動再生成・DBデータの削除は行わない。mockモードは保存済みUIの形を模した固定データを返すもので、実AIによる生成ではない。

詳細と検証結果は [`doc/learning-open-generative-ui.md`](../doc/learning-open-generative-ui.md) を参照。

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
