import type { APIContext, APIRoute } from "astro";
import { authenticate } from "../../server/auth/authenticate";
import { requestLogger } from "./_logger";
import { measureApi } from "./_metrics";

// どの API も、ユーザーごとのデータを返すので、キャッシュさせない
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

// 本文が JSON でなければ undefined を返す(null や空の本文は、JSON として有効なので null で返る)
export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export const badRequest = (message = "リクエストの形式が不正です") => json({ error: message }, 400);

type UserContext = APIContext & {
  userId: string;
  log: ReturnType<typeof requestLogger>;
};

// ログインを確認し、ユーザー ID とリクエスト用のロガーを渡す。未ログインなら 401 を返す。
// 結果(件数・処理時間)は、route ごとのメトリクスとして記録する(例外で終わったときは 5xx 扱い)
export const withUser =
  (route: string, handler: (context: UserContext) => Promise<Response>): APIRoute =>
  (context) =>
    measureApi(route, async () => {
      const userId = await authenticate(context.request);
      if (!userId) return json({ error: "Unauthorized" }, 401);
      return handler({ ...context, userId, log: requestLogger(route, userId) });
    });
