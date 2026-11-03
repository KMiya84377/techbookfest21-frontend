import { createInsight, insightStatus } from "../../server/learning/service";
import { readInsight } from "../../server/learning/repository";
import { DEFAULT_LEARNING_REVIEW_EVERY, isLearningReviewEvery } from "../../lib/userSettings/model";
import { badRequest, json, readJson, withUser } from "./_helpers";

export const prerender = false;

export const GET = withUser("learning-insights.get", async ({ userId, log }) => {
  try {
    return json(await insightStatus(userId), 200);
  } catch (error) {
    log.error("学習の通知を取得できませんでした", { err: error });
    return json({ error: "学習の通知を取得できませんでした" }, 500);
  }
});

const mutate = (action: "generate" | "read") =>
  withUser(`learning-insights.${action}`, async ({ request, userId, log }) => {
    const body = (await readJson(request)) as { batch?: unknown; reviewEvery?: unknown } | null | undefined;
    if (body === undefined) return badRequest();

    const batch = body?.batch;
    const reviewEvery = body?.reviewEvery === undefined ? DEFAULT_LEARNING_REVIEW_EVERY : body.reviewEvery;
    if (typeof batch !== "number" || !Number.isSafeInteger(batch) || batch < 1 || batch > 100_000_000) {
      return json({ error: "学習件数の区間が不正です" }, 400);
    }
    if (!isLearningReviewEvery(reviewEvery)) {
      return json({ error: "学習件数の閾値が不正です" }, 400);
    }

    try {
      if (action === "read") {
        await readInsight(userId, batch, reviewEvery);
        return json({ ok: true }, 200);
      }
      const result = await createInsight(userId, batch, reviewEvery);
      return json({ ...result, ...(await insightStatus(userId)) }, result.state === "stale" ? 409 : 200);
    } catch (error) {
      log.error("学習内容の関連分析に失敗しました", { err: error, batch });
      return json({ error: "学習内容の関連分析に失敗しました。通知一覧から再試行できます。" }, 502);
    }
  });

export const POST = mutate("generate");
export const PATCH = mutate("read");
