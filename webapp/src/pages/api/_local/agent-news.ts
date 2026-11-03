import type { APIRoute } from "astro";
import { z } from "zod";
import { news, newsSchema, userQuests } from "../../../../aws-blocks/storage";
import { BLOCKS_LOCAL } from "../../../lib/blocks/config";
import { conditionalFailure } from "../../../server/blocks/records";
import { listQuests } from "../../../server/quests/repository";
import { json, readJson, withUser } from "../_helpers";

export const prerender = false;

// ローカル開発で、エージェント(Python)がニュースを保存・確認するための API。
// ルートは astro.config.mjs が、astro dev のときだけ登録する(本番ビルドには、ルートもコードも入らない)。
// mock モードでは、認証より先に 404 を返す
const localOnly = (route: string, handler: Parameters<typeof withUser>[1]): APIRoute => {
  const authenticated = withUser(route, handler);
  return (context) => (BLOCKS_LOCAL ? authenticated(context) : Promise.resolve(json({ error: "Not found" }, 404)));
};

export const GET = localOnly("agent-news.get", async ({ userId }) =>
  json({ quests: (await listQuests(userId)).map((q) => ({ id: q.id, title: q.title, published_at: q.publishedAt })) }),
);

export const POST = localOnly("agent-news.post", async ({ request, userId }) => {
  const parsed = z.array(newsSchema).max(50).safeParse(await readJson(request));
  if (!parsed.success) return json({ error: "ニュースの形式が不正です" }, 400);

  const saved: string[] = [];
  const skipped_existing: string[] = [];
  const assigned: string[] = [];
  for (const item of parsed.data) {
    try {
      await news.put(item, { ifNotExists: true });
      saved.push(item.newsId);
    } catch (error) {
      if (!conditionalFailure(error)) throw error;
      skipped_existing.push(item.newsId);
    }
    try {
      await userQuests.put({ userId, newsId: item.newsId, status: "todo", version: 1 }, { ifNotExists: true });
    } catch (error) {
      if (!conditionalFailure(error)) throw error;
    }
    assigned.push(item.newsId);
  }
  return json({ saved, assigned, skipped_existing });
});
