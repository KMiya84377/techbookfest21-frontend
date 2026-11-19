import { listUserRecords } from "../../../server/blocks/records";
import type { UserQuestItem } from "../../../server/quests/userQuestItem";
import { json, localOnly } from "../_helpers";

// ローカル開発で、エージェント(Python)が、週間レポート用の記録を読むための API。
// ルートは astro.config.mjs が、astro dev のときだけ登録する(本番ビルドには、ルートもコードも入らない)。
// AWS では、エージェントが DynamoDB を直接読む。ここは、そのローカルでの代わり

export const GET = localOnly(
  "agent-learning-records.get",
  async ({ userId }) => {
    const items = await listUserRecords<UserQuestItem>(userId);
    const records = items.map(
      ({
        newsId,
        status,
        firstViewedAt,
        learnedAt,
        updatedAt,
        quizAnswers,
      }) => ({
        newsId,
        status,
        firstViewedAt,
        learnedAt,
        updatedAt,
        quizAnswers,
      }),
    );
    return json({ records });
  },
);
