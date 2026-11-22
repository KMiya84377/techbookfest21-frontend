# AWS Quest Boardアプリ

技術書典21 フロントエンドパートのサンプルアプリのリポジトリです。

## サンプルアプリの概要

本アプリは、AWSの最新情報(What's New)を、RPGのクエストのように学べるWebアプリです。毎朝、AIエージェントがニュースを取得してクエストにまとめ、ユーザーはクエストボードで選んで学びます。

- **クエストボード**: ニュースをクエストとして並べ、状態(未着手・閲覧済み・クリア済み)で管理します。詳細では、要約、変更点、従来との違い、影響を読めます。
- **チャット**: AIエージェントに、クエストの絞り込み、詳細への補足の追加、理解度チェックの出題、新しいクエストの取得を頼めます。
- **通知**: 関心に合う新着のニュースと、学んだニュース同士のつながり(図解)を知らせます。
- **週間レポート**: 1週間の学習の回答数や正解率を、チャットで振り返れます。
- **学習設定**: 学びたい分野、難易度、回答の詳しさを設定できます。

## 本の章とコードの対応

| 章 | 節 | 内容 | 見るところ |
| --- | --- | --- | --- |
| 第1章 | 1.4.1 | Strands AgentsをAG-UIに対応させる(`StrandsAgent`・`create_strands_app`・AgentCore Memory) | [chat-agent/chat/main.py](chat-agent/chat/main.py) |
| 第1章 | 1.4.2 | AgentCore RuntimeのプロトコルにAG-UIを指定する(CDK) | [chat-agent/infra/stack.ts](chat-agent/infra/stack.ts) |
| 第1章 | — | WebアプリからAIエージェントへAG-UIで接続する | [webapp/src/pages/api/_server/agent/](./webapp/src/pages/api/_server/README.md) |
| 第2章 | 2.2〜2.4 | 制御型・宣言型・自由型と、このアプリでの実装 | [webapp/src/components/generative-ui/](webapp/src/components/generative-ui/README.md) |
| 第2章 | 2.5 | F-01〜F-05の型の選び方 | [webapp/src/components/generative-ui/](webapp/src/components/generative-ui/README.md)。各機能のコードは、この表の第3章3.6.1〜3.6.5を参照 |
| 第3章 | 3.1 | CopilotKitの構成(`CopilotKitProvider`とCopilotKit Runtime) | [webapp/src/components/App.tsx](webapp/src/components/App.tsx)、[webapp/src/pages/api/copilotkit/](webapp/src/pages/api/copilotkit/%5B...slug%5D.ts) |
| 第3章 | 3.2〜3.4 | 状態共有、フロントエンドツール、Human-in-the-loop | [webapp/src/hooks/](webapp/src/hooks/README.md) |
| 第3章 | 3.5 | Generative UI(A2UI、Open Generative UI) | [webapp/src/components/generative-ui/](webapp/src/components/generative-ui/README.md) |
| 第3章 | 3.6.1 | F-01：ニュースの詳細画面に比較や影響を追加する | [useUpdateQuestDetail.tsx](webapp/src/hooks/frontend-tool/useUpdateQuestDetail.tsx)、[DetailA2UI.tsx](webapp/src/components/generative-ui/DetailA2UI.tsx)、[detailSections.ts](webapp/src/lib/quests/detailSections.ts) |
| 第3章 | 3.6.2 | F-02：表示中のニュースを踏まえて回答する | [useScreenContext.ts](webapp/src/hooks/useScreenContext.ts) |
| 第3章 | 3.6.3 | F-03：クイズを表示し、回答を受けて処理を続ける | [useShowQuiz.tsx](webapp/src/hooks/human-in-the-loop/useShowQuiz.tsx)(ツール登録とクイズ画面) |
| 第3章 | 3.6.4 | F-04：AWSニュースを図解する | [App.tsx](webapp/src/components/App.tsx)、[design-skill.md](webapp/src/lib/generative-ui/design-skill.md)(デザインのルール)、[middleware.ts](webapp/src/middleware.ts)(外部通信を止めるCSP) |
| 第3章 | 3.6.5 | F-05：週間レポートで学習を振り返る | [weekly_stats.py](chat-agent/chat/weekly_stats.py)(集計)、[ReportCatalog.tsx](webapp/src/components/generative-ui/ReportCatalog.tsx)(棒グラフ)、[main.py](chat-agent/chat/main.py)(部品の使い方を指示するシステムプロンプト) |
| 第4章 | 4.3.3 | AWS Blocks(認証、データ保存、Hosting)。現在の名称は[AWS CDK Blocks](#aws-blocksからaws-cdk-blocksへの名称変更) | [webapp/cdk-blocks/](webapp/README.md#実装の配置) |
| 第4章 | 4.4.2 | Webアプリとバックエンドを、AstroのNode.jsサーバーにまとめる | [webapp/src/pages/api/](webapp/README.md#実装の配置) |
| 第4章 | 4.4.3 | Hosting Blockでの配信と、CDKで定義した定期取得 | [webapp/cdk-blocks/hosting.ts](webapp/cdk-blocks/hosting.ts)、[webapp/cdk-blocks/index.cdk.ts](webapp/cdk-blocks/index.cdk.ts)、[batch-agent/infra/stack.ts](batch-agent/infra/stack.ts) |
| 第4章 | 4.4.4 | WebアプリとAIエージェントを、別のワークフローでデプロイする | [.github/workflows/](.github/workflows/README.md) |

## 執筆時点からの変更点：AWS BlocksからAWS CDK Blocksへの名称変更

本で紹介しているAWS Blocksは、2026年11月に[AWS CDK Blocks](https://github.com/aws/cdk-blocks)へ名称が変わりました(本は、変更前のAWS Blocks 0.9.0で書いています)。このリポジトリは、**AWS CDK Blocks 1.0.0(`aws-cdk-blocks`)に移行済み**です。本の記述とコードを見比べるときは、次の対応を参考にしてください。

| 項目 | 本の記述(AWS Blocks 0.9.0) | このリポジトリ(AWS CDK Blocks 1.0.0) |
| --- | --- | --- |
| npmパッケージ | `@aws-blocks/blocks`、`@aws-blocks/hosting` | `aws-cdk-blocks`、`@aws-cdk-blocks/hosting` |
| バックエンドのフォルダ | `aws-blocks/` | [`cdk-blocks/`](webapp/cdk-blocks/) |
| 認証のBlock | `AuthCognito` | `Auth`([cdk-blocks/auth.ts](webapp/cdk-blocks/auth.ts)) |
| キーバリューのBlock | `DistributedTable` | `KVStore`([cdk-blocks/storage.ts](webapp/cdk-blocks/storage.ts))。書き込みは`put(キー, 値)`の形で、`get()`は強い整合性の読み取りが既定 |
| API・ローカルデータの場所 | `/aws-blocks/api`、`.bb-data/` | `/cdk-blocks/api`、`.cdk-blocks/local/` |

### 統合されたBlock

AWS CDK Blocks 1.0.0では、旧版で別々だったBlockが、用途ごとに1つにまとまりました。旧Blockのパッケージは削除され、互換のレイヤーはありません。

| 用途 | 旧(AWS Blocks 0.9.0) | 新(AWS CDK Blocks 1.0.0) |
| --- | --- | --- |
| 認証 | `AuthBasic`、`AuthCognito`、`AuthOIDC` | `Auth`(このリポジトリは、旧`AuthCognito`と同じ、既定のCognitoを使用) |
| キーバリュー(DynamoDB) | `DistributedTable` | `KVStore` |

本の4.3.3の「認証は`AuthCognito`、データ管理は`DistributedTable`など」は、「認証は`Auth`、データ管理は`KVStore`など」と読み替えてください。

## 執筆時点からの変更点：Lambda Web FunctionsのPython対応

本の第4章では、Lambda Web Functions（LWF）の対応ランタイムを「Node.jsのみ」と説明しています。その後、2026年11月20日に、Python 3.15のパブリックプレビュー対応が発表されました（[AWS公式発表](https://aws.amazon.com/about-aws/whats-new/2026/11/aws-lambda-python-315/)）。

2026年11月22日時点では正式提供ではなく、AWSはプレビュー版を本番環境で利用しないよう案内しています（[対応ランタイム](https://docs.aws.amazon.com/lambda/latest/dg/web-functions-runtimes.md)）。

## 本にない追加機能

| 機能 | 説明 |
| --- | --- |
| 関心に合う新着の通知 | [webapp/README.md](webapp/README.md#関心に合う新着の通知) |
| 学習内容のつながりの図 | [webapp/src/components/learning/](webapp/src/components/learning/) |
| 表示先の推奨(Jev UIルーター) | [chat-agent/README.md](chat-agent/README.md#jev-uiルーターを有効にする) |

## フォルダ構成

| フォルダ | 内容 |
| --- | --- |
| [webapp/](webapp/README.md) | Webアプリ(Astro・React・CopilotKit)と、AWS CDK Blocksの定義 |
| [chat-agent/](chat-agent/README.md) | チャット用のAIエージェント(Strands Agents、AG-UI) |
| [batch-agent/](batch-agent/README.md) | 毎朝ニュースを取得する、定期実行用のAIエージェント |
| [.github/workflows/](.github/workflows/README.md) | デプロイのワークフロー(GitHub Actions) |

## 使い方

ローカルでの起動、AWSへのデプロイは、各フォルダのREADMEを参照ください。

- [Webアプリ](webapp/README.md)
- [チャット用エージェント](chat-agent/README.md)
- [定期実行用エージェント](batch-agent/README.md)
