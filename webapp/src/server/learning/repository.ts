import { AUTH_DISABLED } from "../../lib/blocks/config";
import { changeUserRecord, getUserRecord, listUserRecords } from "../blocks/records";
import { DEFAULT_LEARNING_REVIEW_EVERY } from "../../lib/userSettings/model";
import { PREFIX, eligible, key, legacyKey, toInsights, type ReviewRecord, type ReviewStore } from "./reviewRecord";

const blocksReviewStore: ReviewStore = {
  async getReview(userId, batch, every) {
    const current = await getUserRecord<ReviewRecord>(userId, key(batch, every));
    const legacy = every === DEFAULT_LEARNING_REVIEW_EVERY ? await getUserRecord<ReviewRecord>(userId, legacyKey(batch)) : null;
    return current ?? legacy ?? undefined;
  },

  async listInsights(userId) {
    return toInsights(await listUserRecords<ReviewRecord>(userId, PREFIX));
  },

  async claimReview(userId, batch, every, now = Date.now()) {
    if (!eligible(await blocksReviewStore.getReview(userId, batch, every), now)) return null;
    const token = crypto.randomUUID();
    return changeUserRecord<ReviewRecord, string | null>(userId, key(batch, every), (current) => eligible(current, now)
      ? { value: { ...current, batch, state: "running", leaseToken: token, leaseUntil: now + 180_000 }, result: token }
      : { result: null });
  },

  async finishReview(userId, batch, every, token, state, insight) {
    await changeUserRecord<ReviewRecord, void>(userId, key(batch, every), (current) => {
      if (!current || current.leaseToken !== token) throw new Error("分析の実行権が失効しました");
      return { value: { ...current, state, ...(insight ? { insight } : {}) }, result: undefined };
    });
  },

  async readInsight(userId, batch, every) {
    const readAt = new Date().toISOString();
    const record = await blocksReviewStore.getReview(userId, batch, every);
    if (!record?.insight) return;
    await changeUserRecord<ReviewRecord, void>(userId, record.newsId ?? key(batch, every), (current) => current?.state === "ready" && current.insight
      ? { value: { ...current, insight: { ...current.insight, readAt: current.insight.readAt ?? readAt } }, result: undefined }
      : { result: undefined });
  },
};

const store: ReviewStore = AUTH_DISABLED
  ? (await import("../../../mock/learningReviewStore")).memoryReviewStore
  : blocksReviewStore;

export const { getReview, listInsights, claimReview, finishReview, readInsight } = store;
