import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiFetch } from "./useApiFetch";
import type { NewsNotification } from "../lib/newsNotifications/model";
import { requestNewsReview } from "../lib/newsNotifications/request";

const NEWS_NOTIFICATIONS_URL = "/api/news-notifications";

// 関心に合う新着の通知の取得と、AI による選定の依頼、既読の保存
export function useNewsNotifications(apiFetch: ApiFetch) {
  const [notifications, setNotifications] = useState<NewsNotification[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mounted.current) {
      setBusy(true);
      setError(null);
    }
    try {
      // AIの選定が失敗しても、保存済みの通知は表示する。
      const saved = await apiFetch(NEWS_NOTIFICATIONS_URL);
      if (!saved.ok) throw new Error("新着の通知を取得できませんでした");
      const current = (await saved.json()) as {
        notifications: NewsNotification[];
      };
      if (mounted.current) setNotifications(current.notifications);
      const response = await requestNewsReview(apiFetch);
      if (!response.ok) throw new Error("新着の確認に失敗しました");
      const result = (await response.json()) as {
        notifications: NewsNotification[];
      };
      if (mounted.current) setNotifications(result.notifications);
    } catch (cause) {
      if (mounted.current) {
        setError(
          cause instanceof Error ? cause.message : "新着の確認に失敗しました",
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    mounted.current = true;
    void check();
    // Webアプリを使っている間に新着を確認。非表示中はAI選定を起動しない。
    const checkIfVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = setInterval(checkIfVisible, 60_000);
    document.addEventListener("visibilitychange", checkIfVisible);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkIfVisible);
    };
  }, [check]);

  const markRead = useCallback(
    async (notification: NewsNotification) => {
      const response = await apiFetch(NEWS_NOTIFICATIONS_URL, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questId: notification.questId }),
      });
      if (!response.ok) throw new Error("新着の通知を既読にできませんでした");
      if (mounted.current) {
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          ),
        );
      }
    },
    [apiFetch],
  );

  return { notifications, busy, error, check, markRead };
}
