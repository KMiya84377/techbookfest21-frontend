import { buildSampleQuests } from "./sampleQuests";
import type { Quest } from "../src/lib/quests/model";
import type { LearningEntry } from "../src/lib/learning/model";
import type { QuestStore } from "../src/server/quests/store";

// mockモード専用。DynamoDB・LLM・AWS認証情報を使わず同じAPI契約を試す。
const states = new Map<string, {
  status: "viewed" | "cleared";
  review?: boolean;
  learning?: LearningEntry;
  firstViewedAt?: string;
  quizAnswers?: { answeredAt: string; correct: boolean }[];
}>();
const key = (userId: string, questId: string) => `${userId}:${questId}`;

export function listMockQuests(userId: string): Quest[] {
  return buildSampleQuests().map((quest) => ({ ...quest, ...states.get(key(userId, quest.id)) }));
}

export function saveMockQuestState(userId: string, id: string, status: "viewed" | "cleared", review?: boolean) {
  const quest = listMockQuests(userId).find((item) => item.id === id);
  if (!quest) throw new Error("対象のニュースが見つかりません");
  const previous = states.get(key(userId, id));
  if (quest.status === "cleared") return { newlyCleared: false };
  const learning: LearningEntry | undefined = status === "cleared" ? {
    questId: id, title: quest.title, summary: quest.summary, services: quest.services,
    learnedAt: new Date().toISOString(), review: Boolean(review),
  } : undefined;
  states.set(key(userId, id), { ...previous, status, firstViewedAt: previous?.firstViewedAt ?? new Date().toISOString(), ...(review === undefined ? {} : { review }), ...(learning ? { learning } : {}) });
  return { newlyCleared: status === "cleared" };
}

export function mockLearningHistory(userId: string): LearningEntry[] {
  return listMockQuests(userId).filter((quest) => quest.status === "cleared").map((quest) =>
    states.get(key(userId, quest.id))?.learning ?? {
      questId: quest.id, title: quest.title, summary: quest.summary, services: quest.services,
      learnedAt: quest.publishedAt, review: Boolean(quest.review),
    },
  ).sort((a, b) => a.learnedAt.localeCompare(b.learnedAt) || a.questId.localeCompare(b.questId));
}

// 理解度チェックの、初回の回答を記録する(状態は変えない)
export function recordMockQuizAnswer(userId: string, id: string, correct: boolean) {
  if (!listMockQuests(userId).some((item) => item.id === id)) throw new Error("対象のニュースが見つかりません");
  const previous = states.get(key(userId, id));
  const answeredAt = new Date().toISOString();
  states.set(key(userId, id), {
    status: "viewed", ...previous,
    quizAnswers: [...(previous?.quizAnswers ?? []), { answeredAt, correct }].slice(-50),
  });
}

// テスト用: 保存した、回答と閲覧日時を読む
export function mockQuestRecord(userId: string, id: string) {
  const { firstViewedAt, quizAnswers } = states.get(key(userId, id)) ?? {};
  return { firstViewedAt, quizAnswers: quizAnswers ?? [] };
}

export const mockQuestStore: QuestStore = {
  async list(userId) {
    return listMockQuests(userId);
  },
  async saveState(userId, quest, status, review) {
    return saveMockQuestState(userId, quest.id, status, review);
  },
  async learningHistory(userId) {
    return mockLearningHistory(userId);
  },
  async recordQuizAnswer(userId, questId, correct) {
    recordMockQuizAnswer(userId, questId, correct);
  },
};
