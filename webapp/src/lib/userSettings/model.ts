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

// 難易度と回答の詳しさの選択肢(設定画面の表示と、値の検証の両方に使う)
export const DIFFICULTY_OPTIONS = [
  { id: "beginner", label: "初級", description: "用語から補足" },
  { id: "intermediate", label: "中級", description: "基本知識を前提" },
  { id: "advanced", label: "上級", description: "設計やトレードオフまで" },
] as const;
export type LearningDifficulty = (typeof DIFFICULTY_OPTIONS)[number]["id"];

export const ANSWER_DETAIL_OPTIONS = [
  { id: "concise", label: "簡潔", description: "要点を中心に" },
  { id: "standard", label: "標準", description: "背景も含めて" },
  { id: "detailed", label: "詳しく", description: "仕組みや注意点まで" },
] as const;
export type AnswerDetail = (typeof ANSWER_DETAIL_OPTIONS)[number]["id"];

export const DEFAULT_LEARNING_REVIEW_EVERY = 5;
export const MIN_LEARNING_REVIEW_EVERY = 2;
export const MAX_LEARNING_REVIEW_EVERY = 20;

export function isLearningReviewEvery(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_LEARNING_REVIEW_EVERY &&
    value <= MAX_LEARNING_REVIEW_EVERY
  );
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
// 値の検証に使う、ID の集合
export const DIFFICULTIES = new Set<LearningDifficulty>(
  DIFFICULTY_OPTIONS.map(({ id }) => id),
);
export const ANSWER_DETAILS = new Set<AnswerDetail>(
  ANSWER_DETAIL_OPTIONS.map(({ id }) => id),
);

// 学習分野: 既知の分野だけで、重複がない
function isLearningTopics(value: unknown): value is LearningTopic[] {
  return (
    Array.isArray(value) &&
    value.length <= LEARNING_TOPICS.length &&
    value.every((topic) => typeof topic === "string" && TOPIC_IDS.has(topic)) &&
    new Set(value).size === value.length
  );
}

const isDifficulty = (value: unknown): value is LearningDifficulty =>
  typeof value === "string" && DIFFICULTIES.has(value as LearningDifficulty);

const isAnswerDetail = (value: unknown): value is AnswerDetail =>
  typeof value === "string" && ANSWER_DETAILS.has(value as AnswerDetail);

// 保存済みの値や API の入力を検証し、正しければ設定として返す(正しくなければ null)
export function parseUserSettings(value: unknown): UserSettings | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as Record<string, unknown>;
  if (
    !isLearningTopics(input.learningTopics) ||
    !isDifficulty(input.difficulty) ||
    !isAnswerDetail(input.answerDetail) ||
    !isLearningReviewEvery(input.learningReviewEvery)
  ) {
    return null;
  }

  return {
    learningTopics: input.learningTopics,
    difficulty: input.difficulty,
    answerDetail: input.answerDetail,
    learningReviewEvery: input.learningReviewEvery,
  };
}
