import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import * as settings from "../src/lib/userSettings/model";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

async function scenario() {
  const calls: unknown[] = [];
  let failure: "generate" | "read" | "status" | undefined;
  let stale = false;
  const status = { count: 10, batch: 2, reviewEvery: 5 };
  const json = (data: unknown, code = 200) => Response.json(data, { status: code });
  const routes = await loadIsolatedModule<typeof import("../src/pages/api/learning-insights")>(
    "src/pages/api/learning-insights.ts", {
      zod: { z },
      "../../lib/userSettings/model": settings,
      "./_server/learning/service": {
        createInsight: async (...args: unknown[]) => {
          calls.push(["generate", ...args]);
          if (failure === "generate") throw new Error("failed");
          return { state: stale ? "stale" : "generated" };
        },
        insightStatus: async (userId: string) => {
          calls.push(["status", userId]);
          if (failure === "status") throw new Error("failed");
          return status;
        },
      },
      "./_server/learning/store": {
        readInsight: async (...args: unknown[]) => {
          calls.push(["read", ...args]);
          if (failure === "read") throw new Error("failed");
        },
      },
      "./_helpers": {
        json,
        badRequest: () => json({ error: "bad request" }, 400),
        readJson: (request: Request) => request.json().catch(() => undefined),
        withUser: (_name: string, handler: Function) =>
          ({ request }: { request: Request }) => handler({
            request, userId: "verified-user", log: { error() {} },
          }),
      },
    },
  );
  return {
    calls, status,
    fail: (value: typeof failure) => { failure = value; },
    markStale: () => { stale = true; },
    async request(method: "GET" | "POST" | "PATCH", body?: unknown) {
      const request = new Request("https://example.test/api/learning-insights", {
        method, ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
      });
      return await routes[method]({ request } as Parameters<typeof routes.GET>[0]);
    },
  };
}

test("関連分析の生成と既読処理は、別の処理を呼び、検証済みユーザーと区間を渡す", async () => {
  const s = await scenario();
  assert.deepEqual(await (await s.request("GET")).json(), s.status);
  s.calls.length = 0;
  assert.deepEqual(await (await s.request("POST", { batch: 2 })).json(), {
    state: "generated", ...s.status,
  });
  assert.deepEqual(s.calls, [["generate", "verified-user", 2, 5], ["status", "verified-user"]]);
  s.calls.length = 0;
  assert.deepEqual(await (await s.request("PATCH", { batch: 3, reviewEvery: 10 })).json(), { ok: true });
  assert.deepEqual(s.calls, [["read", "verified-user", 3, 10]]);
  s.markStale();
  assert.equal((await s.request("POST", { batch: 2 })).status, 409);
});

test("関連分析APIは不正な入力で処理を呼ばず、生成・既読・取得の失敗を区別する", async () => {
  const s = await scenario();
  for (const method of ["POST", "PATCH"] as const) {
    for (const body of [undefined, null, {}, { batch: 0 }, { batch: 1, reviewEvery: 1 }]) {
      assert.equal((await s.request(method, body)).status, 400);
    }
  }
  assert.deepEqual(s.calls, []);
  s.fail("generate");
  assert.equal((await s.request("POST", { batch: 1 })).status, 502);
  s.fail("read");
  assert.equal((await s.request("PATCH", { batch: 1 })).status, 500);
  s.fail("status");
  assert.equal((await s.request("GET")).status, 500);
});
