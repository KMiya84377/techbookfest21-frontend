import type { APIContext, APIRoute } from "astro";
import { BLOCKS_LOCAL } from "../../lib/appMode";
import { authenticate } from "./_server/auth/authenticate";
import { requestLogger } from "./_logger";
import { measureApi } from "./_metrics";

// どの API も、ユーザーごとのデータを返すので、キャッシュさせない
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

// 本文がJSONでなければundefinedを返す。JSONのnullはnullのまま返す。
export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function badRequest(message = "リクエストの形式が不正です"): Response {
  return json({ error: message }, 400);
}

type UserContext = APIContext & {
  userId: string;
  log: ReturnType<typeof requestLogger>;
};
type UserHandler = (context: UserContext) => Promise<Response>;

// ログインを確認し、ユーザー ID とリクエスト用のロガーを渡す。未ログインなら 401 を返す。
// 結果(件数・処理時間)は、route ごとのメトリクスとして記録する(例外で終わったときは 5xx 扱い)
export function withUser(route: string, handler: UserHandler): APIRoute {
  return function authenticatedRoute(context) {
    return measureApi(route, async () => {
      const userId = await authenticate(context.request);
      if (!userId) {
        return json({ error: "Unauthorized" }, 401);
      }
      const log = requestLogger(route, userId);
      return handler({ ...context, userId, log });
    });
  };
}

// ローカル開発でだけ使う API(_local/)。Blocks のローカル構成のときだけ動かし、
// mock モードでは、認証より先に 404 を返す
export function localOnly(route: string, handler: UserHandler): APIRoute {
  const authenticated = withUser(route, handler);
  return async function localRoute(context) {
    if (!BLOCKS_LOCAL) {
      return json({ error: "Not found" }, 404);
    }
    return authenticated(context);
  };
}
