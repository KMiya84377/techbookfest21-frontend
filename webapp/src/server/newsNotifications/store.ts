import type { NewsNotification } from "../../lib/newsNotifications/model";

export interface ReviewLease { token: string; evaluatedIds: string[] }
export interface NotificationStore {
  claim(userId: string): Promise<ReviewLease | null>;
  finish(userId: string, token: string, evaluatedIds: string[]): Promise<void>;
  save(userId: string, notification: NewsNotification): Promise<void>;
  list(userId: string): Promise<NewsNotification[]>;
  read(userId: string, questId: string): Promise<boolean>;
}
