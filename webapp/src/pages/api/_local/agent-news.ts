import { z } from "zod";
import { news, newsSchema, userQuests } from "../../../../cdk-blocks/storage";
import { isConditionalWriteConflict } from "../_server/blocks/userQuestRecords";
import { listQuests } from "../_server/quests/repository";
import { json, localOnly, readJson } from "../_helpers";

// ローカル開発で、エージェント(Python)がニュースを保存・確認するための API。
// ルートは astro.config.mjs が、astro dev のときだけ登録する(本番ビルドには、ルートもコードも入らない)。

export const GET = localOnly("agent-news.get", async ({ userId }) =>
  json({
    quests: (await listQuests(userId)).map((quest) => ({
      id: quest.id,
      title: quest.title,
      published_at: quest.publishedAt,
    })),
  }),
);

export const POST = localOnly(
  "agent-news.post",
  async ({ request, userId }) => {
    const parsed = z
      .array(newsSchema)
      .max(50)
      .safeParse(await readJson(request));
    if (!parsed.success)
      return json({ error: "ニュースの形式が不正です" }, 400);

    const saved: string[] = [];
    const skipped_existing: string[] = [];
    const assigned: string[] = [];
    for (const item of parsed.data) {
      try {
        await news.put({ newsId: item.newsId }, item, { ifNotExists: true });
        saved.push(item.newsId);
      } catch (error) {
        if (!isConditionalWriteConflict(error)) throw error;
        skipped_existing.push(item.newsId);
      }
      try {
        // 学習状態の記録(未着手)。キー以外の項目は、スキーマで絞らず保存する。
        const state = { status: "todo", version: 1 };
        await userQuests.put({ userId, newsId: item.newsId }, state, {
          ifNotExists: true,
        });
      } catch (error) {
        if (!isConditionalWriteConflict(error)) throw error;
      }
      assigned.push(item.newsId);
    }
    return json({ saved, assigned, skipped_existing });
  },
);
