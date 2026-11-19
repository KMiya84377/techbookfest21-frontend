import { changeUserRecord, listUserRecords } from "../blocks/records";
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
    return changeUserRecord<
      ReviewRecord,
      { token: string; evaluatedIds: string[] } | null
    >(userId, REVIEW_KEY, (current) => {
      if (current && current.leaseUntil > now) return { result: null };
      const evaluatedIds = current?.evaluatedIds ?? [];
      return {
        value: {
          ...current,
          leaseToken: token,
          leaseUntil: now + LEASE_MS,
          evaluatedIds,
        },
        result: { token, evaluatedIds },
      };
    });
  },
  async finish(userId, token, evaluatedIds) {
    await changeUserRecord<ReviewRecord, void>(
      userId,
      REVIEW_KEY,
      (current) => {
        if (!current || current.leaseToken !== token)
          throw new Error("新着選定の実行権が失効しました");
        return {
          value: { ...current, evaluatedIds, leaseUntil: 0 },
          result: undefined,
        };
      },
    );
  },
  async save(userId, notification) {
    await changeUserRecord<NotificationRecord, void>(
      userId,
      PREFIX + notification.questId,
      (current) =>
        current
          ? { result: undefined }
          : { value: { notification }, result: undefined },
    );
  },
  async list(userId) {
    return (await listUserRecords<NotificationRecord>(userId, PREFIX))
      .filter((item) => item.notification)
      .map((item) => item.notification)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
      )
      .slice(0, NOTIFICATION_LIST_LIMIT);
  },
  async read(userId, questId) {
    return changeUserRecord<NotificationRecord, boolean>(
      userId,
      PREFIX + questId,
      (current) =>
        current?.notification
          ? {
              value: {
                ...current,
                notification: {
                  ...current.notification,
                  readAt:
                    current.notification.readAt ?? new Date().toISOString(),
                },
              },
              result: true,
            }
          : { result: false },
    );
  },
};
