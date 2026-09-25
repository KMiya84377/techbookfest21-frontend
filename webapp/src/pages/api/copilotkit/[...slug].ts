import type { APIRoute } from "astro";
import { HttpAgent } from "@ag-ui/client";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import outputs from "../../../../amplify_outputs.json";
import { createAgentCoreAgent } from "../../../lib/agentcore";

// リクエストごとにサーバーで動かす(静的ファイルにしない)
export const prerender = false;

// エージェントの接続先
//   AGENT_RUNTIME_ARN があれば、AgentCore Runtime に SigV4 署名つきで接続する
//   本番ビルドでは、環境変数がなくても、amplify_outputs.json の ARN に接続する
//   どちらもなければ AGENT_URL(未設定なら aimock)に、署名なしで接続する
const env = (name: string): string | undefined =>
  process.env[name] ?? (import.meta.env[name] as string | undefined);
const outputsArn = (outputs as { custom?: { agentRuntimeArn?: string } }).custom
  ?.agentRuntimeArn;
const AGENT_RUNTIME_ARN =
  env("AGENT_RUNTIME_ARN") ?? (import.meta.env.PROD ? outputsArn : undefined);
const AGENT_URL = env("AGENT_URL") ?? "http://localhost:4010/agui";

const agent = AGENT_RUNTIME_ARN
  ? createAgentCoreAgent(AGENT_RUNTIME_ARN)
  : new HttpAgent({ url: AGENT_URL });

// Cognito のアクセストークンを検証する
const verifier = CognitoJwtVerifier.create({
  userPoolId: outputs.auth.user_pool_id,
  tokenUse: "access",
  clientId: outputs.auth.user_pool_client_id,
});

const runtime = new CopilotRuntime({
  agents: { default: agent },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  hooks: {
    // 全リクエストで JWT を検証し、失敗したら 401 を返す
    onRequest: async ({ request }) => {
      const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
      if (!token) {
        throw new Response("Unauthorized", { status: 401 });
      }
      try {
        await verifier.verify(token);
      } catch {
        throw new Response("Unauthorized", { status: 401 });
      }
    },
  },
});

export const ALL: APIRoute = ({ request }) => handler(request);
