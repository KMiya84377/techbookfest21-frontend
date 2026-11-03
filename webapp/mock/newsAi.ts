import type { Recommendations } from "../src/lib/newsNotifications/model";
import type { Quest } from "../src/lib/quests/model";

// mockモード専用。AIを呼ばずに、先頭2件を「関心に合う新着」として返す
export const mockRecommendations = (candidates: Quest[]): Recommendations => ({
  recommendations: candidates.slice(0, 2).map((quest) => ({
    questId: quest.id,
    reason: "新着通知の画面確認用モックです。AIによる関心の判定ではありません。",
  })),
});
