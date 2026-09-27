import { z } from "zod";

// チャットでの質問に応じて、エージェントが、クエスト詳細に追加する表示(仕様書 F-03、F-04)
// 種類は 3 つ。見た目は、こちらで固定し、エージェントは、中身だけを決める
export const detailSectionSchema = z.object({
  id: z
    .string()
    .describe("表示の ID(英数字とハイフン)。すでにある表示と同じ ID なら更新し、新しい ID なら追加する"),
  kind: z
    .enum(["comparison", "impact", "text"])
    .describe("comparison: 「これまで」と「更新後」の比較表、impact: 項目ごとの影響、text: 短い文章"),
  title: z.string().describe("表示の見出し(短く)"),
  rows: z
    .array(
      z.object({
        label: z.string().describe("比較する項目"),
        before: z.string().describe("これまで"),
        after: z.string().describe("更新後"),
      }),
    )
    .optional()
    .describe("kind が comparison のときの、比較の行"),
  items: z
    .array(
      z.object({
        label: z.string().describe("影響の項目(例: 料金、構成、運用)"),
        text: z.string().describe("影響の内容"),
      }),
    )
    .optional()
    .describe("kind が impact のときの、影響の項目"),
  body: z.string().optional().describe("kind が text のときの、本文"),
});

export type DetailSection = z.infer<typeof detailSectionSchema>;

export const detailUpdateSchema = z.object({
  questId: z.string().describe("詳細を開いているクエストの id(context のものを、そのまま使う)"),
  sections: z.array(detailSectionSchema).describe("追加または更新する表示"),
});

export interface DetailUpdate {
  // クエストのタイトル
  title?: string;
  added: string[];
  updated: string[];
  error?: string;
}

// 同じ ID の表示は置き換え、新しい ID は末尾に足す
export function mergeSections(
  current: DetailSection[],
  incoming: DetailSection[],
): { sections: DetailSection[]; added: string[]; updated: string[] } {
  const sections = [...current];
  const added: string[] = [];
  const updated: string[] = [];
  for (const section of incoming) {
    const index = sections.findIndex((s) => s.id === section.id);
    if (index >= 0) {
      sections[index] = section;
      updated.push(section.title);
    } else {
      sections.push(section);
      added.push(section.title);
    }
  }
  return { sections, added, updated };
}
