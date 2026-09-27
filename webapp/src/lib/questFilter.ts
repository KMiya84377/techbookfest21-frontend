import { z } from "zod";
import {
  IMPORTANCE_LABEL,
  STATUS_LABEL,
  type Importance,
  type Quest,
  type QuestStatus,
} from "../data/quests";

// クエストボードの検索条件(機能仕様書 F-01)
//   指定していない条件は、絞り込まない。条件は、すべて満たすものを表示する
export interface QuestFilter {
  status?: QuestStatus;
  // サービス名(どれか 1 つに合えばよい。大文字小文字は区別しない)
  services?: string[];
  importance?: Importance[];
  // 想定学習時間(分)の上限
  maxMinutes?: number;
  // 直近の日数(公開日時で絞る)
  sinceDays?: number;
}

export const EMPTY_FILTER: QuestFilter = {};

// エージェントが、ボードの検索条件を変えるときの引数
//   指定した条件だけを変える。null を渡すと、その条件を解除する。reset は、すべて解除してから適用する
export const filterPatchSchema = z.object({
  reset: z.boolean().optional().describe("true なら、これまでの条件をすべて解除してから、次の条件を適用する"),
  status: z
    .enum(["todo", "viewed", "cleared"])
    .nullable()
    .optional()
    .describe("クエストの状態(未着手、閲覧済み、クリア済み)。null で解除"),
  services: z.array(z.string()).nullable().optional().describe("AWS サービス名(例: AgentCore、Lambda)。null で解除"),
  importance: z
    .array(z.enum(["high", "medium", "low"]))
    .nullable()
    .optional()
    .describe("重要度。null で解除"),
  maxMinutes: z.number().int().nullable().optional().describe("想定学習時間の上限(分)。null で解除"),
  sinceDays: z.number().int().nullable().optional().describe("直近の日数(公開日時)。null で解除"),
});

export type FilterPatch = z.infer<typeof filterPatchSchema>;

// 条件を変える。指定した条件だけを上書きし、null の条件は解除する
export function mergeFilter(prev: QuestFilter, patch: FilterPatch): QuestFilter {
  const next: Record<string, unknown> = patch.reset ? {} : { ...prev };
  const { reset: _reset, ...changes } = patch;
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
  }
  return next as QuestFilter;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function applyFilter(quests: Quest[], filter: QuestFilter, now = Date.now()): Quest[] {
  return quests.filter((q) => {
    if (filter.status && q.status !== filter.status) return false;
    if (filter.services?.length) {
      const wanted = filter.services.map((s) => s.toLowerCase());
      const has = q.services.some((s) => wanted.some((w) => s.toLowerCase().includes(w)));
      if (!has) return false;
    }
    if (filter.importance?.length && !filter.importance.includes(q.importance)) return false;
    if (filter.maxMinutes !== undefined && q.minutes > filter.maxMinutes) return false;
    if (filter.sinceDays !== undefined && Date.parse(q.publishedAt) < now - filter.sinceDays * DAY_MS) {
      return false;
    }
    return true;
  });
}

// 適用中の条件を、画面とチャットに出す文にする(条件がなければ、空の配列)
export function describeFilter(filter: QuestFilter): string[] {
  const labels: string[] = [];
  if (filter.sinceDays !== undefined) labels.push(`期間: 直近 ${filter.sinceDays} 日`);
  if (filter.services?.length) labels.push(`サービス: ${filter.services.join("、")}`);
  if (filter.importance?.length) {
    labels.push(`重要度: ${filter.importance.map((i) => IMPORTANCE_LABEL[i].replace("重要度 ", "")).join("、")}`);
  }
  if (filter.maxMinutes !== undefined) labels.push(`想定学習時間: ${filter.maxMinutes} 分以内`);
  if (filter.status) labels.push(`状態: ${STATUS_LABEL[filter.status]}`);
  return labels;
}

// 条件を変えた結果(チャットに表示し、エージェントにも返す)
export interface FilterChange {
  before: string[];
  after: string[];
  // 変更後に、ボードに表示されるクエストの数と、全体の数
  count: number;
  total: number;
}
