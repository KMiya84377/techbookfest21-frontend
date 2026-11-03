import type { APIRoute } from "astro";
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { createConfiguredAgent } from "../../../server/agent/configuredAgent";
import { authenticate } from "../../../server/auth/authenticate";
import { measureApi } from "../_metrics";
import {
  REPORT_CATALOG_ID,
  reportCatalogSchema,
} from "../../../lib/generative-ui/reportCatalog";
import { userContext } from "../../../server/agent/userContext";

// リクエストごとにサーバーで動かす(静的ファイルにしない)
export const prerender = false;

async function buildHandler() {
  const agent = await createConfiguredAgent();

  const runtime = new CopilotRuntime({
    agents: { default: agent },
    a2ui: {
      schema: reportCatalogSchema,
      defaultCatalogId: REPORT_CATALOG_ID,
      injectA2UITool: true,
    },
    openGenerativeUI: { agents: ["default"] },
  });

  const handler = createCopilotRuntimeHandler({
    runtime,
    basePath: "/api/copilotkit",
    hooks: {
      onRequest: async ({ request }) => {
        // 全リクエストで JWT を検証し、失敗したら 401 を返す
        if (!(await authenticate(request))) {
          throw new Response("Unauthorized", { status: 401 });
        }
      },
    },
  });

  return handler;
}
let pendingHandler: ReturnType<typeof buildHandler> | undefined;
function getHandler() {
  return pendingHandler ??= buildHandler().catch((error) => { pendingHandler = undefined; throw error; });
}

// 検証したユーザー ID を、この処理の間だけ持たせる(エージェントへの送信で、本文に入れる)
// 件数・処理時間は、サブパスをまとめて "copilotkit" として記録する
export const ALL: APIRoute = ({ request }) =>
  measureApi("copilotkit", async () => {
    const userId = await authenticate(request);
    if (!userId) return new Response("Unauthorized", { status: 401 });
    return userContext.run(
      { userId, ...(import.meta.env.DEV ? { localAuthCookie: request.headers.get("cookie") ?? undefined } : {}) },
      async () => (await getHandler())(request),
    );
  });
