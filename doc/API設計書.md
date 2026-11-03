# API 設計書

Web アプリ(`webapp/`)のサーバー側 API の一覧と、各 API の監視の状態を管理する。API を足す・変えるときは、この文書も更新する。

- 最終確認日: 2026-11-04(コード・テスト・ビルドで確認。AWS 上での監視の動作は未確認)
- 実装の場所: `webapp/src/pages/api/`(共通処理は `_helpers.ts`・`_logger.ts`・`_metrics.ts`)

状態の凡例: ○ 実装済み / △ 実装済みだが AWS 上では未確認 / × なし

## 1. API 一覧

### 1.1 Astro の SSR の API

SSR 用 Lambda で動く。`route` は、ログとメトリクスに付く名前。

| パス | メソッド | route | 役割 | 入力 | 成功時の応答 | 失敗時 |
|---|---|---|---|---|---|---|
| `/api/quests` | GET | `quests.get` | クエスト一覧の取得 | なし | `{ quests: Quest[] }` | 401、500 |
| | PATCH | `quests.patch` | 閲覧済み・クリアの保存 | `{ id, publishedAt, status: "viewed"\|"cleared", review? }` | `{ ok: true, learning: { count, reviewEvery, batch, newlyCleared } \| null }` | 400、401、500 |
| `/api/quiz-answers` | POST | `quiz-answers.post` | 理解度チェックの、初回の回答を保存(週間レポートの回答数・初回正解率用) | `{ questId, correct: boolean }` | `{ ok: true }` | 400、401、500 |
| `/api/settings` | GET | `settings.get` | ユーザー設定の取得 | なし | `{ settings }` | 401、500 |
| | PUT | `settings.put` | ユーザー設定の保存 | 設定(学習分野・難易度・回答の詳しさ・関連分析の間隔) | `{ settings }` | 400、401、500 |
| `/api/news-notifications` | GET | `news-notifications.get` | 新着の通知の一覧 | なし | `{ notifications }` | 401、500 |
| | POST | `news-notifications.post` | 関心に合う新着を AI で選び、通知を作る | なし(ユーザー・ニュース・関心はサーバーが DB から取得) | `{ state: "running"\|"ready", notifications }` | 401、502 |
| | PATCH | `news-notifications.patch` | 通知を既読にする | `{ questId }` | `{ ok: true }` | 400、401、404、500 |
| `/api/learning-insights` | GET | `learning-insights.get` | 学習の関連分析の状態と通知 | なし | `{ learning, insights, pendingBatch }` | 401、500 |
| | POST | `learning-insights.generate` | 関連分析を作る | `{ batch, reviewEvery? }` | `{ state: "ready"\|"none"\|"existing"\|"stale", ...状態 }`(`stale` は 409) | 400、401、409、502 |
| | PATCH | `learning-insights.read` | 関連分析の通知を既読にする | `{ batch, reviewEvery? }` | `{ ok: true }` | 400、401、502 |
| `/api/copilotkit/[...slug]` | すべて | `copilotkit` | CopilotKit のランタイム(チャット・エージェント接続) | CopilotKit のプロトコル | ストリーム(SSE など) | 401 |

### 1.2 Blocks のバックエンドの API

Blocks の Lambda(`DefaultComputeHandler`)で動く。呼び出しは `/aws-blocks/api`(JSON-RPC)。

| 名前空間 | メソッド | 役割 |
|---|---|---|
| `authApi` | Blocks が自動で作る | サインアップ、サインイン、MFA、パスワードのリセット |
| `session` | `identity()`、`fetchSession()` | ユーザー ID の確認、アクセストークンの取得 |

### 1.3 補足: ローカル開発だけの API

`astro dev` のときだけ、`astro.config.mjs` がルートを登録する。本番ビルドにはルートもコードも入らない。mock モードでは 404。

| パス | メソッド | route | 役割 |
|---|---|---|---|
| `/api/agent-news` | GET | `agent-news.get` | 保存済みクエストの確認(エージェント用) |
| | POST | `agent-news.post` | ニュースの保存(エージェント用。最大 50 件) |
| `/api/agent-learning-records` | GET | `agent-learning-records.get` | ユーザーの学習の記録の取得(週間レポートの集計用。エージェント用) |

