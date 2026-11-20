import {
  updateUserQuestRecord,
  listUserQuestRecords,
} from "../blocks/userQuestRecords";
import type { NotificationStore } from "./store";
import {
  LEASE_MS,
  NOTIFICATION_LIST_LIMIT,
  PREFIX,
  REVIEW_KEY,
  type NotificationRecord,
  type ReviewRecord,
} from "./reviewRecord";

// Blocks(DistributedTable)の保存先。mock モードとの切り替えは store.ts
export const blocksNotificationStore: NotificationStore = {
  async claim(userId) {
    const token = crypto.randomUUID();
    const now = Date.now();
    const saved = await updateUserQuestRecord<ReviewRecord>(
      userId,
      REVIEW_KEY,
      (current) => {
        if (current && current.leaseUntil > now) return null;
        return {
          ...current,
          leaseToken: token,
          leaseUntil: now + LEASE_MS,
          evaluatedIds: current?.evaluatedIds ?? [],
        };
      },
    );
    if (!saved) return null;
    return { token: saved.leaseToken, evaluatedIds: saved.evaluatedIds };
  },
  async finish(userId, token, evaluatedIds) {
    await updateUserQuestRecord<ReviewRecord>(
      userId,
      REVIEW_KEY,
      (current) => {
        if (!current || current.leaseToken !== token)
          throw new Error("新着選定の実行権が失効しました");
        return { ...current, evaluatedIds, leaseUntil: 0 };
      },
    );
  },
  async save(userId, notification) {
    await updateUserQuestRecord<NotificationRecord>(
      userId,
      PREFIX + notification.questId,
      (current) => {
        if (current) return null;
        return { notification };
      },
    );
  },
  async list(userId) {
    return (await listUserQuestRecords<NotificationRecord>(userId, PREFIX))
      .filter((item) => item.notification)
      .map((item) => item.notification)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      )
      .slice(0, NOTIFICATION_LIST_LIMIT);
  },
  async read(userId, questId) {
    const saved = await updateUserQuestRecord<NotificationRecord>(
      userId,
      PREFIX + questId,
      (current) => {
        if (!current?.notification) return null;
        return {
          ...current,
          notification: {
            ...current.notification,
            readAt: current.notification.readAt ?? new Date().toISOString(),
          },
        };
      },
    );
    return saved !== null;
  },
};
