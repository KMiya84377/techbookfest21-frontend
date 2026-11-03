import type { LearningConnections, LearningEntry, LearningInsight } from "../../lib/learning/model";
import { learningProgress } from "../../lib/learning/model";
import { loadUserSettings } from "../userSettings/service";
import { questStore } from "../quests/store";
import { MOCK_AI } from "../../lib/blocks/config";
import { claimReview, finishReview, getReview, listInsights } from "./repository";
import { generateConnections } from "./generate";

// 関連図の作り方。mock のときは、AIを呼ばずに画面確認用の図を返す
interface ConnectionMaker {
  make(userId: string, sources: LearningEntry[]): Promise<LearningConnections>;
  mock: boolean;
}
const connectionMaker: ConnectionMaker = MOCK_AI
  ? { make: async (_userId, sources) => (await import("../../../mock/learningAi")).mockConnections(sources), mock: true }
  : { make: generateConnections, mock: false };

export const learningHistory = (userId: string) => questStore.learningHistory(userId);

export async function insightStatus(userId: string) {
  const [history, settings] = await Promise.all([learningHistory(userId), loadUserSettings(userId)]);
  const learning = learningProgress(history.length, settings.learningReviewEvery);
  const record = learning.batch > 0 ? await getReview(userId, learning.batch, learning.reviewEvery) : undefined;
  return {
    learning,
    insights: await listInsights(userId),
    // 再読み込み時にも未処理・失敗・失効した実行を復旧できる。
    pendingBatch: learning.batch > 0 && (!record || record.state === "failed" || (record.state === "running" && record.leaseUntil < Date.now()))
      ? learning.batch : null,
  };
}

export async function createInsight(userId: string, expectedBatch: number, expectedEvery: number) {
  // 件数・履歴はリクエスト本文を信用せず、必ずユーザー自身のDBから再取得する。
  const [all, settings] = await Promise.all([learningHistory(userId), loadUserSettings(userId)]);
  const progress = learningProgress(all.length, settings.learningReviewEvery);
  if (progress.batch < 1 || expectedBatch !== progress.batch || expectedEvery !== progress.reviewEvery) return { state: "stale" as const };
  const token = await claimReview(userId, progress.batch, progress.reviewEvery);
  if (!token) return { state: "existing" as const };
  try {
    // 直近20件まで。件数区間を固定して同時クリア後も分析対象を安定させる。
    const end = progress.batch * progress.reviewEvery;
    const sources: LearningEntry[] = all.slice(Math.max(0, end - 20), end);
    const diagram = await connectionMaker.make(userId, sources);
    if (!diagram.hasConnections) {
      await finishReview(userId, progress.batch, progress.reviewEvery, token, "none");
      return { state: "none" as const };
    }
    const ids = new Set(diagram.nodes.map((node) => node.questId));
    const insight: LearningInsight = {
      id: `learning-${progress.reviewEvery}-${progress.batch}`, batch: progress.batch, reviewEvery: progress.reviewEvery,
      createdAt: new Date().toISOString(), diagram,
      sources: sources.filter((entry) => ids.has(entry.questId)),
      ...(connectionMaker.mock ? { mock: true } : {}),
    };
    await finishReview(userId, progress.batch, progress.reviewEvery, token, "ready", insight);
    return { state: "ready" as const };
  } catch (error) {
    await finishReview(userId, progress.batch, progress.reviewEvery, token, "failed");
    throw error;
  }
}
