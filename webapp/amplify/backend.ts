import * as path from "node:path";
import { defineBackend } from "@aws-amplify/backend";
import { Duration, RemovalPolicy, TimeZone } from "aws-cdk-lib";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as targets from "aws-cdk-lib/aws-scheduler-targets";
import { auth } from "./auth/resource";

const backend = defineBackend({
  auth,
});

// エージェント(Strands)を AgentCore Runtime にデプロイする(カスタムリソース)
const agentStack = backend.createStack("agent");

// クエストを保存するテーブル(ユーザーごとに持つ)
//   userId: ユーザー ID(Cognito の sub)
//   questId: 「公開日時#ニュースの ID」。新しい順に取れる
const questTable = new dynamodb.Table(agentStack, "QuestTable", {
  partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
  sortKey: { name: "questId", type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  // サンプルアプリのため、環境を削除したらテーブルも削除する
  removalPolicy: RemovalPolicy.DESTROY,
});

// エージェントの記憶(AgentCore Memory)
//   短期記憶: 会話のイベントを保存し、会話の続きを再現する
//   長期記憶: 会話から、好み、事実、エピソードを取り出して、会話をまたいで使う
//   namespace の {actorId} はユーザー、{sessionId} は会話(スレッド)
const memory = new agentcore.Memory(agentStack, "AgentMemory", {
  description: "クエストの学習アシスタントの記憶",
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
      // 複数のエピソードから、振り返りを作る(エピソードの namespace の上位)
      reflectionConfiguration: { namespaces: ["/episodes/{actorId}/"] },
    }),
  ],
});

const agentRuntime = new agentcore.Runtime(agentStack, "AgentRuntime", {
  // agent/ の Dockerfile からイメージをビルドして ECR に登録する(ARM64)
  // x86 のマシン(CI など)でも ARM64 でビルドするよう、プラットフォームを明示する
  agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
    path.resolve(process.cwd(), "..", "agent"),
    { platform: ecrAssets.Platform.LINUX_ARM64 },
  ),
  protocolConfiguration: agentcore.ProtocolType.AGUI,
  environmentVariables: {
    QUEST_TABLE: questTable.tableName,
    MEMORY_ID: memory.memoryId,
  },
});

// エージェントが、クエストを読み書きする権限
questTable.grantReadWriteData(agentRuntime);

// エージェントが、記憶を読み書きする権限
memory.grantRead(agentRuntime);
memory.grantWrite(agentRuntime);

// Bedrock のモデルを呼び出す権限(JP 推論プロファイルと、その先の基盤モデル)
agentRuntime.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ],
    resources: [
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-*",
      `arn:aws:bedrock:*:${agentStack.account}:inference-profile/*anthropic.claude-*`,
    ],
  }),
);

// 毎朝、エージェントに、クエストの作成を頼む(EventBridge Scheduler → Lambda → AgentCore Runtime)
//   Lambda が、Cognito のユーザーを一覧し、ユーザーごとに、エージェントを呼び出す
const { userPool } = backend.auth.resources;
const dailyQuests = new lambda.Function(agentStack, "DailyQuests", {
  runtime: lambda.Runtime.PYTHON_3_13,
  handler: "handler.handler",
  code: lambda.Code.fromAsset(
    path.resolve(process.cwd(), "amplify", "jobs", "daily-quests"),
  ),
  // エージェントの実行(ニュースの取得と、クエストの作成)を、待つ
  timeout: Duration.minutes(15),
  memorySize: 256,
  environment: {
    RUNTIME_ARN: agentRuntime.agentRuntimeArn,
    USER_POOL_ID: userPool.userPoolId,
  },
});
agentRuntime.grantInvokeRuntime(dailyQuests);
dailyQuests.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["cognito-idp:ListUsers"],
    resources: [userPool.userPoolArn],
  }),
);
new scheduler.Schedule(agentStack, "DailyQuestsSchedule", {
  description: "毎朝 6 時(日本時間)に、クエストを自動で作成する",
  schedule: scheduler.ScheduleExpression.cron({
    minute: "0",
    hour: "6",
    timeZone: TimeZone.ASIA_TOKYO,
  }),
  // 失敗しても、再実行しない(モデルの呼び出しを、繰り返さないため)
  target: new targets.LambdaInvoke(dailyQuests, { retryAttempts: 0 }),
});

// バックエンド(CopilotRuntime とクエストの API)が接続先を知るための出力
backend.addOutput({
  custom: {
    agentRuntimeArn: agentRuntime.agentRuntimeArn,
    questTableName: questTable.tableName,
    memoryId: memory.memoryId,
    dailyQuestsFunctionName: dailyQuests.functionName,
  },
});
