import type { APIRoute } from "astro";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { createAgentCoreAgent, createLocalAgent } from "../../../lib/agentcore";
import { authenticate } from "../../../lib/auth";
import { outputs } from "../../../lib/outputs";
import { userContext } from "../../../lib/userContext";

// リクエストごとにサーバーで動かす(静的ファイルにしない)
export const prerender = false;

// エージェントの接続先
//   AGENT_RUNTIME_ARN があれば、AgentCore Runtime に SigV4 署名つきで接続する
//   本番ビルドでは、環境変数がなくても、amplify_outputs.json の ARN に接続する
//   どちらもなければ AGENT_URL(未設定なら aimock)に、署名なしで接続する
const env = (name: string): string | undefined =>
  process.env[name] ?? (import.meta.env[name] as string | undefined);
const AGENT_RUNTIME_ARN =
  env("AGENT_RUNTIME_ARN") ??
  (import.meta.env.PROD ? outputs?.custom?.agentRuntimeArn : undefined);
const AGENT_URL = env("AGENT_URL") ?? "http://localhost:4010/agui";

const agent = AGENT_RUNTIME_ARN
  ? createAgentCoreAgent(AGENT_RUNTIME_ARN)
  : createLocalAgent(AGENT_URL);

const runtime = new CopilotRuntime({
  agents: { default: agent },
});

const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
  hooks: {
    // 全リクエストで JWT を検証し、失敗したら 401 を返す
    onRequest: async ({ request }) => {
      if (!(await authenticate(request))) {
        throw new Response("Unauthorized", { status: 401 });
      }
    },
  },
});

// 検証したユーザー ID を、この処理の間だけ持たせる(エージェントへの送信で、本文に入れる)
export const ALL: APIRoute = async ({ request }) => {
  const userId = await authenticate(request);
  return userId ? userContext.run({ userId }, () => handler(request)) : handler(request);
};
