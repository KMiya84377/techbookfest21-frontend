import { z } from "zod";
import type { Quest } from "../quests/model";

export const NEWS_REVIEW_LIMIT = 20;
export const recommendationsSchema = z.object({
  recommendations: z.array(z.object({
    questId: z.string().min(1).max(200),
    reason: z.string().trim().min(1).max(400),
  }).strict()).max(5),
}).strict();
export type Recommendations = z.infer<typeof recommendationsSchema>;
export interface NewsNotification {
  id: string;
  questId: string;
  title: string;
  reason: string;
  createdAt: string;
  readAt?: string;
  mock?: boolean;
}

export function newCandidates(quests: Quest[], evaluatedIds: string[]): Quest[] {
  const evaluated = new Set(evaluatedIds);
  return quests.filter((quest) => quest.status === "todo" && !evaluated.has(quest.id))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
    .slice(0, NEWS_REVIEW_LIMIT);
}

// AIには選定だけを任せ、対象ID・重複・通知文の形式はアプリで検証する。
export function validateRecommendations(value: unknown, candidates: Quest[]): Recommendations {
  const result = recommendationsSchema.parse(value);
  const allowed = new Set(candidates.map((quest) => quest.id));
  const ids = result.recommendations.map((item) => item.questId);
  if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id))) {
    throw new Error("新着候補にないニュース、または重複したニュースが選ばれました");
  }
  return result;
}
