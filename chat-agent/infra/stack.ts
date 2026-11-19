// チャット用エージェントの AWS 構成(CDK)。CDK のアプリは webapp/ にあり、
// webapp/aws-blocks/index.cdk.ts がこの関数を呼んで、QuestBoardAgent スタックを作る。
// 依存(aws-cdk-lib)は webapp/node_modules のものを使う(webapp/tsconfig.json の paths)。
import * as path from "node:path";
import {
  Aws,
  CfnOutput,
  Duration,
  Stack,
  type App,
  type Environment,
} from "aws-cdk-lib";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";

const MODEL_ID = "moonshotai.kimi-k2.5";
// AgentCore Identity に作成済みの、Jev の API キーの名前
const JEV_API_KEY_PROVIDER = "typesafe-jev-api";

interface ChatAgentStackProps {
  env: Environment;
  // Web スタック(Blocks)のテーブル名
  tables: { news: string; userQuests: string };
  // Runtime の ARN を保存する SSM パラメーターの名前(Web 側が、ここから接続先を読む)
  runtimeParameterName: string;
}

export function createChatAgentStack(
  app: App,
  { env, tables, runtimeParameterName }: ChatAgentStackProps,
) {
  const stack = new Stack(app, "QuestBoardAgent", { env });

  // 記憶(AgentCore Memory)
  const memory = new agentcore.Memory(stack, "AgentMemory", {
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

  // Runtime(AG-UI)。このフォルダ(chat-agent/)の Dockerfile でビルドする
  //   パスは、CDK を実行するフォルダ(webapp/)からの相対
  const runtime = new agentcore.Runtime(stack, "AgentRuntime", {
    runtimeName: "quest_board_chat",
    agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
      path.resolve("..", "chat-agent"),
      { platform: ecrAssets.Platform.LINUX_ARM64 },
    ),
    protocolConfiguration: agentcore.ProtocolType.AGUI,
    environmentVariables: {
      NEWS_TABLE: tables.news,
      USER_QUEST_TABLE: tables.userQuests,
      MEMORY_ID: memory.memoryId,
      MODEL_ID,
      JEV_API_KEY_PROVIDER_NAME: JEV_API_KEY_PROVIDER,
    },
  });

  // ニュースのテーブルの読み書きと、モデルの呼び出し
  dynamodb.Table.fromTableName(stack, "News", tables.news).grantReadWriteData(
    runtime,
  );
  runtime.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      resources: [`arn:aws:bedrock:*::foundation-model/${MODEL_ID}`],
    }),
  );

  // ユーザー用テーブルの読み書き(クエストの状態・週間レポートの記録)
  dynamodb.Table.fromTableName(
    stack,
    "UserQuests",
    tables.userQuests,
  ).grantReadWriteData(runtime);

  // 記憶の読み書き
  memory.grantRead(runtime);
  memory.grantWrite(runtime);

  // Jev の API キーを、AgentCore Identity から取得する
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

  // 接続先は、Web 側が SSM から読む(スタック間の循環を避けるため)
  new ssm.StringParameter(stack, "AgentRuntimeParameter", {
    parameterName: runtimeParameterName,
    stringValue: runtime.agentRuntimeArn,
  });
  new CfnOutput(stack, "AgentRuntimeArn", { value: runtime.agentRuntimeArn });

  return { stack, runtime };
}
