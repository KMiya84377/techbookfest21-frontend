import * as path from "node:path";
import { App, CfnOutput, Duration } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import { BlocksPresets, BlocksStack, Hosting } from "@aws-blocks/blocks/cdk";
import type { Construct } from "constructs";
import { astroHostingAdapter } from "../infra/astroHostingAdapter";
import { createAgentStacks } from "../infra/agents";
import { configureStreamingIntegrationTimeout } from "../infra/hostingTimeout";
import { AGENT_RUNTIME_PARAMETER } from "./constants";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
};

// Web スタック(Blocks: 認証・データ保存・Hosting)
const web = await BlocksStack.create(app, "QuestBoardWeb", {
  env,
  backendHandlerPath: path.resolve("aws-blocks/index.handler.ts"),
  backendCDKPath: path.resolve("aws-blocks/index.ts"),
  defaults: BlocksPresets.production,
});

// BlocksがCDK条件で読み込んだ同じリソースから接続情報を取得する。
const { auth } = await import("./auth");
const { news, userQuests, settings } = await import("./storage");

// 公開ランタイム用のgetSdkIdentifiersはCDKでは登録されないため、生成されたConstructから参照する。
const tableOf = (block: object) => {
  const table = (block as Construct).node
    .findAll()
    .find((child): child is dynamodb.Table => child instanceof dynamodb.Table);
  if (!table) throw new Error("BlocksのDynamoDBテーブルが見つかりません");
  return table;
};

const newsTableName = tableOf(news).tableName;
const userQuestTableName = tableOf(userQuests).tableName;
const settingsTableName = tableOf(settings).tableName;

const authConstruct = auth as unknown as {
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
};
const userPoolId = authConstruct.userPool.userPoolId;
const userPoolClientId = authConstruct.userPoolClient.userPoolClientId;

// 公開環境は管理者が招待したユーザーのみ。UIを迂回した直接の自己登録もCognitoで拒否する。
// Blocksのローカル認証には影響させず、AWS用テンプレートにだけ適用する。
const cfnUserPool = authConstruct.userPool.node.defaultChild;
if (!(cfnUserPool instanceof cognito.CfnUserPool)) {
  throw new Error("招待制を設定するCognito User Poolが見つかりません");
}
cfnUserPool.addPropertyOverride("AdminCreateUserConfig.AllowAdminCreateUserOnly", true);

// エージェントのスタック(対話用・定期取得用)
createAgentStacks(
  app,
  env,
  { news: newsTableName, userQuests: userQuestTableName },
  process.env.ALERT_EMAIL,
);

// Hosting(Astro の SSR)
const ssrTimeout = Duration.minutes(5);
const hosting = new Hosting(web, "Hosting", {
  root: path.resolve("."),
  framework: "astro",
  // /aws-blocks/... を同じドメインで中継する(CORS 不要)
  api: web,
  // synth 時に実行される
  buildCommand: "npm run build",
  // 公式アダプターが Astro 7 を読めないための差し替え
  customAdapter: astroHostingAdapter,
  // SSR 用 Lambda。API Gatewayの統合タイムアウトも下で同じ値に設定する。
  compute: { timeout: ssrTimeout },
  // 5xx・Lambda エラーのアラーム。通知先は ALERT_EMAIL(未設定なら通知なし)
  // CloudFront のアラームは、us-east-1 の補助スタック(QuestBoardWeb-CfMonitoring-*)に作られる
  monitoring: {
    subscriptions: process.env.ALERT_EMAIL
      ? [new subs.EmailSubscription(process.env.ALERT_EMAIL)]
      : [],
  },
  // SSR 用 Lambda の環境変数。BLOCKS_STACK_NAME は AWS 上かどうかの判定に、
  // Cognito の ID は JWT の検証に使う(src/server/blocks/serverConfig.ts の serverConfig)
  environment: {
    BLOCKS_STACK_NAME: web.stackName,
    COGNITO_USER_POOL_ID: userPoolId,
    COGNITO_CLIENT_ID: userPoolClientId,
  },
});

configureStreamingIntegrationTimeout(hosting, ssrTimeout);

const ssrFunction = hosting.ssrFunction;
if (!ssrFunction) throw new Error("Astro SSR用Lambdaがありません");

// SSR 用 Lambda に必要な権限だけを付ける
dynamodb.Table.fromTableName(web, "News", newsTableName).grantReadData(ssrFunction);
// 名前から参照したテーブルのgrantReadDataには、GSIの権限が含まれない。
// クエスト一覧が検索するインデックスだけにQueryを許可する。
ssrFunction.addToRolePolicy(
  new iam.PolicyStatement({
    sid: "NewsFeedIndexQuery",
    actions: ["dynamodb:Query"],
    resources: [web.formatArn({
      service: "dynamodb",
      resource: "table",
      resourceName: `${newsTableName}/index/ByFeedPublishedAt`,
    })],
  }),
);
dynamodb.Table.fromTableName(web, "UserQuests", userQuestTableName).grantReadWriteData(ssrFunction);
dynamodb.Table.fromTableName(web, "UserSettings", settingsTableName).grantReadWriteData(ssrFunction);
// 接続先は後続のAgentスタックが作るため、デプロイ時には値を解決しない。
ssrFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: [web.formatArn({
      service: "ssm",
      resource: "parameter",
      resourceName: AGENT_RUNTIME_PARAMETER.replace(/^\//, ""),
    })],
  }),
);
ssrFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["bedrock-agentcore:InvokeAgentRuntime", "bedrock-agentcore:InvokeAgentRuntimeForUser"],
    resources: [
      web.formatArn({
        service: "bedrock-agentcore",
        resource: "runtime",
        resourceName: "quest_board_chat-*",
      }),
    ],
  }),
);

// 出力
const outputs = {
  NewsTableName: newsTableName,
  UserQuestTableName: userQuestTableName,
  UserSettingsTableName: settingsTableName,
  UserPoolId: userPoolId,
  UserPoolClientId: userPoolClientId,
};
for (const [name, value] of Object.entries(outputs)) {
  new CfnOutput(web, name, { value });
}
new CfnOutput(web, "WebUrl", { value: hosting.url });
