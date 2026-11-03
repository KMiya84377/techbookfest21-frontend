import type { Quest, QuestStatus } from "../../lib/quests/model";
import type { LearningEntry } from "../../lib/learning/model";

// 理解度チェックの、初回の回答1件(再回答は記録しない)。週間レポートの、回答数と初回正解率に使う
export interface QuizAnswerRecord {
  answeredAt: string;
  correct: boolean;
}

// ユーザーが、そのニュースを学習した状態だけを保存する項目
export interface UserQuestItem {
  userId: string;
  newsId: string;
  status: QuestStatus;
  review?: boolean;
  updatedAt?: string;
  // 初めて詳細を開いた日時(週間レポートの閲覧数に使う)
  firstViewedAt?: string;
  learnedAt?: string;
  learning?: LearningEntry;
  // 理解度チェックの、初回の回答(1 つのクエストで、複数の問題に答えることがある)
  quizAnswers?: QuizAnswerRecord[];
}

// 1 つのクエストに残す回答の上限(想定外の増加を抑える)
export const MAX_QUIZ_ANSWERS = 50;

export function toUserQuestItem(userId: string, quest: Quest): UserQuestItem {
  return {
    userId,
    newsId: quest.id,
    status: quest.status,
    ...(quest.review === undefined ? {} : { review: quest.review }),
  };
}
