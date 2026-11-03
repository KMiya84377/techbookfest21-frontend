import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import type { HttpAgentFetchFn } from "@ag-ui/client";
import type { Quest } from "../src/lib/quests/model.ts";
import { DEFAULT_USER_SETTINGS } from "../src/lib/userSettings/model.ts";
import { newCandidates, validateRecommendations } from "../src/lib/newsNotifications/model.ts";
import { createMemoryNotificationStore } from "../mock/notificationStore.ts";
import { reviewNews } from "../src/server/newsNotifications/review.ts";
import { collectRecommendations, RECOMMENDATIONS_TOOL } from "../src/server/newsNotifications/collectRecommendations.ts";
const { HttpAgent } = createRequire(import.meta.url)("@ag-ui/client") as typeof import("@ag-ui/client");
const quest = (id: string, status = "todo"): Quest => ({ id, status, title: id, summary: "AWSの新着", services: ["Amazon Bedrock"], publishedAt: "2026-10-31", importance: "high", minutes: 5 } as Quest);
const selected = (questId: string) => ({ recommendations: [{ questId, reason: "設定された学習分野に関連する更新です" }] });

function agentFor(output: unknown, mode = "ok") {
  const fetch: HttpAgentFetchFn = async (_url, init) => {
    const input = JSON.parse(init.body as string);
    assert.equal(input.forwardedProps.newsReview, true);
    assert.deepEqual(input.tools.map((tool: { name: string }) => tool.name), [RECOMMENDATIONS_TOOL]);
    const data = JSON.parse(input.context[0].value);
    assert.deepEqual(data.settings, DEFAULT_USER_SETTINGS);
    assert.equal(data.candidates[0].id, "a");
    const args = JSON.stringify(output);
    const tool = (id: string) => [
      { type: "TOOL_CALL_START", toolCallId: id, toolCallName: RECOMMENDATIONS_TOOL },
      { type: "TOOL_CALL_ARGS", toolCallId: id, delta: args.slice(0, 12) },
      { type: "TOOL_CALL_ARGS", toolCallId: id, delta: args.slice(12) },
      { type: "TOOL_CALL_END", toolCallId: id },
    ];
    const events = [
      { type: "RUN_STARTED", threadId: input.threadId, runId: input.runId },
      ...(mode === "error" ? [{ type: "RUN_ERROR", message: "model failed" }] : [
        ...(mode === "missing" ? [] : tool("first")),
        ...(mode === "duplicate" ? tool("second") : []),
        { type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId },
      ]),
    ];
    return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
  };
  return new HttpAgent({ url: "http://unused.test/agui", fetch });
}

