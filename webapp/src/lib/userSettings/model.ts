export const LEARNING_TOPICS = [
  { id: "ai_ml", label: "AI・機械学習" },
  { id: "compute", label: "コンピューティング" },
  { id: "containers", label: "コンテナ" },
  { id: "database", label: "データベース" },
  { id: "networking", label: "ネットワーク" },
  { id: "security", label: "セキュリティ" },
  { id: "storage", label: "ストレージ" },
  { id: "serverless", label: "サーバーレス" },
] as const;

export type LearningTopic = (typeof LEARNING_TOPICS)[number]["id"];
export type LearningDifficulty = "beginner" | "intermediate" | "advanced";
export type AnswerDetail = "concise" | "standard" | "detailed";

export const DEFAULT_LEARNING_REVIEW_EVERY = 5;
export const MIN_LEARNING_REVIEW_EVERY = 2;
export const MAX_LEARNING_REVIEW_EVERY = 20;

export function isLearningReviewEvery(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value)
    && value >= MIN_LEARNING_REVIEW_EVERY && value <= MAX_LEARNING_REVIEW_EVERY;
}

export interface UserSettings {
  learningTopics: LearningTopic[];
  difficulty: LearningDifficulty;
  answerDetail: AnswerDetail;
  learningReviewEvery: number;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  // 未指定なら特定の分野に絞らず、AWS 全般を対象にする。
  learningTopics: [],
  difficulty: "intermediate",
  answerDetail: "standard",
  learningReviewEvery: DEFAULT_LEARNING_REVIEW_EVERY,
};

const TOPIC_IDS = new Set<string>(LEARNING_TOPICS.map(({ id }) => id));
export const DIFFICULTIES = new Set<LearningDifficulty>([
  "beginner",
  "intermediate",
  "advanced",
]);
export const ANSWER_DETAILS = new Set<AnswerDetail>([
  "concise",
  "standard",
  "detailed",
]);

export function parseUserSettings(value: unknown): UserSettings | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  // 追加前に保存された設定も、既存の分野・難易度を保って読み込む。
  const learningReviewEvery = input.learningReviewEvery === undefined
    ? DEFAULT_LEARNING_REVIEW_EVERY : input.learningReviewEvery;
  if (
    !Array.isArray(input.learningTopics) ||
    input.learningTopics.length > LEARNING_TOPICS.length ||
    !input.learningTopics.every(
      (topic) => typeof topic === "string" && TOPIC_IDS.has(topic),
    ) ||
    new Set(input.learningTopics).size !== input.learningTopics.length ||
    typeof input.difficulty !== "string" ||
    !DIFFICULTIES.has(input.difficulty as LearningDifficulty) ||
    typeof input.answerDetail !== "string" ||
    !ANSWER_DETAILS.has(input.answerDetail as AnswerDetail) ||
    !isLearningReviewEvery(learningReviewEvery)
  ) {
    return null;
  }

  return {
    learningTopics: input.learningTopics as LearningTopic[],
    difficulty: input.difficulty as LearningDifficulty,
    answerDetail: input.answerDetail as AnswerDetail,
    learningReviewEvery,
  };
}
