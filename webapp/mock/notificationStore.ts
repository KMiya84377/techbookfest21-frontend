import type { NewsNotification } from "../src/lib/newsNotifications/model";
import type { NotificationStore } from "../src/server/newsNotifications/store";

// モックでもユーザー分離・排他・既読・重複排除を本番と同じ契約で扱う。
export function createMemoryNotificationStore(now = () => Date.now()): NotificationStore {
  const reviews = new Map<string, { token: string; until: number; evaluatedIds: string[] }>();
  const notifications = new Map<string, Map<string, NewsNotification>>();
  return {
    async claim(userId) {
      const current = reviews.get(userId);
      if (current && current.until > now()) return null;
      const token = crypto.randomUUID();
      const evaluatedIds = [...(current?.evaluatedIds ?? [])];
      reviews.set(userId, { token, until: now() + 180_000, evaluatedIds });
      return { token, evaluatedIds };
    },
    async finish(userId, token, evaluatedIds) {
      if (reviews.get(userId)?.token !== token) throw new Error("新着選定の実行権が失効しました");
      reviews.set(userId, { token, until: 0, evaluatedIds: [...evaluatedIds] });
    },
    async save(userId, notification) {
      const items = notifications.get(userId) ?? new Map<string, NewsNotification>();
      if (!items.has(notification.questId)) items.set(notification.questId, { ...notification });
      notifications.set(userId, items);
    },
    async list(userId) {
      return [...(notifications.get(userId)?.values() ?? [])].map((item) => ({ ...item }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 20);
    },
    async read(userId, questId) {
      const item = notifications.get(userId)?.get(questId);
      if (!item) return false;
      if (!item.readAt) item.readAt = new Date(now()).toISOString();
      return true;
    },
  };
}
