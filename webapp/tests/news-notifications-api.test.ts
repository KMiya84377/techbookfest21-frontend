import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.NEWS_TEST_URL;
test("UC-05: APIで選定→通知→詳細取得→既読→再選定の重複排除（AWS・LLMなし）", { skip: !base }, async () => {
  const request = async (method = "GET", body?: unknown) => {
    const response = await fetch(base + "/api/news-notifications", { method, headers: { origin: base!, "content-type": "application/json" }, ...(method === "PATCH" ? { body: JSON.stringify(body ?? null) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const generated = await request("POST");
  assert.equal(generated.status, 200);
  assert.ok(generated.body.notifications.length);
  const first = generated.body.notifications[0];
  assert.equal(first.mock, true);
  const quests = await (await fetch(base + "/api/quests")).json();
  assert.ok(quests.quests.some((item: { id: string }) => item.id === first.questId));
  assert.equal((await request("PATCH", { questId: first.questId })).status, 200);
  const read = (await request()).body.notifications.find((item: { id: string }) => item.id === first.id);
  assert.ok(read.readAt);
  await request("POST");
  const again = (await request()).body.notifications;
  assert.equal(new Set(again.map((item: { questId: string }) => item.questId)).size, again.length);
  assert.equal(again.find((item: { id: string }) => item.id === first.id).readAt, read.readAt);
  for (const body of [null, {}, { questId: "" }, { questId: 1 }]) assert.equal((await request("PATCH", body)).status, 400);
  assert.equal((await request("PATCH", { questId: "does-not-exist" })).status, 404);
});
