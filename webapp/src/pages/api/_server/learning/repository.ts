import {
  updateUserQuestRecord,
  getUserQuestRecord,
  listUserQuestRecords,
} from "../blocks/userQuestRecords";
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
      (await getUserQuestRecord<ReviewRecord>(userId, reviewKey(batch, every))) ??
      undefined
    );
  },

  async listInsights(userId) {
    return toInsights(
      await listUserQuestRecords<ReviewRecord>(userId, REVIEW_PREFIX),
    );
  },

  async claimReview(userId, batch, every, now = Date.now()) {
    const token = crypto.randomUUID();
    const saved = await updateUserQuestRecord<ReviewRecord>(
      userId,
      reviewKey(batch, every),
      (current) => {
        if (!canStartReview(current, now)) return null;
        return {
          ...current,
          batch,
          state: "running",
          leaseToken: token,
          leaseUntil: now + LEASE_MS,
        };
      },
    );
    return saved?.leaseToken ?? null;
  },

  async finishReview(userId, batch, every, token, state, insight) {
    await updateUserQuestRecord<ReviewRecord>(
      userId,
      reviewKey(batch, every),
      (current) => {
        if (!current || current.leaseToken !== token)
          throw new Error("分析の実行権が失効しました");
        const next = { ...current, state };
        if (insight) next.insight = insight;
        return next;
      },
    );
  },

  async readInsight(userId, batch, every) {
    const readAt = new Date().toISOString();
    await updateUserQuestRecord<ReviewRecord>(
      userId,
      reviewKey(batch, every),
      (current) => {
        if (current?.state !== "ready" || !current.insight) return null;
        return {
          ...current,
          insight: {
            ...current.insight,
            readAt: current.insight.readAt ?? readAt,
          },
        };
      },
    );
  },
};
