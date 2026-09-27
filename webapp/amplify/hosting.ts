import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { defineHosting } from "@aws-amplify/hosting";

const hosting = defineHosting({
  // エージェントの応答(SSE)が長くなるため、SSR の Lambda のタイムアウトを延ばす(既定は 30 秒)
  compute: { timeout: 60 },
});

// Quests テーブルの名前(バックエンドのデプロイで、amplify_outputs.json に出力される)
// まだない場合は、アカウントとリージョン内のテーブル全体に許可する
const outputsPath = path.resolve(process.cwd(), "amplify_outputs.json");
const questTableName: string | undefined = existsSync(outputsPath)
  ? JSON.parse(readFileSync(outputsPath, "utf-8")).custom?.questTableName
  : undefined;
if (!questTableName) {
  console.warn(
    "amplify_outputs.json に custom.questTableName がありません。DynamoDB の権限を、テーブル全体に付けます。先にバックエンドをデプロイしてください",
  );
}

// SSR の Lambda に、次の権限を付ける
//   - AgentCore Runtime を呼び出す権限(SigV4 署名に使われる実行ロール)
    //   - Quests テーブルを読む・状態を更新する権限
// defineHosting の resources には SSR の Lambda が含まれないため、CDK のツリーから探す
const { region, account } = hosting.stack;
for (const construct of hosting.stack.node.findAll()) {
  if (
    construct instanceof lambda.Function &&
    /Compute-(default|server)/.test(construct.node.path)
  ) {
    construct.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock-agentcore:InvokeAgentRuntime"],
        resources: [`arn:aws:bedrock-agentcore:${region}:${account}:runtime/*`],
      }),
    );
    construct.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dynamodb:Query", "dynamodb:UpdateItem"],
        resources: [
          `arn:aws:dynamodb:${region}:${account}:table/${questTableName ?? "*"}`,
        ],
      }),
    );
  }
}
