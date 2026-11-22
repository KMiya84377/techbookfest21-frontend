// 定期実行用エージェントの AWS 構成(CDK)。CDK のアプリは webapp/ にあり、
// webapp/cdk-blocks/index.cdk.ts がこの関数を呼んで、QuestBoardBatch スタックを作る。
// 依存(aws-cdk-lib)は webapp/node_modules のものを使う(webapp/tsconfig.json の paths)。
import * as path from "node:path";
import {
  CfnOutput,
  Duration,
  Stack,
  TimeZone,
  type App,
  type Environment,
} from "aws-cdk-lib";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cwActions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as targets from "aws-cdk-lib/aws-scheduler-targets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";

const MODEL_ID = "moonshotai.kimi-k2.5";

interface BatchAgentStackProps {
  env: Environment;
  // Web スタック(Blocks)のニュースのテーブル名
  newsTable: string;
  // 定期取得の失敗を知らせるメールの宛先(未設定なら、アラームは作るが通知しない)
  alertEmail?: string;
}

export function createBatchAgentStack(
  app: App,
  { env, newsTable, alertEmail }: BatchAgentStackProps,
) {
  const stack = new Stack(app, "QuestBoardBatch", { env });
  // CDK を実行するフォルダ(webapp/)からの、このエージェントのフォルダ
  const agentDir = path.resolve("..", "batch-agent");

  // Runtime(HTTP)。このフォルダの Dockerfile でビルドする
  const batch = new agentcore.Runtime(stack, "BatchAgentRuntime", {
    agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(agentDir, {
      platform: ecrAssets.Platform.LINUX_ARM64,
    }),
    protocolConfiguration: agentcore.ProtocolType.HTTP,
    // 共通のニュースだけを保存する(ユーザーごとの状態は作らない)ので、ユーザー用テーブルは渡さない
    environmentVariables: {
      NEWS_TABLE: newsTable,
      MODEL_ID,
    },
  });

  // ニュースのテーブルの読み書きと、モデルの呼び出し
  dynamodb.Table.fromTableName(stack, "News", newsTable).grantReadWriteData(
    batch,
  );
  batch.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [`arn:aws:bedrock:*::foundation-model/${MODEL_ID}`],
    }),
  );

  // 重複ニュースを調べるため、使用するGSIだけにQueryを許可する。
  batch.addToRolePolicy(
    new iam.PolicyStatement({
      sid: "BatchNewsFeedIndexQuery",
      actions: ["dynamodb:Query"],
      resources: [
        stack.formatArn({
          service: "dynamodb",
          resource: "table",
          resourceName: `${newsTable}/index/ByFeedPublishedAt`,
        }),
      ],
    }),
  );

  // 毎朝6時(東京時間)に Lambda が、この Runtime を呼ぶ(コードは scheduler/)
  const daily = new lambda.Function(stack, "DailyQuests", {
    runtime: lambda.Runtime.PYTHON_3_13,
    handler: "handler.handler",
    code: lambda.Code.fromAsset(path.join(agentDir, "scheduler")),
    timeout: Duration.minutes(15),
    memorySize: 256,
    environment: { RUNTIME_ARN: batch.agentRuntimeArn },
  });
  batch.grantInvokeRuntime(daily);
  new scheduler.Schedule(stack, "DailyQuestsSchedule", {
    schedule: scheduler.ScheduleExpression.cron({
      minute: "0",
      hour: "6",
      timeZone: TimeZone.ASIA_TOKYO,
    }),
    target: new targets.LambdaInvoke(daily, { retryAttempts: 0 }),
  });

  // 失敗の通知: Lambda がエラー(エージェントの失敗を含む)で終わったら、メールで知らせる
  //   Scheduler から Lambda を呼べなかった場合は含まれない
  const alertTopic = new sns.Topic(stack, "BatchAlertTopic");
  if (alertEmail) {
    alertTopic.addSubscription(new subs.EmailSubscription(alertEmail));
  }
  new cloudwatch.Alarm(stack, "DailyQuestsErrors", {
    alarmDescription: "毎朝の定期取得(DailyQuests)が失敗した",
    metric: daily.metricErrors({ period: Duration.hours(1), statistic: "Sum" }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator:
      cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  }).addAlarmAction(new cwActions.SnsAction(alertTopic));

  new CfnOutput(stack, "BatchAgentRuntimeArn", {
    value: batch.agentRuntimeArn,
  });

  return { stack, runtime: batch };
}
