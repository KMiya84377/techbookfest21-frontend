import type { NewsNotification } from "../../lib/newsNotifications/model";

// 新着選定の実行記録と、通知の記録。Blocks の保存先と、mock のメモリの両方が使う(型と定数だけ)
export interface ReviewRecord {
  leaseToken: string;
  leaseUntil: number;
  evaluatedIds: string[];
}
export interface NotificationRecord {
  notification: NewsNotification;
}

export const REVIEW_KEY = "__news_notification_review__";
export const PREFIX = "__news_notification__#";

// 選定の実行権の期限。期限を過ぎた実行は、ほかのリクエストが引き継げる
export const LEASE_MS = 180_000;

// 一覧に返す通知の件数(新しい順)
export const NOTIFICATION_LIST_LIMIT = 20;
