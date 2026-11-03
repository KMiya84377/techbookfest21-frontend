import { AUTH_DISABLED } from "../../lib/blocks/config";
import type { LearningEntry } from "../../lib/learning/model";
import type { Quest } from "../../lib/quests/model";
import { listLearningHistory, listQuests, recordQuizAnswer, updateQuestState } from "./repository";

// クエストの一覧・状態の保存・学習履歴。保存先は、ここで1度だけ選ぶ(Blocks か、mock モードのメモリ)
export interface QuestStore {
  list(userId: string): Promise<Quest[]>;
  saveState(
    userId: string,
    quest: Pick<Quest, "id" | "publishedAt">,
    status: "viewed" | "cleared",
    review?: boolean,
  ): Promise<{ newlyCleared: boolean }>;
  learningHistory(userId: string): Promise<LearningEntry[]>;
  // 理解度チェックの、初回の回答を記録する(週間レポート用)
  recordQuizAnswer(userId: string, questId: string, correct: boolean): Promise<void>;
}

const blocksQuestStore: QuestStore = {
  list: listQuests,
  saveState: updateQuestState,
  learningHistory: listLearningHistory,
  recordQuizAnswer,
};

// AUTH_DISABLED は、本番ビルドでは定数 false になり、mock/ の読み込みごと消える
export const questStore: QuestStore = AUTH_DISABLED
  ? (await import("../../../mock/questStore")).mockQuestStore
  : blocksQuestStore;
