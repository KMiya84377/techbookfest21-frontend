import assert from "node:assert/strict";
import test from "node:test";

// 新しいmockサーバーに対して実行する。閾値はユーザー設定APIから変更する。
const base = process.env.LEARNING_TEST_URL;
test("UC-04: 保存→件数→関連分析→通知→既読→再取得（AWS・LLMなし）", { skip: !base }, async () => {
  const request = async (url: string, method = "GET", body?: unknown) => {
    const response = await fetch(base + url, { method, headers: { origin: base!, "content-type": "application/json" }, ...(method !== "GET" ? { body: JSON.stringify(body ?? null) } : {}) });
    return { status: response.status, body: await response.json() };
  };
  const settings = (await request("/api/settings")).body.settings;
  assert.equal(settings.learningReviewEvery, 5);
  for (const value of [1, 21, 2.5, "2", null]) {
    assert.equal((await request("/api/settings", "PUT", { ...settings, learningReviewEvery: value })).status, 400);
  }
  assert.equal((await request("/api/settings", "PUT", { ...settings, learningReviewEvery: 2 })).status, 200);
  assert.equal((await request("/api/settings")).body.settings.learningReviewEvery, 2);
  const initial = await request("/api/learning-insights");
  assert.equal(initial.status, 200);
  assert.equal(initial.body.learning.reviewEvery, 2);
  const quests = (await request("/api/quests")).body.quests;
  const quest = quests.find((item: { status: string }) => item.status === "todo");
  assert.ok(quest);
  const saved = await request("/api/quests", "PATCH", { id: quest.id, publishedAt: quest.publishedAt, status: "cleared", review: false });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.learning.count, initial.body.learning.count + 1);
  assert.equal(saved.body.learning.newlyCleared, true);
  const duplicate = await request("/api/quests", "PATCH", { id: quest.id, publishedAt: quest.publishedAt, status: "cleared", review: true });
  assert.equal(duplicate.body.learning.count, saved.body.learning.count);
  assert.equal(duplicate.body.learning.newlyCleared, false);
  const batch = saved.body.learning.batch;
  assert.ok(batch > 0);
  const [first, second] = await Promise.all([
    request("/api/learning-insights", "POST", { batch, reviewEvery: 2 }), request("/api/learning-insights", "POST", { batch, reviewEvery: 2 }),
  ]);
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  const status = (await request("/api/learning-insights")).body;
  assert.equal(status.insights.length, 1);
  const insight = status.insights[0];
  assert.equal(insight.mock, true);
  assert.equal(insight.reviewEvery, 2);
  assert.equal(insight.diagram.nodes.length, 2);
  assert.equal(insight.diagram.edges.length, 1);
  assert.equal(status.pendingBatch, null);
  for (const node of insight.diagram.nodes) assert.ok(insight.sources.some((source: { questId: string }) => source.questId === node.questId));
  assert.equal((await request("/api/learning-insights", "PATCH", { batch, reviewEvery: 2 })).status, 200);
  assert.ok((await request("/api/learning-insights")).body.insights[0].readAt);
  assert.equal((await request("/api/learning-insights", "POST", { batch: batch + 1, reviewEvery: 2 })).status, 409);
  assert.equal((await request("/api/learning-insights", "POST", { batch: -1 })).status, 400);
  assert.equal((await request("/api/learning-insights", "POST", { batch: "1" })).status, 400);
  assert.equal((await request("/api/learning-insights", "POST", null)).status, 400);
  await request("/api/quests", "PATCH", { id: quest.id, publishedAt: quest.publishedAt, status: "viewed" });
  assert.equal((await request("/api/quests")).body.quests.find((item: { id: string }) => item.id === quest.id).status, "cleared");

  // 同じ区間番号でも、閾値の変更後は別の分析として扱う。
  await request("/api/settings", "PUT", { ...settings, learningReviewEvery: 3 });
  const changed = (await request("/api/learning-insights")).body;
  assert.equal(changed.learning.reviewEvery, 3);
  assert.equal(changed.learning.batch, 0);
  assert.equal(changed.pendingBatch, null);
  assert.equal(changed.insights.length, 1);
  assert.equal((await request("/api/learning-insights", "POST", { batch, reviewEvery: 2 })).status, 409);
  const nextQuest = quests.find((item: { id: string; status: string }) => item.status === "todo" && item.id !== quest.id);
  assert.ok(nextQuest);
  const nextSaved = await request("/api/quests", "PATCH", { id: nextQuest.id, publishedAt: nextQuest.publishedAt, status: "cleared" });
  assert.equal(nextSaved.body.learning.reviewEvery, 3);
  assert.equal(nextSaved.body.learning.batch, batch);
  const generated = await request("/api/learning-insights", "POST", { batch, reviewEvery: 3 });
  assert.equal(generated.status, 200);
  assert.equal(generated.body.insights.length, 2);
  assert.equal(new Set(generated.body.insights.map((item: { id: string }) => item.id)).size, 2);
  assert.equal((await request("/api/learning-insights", "PATCH", { batch, reviewEvery: 2 })).status, 200);
  assert.equal((await request("/api/learning-insights", "POST", { batch, reviewEvery: null })).status, 400);
  await request("/api/settings", "PUT", { ...settings, learningReviewEvery: 2 });
  const reverted = (await request("/api/learning-insights")).body;
  assert.equal(reverted.pendingBatch, null);
  assert.equal(reverted.insights.length, 2);
});
