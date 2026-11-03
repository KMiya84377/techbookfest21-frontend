import assert from "node:assert/strict";
import test from "node:test";
import { blocksSession } from "./helpers/blocksSession.ts";
const base = process.env.BLOCKS_TEST_URL;

test("Blocks: ローカル認証・ユーザー分離・学習保存・通知の一連の処理", { skip: !base }, async () => {
  for (const path of ["/api/quests", "/api/settings", "/api/learning-insights", "/api/news-notifications", "/api/agent-news", "/api/copilotkit/info"]) {
    assert.equal((await fetch(base + path)).status, 401, path);
  }
  const first = await blocksSession(base!), second = await blocksSession(base!);
  const quests = (await first.request("/api/quests")).body.quests;
  assert.ok(quests.length >= 4, "先にnpm run seedを実行してください");
  const settings = (await first.request("/api/settings")).body.settings;
  assert.equal((await first.request("/api/settings", "PUT", { ...settings, learningTopics: ["ai_ml"], learningReviewEvery: 2 })).status, 200);
  assert.deepEqual((await first.request("/api/settings")).body.settings.learningTopics, ["ai_ml"]);
  assert.deepEqual((await second.request("/api/settings")).body.settings.learningTopics, []);
  const q = quests[0];
  const updates = await Promise.all([first.request("/api/quests", "PATCH", { id: q.id, publishedAt: q.publishedAt, status: "cleared", review: false }), first.request("/api/quests", "PATCH", { id: q.id, publishedAt: q.publishedAt, status: "cleared", review: false })]);
  assert.ok(updates.every((r) => r.status === 200));
  assert.equal(updates.filter((r) => r.body.learning.newlyCleared).length, 1);
  await first.request("/api/quests", "PATCH", { id: q.id, publishedAt: q.publishedAt, status: "viewed" });
  assert.equal((await first.request("/api/quests")).body.quests.find((i: { id: string }) => i.id === q.id).status, "cleared");
  assert.equal((await second.request("/api/quests")).body.quests.find((i: { id: string }) => i.id === q.id).status, "todo");
  const next = quests[1];
  await first.request("/api/quests", "PATCH", { id: next.id, publishedAt: next.publishedAt, status: "cleared", review: false });
  const [a, b] = await Promise.all([first.request("/api/learning-insights", "POST", { batch: 1, reviewEvery: 2 }), first.request("/api/learning-insights", "POST", { batch: 1, reviewEvery: 2 })]);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const insights = (await first.request("/api/learning-insights")).body.insights;
  assert.equal(insights.length, 1);
  assert.equal(insights[0].mock, true);
  assert.equal((await second.request("/api/learning-insights")).body.insights.length, 0);
  const generated = await first.request("/api/news-notifications", "POST");
  assert.equal(generated.status, 200); assert.ok(generated.body.notifications.length);
  const notification = generated.body.notifications[0];
  assert.equal((await second.request("/api/news-notifications", "PATCH", { questId: notification.questId })).status, 404);
  assert.equal((await first.request("/api/news-notifications", "PATCH", { questId: notification.questId })).status, 200);
  await first.request("/api/news-notifications", "POST");
  const saved = (await first.request("/api/news-notifications")).body.notifications;
  assert.equal(saved.length, generated.body.notifications.length);
  assert.ok(saved.find((i: { id: string }) => i.id === notification.id).readAt);
});
