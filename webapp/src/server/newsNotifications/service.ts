import { MOCK_AI } from "../../lib/blocks/config";
import { createConfiguredAgent } from "../agent/configuredAgent";
import { userContext } from "../agent/userContext";
import { questStore } from "../quests/store";
import { loadUserSettings } from "../userSettings/service";
import type { Quest } from "../../lib/quests/model";
import type { UserSettings } from "../../lib/userSettings/model";
import { notificationStore } from "./repository";
import { reviewNews } from "./review";
import { collectRecommendations } from "./collectRecommendations";
import type { Recommendations } from "../../lib/newsNotifications/model";

// 関心に合う新着の選び方。mock のときは、AIを呼ばずに画面確認用の結果を返す
const select = MOCK_AI
  ? async (_userId: string, candidates: Quest[]): Promise<Recommendations> =>
      (await import("../../../mock/newsAi")).mockRecommendations(candidates)
  : (userId: string, candidates: Quest[], settings: UserSettings) =>
      userContext.run({ userId }, async () => collectRecommendations(await createConfiguredAgent(), candidates, settings));

export const reviewNewNews = (userId: string) => reviewNews(userId, {
  store: notificationStore,
  quests: questStore.list,
  settings: loadUserSettings,
  select,
  mock: MOCK_AI,
});
