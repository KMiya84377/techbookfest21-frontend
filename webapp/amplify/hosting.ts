import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { defineHosting } from "@aws-amplify/hosting";

const hosting = defineHosting({
  // エージェントの応答(SSE)が長くなるため、SSR の Lambda のタイムアウトを延ばす(既定は 30 秒)
  compute: { timeout: 60 },
});

// SSR の Lambda に、AgentCore Runtime を呼び出す権限を付ける(SigV4 署名に使われる実行ロール)
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
  }
}
