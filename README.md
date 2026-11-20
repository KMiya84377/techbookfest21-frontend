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

| 本の章・節 | 内容 | 見るところ |
| --- | --- | --- |
| 第1章 1.4.1 | Strands AgentsをAG-UIに対応させる(`StrandsAgent`・`create_strands_app`・AgentCore Memory) | [chat-agent/chat/main.py](chat-agent/chat/main.py) |
| 第1章 1.4.2 | AgentCore RuntimeのプロトコルにAG-UIを指定する(CDK) | [chat-agent/infra/stack.ts](chat-agent/infra/stack.ts) |
| 第1章 | WebアプリからAIエージェントへAG-UIで接続する | [webapp/src/pages/api/_server/agent/](./webapp/src/pages/api/_server/README.md) |
| 第2章 2.2〜2.4 | 制御型・宣言型・自由型と、このアプリでの実装 | [webapp/src/components/generative-ui/](webapp/src/components/generative-ui/README.md) |
| 第2章 2.5 | F-01〜F-05の型の選び方 | 下の「[機能ごとの実装](#機能ごとの実装)」 |
| 第3章 3.1 | CopilotKitの構成(`CopilotKitProvider`とCopilotKit Runtime) | [webapp/src/components/App.tsx](webapp/src/components/App.tsx)、[webapp/src/pages/api/copilotkit/](webapp/src/pages/api/copilotkit/%5B...slug%5D.ts) |
| 第3章 3.2〜3.4 | 状態共有、フロントエンドツール、Human-in-the-loop | [webapp/src/hooks/copilotkit/](webapp/src/hooks/copilotkit/README.md) |
| 第3章 3.5 | Generative UI(A2UI、Open Generative UI) | [webapp/src/components/generative-ui/](webapp/src/components/generative-ui/README.md) |
| 第3章 3.6 | サンプルアプリでのCopilotKitの設計(F-01〜F-05) | 下の「[機能ごとの実装](#機能ごとの実装)」 |
| 第4章 4.3.3 | AWS Blocks(認証、データ保存、Hosting) | [webapp/aws-blocks/](webapp/README.md#実装の配置) |
| 第4章 4.4.2 | Webアプリとバックエンドを、AstroのNode.jsサーバーにまとめる | [webapp/src/pages/api/](webapp/README.md#実装の配置) |
| 第4章 4.4.3 | Hosting Blockでの配信と、CDKで定義した定期取得 | [webapp/aws-blocks/index.cdk.ts](webapp/aws-blocks/index.cdk.ts)、[batch-agent/infra/stack.ts](batch-agent/infra/stack.ts) |
| 第4章 4.4.4 | WebアプリとAIエージェントを、別のワークフローでデプロイする | [.github/workflows/](.github/workflows/README.md) |

## 機能ごとの実装

第2章2.5と第3章3.6で扱う5つの機能です。

| 機能 | Generative UIの型 | CopilotKitの機能 | 主なコード |
| --- | --- | --- | --- |
| F-01：ニュースの詳細画面に比較や影響を追加する | 宣言型(A2UI) | `useFrontendTool()` | [useUpdateQuestDetail.tsx](webapp/src/hooks/copilotkit/useUpdateQuestDetail.tsx)、[DetailA2UI.tsx](webapp/src/components/generative-ui/DetailA2UI.tsx)、[detailSections.ts](webapp/src/lib/quests/detailSections.ts) |
| F-02：表示中のニュースを踏まえて回答する | 使わない | `useAgentContext()` | [useScreenContext.ts](webapp/src/hooks/copilotkit/useScreenContext.ts) |
| F-03：クイズを表示し、回答を受けて処理を続ける | 制御型 | `useHumanInTheLoop()` | [useShowQuiz.tsx](webapp/src/hooks/copilotkit/useShowQuiz.tsx)、[Quiz.tsx](webapp/src/components/human-in-the-loop/Quiz.tsx) |
| F-04：AWSニュースを図解する | 自由型(Open Generative UI) | `CopilotKitProvider`とCopilotKit Runtimeの`openGenerativeUI` | [App.tsx](webapp/src/components/App.tsx)、[design-skill.md](webapp/src/lib/generative-ui/design-skill.md)(デザインのルール)、[middleware.ts](webapp/src/middleware.ts)(外部通信を止めるCSP) |
| F-05：週間レポートで学習を振り返る | 宣言型(A2UI) | A2UIのカスタムカタログ | [weekly_stats.py](chat-agent/chat/weekly_stats.py)(集計)、[ReportCatalog.tsx](webapp/src/components/generative-ui/ReportCatalog.tsx)(棒グラフ)、[main.py](chat-agent/chat/main.py)(部品の使い方を指示するシステムプロンプト) |

## 本にない追加機能

| 機能 | 説明 |
| --- | --- |
| 関心に合う新着の通知 | [webapp/README.md](webapp/README.md#関心に合う新着の通知) |
| 学習内容のつながりの図 | [webapp/src/components/learning/](webapp/src/components/learning/README.md) |
| 表示先の推奨(Jev UIルーター) | [chat-agent/README.md](chat-agent/README.md#jev-uiルーターを有効にする) |

## フォルダ構成

| フォルダ | 内容 |
| --- | --- |
| [webapp/](webapp/README.md) | Webアプリ(Astro・React・CopilotKit)と、AWS Blocksの定義 |
| [chat-agent/](chat-agent/README.md) | チャット用のAIエージェント(Strands Agents、AG-UI) |
| [batch-agent/](batch-agent/README.md) | 毎朝ニュースを取得する、定期実行用のAIエージェント |
| [.github/workflows/](.github/workflows/README.md) | デプロイのワークフロー(GitHub Actions) |

## 使い方

ローカルでの起動、AWSへのデプロイは、各フォルダのREADMEを参照ください。

- [Webアプリ](webapp/README.md)
- [チャット用エージェント](chat-agent/README.md)
- [定期実行用エージェント](batch-agent/README.md)
