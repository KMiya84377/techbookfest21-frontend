# _server

Webアプリのバックエンド処理を置きます。APIから呼ばれ、認証、データの取得・保存、AIエージェントとの通信などを行います。画面の表示部品や、Pythonで実装したStrands Agents本体を置くフォルダではありません。

## 本との対応

- 第1章（AG-UIでつなぐ）のWebアプリ側は、[agent/](./agent/)です。[agentcore.ts](./agent/agentcore.ts)が、AG-UIのクライアント（`HttpAgent`）で、AgentCore Runtimeへ署名つきで接続します。ローカルでは、署名なしでAIエージェントへ接続します。AIエージェント側（`StrandsAgent`など）は、[chat-agent/chat/main.py](../../../../../chat-agent/chat/main.py)です。
- 第3章3.1のCopilotKit Runtimeは、[pages/api/copilotkit/](../copilotkit/%5B...slug%5D.ts)です。`agent/`の接続先を、Runtimeのエージェントとして登録します。
- 第4章4.4.2のとおり、これらは画面の配信と同じ、AstroのNode.jsサーバーで動きます。

## フォルダ

| フォルダ            | 役割                                                                                               | 主なファイル                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `agent`             | AgentCoreまたはローカルのAG-UIエージェントへの接続、実行結果の取得、認証済みユーザー情報の引き渡し | [configuredAgent.ts](./agent/configuredAgent.ts)、[agentcore.ts](./agent/agentcore.ts)、[userContext.ts](./agent/userContext.ts) |
| `auth`              | Cognitoのトークン検証とユーザーの特定。開発時にはローカル認証・モックへ切り替える                  | [authenticate.ts](./auth/authenticate.ts)                                                                                    |
| `blocks`            | AWS Blocksの接続設定と、ユーザー別データの取得・更新に使う共通処理                                 | [serverConfig.ts](./blocks/serverConfig.ts)、[userQuestRecords.ts](./blocks/userQuestRecords.ts)                                                 |
| `quests`            | ニュース、クエストの状態、学習履歴の取得・保存                                                     | [store.ts](./quests/store.ts)、[repository.ts](./quests/repository.ts)                                                         |
| `userSettings`      | 学習分野・難易度・分析件数など、ユーザー設定の取得・保存                                           | [store.ts](./userSettings/store.ts)、[repository.ts](./userSettings/repository.ts)                                             |
| `learning`          | 学習履歴に基づくニュース同士の関連分析、Open Generative UIによる図解の生成・保存、通知状態の管理   | [service.ts](./learning/service.ts)、[generate.ts](./learning/generate.ts)                                                     |
| `newsNotifications` | 関心に合う新着ニュースの選定、通知の保存・既読管理                                                 | [service.ts](./newsNotifications/service.ts)、[review.ts](./newsNotifications/review.ts)                                       |

## 保存先の構成

`quests`・`userSettings`・`learning`・`newsNotifications`は、保存先を同じ形で分けています。

- `store.ts`：保存先の型（interface）と、Blocksかmockモードのメモリかの選択。サービスとAPIは、ここから読み込みます。
- `repository.ts`：Blocks（DistributedTable）での実装。
- `reviewRecord.ts`（`learning`・`newsNotifications`）：Blocksとmockの両方が使う、記録の型・キー・定数。

## UserQuestテーブルの読み書き

[userQuestRecords.ts](./blocks/userQuestRecords.ts)は、学習状態・分析結果・通知が入るUserQuestテーブルの共通処理です。

- `getUserQuestRecord`：1件を取得します。
- `listUserQuestRecords`：ユーザーの記録を取得します。キーの接頭辞で種類を絞れます。
- `updateUserQuestRecord`：現在の記録を読み、渡された関数で次の保存内容を作って保存します。関数が`null`を返した場合は更新しません。

更新できた場合は保存した記録、更新しなかった場合は`null`を返します。例えばクエストの保存処理は、この結果から「今回初めてクリアしたか」を判断します。

読み取り後に別の処理が更新していた場合は、最大8回まで読み直して保存を試みます。保存内容を作る関数も再実行されるため、その中ではAPI呼び出しなどを行わず、データを組み立てるだけにします。

## 他のフォルダとの分担

- [pages/api](../)：HTTPリクエストの受付、入力の確認、レスポンスの作成。
- `_server`：APIから呼ばれるバックエンドの処理、外部サービスとの通信、データの保存。
- [lib](../../../lib/)：画面とバックエンドで使う型、スキーマ、データ処理など。
- [components](../../../components/)：画面を表示するReactコンポーネント。
- [chat-agent](../../../../../chat-agent/)：Pythonで実装した対話用のStrands Agents本体。

例えば、[learning-insights API](../learning-insights.ts)は`learning/service.ts`を呼びます。図解が必要な場合は`learning/generate.ts`から`agent`の接続処理を通じてAIエージェントを実行し、結果を保存してAPIから返します。

CopilotKit Runtimeの構成は[CopilotKit API](../copilotkit/%5B...slug%5D.ts)にあり、`_server/agent`はその接続先となるAIエージェントとの通信を担います。

ここにある処理はサーバー側で使用します。画面のコンポーネントやフックから直接呼ばず、API経由で利用します。`_server`というフォルダ名だけで、ブラウザーへの取り込みが自動的に禁止されるわけではありません。
