import * as path from "node:path";
import {
  Aws,
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
import * as ssm from "aws-cdk-lib/aws-ssm";
import { AGENT_RUNTIME_PARAMETER } from "../aws-blocks/constants";

const MODEL_ID = "moonshotai.kimi-k2.5";
// AgentCore Identity に作成済みの、Jev の API キーの名前
const JEV_API_KEY_PROVIDER = "typesafe-jev-api";

export function createAgentStacks(
  app: App,
  env: Environment,
  tables: { news: string; userQuests: string },
  // 定期取得の失敗を知らせるメールの宛先(未設定なら、アラームは作るが通知しない)
  alertEmail?: string,
) {
  const agentStack = new Stack(app, "QuestBoardAgent", { env });
  const batchStack = new Stack(app, "QuestBoardBatch", { env });

  // 記憶(AgentCore Memory)
  const memory = new agentcore.Memory(agentStack, "AgentMemory", {
    expirationDuration: Duration.days(90),
    memoryStrategies: [
      agentcore.MemoryStrategy.usingUserPreference({
        strategyName: "preferences",
        namespaces: ["/preferences/{actorId}/"],
      }),
      agentcore.MemoryStrategy.usingSemantic({
        strategyName: "facts",
        namespaces: ["/facts/{actorId}/"],
      }),
      agentcore.MemoryStrategy.usingEpisodic({
        strategyName: "episodes",
        namespaces: ["/episodes/{actorId}/{sessionId}/"],
        reflectionConfiguration: { namespaces: ["/episodes/{actorId}/"] },
      }),
    ],
  });

  // エージェントの Runtime(対話用は AG-UI、定期取得用は HTTP)
  const artifact = (file: string) =>
    agentcore.AgentRuntimeArtifact.fromAsset(path.resolve("..", "agent"), {
      file,
      platform: ecrAssets.Platform.LINUX_ARM64,
    });

  const runtime = new agentcore.Runtime(agentStack, "AgentRuntime", {
    runtimeName: "quest_board_chat",
    agentRuntimeArtifact: artifact("chat/Dockerfile"),
    protocolConfiguration: agentcore.ProtocolType.AGUI,
    environmentVariables: {
      NEWS_TABLE: tables.news,
      USER_QUEST_TABLE: tables.userQuests,
      MEMORY_ID: memory.memoryId,
      MODEL_ID,
      JEV_API_KEY_PROVIDER_NAME: JEV_API_KEY_PROVIDER,
    },
  });

  const batch = new agentcore.Runtime(batchStack, "BatchAgentRuntime", {
    agentRuntimeArtifact: artifact("batch/Dockerfile"),
    protocolConfiguration: agentcore.ProtocolType.HTTP,
    environmentVariables: {
      NEWS_TABLE: tables.news,
      USER_QUEST_TABLE: tables.userQuests,
      MODEL_ID,
    },
  });

  // どちらの Runtime にも、テーブルの読み書きとモデルの呼び出しを許可する
  for (const [stack, target] of [
    [agentStack, runtime],
    [batchStack, batch],
  ] as const) {
    dynamodb.Table.fromTableName(stack, "News", tables.news).grantReadWriteData(target);
    dynamodb.Table.fromTableName(stack, "UserQuests", tables.userQuests).grantReadWriteData(target);
    target.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: [`arn:aws:bedrock:*::foundation-model/${MODEL_ID}`],
      }),
    );
  }

  // バッチが重複ニュースを調べるため、使用するGSIだけにQueryを許可する。
  batch.addToRolePolicy(
    new iam.PolicyStatement({
      sid: "BatchNewsFeedIndexQuery",
      actions: ["dynamodb:Query"],
      resources: [batchStack.formatArn({
        service: "dynamodb",
        resource: "table",
        resourceName: `${tables.news}/index/ByFeedPublishedAt`,
      })],
    }),
  );

  // 対話用 Runtime: 記憶の読み書き
  memory.grantRead(runtime);
  memory.grantWrite(runtime);

  // 対話用 Runtime: Jev の API キーを、AgentCore Identity から取得する
  const agentCoreArn = `arn:${Aws.PARTITION}:bedrock-agentcore:${Aws.REGION}:${Aws.ACCOUNT_ID}`;
  runtime.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["bedrock-agentcore:GetResourceApiKey"],
      resources: [
        `${agentCoreArn}:workload-identity-directory/default`,
        `${agentCoreArn}:workload-identity-directory/default/workload-identity/*`,
        `${agentCoreArn}:token-vault/default`,
        `${agentCoreArn}:token-vault/default/apikeycredentialprovider/${JEV_API_KEY_PROVIDER}`,
      ],
    }),
  );
  runtime.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["secretsmanager:GetSecretValue"],
      resources: [
        `arn:${Aws.PARTITION}:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:bedrock-agentcore-identity!default/apikey/${JEV_API_KEY_PROVIDER}-*`,
      ],
    }),
  );

  // 定期取得: 毎朝6時(東京時間)に Lambda が、バッチ用 Runtime を呼ぶ
  const daily = new lambda.Function(batchStack, "DailyQuests", {
    runtime: lambda.Runtime.PYTHON_3_13,
    handler: "handler.handler",
    code: lambda.Code.fromAsset(path.resolve("infra/jobs/daily-quests")),
    timeout: Duration.minutes(15),
    memorySize: 256,
    environment: { RUNTIME_ARN: batch.agentRuntimeArn },
  });
  batch.grantInvokeRuntime(daily);
  new scheduler.Schedule(batchStack, "DailyQuestsSchedule", {
    schedule: scheduler.ScheduleExpression.cron({
      minute: "0",
      hour: "6",
      timeZone: TimeZone.ASIA_TOKYO,
    }),
    target: new targets.LambdaInvoke(daily, { retryAttempts: 0 }),
  });

  // 定期取得の失敗の通知: Lambda がエラー(エージェントの失敗を含む)で終わったら、メールで知らせる
  //   Scheduler から Lambda を呼べなかった場合は含まれない
  const alertTopic = new sns.Topic(batchStack, "BatchAlertTopic");
  if (alertEmail) alertTopic.addSubscription(new subs.EmailSubscription(alertEmail));
  new cloudwatch.Alarm(batchStack, "DailyQuestsErrors", {
    alarmDescription: "毎朝の定期取得(DailyQuests)が失敗した",
    metric: daily.metricErrors({ period: Duration.hours(1), statistic: "Sum" }),
    threshold: 1,
    evaluationPeriods: 1,
    comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
  }).addAlarmAction(new cwActions.SnsAction(alertTopic));

  // 対話用 Runtime の接続先は、Web 側が SSM から読む(スタック間の循環を避けるため)
  new ssm.StringParameter(agentStack, "AgentRuntimeParameter", {
    parameterName: AGENT_RUNTIME_PARAMETER,
    stringValue: runtime.agentRuntimeArn,
  });
  new CfnOutput(agentStack, "AgentRuntimeArn", { value: runtime.agentRuntimeArn });
  new CfnOutput(batchStack, "BatchAgentRuntimeArn", { value: batch.agentRuntimeArn });

  return { runtime, batch };
}
