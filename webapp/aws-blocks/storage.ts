import { AppSetting, DistributedTable, Scope, getSdkIdentifiers } from "@aws-blocks/blocks";
import { z } from "zod";
import { AGENT_RUNTIME_PARAMETER, NEWS_FEED } from "./constants";

export { AGENT_RUNTIME_PARAMETER } from "./constants";

export const scope = new Scope("quests");

// ニュースの共通情報(ユーザーに依存しない)
export const newsSchema = z
  .object({
    newsId: z.string().min(1).max(200),
    feed: z.literal(NEWS_FEED),
    title: z.string(),
    summary: z.string(),
    services: z.array(z.string()),
    importance: z.enum(["high", "medium", "low"]),
    minutes: z.number(),
    publishedAt: z.string(),
    source: z.object({ label: z.string(), url: z.string() }),
    changes: z.array(z.string()),
    before: z.string(),
    after: z.string(),
    impact: z.object({
      changes: z.string(),
      unchanged: z.string(),
      check: z.string(),
    }),
    checks: z.array(z.string()),
    // エージェント(Python)が書き込む、使われていない項目
    status: z.literal("todo").optional(),
  })
  .strict();

export const news = new DistributedTable(scope, "news", {
  schema: newsSchema,
  key: { partitionKey: "newsId" },
  indexes: {
    ByFeedPublishedAt: { partitionKey: "feed", sortKey: "publishedAt" },
  },
});

// 学習状態・通知・排他レコードを、これまでと同じキーで保存する。
// 1つのテーブルに複数の種類を入れる(newsId の接頭辞で区別する)ため、項目は絞らない。
export const userQuests = new DistributedTable(scope, "user-quests", {
  schema: z
    .object({
      userId: z.string(),
      newsId: z.string(),
      version: z.number().optional(),
    })
    .passthrough(),
  key: { partitionKey: "userId", sortKey: "newsId" },
});

// 項目の意味と許される値は、src/lib/userSettings/model.ts で検証する。
export const settings = new DistributedTable(scope, "user-settings", {
  schema: z
    .object({
      userId: z.string(),
      learningTopics: z.array(z.string()),
      difficulty: z.string(),
      answerDetail: z.string(),
      learningReviewEvery: z.number().optional(),
      updatedAt: z.string().optional(),
    })
    .strict(),
  key: { partitionKey: "userId" },
});

// AWS用ビルドでmockエントリが選ばれていたら、保存処理を始める前に停止する。
if (
  process.env.AWS_LAMBDA_FUNCTION_NAME &&
  getSdkIdentifiers(news).tableName.startsWith("mock-")
) {
  throw new Error(
    "BlocksのAWSランタイムが読み込まれていません。aws-runtime条件でビルドしてください",
  );
}

// AIエージェントは別のデプロイ単位。接続先はそのスタックが管理するSSMから読む。
export const agentRuntimeSetting = AppSetting.fromExisting(scope, "chat-runtime", {
  name: AGENT_RUNTIME_PARAMETER,
});
