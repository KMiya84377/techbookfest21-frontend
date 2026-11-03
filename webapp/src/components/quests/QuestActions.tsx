import { createContext, useContext } from "react";
import type { QuestStatus } from "../../lib/quests/model";

// チャット内の部品(理解度チェックなど)が、クエストボードの状態を読み、操作するための窓口
export interface QuestActions {
  // クエストの状態と、復習候補かどうか(クエストがなければ undefined)
  statusOf: (questId: string) => QuestStatus | undefined;
  isReview: (questId: string) => boolean;
  // クエストをクリアする。review が true なら、復習候補の印を付ける(クリア済みなら、何もしない)
  clear: (questId: string, review: boolean) => void;
  // 理解度チェックの、初回の回答を記録する(週間レポート用。再回答は呼ばない)
  recordAnswer: (questId: string, correct: boolean) => void;
  // クエストの詳細を開く
  open: (questId: string) => void;
  // チャットの入力欄に、フォーカスする
  focusChat: () => void;
}

const noop: QuestActions = {
  statusOf: () => undefined,
  isReview: () => false,
  clear: () => {},
  recordAnswer: () => {},
  open: () => {},
  focusChat: () => {},
};

export const QuestActionsContext = createContext<QuestActions>(noop);

export const useQuestActions = () => useContext(QuestActionsContext);
