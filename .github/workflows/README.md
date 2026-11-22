# CI/CD(GitHub Actions)

AWSへのデプロイのワークフローです。本の第4章4.4.4のとおり、Webアプリ・チャット用エージェント・定期取得用エージェントを、別々のワークフローに分けています。AIエージェントだけを変更した場合は、Webアプリを再デプロイせずに更新できます。

## ワークフロー

| ワークフロー | デプロイするスタック | 内容 | 実行するコマンド |
| --- | --- | --- | --- |
| [deploy-web.yml](deploy-web.yml) | `QuestBoardWeb` | Webアプリと、Blocksの認証・DB・Hosting | `npm run deploy:web` |
| [deploy-agent.yml](deploy-agent.yml) | `QuestBoardAgent` | チャット用エージェント(AgentCore Runtime・記憶) | `npm run deploy:agent` |
| [deploy-batch.yml](deploy-batch.yml) | `QuestBoardBatch` | 定期取得用エージェント(AgentCore Runtime・Scheduler・アラーム) | `npm run deploy:batch` |

スタックの定義は、[webapp/cdk-blocks/index.cdk.ts](../../webapp/cdk-blocks/index.cdk.ts)(Web)、[chat-agent/infra/stack.ts](../../chat-agent/infra/stack.ts)(チャット用)、[batch-agent/infra/stack.ts](../../batch-agent/infra/stack.ts)(定期取得用)です。

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

デプロイの順番に、CloudFormationの依存はありません(エージェントのスタックは、Webスタックのテーブルを、名前の文字列で参照します。名前は[constants.ts](../../webapp/cdk-blocks/constants.ts)の定数から決まり、`synth`した結果との一致は`tests/blocks-template.test.ts`で確かめます)。ただし、実際に動かすには、次の順に実行してください。

1. Web(テーブルと認証ができる)
2. チャット用・定期取得用(テーブルが存在しないと、エージェントが読み書きできない)

チャット用エージェントの接続先(RuntimeのARN)は、チャット用のスタックがSSMパラメーターに保存し、Webアプリが実行時に読みます。チャット用を先に実行しても、Webアプリは、実行時にSSMを読むだけなので、Webのデプロイは失敗しません。

2回目以降は、変更したものだけを実行します。
