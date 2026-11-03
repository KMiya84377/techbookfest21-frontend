import assert from "node:assert/strict";
import test from "node:test";
import { learningProgress, validateConnections, type LearningEntry } from "../src/lib/learning/model.ts";
import { listMockQuests, mockLearningHistory, saveMockQuestState } from "../mock/questStore.ts";
import { DEFAULT_USER_SETTINGS, parseUserSettings } from "../src/lib/userSettings/model.ts";
import { getMockUserSettings, putMockUserSettings } from "../mock/userSettingsStore.ts";

const history: LearningEntry[] = ["a", "b", "c"].map((questId) => ({
  questId, title: questId, summary: "学習した内容", services: ["AWS"],
  learnedAt: "2026-10-24T00:00:00Z", review: false,
}));
const diagram = () => ({ hasConnections: true, title: "関係図", summary: "２件の関係", nodes: [{ questId: "a", note: "内容A" }, { questId: "b", note: "内容B" }], edges: [{ from: "a", to: "b", label: "関連がある" }] });

test("既定の実行間隔は５件で、設定を検証する", () => {
  assert.equal(DEFAULT_USER_SETTINGS.learningReviewEvery, 5);
  for (const value of [2, 5, 20]) assert.equal(parseUserSettings({ ...DEFAULT_USER_SETTINGS, learningReviewEvery: value })?.learningReviewEvery, value);
  for (const value of [0, 1, -1, 2.5, 21, "2", null, NaN]) {
    assert.equal(parseUserSettings({ ...DEFAULT_USER_SETTINGS, learningReviewEvery: value }), null);
    assert.throws(() => learningProgress(10, value as number));
  }
});
test("閾値がない既存設定も他の設定を維持して読み込む", () => {
  const legacy = { learningTopics: ["compute"], difficulty: "advanced", answerDetail: "detailed" };
  assert.deepEqual(parseUserSettings(legacy), { ...legacy, learningReviewEvery: 5 });
});
test("閾値を含むユーザー設定を保存し、ユーザー間で分離する", () => {
  const first = crypto.randomUUID(), second = crypto.randomUUID();
  putMockUserSettings(first, { ...DEFAULT_USER_SETTINGS, learningReviewEvery: 2 });
  assert.equal(getMockUserSettings(first).learningReviewEvery, 2);
  assert.equal(getMockUserSettings(second).learningReviewEvery, 5);
});
test("件数から区間を決め、途中の件数で次の区間へ進めない", () => {
  assert.equal(learningProgress(4, 5).batch, 0);
  assert.equal(learningProgress(5, 5).batch, 1);
  assert.equal(learningProgress(9, 5).batch, 1);
  assert.equal(learningProgress(10, 5).batch, 2);
});
test("履歴にあるIDだけで作られた関係図を受け取る", () => assert.deepEqual(validateConnections(diagram(), history), diagram()));
test("関連がないという結果も正常に受け取る", () => {
  assert.equal(validateConnections({ hasConnections: false, title: "関連なし", summary: "根拠が不足", nodes: [], edges: [] }, history).hasConnections, false);
});
test("履歴にないニュースを拒否する", () => {
  const input = diagram(); input.nodes[1].questId = "another-user-quest";
  assert.throws(() => validateConnections(input, history));
});
test("参照先が不正な関係を拒否する", () => {
  const input = diagram(); input.edges[0].to = "missing";
  assert.throws(() => validateConnections(input, history));
});
test("自己参照とノードの重複を拒否する", () => {
  const input = diagram(); input.edges[0].to = "a";
  assert.throws(() => validateConnections(input, history));
  input.nodes[1].questId = "a";
  assert.throws(() => validateConnections(input, history));
});
test("関係のないノードと重複する関係を拒否する", () => {
  const input = diagram(); input.nodes.push({ questId: "c", note: "孤立" });
  assert.throws(() => validateConnections(input, history));
  const duplicate = diagram(); duplicate.edges.push({ ...duplicate.edges[0] });
  assert.throws(() => validateConnections(duplicate, history));
});
test("関連なしなのに図を含む結果や、空の関係図を拒否する", () => {
  assert.throws(() => validateConnections({ ...diagram(), hasConnections: false }, history));
  assert.throws(() => validateConnections({ ...diagram(), edges: [] }, history));
});
test("HTMLやコードの実行用フィールドを受け付けない", () => {
  assert.throws(() => validateConnections({ ...diagram(), html: "<script>alert(1)</script>" }, history));
});
test("再クリアで履歴を増やさず、遅れた閲覧更新で状態を戻さない", () => {
  const userId = crypto.randomUUID();
  const before = mockLearningHistory(userId).length;
  assert.equal(saveMockQuestState(userId, "agentcore-agui", "cleared", false).newlyCleared, true);
  assert.equal(saveMockQuestState(userId, "agentcore-agui", "cleared", true).newlyCleared, false);
  saveMockQuestState(userId, "agentcore-agui", "viewed");
  assert.equal(mockLearningHistory(userId).length, before + 1);
  assert.equal(listMockQuests(userId).find((quest) => quest.id === "agentcore-agui")?.status, "cleared");
  assert.equal(mockLearningHistory(userId).find((entry) => entry.questId === "agentcore-agui")?.review, false);
});
test("mockでもユーザー間の学習履歴を分離する", () => {
  const first = crypto.randomUUID(), second = crypto.randomUUID();
  saveMockQuestState(first, "lambda-streaming", "cleared", false);
  assert.ok(mockLearningHistory(first).some((entry) => entry.questId === "lambda-streaming"));
  assert.ok(!mockLearningHistory(second).some((entry) => entry.questId === "lambda-streaming"));
});
