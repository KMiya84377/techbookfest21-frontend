import type { Quest } from "../data/quests";

// テーブルの 1 件は、ユーザー ID(userId)とクエスト ID(questId)をキーにする
// questId は「公開日時#ニュースの ID」なので、新しい順に取れる
export interface QuestItem extends Omit<Quest, "id"> {
  userId: string;
  questId: string;
}

export function toItem(userId: string, quest: Quest): QuestItem {
  const { id, ...rest } = quest;
  return { ...rest, userId, questId: `${quest.publishedAt}#${id}` };
}

export function toQuest(item: QuestItem): Quest {
  const { userId: _userId, questId, ...rest } = item;
  return { ...rest, id: questId.slice(questId.indexOf("#") + 1) };
}
