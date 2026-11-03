import type { LearningInsight } from "../../lib/learning/model";
import { DEFAULT_LEARNING_REVIEW_EVERY } from "../../lib/userSettings/model";

// 関連分析の実行記録。Blocks の保存先と、mock のメモリの両方が使う(型と純粋な関数だけ)
export type ReviewState = "running" | "ready" | "none" | "failed";
export interface ReviewRecord {
  newsId?: string;
  batch: number;
  state: ReviewState;
  leaseToken: string;
  leaseUntil: number;
  insight?: LearningInsight;
}

export const PREFIX = "__learning_insight__#";
export const key = (batch: number, every: number) => `${PREFIX}${every}#${String(batch).padStart(10, "0")}`;
export const legacyKey = (batch: number) => PREFIX + String(batch).padStart(10, "0");

export const eligible = (record: ReviewRecord | null | undefined, now: number) =>
  !record || record.state === "failed" || (record.state === "running" && record.leaseUntil < now);

export interface ReviewStore {
  getReview(userId: string, batch: number, every: number): Promise<ReviewRecord | undefined>;
  listInsights(userId: string): Promise<LearningInsight[]>;
  claimReview(userId: string, batch: number, every: number, now?: number): Promise<string | null>;
  finishReview(
    userId: string,
    batch: number,
    every: number,
    token: string,
    state: Exclude<ReviewState, "running">,
    insight?: LearningInsight,
  ): Promise<void>;
  readInsight(userId: string, batch: number, every: number): Promise<void>;
}

// 完了した分析を、新しい順に最大20件
export const toInsights = (records: ReviewRecord[]): LearningInsight[] =>
  records
    .filter((r) => r.state === "ready" && r.insight)
    .map((r) => ({ ...r.insight!, reviewEvery: r.insight!.reviewEvery ?? DEFAULT_LEARNING_REVIEW_EVERY }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
