import { z } from "zod";
import { isLearningReviewEvery } from "../userSettings/model";

export interface LearningEntry {
  questId: string;
  title: string;
  summary: string;
  services: string[];
  learnedAt: string;
  review: boolean;
}

export interface LearningProgress {
  count: number;
  reviewEvery: number;
  batch: number;
  newlyCleared?: boolean;
}

// AIにHTMLやスクリプトを実行させず、学習済みニュースの関係を宣言させる。
export const connectionsSchema = z.object({
  hasConnections: z.boolean(),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(800),
  nodes: z.array(z.object({
    questId: z.string().min(1).max(200),
    note: z.string().trim().min(1).max(300),
  }).strict()).max(8),
  edges: z.array(z.object({
    from: z.string().min(1).max(200),
    to: z.string().min(1).max(200),
    label: z.string().trim().min(1).max(180),
  }).strict()).max(12),
}).strict();

export type LearningConnections = z.infer<typeof connectionsSchema>;
export interface LearningInsight {
  id: string;
  batch: number;
  reviewEvery?: number;
  createdAt: string;
  readAt?: string;
  diagram: LearningConnections;
  sources: LearningEntry[];
  mock?: boolean;
}

export function learningProgress(count: number, reviewEvery: number): LearningProgress {
  if (!isLearningReviewEvery(reviewEvery)) throw new Error("図解を提案する学習件数は2〜20の整数で指定してください");
  return { count, reviewEvery, batch: Math.floor(count / reviewEvery) };
}

// モデルが返したIDを、そのユーザーの履歴と照合する。架空のニュースは表示しない。
export function validateConnections(input: unknown, history: LearningEntry[]): LearningConnections {
  const diagram = connectionsSchema.parse(input);
  if (!diagram.hasConnections) {
    if (diagram.nodes.length || diagram.edges.length) throw new Error("関連なしの結果に図解があります");
    return diagram;
  }
  const allowed = new Set(history.map((entry) => entry.questId));
  const ids = new Set(diagram.nodes.map((node) => node.questId));
  if (ids.size !== diagram.nodes.length || ids.size < 2 || !diagram.edges.length) {
    throw new Error("図解には異なる学習済みニュースと、その関係が必要です");
  }
  if ([...ids].some((id) => !allowed.has(id))) throw new Error("学習履歴にないニュースが含まれています");
  const connected = new Set<string>();
  const pairs = new Set<string>();
  for (const edge of diagram.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) {
      throw new Error("関係の参照先が不正です");
    }
    const key = `${edge.from}\0${edge.to}`;
    if (pairs.has(key)) throw new Error("同じ関係が重複しています");
    pairs.add(key);
    connected.add(edge.from);
    connected.add(edge.to);
  }
  if (connected.size !== ids.size) throw new Error("関係のないニュースが含まれています");
  return diagram;
}
