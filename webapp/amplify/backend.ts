import * as path from "node:path";
import { defineBackend } from "@aws-amplify/backend";
import * as agentcore from "aws-cdk-lib/aws-bedrockagentcore";
import * as ecrAssets from "aws-cdk-lib/aws-ecr-assets";
import * as iam from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";

const backend = defineBackend({
  auth,
});

// エージェント(Strands)を AgentCore Runtime にデプロイする(カスタムリソース)
const agentStack = backend.createStack("agent");

const agentRuntime = new agentcore.Runtime(agentStack, "AgentRuntime", {
  // agent/ の Dockerfile からイメージをビルドして ECR に登録する(ARM64)
  // x86 のマシン(CI など)でも ARM64 でビルドするよう、プラットフォームを明示する
  agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(
    path.resolve(process.cwd(), "..", "agent"),
    { platform: ecrAssets.Platform.LINUX_ARM64 },
  ),
  protocolConfiguration: agentcore.ProtocolType.AGUI,
});

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

// バックエンド(CopilotRuntime)が接続先を知るための出力
backend.addOutput({
  custom: {
    agentRuntimeArn: agentRuntime.agentRuntimeArn,
  },
});
