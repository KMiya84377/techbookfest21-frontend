import { questStore } from "../../server/quests/store";
import { learningHistory } from "../../server/learning/service";
import { learningProgress } from "../../lib/learning/model";
import { loadUserSettings } from "../../server/userSettings/service";
import { badRequest, json, readJson, withUser } from "./_helpers";

// リクエストごとにサーバーで動かす(静的ファイルにしない)
export const prerender = false;

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
export const PATCH = withUser("quests.patch", async ({ request, userId, log }) => {
  const body = await readJson(request);
  if (!body || typeof body !== "object") return badRequest();

  const input = body as Record<string, unknown>;
  const id = input.id;
  const publishedAt = input.publishedAt;
  const status = input.status;
  const review = input.review;
  if (
    typeof id !== "string" ||
    typeof publishedAt !== "string" ||
    (status !== "viewed" && status !== "cleared") ||
    (review !== undefined && typeof review !== "boolean")
  ) {
    return json({ error: "クエスト状態の指定が不正です" }, 400);
  }

  try {
    const result = await questStore.saveState(userId, { id, publishedAt }, status, review);
    if (status === "cleared") {
      try {
        const [history, settings] = await Promise.all([learningHistory(userId), loadUserSettings(userId)]);
        return json({ ok: true, learning: { ...learningProgress(history.length, settings.learningReviewEvery), ...result } });
      } catch (error) {
        // 保存自体は成功している。件数取得の失敗で、クリア失敗とは表示しない。
        log.warn("保存後の学習件数を取得できませんでした", { err: error, questId: id });
        return json({ ok: true, learning: null });
      }
    }
    return json({ ok: true });
  } catch (error) {
    log.error("クエスト状態の保存に失敗しました", { err: error, questId: id, status });
    return json({ error: "クエスト状態を保存できませんでした" }, 500);
  }
});
