import { z } from "zod";
import { questStore } from "./_server/quests/store";
import { QuestNotFoundError } from "./_server/quests/errors";
import { badRequest, json, readJson, withUser } from "./_helpers";

// POST の本文(初回の回答)
const quizAnswerSchema = z.object({
  questId: z.string().min(1).max(200),
  correct: z.boolean(),
});

// 理解度チェックの、初回の回答(正解か不正解か)を、ログイン中のユーザー自身のデータへ追記する。
// 週間レポートの、回答数と初回正解率に使う。再回答は、画面から送らない(初回だけ)
export const POST = withUser(
  "quiz-answers.post",
  async ({ request, userId, log }) => {
    const body = await readJson(request);
    if (!body || typeof body !== "object") return badRequest();

    const parsed = quizAnswerSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "回答の指定が不正です" }, 400);
    }
    const { questId, correct } = parsed.data;

    try {
      await questStore.recordQuizAnswer(userId, questId, correct);
      return json({ ok: true });
    } catch (error) {
      if (error instanceof QuestNotFoundError)
        return json({ error: error.message }, 404);
      log.error("理解度チェックの回答を保存できませんでした", {
        err: error,
        questId,
      });
      return json({ error: "回答を保存できませんでした" }, 500);
    }
  },
);
