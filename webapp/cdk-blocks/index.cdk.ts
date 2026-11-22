import * as path from "node:path";
import { App, CfnOutput } from "aws-cdk-lib";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { computeScopeFullId } from "aws-cdk-blocks";
import { BlocksPresets, BlocksStack } from "aws-cdk-blocks/cdk";
import { createBatchAgentStack } from "../../batch-agent/infra/stack";
import { createChatAgentStack } from "../../chat-agent/infra/stack";
import {
  AGENT_RUNTIME_PARAMETER,
  NEWS_TABLE_ID,
  USER_QUESTS_TABLE_ID,
  USER_SETTINGS_TABLE_ID,
  WEB_STACK_NAME,
} from "./constants";
import { createHosting } from "./hosting";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-northeast-1",
};

// Web スタック(Blocks: 認証・データ保存・Hosting)
const web = await BlocksStack.create(app, WEB_STACK_NAME, {
  env,
  backendHandlerPath: path.resolve("cdk-blocks/index.handler.ts"),
  backendCDKPath: path.resolve("cdk-blocks/index.ts"),
  defaults: {
    ...BlocksPresets.production,
    accessLogging: true,
    logRetention: RetentionDays.ONE_MONTH,
  },
});

// BlocksがCDK条件で読み込む、バックエンドの定義(認証・スコープ)。スタックを作った後に読み込む。
const { auth } = await import("./auth");
const { scope } = await import("./storage");

// DynamoDBのテーブル名は、Blockのスコープとidから決まる(KVStoreの仕様)。
const tableName = (id: string) => computeScopeFullId({ id, parent: scope });
const newsTableName = tableName(NEWS_TABLE_ID);
const userQuestTableName = tableName(USER_QUESTS_TABLE_ID);
const settingsTableName = tableName(USER_SETTINGS_TABLE_ID);

// CognitoのユーザープールとクライアントのIDを取り出す(Lambdaの環境変数と、招待制の設定に使う)。
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
cfnUserPool.addPropertyOverride(
  "AdminCreateUserConfig.AllowAdminCreateUserOnly",
  true,
);

// チャット用エージェントのスタックを作成
createChatAgentStack(app, {
  env,
  tables: {
    news: newsTableName,
    userQuests: userQuestTableName
  },
  runtimeParameterName: AGENT_RUNTIME_PARAMETER,
});

// バッチ実行用エージェントのスタックを作成
createBatchAgentStack(app, {
  env,
  newsTable: newsTableName,
  alertEmail: process.env.ALERT_EMAIL,
});

// Hosting(Astro の SSR)を作成
const hosting = createHosting(web, { userPoolId, userPoolClientId });

const ssrFunction = hosting.ssrFunction;
if (!ssrFunction) throw new Error("Astro SSR用Lambdaがありません");

// SSR 用 Lambda に必要な権限だけを付ける
dynamodb.Table.fromTableName(web, "News", newsTableName).grantReadData(
  ssrFunction,
);

// 名前から参照したテーブルのgrantReadDataには、GSIの権限が含まれない。
// クエスト一覧が検索するインデックスだけにQueryを許可する。
ssrFunction.addToRolePolicy(
  new iam.PolicyStatement({
    sid: "NewsFeedIndexQuery",
    actions: ["dynamodb:Query"],
    resources: [
      web.formatArn({
        service: "dynamodb",
        resource: "table",
        resourceName: `${newsTableName}/index/ByFeedPublishedAt`,
      }),
    ],
  }),
);
dynamodb.Table.fromTableName(
  web,
  "UserQuests",
  userQuestTableName,
).grantReadWriteData(ssrFunction);

dynamodb.Table.fromTableName(
  web,
  "UserSettings",
  settingsTableName,
).grantReadWriteData(ssrFunction);

ssrFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ["ssm:GetParameter"],
    resources: [
      web.formatArn({
        service: "ssm",
        resource: "parameter",
        resourceName: AGENT_RUNTIME_PARAMETER.replace(/^\//, ""),
      }),
    ],
  }),
);

ssrFunction.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      "bedrock-agentcore:InvokeAgentRuntime",
      "bedrock-agentcore:InvokeAgentRuntimeForUser",
    ],
    resources: [
      web.formatArn({
        service: "bedrock-agentcore",
        resource: "runtime",
        resourceName: "quest_board_chat-*",
      }),
    ],
  }),
);

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
