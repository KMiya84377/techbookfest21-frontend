# Webアプリ

Astro・React・CopilotKit V2で画面とCopilotKit Runtimeを動かし、[AWS CDK Blocks](https://github.com/aws/cdk-blocks)(`aws-cdk-blocks` 1.0.0。本で紹介しているAWS Blocksの現在の名称)で認証・保存・ホスティングを定義します。名称の違いは、[トップのREADME](../README.md#aws-blocksからaws-cdk-blocksへの名称変更)を参照してください。

## 実装の配置

### AWSの構成（第4章）

| 場所 | 内容 | 本との対応 |
| --- | --- | --- |
| [cdk-blocks/auth.ts](cdk-blocks/auth.ts)・[index.ts](cdk-blocks/index.ts) | `Auth`（Cognito）と認証APIを定義します。ユーザープールの変更できない設定は、`cdk-blocks/baselines/`に記録し、変更を止めます | 第4章4.3.3 |
| [cdk-blocks/storage.ts](cdk-blocks/storage.ts) | `KVStore`によるニュース・学習状態・設定と、AIエージェントの接続設定を定義します | 第4章4.3.3 |
| [cdk-blocks/hosting.ts](cdk-blocks/hosting.ts) | Hosting BlockでAstroのSSRの配信基盤を定義します。Hostingが公開していないストリーミング統合のタイムアウト（5分）も、ここで設定します | 第4章4.3.3・4.4.3 |
| [cdk-blocks/index.cdk.ts](cdk-blocks/index.cdk.ts) | CDKアプリの入口です。BlocksStack、Hosting、エージェントのスタックを組み立て、SSR用Lambdaの権限を付けます | 第4章4.3.3・4.4.3 |
| [../chat-agent/infra/stack.ts](../chat-agent/infra/stack.ts)・[../batch-agent/infra/stack.ts](../batch-agent/infra/stack.ts) | 対話用・定期取得用のエージェントのAWS構成（AgentCore Runtime、記憶、毎朝の定期取得とその失敗アラーム）。`cdk-blocks/index.cdk.ts` から呼びます | 第1章1.4.2・第4章4.4.3 |
| [../.github/workflows/](../.github/workflows/README.md) | Web・対話用エージェント・定期取得を、別々のワークフローでデプロイします | 第4章4.4.4 |

### サーバー（第1章・第3章・第4章4.4.2）

AstroのNode.jsサーバーで、画面の配信とバックエンド（CopilotKit Runtimeを含む）をまとめて動かします（第4章4.4.2）。

| 場所 | 内容 | 本との対応 |
| --- | --- | --- |
| [src/pages/api/copilotkit/](src/pages/api/copilotkit/%5B...slug%5D.ts) | CopilotKit Runtime。A2UIとOpen Generative UIもここで有効にします | 第3章3.1・3.5 |
| [src/pages/api/](src/pages/api/) | JWT検証後に、クエスト・設定・新着の通知・学習の関連分析・理解度チェックの回答を扱います | 第4章4.4.2 |
| [src/pages/api/_server/](./src/pages/api/_server/README.md) | サーバー(SSR)専用のコードです。AIエージェントへのAG-UIの接続（`agent/`）、認証、保存を置き、ブラウザーのコードからは読み込みません | 第1章（Webアプリ側の接続） |
| [src/pages/api/_server/blocks/userQuestRecords.ts](./src/pages/api/_server/blocks/userQuestRecords.ts) | 学習状態・分析結果・通知の取得と、versionによる条件付き書き込みをまとめます | － |
| [src/middleware.ts](src/middleware.ts) | 画面（HTML）の応答にCSPを付けます。通信先を同じオリジンに限り、Open Generative UIが生成したUI（sandboxのiframe）からも、外部への通信・画像・スクリプトの読み込みをさせません | 第3章3.6.4 |

### 画面（第2章・第3章）

| 場所 | 内容 | 本との対応 |
| --- | --- | --- |
| [src/components/App.tsx](src/components/App.tsx) | 画面の入口です。`CopilotKitProvider` で、A2UIのカタログとOpen Generative UIのデザインのルールを渡します | 第3章3.1・3.5 |
| [src/hooks/useCopilotKitIntegration.ts](src/hooks/useCopilotKitIntegration.ts) | 状態共有・ツール登録・サジェストのフックをまとめて呼びます。`App.tsx`の`QuestWorkspace`で、`CopilotKitProvider`配下から呼びます | 第3章3.2〜3.4 |
| [src/hooks/](src/hooks/README.md) | 画面の状態・API呼び出しと、AIエージェントとの連携を扱います。ツール登録と専用UIは、役割別のサブフォルダにまとめます | 第3章3.2〜3.4、3.6 |
| [src/components/generative-ui/](src/components/generative-ui/README.md) | 詳細への追記を描画するA2UIレンダラーと、レポート用のカタログです | 第2章2.2〜2.4、第3章3.5・3.6 |
| [src/components/human-in-the-loop/](src/components/human-in-the-loop/) | クイズと確認画面で共通に使う選択ボタンです | 第3章3.4・3.6.3 |
| [src/components/quests/](src/components/quests/) | ニュースの一覧・詳細画面です | 第3章3.6 |
| [src/components/learning/](src/components/learning/) | 通知と、学習内容のつながりの図です | 本にない追加機能 |
| src/components/chat/・user-setting/ | チャット欄と、共通のチャット用カード枠、学習設定のダイアログです | － |
| src/lib/ | ブラウザーでも使う型・定数・純粋関数だけを置きます | － |

### 開発用

| 場所 | 内容 |
| --- | --- |
| mock/ | mockモードのメモリ上の保存先とAIを置きます。モードのフラグが真のときだけ動的に読み込み、本番ビルドでは空のスタブに差し替えます（`astro.config.mjs` の `strip-mock`） |
| tests/ | Node標準のテストランナーによるテストです |

ツール専用の結果表示や回答待ち画面は、`src/hooks/frontend-tool/`・`src/hooks/human-in-the-loop/`の各フックと同じファイルに置きます。複数の画面で使う部品は`src/components/`に置きます。

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

http://localhost:4321 を開き、ユーザー登録・ログインします。ローカルの確認コードはバックエンドのターミナルへ出ます。AWSのCognito、DynamoDBには接続しません。学習状態や通知は `.cdk-blocks/local/data/` に保存します。

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

## AWSへのデプロイ

Web（`QuestBoardWeb`）、対話用AIエージェント（`QuestBoardAgent`）、定期取得用AIエージェント（`QuestBoardBatch`）を個別のスタック・GitHub Actionsワークフローに分けています。ワークフローは手動実行（`workflow_dispatch`）です。

GitHubのリポジトリのVariablesに、`AWS_ROLE_ARN`（デプロイに使うIAMロール）と、任意で `ALERT_EMAIL`（アラームの通知先メール。未設定なら通知なし）を登録します。コマンドは `npm run deploy:agent` / `deploy:batch` / `deploy:web` です。
