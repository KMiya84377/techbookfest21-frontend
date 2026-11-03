import { AUTH_DISABLED } from "../../lib/blocks/config";
import { changeUserRecord, listUserRecords } from "../blocks/records";
import type { NotificationStore } from "./store";
import type { NewsNotification } from "../../lib/newsNotifications/model";

const REVIEW_KEY = "__news_notification_review__";
const PREFIX = "__news_notification__#";
interface ReviewRecord { leaseToken: string; leaseUntil: number; evaluatedIds: string[] }
interface NotificationRecord { notification: NewsNotification }

const blocksStore: NotificationStore = {
  async claim(userId) {
    const token = crypto.randomUUID(), now = Date.now();
    return changeUserRecord<ReviewRecord, { token: string; evaluatedIds: string[] } | null>(userId, REVIEW_KEY, (current) => {
      if (current && current.leaseUntil > now) return { result: null };
      const evaluatedIds = current?.evaluatedIds ?? [];
      return { value: { ...current, leaseToken: token, leaseUntil: now + 180_000, evaluatedIds }, result: { token, evaluatedIds } };
    });
  },
  async finish(userId, token, evaluatedIds) {
    await changeUserRecord<ReviewRecord, void>(userId, REVIEW_KEY, (current) => {
      if (!current || current.leaseToken !== token) throw new Error("新着選定の実行権が失効しました");
      return { value: { ...current, evaluatedIds, leaseUntil: 0 }, result: undefined };
    });
  },
  async save(userId, notification) {
    await changeUserRecord<NotificationRecord, void>(userId, PREFIX + notification.questId, (current) => current
      ? { result: undefined } : { value: { notification }, result: undefined });
  },
  async list(userId) {
    return (await listUserRecords<NotificationRecord>(userId, PREFIX)).filter((item) => item.notification).map((item) => item.notification)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 20);
  },
  async read(userId, questId) {
    return changeUserRecord<NotificationRecord, boolean>(userId, PREFIX + questId, (current) => current?.notification
      ? { value: { ...current, notification: { ...current.notification, readAt: current.notification.readAt ?? new Date().toISOString() } }, result: true }
      : { result: false });
  },
};
// AUTH_DISABLED は、本番ビルドでは定数 false になり、mock/ の読み込みごと消える
export const notificationStore: NotificationStore = AUTH_DISABLED
  ? (await import("../../../mock/notificationStore")).createMemoryNotificationStore()
  : blocksStore;
