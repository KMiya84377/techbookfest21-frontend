import { NEWS_FEED } from "../../../aws-blocks/constants";
import { news, userQuests } from "../../../aws-blocks/storage";
import type { Quest } from "../../lib/quests/model";
import { toQuest, type NewsItem } from "./newsItem";
import { MAX_QUIZ_ANSWERS, type UserQuestItem } from "./userQuestItem";
import type { LearningEntry } from "../../lib/learning/model";
import { changeUserRecord, listUserRecords } from "../blocks/records";

export async function listLearningHistory(userId: string): Promise<LearningEntry[]> {
  const states = (await listUserRecords<UserQuestItem>(userId)).filter((item) => item.status === "cleared");
  const history: LearningEntry[] = [];
  for (const state of states) {
    if (state.learning) { history.push(state.learning); continue; }
    const item = await news.get({ newsId: state.newsId });
    if (item) history.push({ questId: state.newsId, title: item.title, summary: item.summary,
      services: item.services, review: Boolean(state.review), learnedAt: state.learnedAt ?? state.updatedAt ?? item.publishedAt });
  }
  return history.sort((a, b) => a.learnedAt.localeCompare(b.learnedAt) || a.questId.localeCompare(b.questId));
}

export async function listQuests(userId: string): Promise<Quest[]> {
  const items: NewsItem[] = [];
  for await (const item of news.query({ index: "ByFeedPublishedAt", where: { feed: { equals: NEWS_FEED } }, order: "desc", limit: 200 })) items.push(item as unknown as NewsItem);
  const states = await userQuests.getBatch(items.map((item) => ({ userId, newsId: item.newsId })));
  return items.map((item, i) => toQuest(item, states[i] as unknown as UserQuestItem | undefined));
}

export async function updateQuestState(userId: string, quest: Pick<Quest, "id" | "publishedAt">,
  status: "viewed" | "cleared", review?: boolean): Promise<{ newlyCleared: boolean }> {
  const item = await news.get({ newsId: quest.id });
  if (!item || item.publishedAt !== quest.publishedAt) throw new Error("対象のニュースが見つかりません");
  return changeUserRecord<UserQuestItem, { newlyCleared: boolean }>(userId, quest.id, (current) => {
    if (current?.status === "cleared") return { result: { newlyCleared: false } };
    const updatedAt = new Date().toISOString();
    return { value: { ...current, userId, newsId: quest.id, status, updatedAt,
      // 初めて詳細を開いた(または、詳細を開かずにクリアした)日時は、1 度だけ残す
      firstViewedAt: current?.firstViewedAt ?? updatedAt,
      ...(review === undefined ? {} : { review }),
      ...(status === "cleared" ? { learnedAt: updatedAt, learning: {
        questId: quest.id, title: item.title, summary: item.summary, services: item.services,
        review: Boolean(review), learnedAt: updatedAt,
      } } : {}),
    }, result: { newlyCleared: status === "cleared" } };
  });
}

// 理解度チェックの、初回の回答を 1 件追記する。クエストの状態(閲覧済み・クリア済み)は変えない
export async function recordQuizAnswer(userId: string, questId: string, correct: boolean): Promise<void> {
  const item = await news.get({ newsId: questId });
  if (!item) throw new Error("対象のニュースが見つかりません");
  const answeredAt = new Date().toISOString();
  await changeUserRecord<UserQuestItem, null>(userId, questId, (current) => ({
    value: {
      status: "todo", ...current, userId, newsId: questId,
      quizAnswers: [...(current?.quizAnswers ?? []), { answeredAt, correct }].slice(-MAX_QUIZ_ANSWERS),
    },
    result: null,
  }));
}
