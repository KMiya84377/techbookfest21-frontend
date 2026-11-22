import { AppSetting, KVStore, Scope, getSdkIdentifiers } from "aws-cdk-blocks";
import { z } from "zod";
import {
  AGENT_RUNTIME_PARAMETER,
  BLOCKS_SCOPE,
  NEWS_FEED,
  NEWS_TABLE_ID,
  USER_QUESTS_TABLE_ID,
  USER_SETTINGS_TABLE_ID,
} from "./constants";

export const scope = new Scope(BLOCKS_SCOPE);

// ニュースの共通情報
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
    status: z.literal("todo").optional(),
  })
  .strict();

export const news = new KVStore(scope, NEWS_TABLE_ID, {
  schema: newsSchema,
  key: { partitionKey: "newsId" },
  indexes: {
    ByFeedPublishedAt: {
      partitionKey: "feed",
      sortKey: "publishedAt"
    },
  },
});

// ユーザー単位のニュース情報
type UserQuestKeys = { userId: string; newsId: string; version?: number };
const userQuestSchema = z
  .object({
    userId: z.string(),
    newsId: z.string(),
    version: z.number().optional(),
  })
  .loose() as unknown as z.ZodType<UserQuestKeys, UserQuestKeys>;

export const userQuests = new KVStore(scope, USER_QUESTS_TABLE_ID, {
  schema: userQuestSchema,
  key: { partitionKey: "userId", sortKey: "newsId" },
});

// ユーザー設定情報
export const settings = new KVStore(scope, USER_SETTINGS_TABLE_ID, {
  schema: z
    .object({
      userId: z.string(),
      learningTopics: z.array(z.string()),
      difficulty: z.string(),
      answerDetail: z.string(),
      learningReviewEvery: z.number(),
      updatedAt: z.string().optional(),
    })
    .strict(),
  key: { partitionKey: "userId" },
});

if (
  process.env.AWS_LAMBDA_FUNCTION_NAME &&
  getSdkIdentifiers(news).tableName.startsWith("mock-")
) {
  throw new Error(
    "BlocksのAWSランタイムが読み込まれていません。aws-runtime条件でビルドしてください",
  );
}

export const agentRuntimeSetting = AppSetting.fromExisting(
  scope,
  "chat-runtime",
  {
    name: AGENT_RUNTIME_PARAMETER,
  },
);
