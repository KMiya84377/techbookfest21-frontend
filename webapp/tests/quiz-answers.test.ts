import assert from "node:assert/strict";
import test from "node:test";
import { mockQuestRecord, mockQuestStore } from "../mock/questStore.ts";
import { buildSampleQuests } from "../mock/sampleQuests.ts";

const id = buildSampleQuests()[0].id;
const publishedAt = buildSampleQuests()[0].publishedAt;

test("理解度チェックの初回の回答を追記しても、クエストの状態は変わらない", async () => {
  const user = "quiz-user-1";
  await mockQuestStore.recordQuizAnswer(user, id, true);
  await mockQuestStore.recordQuizAnswer(user, id, false);
  const record = mockQuestRecord(user, id);
  assert.deepEqual(record.quizAnswers.map((a) => a.correct), [true, false]);
  assert.ok(record.quizAnswers.every((a) => !Number.isNaN(Date.parse(a.answeredAt))));
  const quests = await mockQuestStore.list(user);
  assert.equal(quests.find((q) => q.id === id)?.status, "viewed");
});

test("初めて詳細を開いた日時は、1度だけ残る", async () => {
  const user = "quiz-user-2";
  await mockQuestStore.saveState(user, { id, publishedAt }, "viewed");
  const first = mockQuestRecord(user, id).firstViewedAt;
  assert.ok(first);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await mockQuestStore.saveState(user, { id, publishedAt }, "cleared", false);
  assert.equal(mockQuestRecord(user, id).firstViewedAt, first);
});

test("存在しないクエストへの回答は、保存しない", async () => {
  await assert.rejects(mockQuestStore.recordQuizAnswer("quiz-user-3", "no-such-news", true));
});
