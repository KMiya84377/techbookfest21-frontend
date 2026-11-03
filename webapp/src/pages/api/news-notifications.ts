import { notificationStore } from "../../server/newsNotifications/repository";
import { reviewNewNews } from "../../server/newsNotifications/service";
import { badRequest, json, readJson, withUser } from "./_helpers";

export const prerender = false;

export const GET = withUser("news-notifications.get", async ({ userId, log }) => {
  try {
    return json({ notifications: await notificationStore.list(userId) });
  } catch (error) {
    log.error("新着の通知を取得できませんでした", { err: error });
    return json({ error: "新着の通知を取得できませんでした" }, 500);
  }
});

// ユーザーID・ニュース・関心を本文から受け取らず、サーバーがDBから取得する。
export const POST = withUser("news-notifications.post", async ({ userId, log }) => {
  try {
    return json(await reviewNewNews(userId));
  } catch (error) {
    log.error("関心に合う新着の選定に失敗しました", { err: error });
    return json({ error: "新着の確認に失敗しました。通知一覧から再試行できます。" }, 502);
  }
});

export const PATCH = withUser("news-notifications.patch", async ({ request, userId, log }) => {
  const body = (await readJson(request)) as { questId?: unknown } | null | undefined;
  if (body === undefined) return badRequest();

  const questId = body?.questId;
  if (typeof questId !== "string" || !questId.length || questId.length > 200) {
    return json({ error: "ニュースIDが不正です" }, 400);
  }

  try {
    return (await notificationStore.read(userId, questId))
      ? json({ ok: true })
      : json({ error: "通知が見つかりません" }, 404);
  } catch (error) {
    log.error("新着の通知を既読にできませんでした", { err: error, questId });
    return json({ error: "新着の通知を既読にできませんでした" }, 500);
  }
});
