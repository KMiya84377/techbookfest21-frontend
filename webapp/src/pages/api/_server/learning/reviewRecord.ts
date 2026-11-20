import type { LearningInsight } from "../../../../lib/learning/model";

// 関連分析の実行記録。Blocks の保存先と、mock のメモリの両方が使う(型・定数と純粋な関数だけ)
export type ReviewState = "running" | "ready" | "none" | "failed";
export interface ReviewRecord {
  batch: number;
  state: ReviewState;
  leaseToken: string;
  leaseUntil: number;
  insight?: LearningInsight;
}

// 実行権の期限。期限を過ぎた実行中の記録は、ほかのリクエストが引き継げる
export const LEASE_MS = 180_000;

// 保存先のキー。区間の番号を10桁にそろえ、キーの並びが区間の順になるようにする
export const REVIEW_PREFIX = "__learning_insight__#";
export const reviewKey = (batch: number, every: number) =>
  `${REVIEW_PREFIX}${every}#${String(batch).padStart(10, "0")}`;

// 分析を始められるか(まだ実行していない、失敗した、または実行中のまま期限が切れた)
export const canStartReview = (
  record: ReviewRecord | null | undefined,
  now: number,
) =>
  !record ||
  record.state === "failed" ||
  (record.state === "running" && record.leaseUntil < now);

// 一覧に返す、完了した分析の件数(新しい順)
const INSIGHT_LIST_LIMIT = 20;

// 完了した分析の結果だけを、新しい順に返す
export const toInsights = (records: ReviewRecord[]): LearningInsight[] =>
  records
    .flatMap((record) =>
      record.state === "ready" && record.insight ? [record.insight] : [],
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, INSIGHT_LIST_LIMIT);
