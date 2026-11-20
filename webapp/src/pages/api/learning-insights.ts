import { z } from "zod";
import { createInsight, insightStatus } from "./_server/learning/service";
import { readInsight } from "./_server/learning/store";
import {
  DEFAULT_LEARNING_REVIEW_EVERY,
  isLearningReviewEvery,
} from "../../lib/userSettings/model";
import { badRequest, json, readJson, withUser } from "./_helpers";

// 本文の区間(何番目のまとまりか)と、何件ごとか(省略したら既定値)
const batchSchema = z.number().int().min(1).max(100_000_000);
const reviewEverySchema = z
  .number()
  .refine(isLearningReviewEvery)
  .optional()
  .transform((value) => value ?? DEFAULT_LEARNING_REVIEW_EVERY);

export const GET = withUser(
  "learning-insights.get",
  async ({ userId, log }) => {
    try {
      return json(await insightStatus(userId));
    } catch (error) {
      log.error("学習の通知を取得できませんでした", { err: error });
      return json({ error: "学習の通知を取得できませんでした" }, 500);
    }
  },
);

type ReviewInput = { batch: number; reviewEvery: number };

// 生成と既読処理で共通の入力だけを検証する。不正な場合はエラーレスポンスを返す。
async function readReviewInput(request: Request): Promise<ReviewInput | Response> {
  const body = (await readJson(request)) as
    { batch?: unknown; reviewEvery?: unknown } | null | undefined;
  if (body === undefined) return badRequest();

  const batch = batchSchema.safeParse(body?.batch);
  if (!batch.success) {
    return json({ error: "学習件数の区間が不正です" }, 400);
  }
  const every = reviewEverySchema.safeParse(body?.reviewEvery);
  if (!every.success) {
    return json({ error: "学習件数の閾値が不正です" }, 400);
  }
  return { batch: batch.data, reviewEvery: every.data };
}

export const PATCH = withUser(
  "learning-insights.read",
  async ({ request, userId, log }) => {
    const input = await readReviewInput(request);
    if (input instanceof Response) return input;
    try {
      await readInsight(userId, input.batch, input.reviewEvery);
      return json({ ok: true });
    } catch (error) {
      log.error("関連分析の通知を既読にできませんでした", {
        err: error,
        batch: input.batch,
      });
      return json({ error: "通知を既読にできませんでした" }, 500);
    }
  },
);

export const POST = withUser(
  "learning-insights.generate",
  async ({ request, userId, log }) => {
    const input = await readReviewInput(request);
    if (input instanceof Response) return input;
    try {
      const result = await createInsight(userId, input.batch, input.reviewEvery);
      return json(
        { ...result, ...(await insightStatus(userId)) },
        result.state === "stale" ? 409 : 200,
      );
    } catch (error) {
      log.error("学習内容の関連分析に失敗しました", {
        err: error,
        batch: input.batch,
      });
      return json(
        {
          error:
            "学習内容の関連分析に失敗しました。通知一覧から再試行できます。",
        },
        502,
      );
    }
  },
);
