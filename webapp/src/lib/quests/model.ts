// クエストの型と、表示用ラベル。サンプルデータ本体は mock/sampleQuests.ts に置く。
export type QuestStatus = "todo" | "viewed" | "cleared";
export type Importance = "high" | "medium" | "low";

export interface Quest {
  id: string;
  title: string;
  services: string[];
  summary: string;
  importance: Importance;
  minutes: number;
  status: QuestStatus;
  // 不正解のままクリアした、復習候補の印
  review?: boolean;
  // ニュースの公開日時(ISO 8601)
  publishedAt: string;
  source: { label: string; url: string };
  changes: string[];
  before: string;
  after: string;
  impact: { changes: string; unchanged: string; check: string };
  checks: string[];
}

export const STATUS_LABEL: Record<QuestStatus, string> = {
  todo: "未着手",
  viewed: "閲覧済み",
  cleared: "クリア済み",
};

// 重要度の名前(検索条件の表示に使う)と、カードに出すラベル
export const IMPORTANCE_NAME: Record<Importance, string> = {
  high: "高",
  medium: "中",
  low: "低",
};
export const IMPORTANCE_LABEL: Record<Importance, string> = {
  high: `重要度 ${IMPORTANCE_NAME.high}`,
  medium: `重要度 ${IMPORTANCE_NAME.medium}`,
  low: `重要度 ${IMPORTANCE_NAME.low}`,
};

// 依頼書に押す印(重要度から決める)
export const RANK: Record<Importance, string> = {
  high: "S",
  medium: "A",
  low: "B",
};
