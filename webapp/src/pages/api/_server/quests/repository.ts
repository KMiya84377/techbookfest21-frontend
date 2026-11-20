import { NEWS_FEED } from "../../../../../aws-blocks/constants";
import { news, userQuests } from "../../../../../aws-blocks/storage";
import type { Quest } from "../../../../lib/quests/model";
import { toQuest, type NewsItem } from "./newsItem";
import { MAX_QUIZ_ANSWERS, type UserQuestItem } from "./userQuestItem";
import type { LearningEntry } from "../../../../lib/learning/model";
import {
  updateUserQuestRecord,
  listUserQuestRecords,
} from "../blocks/userQuestRecords";
import { QuestNotFoundError } from "./errors";
import type { QuestStore } from "./store";

// クリア時に保存した学習内容(learning)を、学習した順に返す
async function listLearningHistory(
  userId: string,
): Promise<LearningEntry[]> {
  return (await listUserQuestRecords<UserQuestItem>(userId))
    .flatMap((item) =>
      item.status === "cleared" && item.learning ? [item.learning] : [],
    )
    .sort(
      (a, b) =>
        a.learnedAt.localeCompare(b.learnedAt) ||
        a.questId.localeCompare(b.questId),
    );
}

export async function listQuests(userId: string): Promise<Quest[]> {
  const items: NewsItem[] = [];
  for await (const item of news.query({
    index: "ByFeedPublishedAt",
    where: { feed: { equals: NEWS_FEED } },
    order: "desc",
    limit: 200,
  }))
    items.push(item as unknown as NewsItem);
  const states = await userQuests.getBatch(
    items.map((item) => ({ userId, newsId: item.newsId })),
  );
  return items.map((item, i) =>
    toQuest(item, states[i] as unknown as UserQuestItem | undefined),
  );
}

export async function updateQuestState(
  userId: string,
  quest: Pick<Quest, "id" | "publishedAt">,
  status: "viewed" | "cleared",
  review?: boolean,
): Promise<{ newlyCleared: boolean }> {
  const item = await news.get({ newsId: quest.id });
  if (!item || item.publishedAt !== quest.publishedAt)
    throw new QuestNotFoundError();
  const saved = await updateUserQuestRecord<UserQuestItem>(
    userId,
    quest.id,
    (current) => {
      if (current?.status === "cleared") return null;
      const updatedAt = new Date().toISOString();
      const next = {
        ...current,
        status,
        updatedAt,
        // 初めて詳細を開いた日時（詳細を開かずクリアした場合はその日時）を残す。
        firstViewedAt: current?.firstViewedAt ?? updatedAt,
      };
      if (review !== undefined) next.review = review;
      if (status === "cleared") {
        next.learnedAt = updatedAt;
        next.learning = {
          questId: quest.id,
          title: item.title,
          summary: item.summary,
          services: item.services,
          review: Boolean(review),
          learnedAt: updatedAt,
        };
      }
      return next;
    },
  );
  return { newlyCleared: saved !== null && saved.status === "cleared" };
}

// 理解度チェックの、初回の回答を 1 件追記する。クエストの状態(閲覧済み・クリア済み)は変えない
export async function recordQuizAnswer(
  userId: string,
  questId: string,
  correct: boolean,
): Promise<void> {
  const item = await news.get({ newsId: questId });
  if (!item) throw new QuestNotFoundError();
  const answeredAt = new Date().toISOString();
  await updateUserQuestRecord<UserQuestItem>(userId, questId, (current) => ({
    status: "todo",
    ...current,
    quizAnswers: [
      ...(current?.quizAnswers ?? []),
      { answeredAt, correct },
    ].slice(-MAX_QUIZ_ANSWERS),
  }));
}

// Blocks(DistributedTable)の保存先。mock モードとの切り替えは store.ts
export const blocksQuestStore: QuestStore = {
  list: listQuests,
  saveState: updateQuestState,
  learningHistory: listLearningHistory,
  recordQuizAnswer,
};
