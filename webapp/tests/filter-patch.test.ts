import assert from "node:assert/strict";
import test from "node:test";
import { mergeFilter, type QuestFilter } from "../src/lib/quests/filter";

const original: QuestFilter = {
  status: "viewed", services: ["Lambda"], importance: ["high"],
  maxMinutes: 10, sinceDays: 7,
};

test("検索条件は未指定なら維持し、nullなら指定した条件だけを解除する", () => {
  assert.deepEqual(mergeFilter(original, {
    status: undefined, services: undefined, importance: undefined,
    maxMinutes: undefined, sinceDays: undefined,
  }), original);
  for (const key of Object.keys(original) as (keyof QuestFilter)[]) {
    const expected = { ...original };
    delete expected[key];
    assert.deepEqual(mergeFilter(original, { [key]: null }), expected);
  }
  assert.deepEqual(original.services, ["Lambda"]);
  assert.equal(Object.keys(original).length, 5, "元の条件は変更しない");
});

test("検索条件のリセット後に、新しい条件を適用する", () => {
  const changed: QuestFilter = {
    status: "cleared", services: ["S3"], importance: ["low"],
    maxMinutes: 5, sinceDays: 1,
  };
  assert.deepEqual(mergeFilter(original, changed), changed);
  assert.deepEqual(mergeFilter(original, { reset: true }), {});
  assert.deepEqual(mergeFilter(original, {
    reset: true, status: "todo", services: null, maxMinutes: 0,
  }), { status: "todo", maxMinutes: 0 });
});
