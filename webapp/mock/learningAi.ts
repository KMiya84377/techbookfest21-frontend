import { validateConnections, type LearningConnections, type LearningEntry } from "../src/lib/learning/model";

// mockモード専用。AIを呼ばずに、画面確認用の関連図を返す
export function mockConnections(history: LearningEntry[]): LearningConnections {
  return validateConnections({
    hasConnections: true,
    title: "学んだニュースのつながり（モック）",
    summary: "学習済みの２件を使った画面確認用の表示です。AIによる関連分析ではありません。",
    nodes: history.slice(-2).map((entry) => ({ questId: entry.questId, note: "学習済みのニュース" })),
    edges: [{ from: history.at(-2)!.questId, to: history.at(-1)!.questId, label: "２件の関係を表示するモック" }],
  }, history);
}
