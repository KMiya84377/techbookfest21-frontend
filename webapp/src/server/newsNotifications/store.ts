import { AUTH_DISABLED } from "../../lib/blocks/config";
import type { NewsNotification } from "../../lib/newsNotifications/model";
import { blocksNotificationStore } from "./repository";

export interface ReviewLease {
  token: string;
  evaluatedIds: string[];
}

// 新着選定の排他と、通知の保存・既読。保存先は、ここで1度だけ選ぶ(Blocks か、mock モードのメモリ)
export interface NotificationStore {
  claim(userId: string): Promise<ReviewLease | null>;
  finish(userId: string, token: string, evaluatedIds: string[]): Promise<void>;
  save(userId: string, notification: NewsNotification): Promise<void>;
  list(userId: string): Promise<NewsNotification[]>;
  read(userId: string, questId: string): Promise<boolean>;
}

// AUTH_DISABLED は、本番ビルドでは定数 false になり、mock/ の読み込みごと消える
export const notificationStore: NotificationStore = AUTH_DISABLED
  ? (
      await import("../../../mock/notificationStore")
    ).createMemoryNotificationStore()
  : blocksNotificationStore;