test("UC-05: 実際のAG-UIクライアントで選定ツールの分割イベントを受信する", async () => {
  assert.deepEqual(await collectRecommendations(agentFor(selected("a")), [quest("a")], DEFAULT_USER_SETTINGS), selected("a"));
  assert.deepEqual(await collectRecommendations(agentFor({ recommendations: [] }), [quest("a")], DEFAULT_USER_SETTINGS), { recommendations: [] });
});
test("AG-UIのエラー・結果なし・複数結果・架空のIDを成功にしない", async () => {
  for (const mode of ["error", "missing", "duplicate"]) {
    await assert.rejects(() => collectRecommendations(agentFor(selected("a"), mode), [quest("a")], DEFAULT_USER_SETTINGS));
  }
  await assert.rejects(() => collectRecommendations(agentFor(selected("unknown")), [quest("a")], DEFAULT_USER_SETTINGS));
});
test("候補ID・重複・通知理由を検証し、未確認の未着手ニュースだけを対象にする", () => {
  for (const input of [selected("unknown"), { recommendations: [selected("a").recommendations[0], selected("a").recommendations[0]] }, { recommendations: [{ questId: "a", reason: " " }] }, { recommendations: [{ questId: "a", reason: "理由", html: "<script>" }] }]) {
    assert.throws(() => validateRecommendations(input, [quest("a")]));
  }
  assert.deepEqual(newCandidates([quest("a"), quest("b", "viewed"), quest("c", "cleared"), quest("d")], ["a"]).map((item) => item.id), ["d"]);
  assert.equal(newCandidates(Array.from({ length: 30 }, (_, i) => quest(String(i))), []).length, 20);
});
test("通知→既読→再取得とユーザー分離。新しいニュースだけを再選定する", async () => {
  const store = createMemoryNotificationStore();
  let quests = [quest("a")];
  const calls: string[][] = [];
  const deps = { store, quests: async () => quests, settings: async () => DEFAULT_USER_SETTINGS,
    select: async (userId: string, candidates: Quest[]) => { calls.push([userId, ...candidates.map((item) => item.id)]); return selected(candidates[0].id); } };
  assert.equal((await reviewNews("user-a", deps)).notifications.length, 1);
  assert.equal(await store.read("user-b", "a"), false);
  assert.equal((await store.list("user-b")).length, 0);
  assert.equal(await store.read("user-a", "a"), true);
  const readAt = (await store.list("user-a"))[0].readAt;
  assert.ok(readAt);
  await reviewNews("user-a", deps);
  assert.equal(calls.length, 1);
  assert.equal((await store.list("user-a"))[0].readAt, readAt);
  quests = [quest("b"), ...quests];
  assert.equal((await reviewNews("user-a", deps)).notifications.length, 2);
  assert.deepEqual(calls[1], ["user-a", "b"]);
  await reviewNews("user-b", deps);
  assert.equal((await store.list("user-b")).length, 1);
});
test("該当なしでも同じニュースを毎回AIへ送らない。失敗後は再試行する", async () => {
  const store = createMemoryNotificationStore();
  let calls = 0;
  const deps = { store, quests: async () => [quest("a")], settings: async () => DEFAULT_USER_SETTINGS,
    select: async () => { calls++; if (calls === 1) throw new Error("unavailable"); return { recommendations: [] }; } };
  await assert.rejects(() => reviewNews("user", deps));
  assert.equal((await reviewNews("user", deps)).notifications.length, 0);
  await reviewNews("user", deps);
  assert.equal(calls, 2);
});
test("重複実行を抑止し、期限切れの実行は復旧する。古い実行は状態を書き戻せない", async () => {
  let now = 0;
  const store = createMemoryNotificationStore(() => now);
  const first = await store.claim("user"); assert.ok(first);
  assert.equal(await store.claim("user"), null);
  const running = await reviewNews("user", { store, quests: async () => { throw new Error("must not run"); }, settings: async () => DEFAULT_USER_SETTINGS, select: async () => ({ recommendations: [] }) });
  assert.equal(running.state, "running");
  now = 180_001;
  const next = await store.claim("user"); assert.ok(next);
  await assert.rejects(() => store.finish("user", first.token, ["a"]));
  await store.finish("user", next.token, ["b"]);
  assert.deepEqual((await store.claim("user"))?.evaluatedIds, ["b"]);
});
test("途中で保存に失敗しても、再実行で通知と既読状態を上書きしない", async () => {
  const store = createMemoryNotificationStore();
  const save = store.save;
  let failed = false;
  store.save = async (id, notification) => {
    if (notification.questId === "b" && !failed) { failed = true; throw new Error("temporary write error"); }
    return save(id, notification);
  };
  const deps = { store, quests: async () => [quest("a"), quest("b")], settings: async () => DEFAULT_USER_SETTINGS,
    select: async () => ({ recommendations: [...selected("a").recommendations, ...selected("b").recommendations] }) };
  await assert.rejects(() => reviewNews("user", deps));
  await store.read("user", "a");
  const before = (await store.list("user"))[0];
  const after = await reviewNews("user", deps);
  assert.equal(after.notifications.length, 2);
  assert.deepEqual(after.notifications.find((item) => item.questId === "a"), before);
});
