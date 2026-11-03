import assert from "node:assert/strict";
import test from "node:test";
import { requestNewsReview } from "../src/lib/newsNotifications/request";

test("通知の選定はJSON POSTとして送り、プロキシ経由でもAstroのCSRFチェックを通る", async () => {
  const { isForbiddenCrossOriginRequest } = await import(new URL("../node_modules/astro/dist/core/app/origin-check.js", import.meta.url).href);
  const origin = "https://example.cloudfront.net";
  const backend = new URL("https://example.execute-api.ap-northeast-1.amazonaws.com/api/news-notifications");
  assert.equal(isForbiddenCrossOriginRequest(new Request(backend, { method: "POST", headers: { origin } }), backend, false), true);
  await requestNewsReview(async (url, init) => {
    assert.equal(url, "/api/news-notifications");
    assert.equal(init?.method, "POST");
    assert.deepEqual(JSON.parse(init!.body as string), {});
    const request = new Request(backend, { ...init, headers: { ...init?.headers, origin } });
    assert.equal(request.headers.get("content-type"), "application/json");
    assert.equal(isForbiddenCrossOriginRequest(request, backend, false), false);
    return new Response("{}", { headers: { "content-type": "application/json" } });
  });
});
