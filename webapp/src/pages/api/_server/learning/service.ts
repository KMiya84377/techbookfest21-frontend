import type { LearningEntry, LearningInsight } from "../../../../lib/learning/model";
import { learningProgress } from "../../../../lib/learning/model";
import { userSettingsStore } from "../userSettings/store";
import { questStore } from "../quests/store";
import { MOCK_AI } from "../../../../lib/appMode";
import { claimReview, finishReview, getReview, listInsights } from "./store";
import { canStartReview } from "./reviewRecord";
import { generateConnections, type GeneratedLearningDiagram } from "./generate";

// 1 回の分析で、AIに渡す学習履歴の上限
const MAX_SOURCES = 20;

// 関連図の作り方。mock のときは、AIを呼ばずに画面確認用の図を返す
const makeConnections: (
  userId: string,
  sources: LearningEntry[],
) => Promise<GeneratedLearningDiagram> = MOCK_AI
  ? async (_userId, sources) =>
      (await import("../../../../../mock/learningAi")).mockLearningDiagram(sources)
  : generateConnections;

export const learningHistory = (userId: string) =>
  questStore.learningHistory(userId);

// 件数・履歴はリクエスト本文を信用せず、必ずユーザー自身のDBから取得して、件数区間を計算する。
export async function loadProgress(userId: string) {
  const [history, settings] = await Promise.all([
    learningHistory(userId),
    userSettingsStore.get(userId),
  ]);
  return {
    history,
    progress: learningProgress(history.length, settings.learningReviewEvery),
  };
}

export async function insightStatus(userId: string) {
  const { progress: learning } = await loadProgress(userId);
  const record =
    learning.batch > 0
      ? await getReview(userId, learning.batch, learning.reviewEvery)
      : undefined;
  return {
    learning,
    insights: await listInsights(userId),
    // 再読み込み時にも未処理・失敗・失効した実行を復旧できる。
    pendingBatch:
      learning.batch > 0 && canStartReview(record, Date.now())
        ? learning.batch
        : null,
  };
}

export async function createInsight(
  userId: string,
  expectedBatch: number,
  expectedEvery: number,
) {
  const { history, progress } = await loadProgress(userId);
  if (
    progress.batch < 1 ||
    expectedBatch !== progress.batch ||
    expectedEvery !== progress.reviewEvery
  )
    return { state: "stale" as const };
  const token = await claimReview(userId, progress.batch, progress.reviewEvery);
  if (!token) return { state: "existing" as const };
  const finish = (
    state: "ready" | "none" | "failed",
    insight?: LearningInsight,
  ) =>
    finishReview(
      userId,
      progress.batch,
      progress.reviewEvery,
      token,
      state,
      insight,
    );
  try {
    // 直近 MAX_SOURCES 件まで。件数区間を固定して同時クリア後も分析対象を安定させる。
    const end = progress.batch * progress.reviewEvery;
    const sources: LearningEntry[] = history.slice(
      Math.max(0, end - MAX_SOURCES),
      end,
    );
    const { diagram, ui } = await makeConnections(userId, sources);
    if (!diagram.hasConnections) {
      await finish("none");
      return { state: "none" as const };
    }
    if (!ui) throw new Error("関係の図解UIが生成されていません");
    const ids = new Set(diagram.nodes.map((node) => node.questId));
    const insight: LearningInsight = {
      id: `learning-${progress.reviewEvery}-${progress.batch}`,
      batch: progress.batch,
      reviewEvery: progress.reviewEvery,
      createdAt: new Date().toISOString(),
      diagram,
      ui,
      sources: sources.filter((entry) => ids.has(entry.questId)),
    };
    await finish("ready", insight);
    return { state: "ready" as const };
  } catch (error) {
    await finish("failed");
    throw error;
  }
}
