import { z } from "zod";
import { notificationStore } from "./_server/newsNotifications/store";
import { reviewNewNews } from "./_server/newsNotifications/service";
import { badRequest, json, readJson, withUser } from "./_helpers";

// PATCH の本文(既読にする通知のニュース ID)
const readSchema = z.object({ questId: z.string().min(1).max(200) });

export const GET = withUser(
  "news-notifications.get",
  async ({ userId, log }) => {
    try {
      return json({ notifications: await notificationStore.list(userId) });
    } catch (error) {
      log.error("新着の通知を取得できませんでした", { err: error });
      return json({ error: "新着の通知を取得できませんでした" }, 500);
    }
  },
);

// ユーザーID・ニュース・関心を本文から受け取らず、サーバーがDBから取得する。
export const POST = withUser(
  "news-notifications.post",
  async ({ userId, log }) => {
    try {
      return json(await reviewNewNews(userId));
    } catch (error) {
      log.error("関心に合う新着の選定に失敗しました", { err: error });
      return json(
        { error: "新着の確認に失敗しました。通知一覧から再試行できます。" },
        502,
      );
    }
  },
);

export const PATCH = withUser(
  "news-notifications.patch",
  async ({ request, userId, log }) => {
    const body = await readJson(request);
    if (body === undefined) return badRequest();

    const parsed = readSchema.safeParse(body);
    if (!parsed.success) return json({ error: "ニュースIDが不正です" }, 400);
    const { questId } = parsed.data;

    try {
      return (await notificationStore.read(userId, questId))
        ? json({ ok: true })
        : json({ error: "通知が見つかりません" }, 404);
    } catch (error) {
      log.error("新着の通知を既読にできませんでした", { err: error, questId });
      return json({ error: "新着の通知を既読にできませんでした" }, 500);
    }
  },
);