## 2. 共通仕様

- 認証: Cognito のアクセストークン(JWT)を `Authorization: Bearer` で受け取り、サーバーが検証する。ローカル開発は Blocks の Cookie セッション、mock モードは認証なし(固定ユーザー)。未ログインは 401。
- ユーザー ID: 本文では受け取らない。検証したトークンの `sub` を使う。
- 応答: JSON(`content-type: application/json; charset=utf-8`)、`cache-control: no-store`。エラーは `{ error: string }`。
- `withUser(route, handler)`(`_helpers.ts`): 認証、リクエスト用ロガー、メトリクスの記録を一括で行う。CopilotKit だけは、`measureApi` でメトリクスのみ記録する。

## 3. 監視の状態

### 3.1 ログ

| 対象 | 状態 | 内容 |
|---|---|---|
| `withUser` の API(11 route) | ○ | 失敗時に JSON で記録(`level`・`route`・`requestId`・`userId`・`err`)。`quests.patch` の学習件数の取得失敗は `warn` |
| 全 12 route の1リクエストごと | ○ | `API リクエスト` という1行(`route`・`status`・`durationMs`)。route・status 別の件数や処理時間は、Logs Insights で集計する(下の例) |
| `copilotkit` | × | リクエスト用ロガーは未使用(CopilotKit 側の出力のみ) |
| 保存先 | ○ | SSR 用 Lambda のロググループ(保存期間 30 日) |

### 3.2 メトリクス

| 対象 | 状態 | 内容 |
|---|---|---|
| 全 12 route の合計 | △ | 名前空間 `QuestBoard/Web`、次元は `service=ssr` のみ。`ApiRequests`(Count、全件)、`ApiErrors`(Count、5xx なら 1・それ以外は 0。合計が件数、平均がエラー率)、`ApiLatency`(Milliseconds)。ローカルで EMF の出力を確認。CloudWatch での集計は未確認 |
| route 別の内訳 | ○ | メトリクスにはせず、3.1 のログを Logs Insights で集計する |

- メトリクスは3つだけ(約 $1/月。目安は Blocks の README の約 $0.30/メトリクス/月)。route を次元にすると、組み合わせの数だけ費用が増えるため、ログで見る。
- `copilotkit` の処理時間は、ストリーミング応答では、最初の応答が返るまでの時間。
- route 別の集計の例(SSR 用 Lambda のロググループで実行):

```
filter message = "API リクエスト"
| stats count(*) as n, avg(durationMs) as avg_ms, pct(durationMs, 99) as p99_ms by route, status
| sort n desc
```

### 3.3 アラーム・ダッシュボード

| 対象 | 状態 | 内容 |
|---|---|---|
| SSR Lambda のエラー・スロットル | △ | `monitoring` で作成(`QuestBoardWeb`)。通知先は環境変数 `ALERT_EMAIL`(未設定なら通知なし) |
| CloudFront の 5xx | △ | us-east-1 の補助スタック `QuestBoardWeb-CfMonitoring-*` |
| 5xx 率のアラーム(`ApiErrors`) | × | 未作成 |
| 定期取得の失敗通知 | △ | `QuestBoardBatch` に、Lambda(DailyQuests)の `Errors` が 1 以上でメールするアラームを作成(宛先は `ALERT_EMAIL`)。Scheduler から Lambda を呼べなかった場合は対象外。synth で作成を確認、AWS では未確認 |
| 対話用エージェントの失敗通知 | × | 未作成 |
| ダッシュボード | × | 未作成。Blocks の `Dashboard` を足して synth したところ、対象は認証 API 用の Lambda(`DefaultComputeHandler`)だけで、SSR 用 Lambda は含まれなかった(2026-10-31 に確認) |

## 4. 課題

- ダッシュボードの作成(CDK の標準の `cloudwatch.Dashboard` を検討)。
- 対話用エージェントの失敗通知。
- エージェント(Python)のログの構造化は、ツールとバッチを `common/log.py` の JSON 1 行にした。Jev の判定ログ(`ui_router.py`)は別の書式のまま。
- `copilotkit` のリクエスト用ロガー。
