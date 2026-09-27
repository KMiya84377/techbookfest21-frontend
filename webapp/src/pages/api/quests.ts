import type { APIRoute } from "astro";
import { buildSampleQuests } from "../../data/sampleQuests";
import { authenticate } from "../../lib/auth";
import { AUTH_DISABLED } from "../../lib/outputs";
import { listQuests, updateQuestState } from "../../lib/quests";

// リクエストごとにサーバーで動かす(静的ファイルにしない)
export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

// mock モードでも、同じ開発サーバーの間は状態を保持して再読み込みを確認できるようにする
const mockStates = new Map<
  string,
  { status: "viewed" | "cleared"; review?: boolean }
>();

const mockStateKey = (userId: string, questId: string) => `${userId}:${questId}`;

// ログインしたユーザー自身のクエストを返す(エージェントは通さない)
//   mock モード(認証なし)では、DynamoDB を使わず、サンプルのクエストを返す
export const GET: APIRoute = async ({ request }) => {
  const userId = await authenticate(request);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  if (AUTH_DISABLED) {
    const quests = buildSampleQuests().map((quest) => {
      const state = mockStates.get(mockStateKey(userId, quest.id));
      return state ? { ...quest, ...state } : quest;
    });
    return json({ quests });
  }

  try {
    return json({ quests: await listQuests(userId) });
  } catch (error) {
    console.error("クエストの取得に失敗しました", error);
    return json({ error: "クエストを取得できませんでした" }, 500);
  }
};

// クエストの状態を、ログイン中のユーザー自身のデータへ保存する
export const PATCH: APIRoute = async ({ request }) => {
  const userId = await authenticate(request);
  if (!userId) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "リクエストの形式が不正です" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "リクエストの形式が不正です" }, 400);
  }
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

  // mock モードでも、再読み込み後に状態を復元できるようサーバー内に保持する
  if (AUTH_DISABLED) {
    mockStates.set(mockStateKey(userId, id), {
      status,
      ...(review === undefined ? {} : { review }),
    });
    return json({ ok: true });
  }

  try {
    await updateQuestState(
      userId,
      { id, publishedAt },
      status,
      review,
    );
    return json({ ok: true });
  } catch (error) {
    console.error("クエスト状態の保存に失敗しました", error);
    return json({ error: "クエスト状態を保存できませんでした" }, 500);
  }
};
