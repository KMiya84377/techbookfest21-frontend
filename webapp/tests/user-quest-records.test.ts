import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import { news, userQuests } from "../aws-blocks/storage";
import { isAwsBlock } from "../src/pages/api/_server/blocks/consistentReads";
import {
  getUserQuestRecord,
  listUserQuestRecords,
  updateUserQuestRecord,
} from "../src/pages/api/_server/blocks/userQuestRecords";
import {
  recordQuizAnswer,
  updateQuestState,
} from "../src/pages/api/_server/quests/repository";
import type { UserQuestItem } from "../src/pages/api/_server/quests/userQuestItem";
import { blocksReviewStore } from "../src/pages/api/_server/learning/repository";
import { blocksNotificationStore } from "../src/pages/api/_server/newsNotifications/repository";
import { reviewKey } from "../src/pages/api/_server/learning/reviewRecord";
import { PREFIX, REVIEW_KEY } from "../src/pages/api/_server/newsNotifications/reviewRecord";

type Key = { userId: string; newsId: string };
type RecordItem = Key & { version?: number; [key: string]: unknown };
type WriteCondition = Parameters<typeof userQuests.put>[1];

function conflict() {
  const error = new Error("別の処理が更新しました");
  error.name = "ConditionalCheckFailedException";
  return error;
}

// 実際の保存処理は呼ばず、条件付き書き込みをテスト用のメモリ上で再現する。
function memoryTable() {
  assert.equal(isAwsBlock(userQuests), false, "AWSランタイムでは実行しない");
  const records = new Map<string, RecordItem>();
  const keyOf = (key: Key) => JSON.stringify([key.userId, key.newsId]);
  const get = mock.method(userQuests, "get", async (key: Key) =>
    structuredClone(records.get(keyOf(key)) ?? null),
  );
  const put = mock.method(
    userQuests,
    "put",
    async (record: RecordItem, condition?: WriteCondition) => {
      const current = records.get(keyOf(record));
      if (condition?.ifNotExists && current) throw conflict();
      if (
        condition?.ifFieldEquals &&
        (!current || current.version !== condition.ifFieldEquals.version)
      ) {
        throw conflict();
      }
      records.set(keyOf(record), structuredClone(record));
    },
  );
  mock.method(userQuests, "query", async function* (options: {
    where: { userId: { equals: string }; newsId?: { beginsWith: string } };
  }) {
    for (const record of records.values()) {
      if (record.userId !== options.where.userId.equals) continue;
      const prefix = options.where.newsId?.beginsWith ?? "";
      if (record.newsId.startsWith(prefix)) yield structuredClone(record);
    }
  });
  return {
    get,
    put,
    seed: (record: RecordItem) =>
      records.set(keyOf(record), structuredClone(record)),
  };
}

afterEach(() => mock.restoreAll());

test("記録を新規保存・更新し、更新しない場合はnullを返す", async () => {
  const table = memoryTable();
  type State = { status: string };
  assert.equal(await getUserQuestRecord<State>("u", "n"), null);
  const created = await updateUserQuestRecord<State>("u", "n", () => ({
    status: "todo",
  }));
  assert.deepEqual(created, {
    userId: "u", newsId: "n", version: 1, status: "todo",
  });
  const updated = await updateUserQuestRecord<State>("u", "n", (current) => ({
    ...current,
    status: "cleared",
  }));
  assert.equal(updated?.version, 2);
  assert.equal(updated?.status, "cleared");
  assert.equal(
    await updateUserQuestRecord<State>("u", "n", () => null), null,
  );
  assert.equal(table.put.mock.callCount(), 2);
  assert.equal(
    await updateUserQuestRecord<State>("u", "missing", () => null), null,
  );
  assert.equal(table.put.mock.callCount(), 2);
});

test("一覧はユーザーとキーの接頭辞で絞り込む", async () => {
  const table = memoryTable();
  table.seed({ userId: "u", newsId: "notice#1", version: 1 });
  table.seed({ userId: "u", newsId: "news1", version: 1 });
  table.seed({ userId: "other", newsId: "notice#2", version: 1 });
  assert.equal((await listUserQuestRecords("u")).length, 2);
  assert.deepEqual(
    (await listUserQuestRecords("u", "notice#")).map((record) => record.newsId),
    ["notice#1"],
  );
});

test("同時更新時は最新の記録を読み直し、両方の変更を残す", async () => {
  memoryTable();
  type Data = { viewed?: boolean; answered?: boolean };
  await Promise.all([
    updateUserQuestRecord<Data>("u", "n", (current) => ({
      ...current, viewed: true,
    })),
    updateUserQuestRecord<Data>("u", "n", (current) => ({
      ...current, answered: true,
    })),
  ]);
  const saved = await getUserQuestRecord<Data>("u", "n");
  assert.equal(saved?.viewed, true);
  assert.equal(saved?.answered, true);
  assert.equal(saved?.version, 2);
});

