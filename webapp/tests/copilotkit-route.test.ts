import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import test from "node:test";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

test("CopilotKitの初期化は同時に1回にまとめ、認証済みユーザーを実行中だけ渡す", async () => {
  const context = new AsyncLocalStorage<{ userId: string; localAuthCookie?: string }>();
  const initialized = Promise.withResolvers<object>();
  let attempts = 0;
  let allowed = true;
  const seen: unknown[] = [];
  const { ALL } = await loadIsolatedModule<typeof import("../src/pages/api/copilotkit/[...slug]")>(
    "src/pages/api/copilotkit/[...slug].ts", {
      "@copilotkit/runtime/v2": {
        CopilotRuntime: class { constructor(config: unknown) { seen.push(config); } },
        createCopilotRuntimeHandler: () => async () => {
          seen.push(context.getStore());
          return new Response("ok");
        },
      },
      "../_server/agent/configuredAgent": {
        createConfiguredAgent: () => {
          attempts++;
          return attempts === 1 ? initialized.promise : Promise.resolve({ agent: "test" });
        },
      },
      "../_server/auth/authenticate": {
        authenticate: async () => allowed ? "verified" : null,
      },
      "../_metrics": { measureApi: (_name: string, run: () => unknown) => run() },
      "../../../lib/generative-ui/reportCatalog": {
        REPORT_CATALOG_ID: "catalog", reportCatalogSchema: { type: "object" },
      },
      "../_server/agent/userContext": { userContext: context },
    }, { "import.meta.env": JSON.stringify({ DEV: true }) },
  );
  const request = new Request("https://example.test/api/copilotkit/run", {
    headers: { cookie: "local-session=test" },
  });
  const apiContext = { request } as Parameters<typeof ALL>[0];
  const first = ALL(apiContext);
  const second = ALL(apiContext);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(attempts, 1);
  initialized.reject(new Error("initialization failed"));
  const failed = await Promise.allSettled([first, second]);
  assert.ok(failed.every(result => result.status === "rejected"));
  // 失敗したPromiseをキャッシュから外すので、次のリクエストで再試行する。
  assert.equal((await ALL(apiContext)).status, 200);
  assert.equal(attempts, 2);
  assert.deepEqual(seen[1], { userId: "verified", localAuthCookie: "local-session=test" });
  assert.deepEqual(seen[0], {
    agents: { default: { agent: "test" } },
    a2ui: { schema: { type: "object" }, defaultCatalogId: "catalog", injectA2UITool: true },
    openGenerativeUI: { agents: ["default"] },
  });
  await ALL(apiContext);
  assert.equal(attempts, 2, "成功した初期化結果は再利用する");
  allowed = false;
  assert.equal((await ALL(apiContext)).status, 401);
  assert.equal(attempts, 2);
  assert.equal(context.getStore(), undefined);
});
