# server

Webアプリのバックエンド処理を置きます。APIから呼ばれ、認証、データの取得・保存、AIエージェントとの通信などを行います。画面の表示部品や、Pythonで実装したStrands Agents本体を置くフォルダではありません。

## フォルダ

| フォルダ            | 役割                                                                                               | 主なファイル                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `agent`             | AgentCoreまたはローカルのAG-UIエージェントへの接続、実行結果の取得、認証済みユーザー情報の引き渡し | [configuredAgent.ts](agent/configuredAgent.ts)、[agentcore.ts](agent/agentcore.ts)、[userContext.ts](agent/userContext.ts) |
| `auth`              | Cognitoのトークン検証とユーザーの特定。開発時にはローカル認証・モックへ切り替える                  | [authenticate.ts](auth/authenticate.ts)                                                                                    |
| `blocks`            | AWS Blocksの接続設定と、ユーザー別データの取得・更新に使う共通処理                                 | [serverConfig.ts](blocks/serverConfig.ts)、[records.ts](blocks/records.ts)                                                 |
| `quests`            | ニュース、クエストの状態、学習履歴の取得・保存                                                     | [store.ts](quests/store.ts)、[repository.ts](quests/repository.ts)                                                         |
| `userSettings`      | 学習分野・難易度・分析件数など、ユーザー設定の取得・保存                                           | [store.ts](userSettings/store.ts)、[repository.ts](userSettings/repository.ts)                                             |
| `learning`          | 学習履歴に基づくニュース同士の関連分析、Open Generative UIによる図解の生成・保存、通知状態の管理   | [service.ts](learning/service.ts)、[generate.ts](learning/generate.ts)                                                     |
| `newsNotifications` | 関心に合う新着ニュースの選定、通知の保存・既読管理                                                 | [service.ts](newsNotifications/service.ts)、[review.ts](newsNotifications/review.ts)                                       |

## 保存先の構成

`quests`・`userSettings`・`learning`・`newsNotifications`は、保存先を同じ形で分けています。

- `store.ts`：保存先の型（interface）と、Blocksかmockモードのメモリかの選択。サービスとAPIは、ここから読み込みます。
- `repository.ts`：Blocks（DistributedTable）での実装。
- `reviewRecord.ts`（`learning`・`newsNotifications`）：Blocksとmockの両方が使う、記録の型・キー・定数。

## 他のフォルダとの分担

- [pages/api](../pages/api/)：HTTPリクエストの受付、入力の確認、レスポンスの作成。
- `server`：APIから呼ばれるバックエンドの処理、外部サービスとの通信、データの保存。
- [lib](../lib/)：画面とバックエンドで使う型、スキーマ、データ処理など。
- [components](../components/)：画面を表示するReactコンポーネント。
- [chat-agent](../../../chat-agent/)：Pythonで実装した対話用のStrands Agents本体。

例えば、[learning-insights API](../pages/api/learning-insights.ts)は`learning/service.ts`を呼びます。図解が必要な場合は`learning/generate.ts`から`agent`の接続処理を通じてAIエージェントを実行し、結果を保存してAPIから返します。

CopilotKit Runtimeの構成は[CopilotKit API](../pages/api/copilotkit/%5B...slug%5D.ts)にあり、`server/agent`はその接続先となるAIエージェントとの通信を担います。

ここにある処理はサーバー側で使用します。画面のコンポーネントやフックから直接呼ばず、API経由で利用します。`server`というフォルダ名だけで、ブラウザーへの取り込みが自動的に禁止されるわけではありません。
