// クエストの型と、表示用のラベル
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

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  high: "重要度 高",
  medium: "重要度 中",
  low: "重要度 低",
};

// 依頼書に押す印(重要度から決める)
export const RANK: Record<Importance, string> = { high: "S", medium: "A", low: "B" };
