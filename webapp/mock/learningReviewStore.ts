import { eligible, toInsights, type ReviewRecord, type ReviewStore } from "../src/server/learning/reviewRecord";

// mockモード専用。関連分析の実行記録をメモリに持つ(Blocks の保存先と同じ契約)
const records = new Map<string, ReviewRecord>();
const keyOf = (userId: string, batch: number, every: number) => JSON.stringify([userId, every, batch]);

export const memoryReviewStore: ReviewStore = {
  async getReview(userId, batch, every) {
    return records.get(keyOf(userId, batch, every));
  },

  async listInsights(userId) {
    return toInsights([...records.entries()].filter(([k]) => JSON.parse(k)[0] === userId).map(([, v]) => v));
  },

  async claimReview(userId, batch, every, now = Date.now()) {
    if (!eligible(await memoryReviewStore.getReview(userId, batch, every), now)) return null;
    const token = crypto.randomUUID();
    if (!eligible(records.get(keyOf(userId, batch, every)), now)) return null;
    records.set(keyOf(userId, batch, every), { batch, state: "running", leaseToken: token, leaseUntil: now + 180_000 });
    return token;
  },

  async finishReview(userId, batch, every, token, state, insight) {
    const current = records.get(keyOf(userId, batch, every));
    if (current?.leaseToken !== token) throw new Error("分析の実行権が失効しました");
    records.set(keyOf(userId, batch, every), { ...current, state, ...(insight ? { insight } : {}) });
  },

  async readInsight(userId, batch, every) {
    const current = records.get(keyOf(userId, batch, every));
    if (current?.insight) current.insight = { ...current.insight, readAt: new Date().toISOString() };
  },
};
