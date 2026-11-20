import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import type { ApiFetch } from "../src/hooks/useApiFetch";
import type { LearningInsight } from "../src/lib/learning/model";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";
import { hookHarness } from "./helpers/hookHarness";

type Hook = typeof import("../src/hooks/useLearningInsights").useLearningInsights;
const insight: LearningInsight = {
  id: "insight", batch: 1, reviewEvery: 5, createdAt: "2026-11-20",
  sources: [],
  diagram: {
    hasConnections: false, title: "分析", summary: "関連なし", nodes: [], edges: [],
  },
};

function response(batch: number, pendingBatch: number | null = null, status = 200) {
  return new Response(JSON.stringify({
    insights: [insight],
    learning: { batch, count: batch * 5, reviewEvery: 5 },
    pendingBatch,
  }), { status, headers: { "content-type": "application/json" } });
}

async function scenario(initialPending: number | null = null) {
  const harness = hookHarness();
  const { useLearningInsights } = await loadIsolatedModule<{ useLearningInsights: Hook }>(
    "src/hooks/useLearningInsights.ts", { react: harness.react },
  );
  const posts: {
    batch: number;
    source: string;
    resolve: (response: Response) => void;
  }[] = [];
  const methods: string[] = [];
  let pendingBatch = initialPending;
  let event: Parameters<Hook>[1] = null;
  let version = 0;
  let patchStatus = 200;

  function makeFetch(source: string): ApiFetch {
    return async (_url, init = {}) => {
      const method = init.method ?? "GET";
      methods.push(method);
      if (method === "POST") {
        const pending = Promise.withResolvers<Response>();
        posts.push({
          batch: JSON.parse(init.body as string).batch,
          source,
          resolve: pending.resolve,
        });
        return pending.promise;
      }
      if (method === "PATCH") return response(0, null, patchStatus);
      return response(0, pendingBatch);
    };
  }
  let apiFetch = makeFetch("first");
  const render = () => harness.render(() => useLearningInsights(apiFetch, event, 5));
  render();
  await setImmediate();
  return {
    harness, posts, methods, render,
    trigger(batch: number) {
      event = { progress: { count: batch * 5, batch, reviewEvery: 5 }, version: ++version };
      return render();
    },
    changeFetch() { apiFetch = makeFetch("latest"); render(); },
    setPending(batch: number | null) { pendingBatch = batch; },
    failRead() { patchStatus = 500; },
  };
}

test("分析は同時に1件だけ実行し、待機中の依頼は最後の1件にまとめる", async () => {
  const s = await scenario();
  s.trigger(1);
  s.trigger(2);
  s.trigger(3);
  assert.deepEqual(s.posts.map(post => post.batch), [1]);
  s.posts[0].resolve(response(1));
  await setImmediate();
  assert.deepEqual(s.posts.map(post => post.batch), [1, 3]);
  assert.equal(s.render().busy, true);
  s.posts[1].resolve(response(3));
  await setImmediate();
  assert.equal(s.render().busy, false);
  assert.equal(s.render().error, null);
  s.harness.unmount();
});

test("同一区間の失敗を自動で繰り返さず、明示的な再試行では実行する", async () => {
  const s = await scenario();
  s.trigger(1);
  s.trigger(1);
  s.posts[0].resolve(response(1, null, 500));
  await setImmediate();
  assert.equal(s.posts.length, 1);
  assert.equal(s.render().busy, false);
  assert.match(s.render().error!, /分析できません/);

  s.setPending(1);
  const retry = s.render().retry();
  await setImmediate();
  assert.equal(s.posts.length, 2);
  s.posts[1].resolve(response(1));
  await retry;
  assert.equal(s.render().error, null);
  s.harness.unmount();
});

test("409の最新区間を引き継ぎ、待機中に通信処理が変われば最新を使う", async () => {
  const s = await scenario();
  s.trigger(1);
  s.changeFetch();
  await setImmediate();
  s.posts[0].resolve(response(1, 2, 409));
  await setImmediate();
  assert.deepEqual(s.posts.map(post => [post.batch, post.source]), [
    [1, "first"], [2, "latest"],
  ]);
  s.trigger(3);
  s.harness.unmount();
  const updates = s.harness.updates;
  s.posts[1].resolve(response(2));
  await setImmediate();
  assert.equal(s.posts.length, 2, "画面を閉じた後は待機中の分析を始めない");
  assert.equal(s.harness.updates, updates, "画面を閉じた後は状態を更新しない");
});

test("初回取得の未処理区間を分析し、通知の既読を保存する", async () => {
  const s = await scenario(1);
  assert.deepEqual(s.posts.map(post => post.batch), [1]);
  s.posts[0].resolve(response(1));
  await setImmediate();
  await s.render().markRead(insight);
  assert.ok(s.render().insights[0].readAt);
  assert.ok(s.methods.includes("PATCH"));
  s.harness.unmount();
});

test("既読保存に失敗した場合は未読状態を保ち、エラーを表示する", async () => {
  const s = await scenario();
  s.failRead();
  await s.render().markRead(insight);
  assert.equal(s.render().insights[0].readAt, undefined);
  assert.equal(s.render().error, "通知を既読にできませんでした");
  s.harness.unmount();
});
