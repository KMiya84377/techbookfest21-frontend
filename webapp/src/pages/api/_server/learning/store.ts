import { AUTH_DISABLED } from "../../../../lib/appMode";
import type { LearningInsight } from "../../../../lib/learning/model";
import { blocksReviewStore } from "./repository";
import type { ReviewRecord, ReviewState } from "./reviewRecord";

// 関連分析の排他と、結果の保存・既読。保存先は、ここで1度だけ選ぶ(Blocks か、mock モードのメモリ)
export interface ReviewStore {
  getReview(
    userId: string,
    batch: number,
    every: number,
  ): Promise<ReviewRecord | undefined>;
  listInsights(userId: string): Promise<LearningInsight[]>;
  claimReview(
    userId: string,
    batch: number,
    every: number,
    now?: number,
  ): Promise<string | null>;
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

// AUTH_DISABLED は、本番ビルドでは定数 false になり、mock/ の読み込みごと消える
const store: ReviewStore = AUTH_DISABLED
  ? (await import("../../../../../mock/learningReviewStore")).memoryReviewStore
  : blocksReviewStore;

export const {
  getReview,
  listInsights,
  claimReview,
  finishReview,
  readInsight,
} = store;