test("競合が解消しなければ8回で止め、その他のエラーは再試行しない", async () => {
  const table = memoryTable();
  const conflictError = conflict();
  table.put.mock.mockImplementation(async () => {
    throw conflictError;
  });
  await assert.rejects(
    updateUserQuestRecord("u", "n", () => ({})),
    (error) => error === conflictError,
  );
  assert.equal(table.put.mock.callCount(), 8);
  const denied = new Error("AccessDenied");
  table.put.mock.mockImplementation(async () => {
    throw denied;
  });
  await assert.rejects(
    updateUserQuestRecord("u", "n", () => ({})),
    (error) => error === denied,
  );
  assert.equal(table.put.mock.callCount(), 9);
});

test("二重クリアは1件だけを新規扱いとし、閲覧・回答の更新でクリア状態を消さない", async () => {
  memoryTable();
  const item = {
    newsId: "n",
    publishedAt: "2026-11-20",
    title: "ニュース",
    summary: "概要",
    services: [],
  };
  mock.method(news, "get", async () => item);
  const quest = { id: "n", publishedAt: item.publishedAt };
  const results = await Promise.all([
    updateQuestState("u", quest, "cleared", false),
    updateQuestState("u", quest, "cleared", false),
  ]);
  assert.equal(results.filter((result) => result.newlyCleared).length, 1);
  const before = await getUserQuestRecord<UserQuestItem>("u", "n");
  assert.deepEqual(await updateQuestState("u", quest, "viewed"), {
    newlyCleared: false,
  });
  await recordQuizAnswer("u", "n", true);
  const after = await getUserQuestRecord<UserQuestItem>("u", "n");
  assert.equal(after?.status, "cleared");
  assert.equal(after?.quizAnswers?.length, 1);
  assert.equal(after?.firstViewedAt, before?.firstViewedAt);
  assert.deepEqual(after?.learning, before?.learning);
});

test("関連分析の実行権は1件だけ取得でき、古い実行権で結果を保存できない", async () => {
  const table = memoryTable();
  const claims = await Promise.all([
    blocksReviewStore.claimReview("u", 1, 5, 1000),
    blocksReviewStore.claimReview("u", 1, 5, 1000),
  ]);
  const token = claims.find((value) => value !== null)!;
  assert.equal(claims.filter(Boolean).length, 1);
  await assert.rejects(
    blocksReviewStore.finishReview("u", 1, 5, "wrong", "none"), /実行権/,
  );
  await blocksReviewStore.finishReview("u", 1, 5, token, "none");
  assert.equal((await blocksReviewStore.getReview("u", 1, 5))?.state, "none");
  assert.equal(await blocksReviewStore.claimReview("u", 1, 5, 2000), null);
  table.seed({
    userId: "u", newsId: reviewKey(2, 5), version: 1,
    batch: 2, state: "running", leaseToken: "old", leaseUntil: 10,
  });
  assert.ok(await blocksReviewStore.claimReview("u", 2, 5, 1000));
});

test("新着選定の実行権・選定済みID・通知の既読状態を維持する", async () => {
  const table = memoryTable();
  const claims = await Promise.all([
    blocksNotificationStore.claim("u"),
    blocksNotificationStore.claim("u"),
  ]);
  const claim = claims.find((value) => value !== null)!;
  assert.equal(claims.filter(Boolean).length, 1);
  await assert.rejects(
    blocksNotificationStore.finish("u", "wrong", []), /実行権/,
  );
  await blocksNotificationStore.finish("u", claim.token, ["n"]);
  assert.deepEqual(
    (await blocksNotificationStore.claim("u"))?.evaluatedIds, ["n"],
  );
  const notification = {
    id: "id", questId: "n", title: "タイトル",
    reason: "理由", createdAt: "2026-11-20",
  };
  await Promise.all([
    blocksNotificationStore.save("u", notification),
    blocksNotificationStore.save("u", notification),
  ]);
  assert.equal(await blocksNotificationStore.read("other", "n"), false);
  assert.equal(await blocksNotificationStore.read("u", "missing"), false);
  assert.equal(await blocksNotificationStore.read("u", "n"), true);
  const first = (await blocksNotificationStore.list("u"))[0];
  await blocksNotificationStore.read("u", "n");
  await blocksNotificationStore.save("u", {
    ...notification, reason: "置き換えない",
  });
  assert.deepEqual(await blocksNotificationStore.list("u"), [first]);
  assert.ok(first.readAt);
  assert.equal(
    (await getUserQuestRecord("u", PREFIX + "n"))?.version, 3,
  );
  assert.ok(await getUserQuestRecord("u", REVIEW_KEY));
  // 関連分析の既読も、初回に保存した時刻を保つ。
  table.seed({
    userId: "u", newsId: reviewKey(1, 5), version: 1,
    batch: 1, state: "ready", leaseToken: "t", leaseUntil: 0,
    insight: { readAt: "first" },
  });
  await blocksReviewStore.readInsight("u", 1, 5);
  assert.equal(
    (await blocksReviewStore.getReview("u", 1, 5))?.insight?.readAt, "first",
  );
});
