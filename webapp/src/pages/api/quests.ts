import { z } from "zod";
import { questStore } from "./_server/quests/store";
import { loadProgress } from "./_server/learning/service";
import { QuestNotFoundError } from "./_server/quests/errors";
import { badRequest, json, readJson, withUser } from "./_helpers";

// PATCH の本文(保存するクエストの状態)
const questStateSchema = z.object({
  id: z.string(),
  publishedAt: z.string(),
  status: z.enum(["viewed", "cleared"]),
  review: z.boolean().optional(),
});

// ログインしたユーザー自身のクエストを返す(エージェントは通さない)
//   mock モード(認証なし)では、DynamoDB を使わず、サンプルのクエストを返す(questStore が切り替える)
export const GET = withUser("quests.get", async ({ userId, log }) => {
  try {
    return json({ quests: await questStore.list(userId) });
  } catch (error) {
    log.error("クエストの取得に失敗しました", { err: error });
    return json({ error: "クエストを取得できませんでした" }, 500);
  }
});

// クエストの状態を、ログイン中のユーザー自身のデータへ保存する
export const PATCH = withUser(
  "quests.patch",
  async ({ request, userId, log }) => {
    const body = await readJson(request);
    if (!body || typeof body !== "object") return badRequest();

    const parsed = questStateSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "クエスト状態の指定が不正です" }, 400);
    }
    const { id, publishedAt, status, review } = parsed.data;

    try {
      const result = await questStore.saveState(
        userId,
        { id, publishedAt },
        status,
        review,
      );
      if (status === "cleared") {
        try {
          const { progress } = await loadProgress(userId);
          return json({ ok: true, learning: { ...progress, ...result } });
        } catch (error) {
          // 保存自体は成功している。件数取得の失敗で、クリア失敗とは表示しない。
          log.warn("保存後の学習件数を取得できませんでした", {
            err: error,
            questId: id,
          });
          return json({ ok: true, learning: null });
        }
      }
      return json({ ok: true });
    } catch (error) {
      if (error instanceof QuestNotFoundError)
        return json({ error: error.message }, 404);
      log.error("クエスト状態の保存に失敗しました", {
        err: error,
        questId: id,
        status,
      });
      return json({ error: "クエスト状態を保存できませんでした" }, 500);
    }
  },
);
