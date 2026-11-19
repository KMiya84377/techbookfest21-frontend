import {
  changeUserRecord,
  getUserRecord,
  listUserRecords,
} from "../blocks/records";
import {
  LEASE_MS,
  REVIEW_PREFIX,
  canStartReview,
  reviewKey,
  toInsights,
  type ReviewRecord,
} from "./reviewRecord";
import type { ReviewStore } from "./store";

// Blocks(DistributedTable)の保存先。mock モードとの切り替えは store.ts
export const blocksReviewStore: ReviewStore = {
  async getReview(userId, batch, every) {
    return (
      (await getUserRecord<ReviewRecord>(userId, reviewKey(batch, every))) ??
      undefined
    );
  },

  async listInsights(userId) {
    return toInsights(
      await listUserRecords<ReviewRecord>(userId, REVIEW_PREFIX),
    );
  },

  async claimReview(userId, batch, every, now = Date.now()) {
    const token = crypto.randomUUID();
    return changeUserRecord<ReviewRecord, string | null>(
      userId,
      reviewKey(batch, every),
      (current) =>
        canStartReview(current, now)
          ? {
              value: {
                ...current,
                batch,
                state: "running",
                leaseToken: token,
                leaseUntil: now + LEASE_MS,
              },
              result: token,
            }
          : { result: null },
    );
  },

  async finishReview(userId, batch, every, token, state, insight) {
    await changeUserRecord<ReviewRecord, void>(
      userId,
      reviewKey(batch, every),
      (current) => {
        if (!current || current.leaseToken !== token)
          throw new Error("分析の実行権が失効しました");
        return {
          value: { ...current, state, ...(insight ? { insight } : {}) },
          result: undefined,
        };
      },
    );
  },

  async readInsight(userId, batch, every) {
    const readAt = new Date().toISOString();
    await changeUserRecord<ReviewRecord, void>(
      userId,
      reviewKey(batch, every),
      (current) =>
        current?.state === "ready" && current.insight
          ? {
              value: {
                ...current,
                insight: {
                  ...current.insight,
                  readAt: current.insight.readAt ?? readAt,
                },
              },
              result: undefined,
            }
          : { result: undefined },
    );
  },
};
