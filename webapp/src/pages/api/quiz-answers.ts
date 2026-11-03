import { questStore } from "../../server/quests/store";
import { badRequest, json, readJson, withUser } from "./_helpers";

// リクエストごとにサーバーで動かす(静的ファイルにしない)
export const prerender = false;

// 理解度チェックの、初回の回答(正解か不正解か)を、ログイン中のユーザー自身のデータへ追記する。
// 週間レポートの、回答数と初回正解率に使う。再回答は、画面から送らない(初回だけ)
export const POST = withUser("quiz-answers.post", async ({ request, userId, log }) => {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return badRequest();

  const { questId, correct } = body as Record<string, unknown>;
  if (typeof questId !== "string" || questId.length === 0 || typeof correct !== "boolean") {
    return json({ error: "回答の指定が不正です" }, 400);
  }

  try {
    await questStore.recordQuizAnswer(userId, questId, correct);
    return json({ ok: true });
  } catch (error) {
    log.error("理解度チェックの回答を保存できませんでした", { err: error, questId });
    return json({ error: "回答を保存できませんでした" }, 500);
  }
});
