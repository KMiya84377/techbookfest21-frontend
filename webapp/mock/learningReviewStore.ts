import {
  LEASE_MS,
  canStartReview,
  toInsights,
  type ReviewRecord,
} from "../src/server/learning/reviewRecord";
import type { ReviewStore } from "../src/server/learning/store";

// mockモード専用。関連分析の実行記録をメモリに持つ(Blocks の保存先と同じ契約)
const records = new Map<string, ReviewRecord>();
const keyOf = (userId: string, batch: number, every: number) =>
  JSON.stringify([userId, every, batch]);

export const memoryReviewStore: ReviewStore = {
  async getReview(userId, batch, every) {
    return records.get(keyOf(userId, batch, every));
  },

  async listInsights(userId) {
    return toInsights(
      [...records.entries()]
        .filter(([recordKey]) => JSON.parse(recordKey)[0] === userId)
        .map(([, record]) => record),
    );
  },

  async claimReview(userId, batch, every, now = Date.now()) {
    if (!canStartReview(records.get(keyOf(userId, batch, every)), now))
      return null;
    const token = crypto.randomUUID();
    records.set(keyOf(userId, batch, every), {
      batch,
      state: "running",
      leaseToken: token,
      leaseUntil: now + LEASE_MS,
    });
    return token;
  },

  async finishReview(userId, batch, every, token, state, insight) {
    const current = records.get(keyOf(userId, batch, every));
    if (current?.leaseToken !== token)
      throw new Error("分析の実行権が失効しました");
    records.set(keyOf(userId, batch, every), {
      ...current,
      state,
      ...(insight ? { insight } : {}),
    });
  },

  async readInsight(userId, batch, every) {
    const current = records.get(keyOf(userId, batch, every));
    if (current?.insight)
      current.insight = {
        ...current.insight,
        readAt: current.insight.readAt ?? new Date().toISOString(),
      };
  },
};
