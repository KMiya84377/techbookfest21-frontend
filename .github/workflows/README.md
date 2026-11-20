# CI/CD(GitHub Actions)

AWSへのデプロイのワークフローです。本の第4章4.4.4のとおり、Webアプリ・チャット用エージェント・定期取得用エージェントを、別々のワークフローに分けています。AIエージェントだけを変更した場合は、Webアプリを再デプロイせずに更新できます。

## ワークフロー

| ワークフロー | デプロイするスタック | 内容 | 実行するコマンド |
| --- | --- | --- | --- |
| [deploy-web.yml](deploy-web.yml) | `QuestBoardWeb` | Webアプリと、Blocksの認証・DB・Hosting | `npm run deploy:web` |
| [deploy-agent.yml](deploy-agent.yml) | `QuestBoardAgent` | チャット用エージェント(AgentCore Runtime・記憶) | `npm run deploy:agent` |
| [deploy-batch.yml](deploy-batch.yml) | `QuestBoardBatch` | 定期取得用エージェント(AgentCore Runtime・Scheduler・アラーム) | `npm run deploy:batch` |

スタックの定義は、[webapp/aws-blocks/index.cdk.ts](../../webapp/aws-blocks/index.cdk.ts)(Web)、[chat-agent/infra/stack.ts](../../chat-agent/infra/stack.ts)(チャット用)、[batch-agent/infra/stack.ts](../../batch-agent/infra/stack.ts)(定期取得用)です。

3つのワークフローの共通点は、次のとおりです。

- 手動実行(`workflow_dispatch`)です。GitHubのActionsタブで、ワークフローを選んで「Run workflow」を押します。
- `webapp/`でCDKを実行します。`--exclusively`で、指定したスタックだけをデプロイし、ほかのスタックは更新しません。
- 同じワークフローは、同時に1つだけ動きます(`concurrency`)。
- リージョンは`ap-northeast-1`です。
- エージェントの2つは、x86のランナーでARM64のDockerイメージをビルドするため、QEMUを使います。

## 事前の準備

- AWSアカウントで、CDKのbootstrapを済ませておきます。
- GitHubのOIDCから引き受けられる、デプロイ用のIAMロールを作ります。
- リポジトリのVariablesに、次を登録します。

| 名前 | 必須 | 内容 |
| --- | --- | --- |
| `AWS_ROLE_ARN` | ○ | デプロイに使うIAMロールのARN |
| `ALERT_EMAIL` | － | アラームの通知先メール(Web・定期取得)。未設定なら通知しない |

## 初回の順番

最初は、Web → チャット用 → 定期取得用の順に実行します。2つのエージェントのスタックは、Webスタックが作るテーブル名を参照するためです。チャット用エージェントの接続先(RuntimeのARN)は、チャット用のスタックがSSMパラメーターに保存し、Webアプリが実行時に読みます。

2回目以降は、変更したものだけを実行します。
