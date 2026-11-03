import type { Quest } from "../../lib/quests/model";
import type { UserSettings } from "../../lib/userSettings/model";
import { newCandidates, validateRecommendations, type Recommendations } from "../../lib/newsNotifications/model";
import type { NotificationStore } from "./store";

interface Dependencies {
  store: NotificationStore;
  quests: (userId: string) => Promise<Quest[]>;
  settings: (userId: string) => Promise<UserSettings>;
  select: (userId: string, candidates: Quest[], settings: UserSettings) => Promise<Recommendations>;
  mock?: boolean;
}

export async function reviewNews(userId: string, deps: Dependencies) {
  const lease = await deps.store.claim(userId);
  if (!lease) return { state: "running" as const, notifications: await deps.store.list(userId) };
  let evaluatedIds = lease.evaluatedIds;
  try {
    const [quests, settings] = await Promise.all([deps.quests(userId), deps.settings(userId)]);
    const candidates = newCandidates(quests, evaluatedIds);
    if (candidates.length) {
      const selection = validateRecommendations(await deps.select(userId, candidates, settings), candidates);
      const createdAt = new Date().toISOString();
      for (const { questId, reason } of selection.recommendations) {
        const quest = candidates.find((item) => item.id === questId)!;
        await deps.store.save(userId, {
          id: `news-${questId}`, questId, title: quest.title, reason, createdAt,
          ...(deps.mock ? { mock: true } : {}),
        });
      }
      // 候補外になった古いIDを除き、現在の一覧の範囲で評価済みを記録する。
      // 該当なしも記録し、ポーリングのたびに同じニュースをAIへ送らない。
      const currentIds = new Set(quests.map((quest) => quest.id));
      evaluatedIds = [...new Set([...evaluatedIds, ...candidates.map((quest) => quest.id)])].filter((id) => currentIds.has(id));
    }
    await deps.store.finish(userId, lease.token, evaluatedIds);
  } catch (error) {
    // 失敗した候補は評価済みに進めず、次の確認で再試行する。
    await deps.store.finish(userId, lease.token, lease.evaluatedIds);
    throw error;
  }
  return { state: "ready" as const, notifications: await deps.store.list(userId) };
}
