import { z } from "zod";

export const DETAIL_CATALOG_ID = "https://a2ui.org/specification/v0_9/basic_catalog.json";
const id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
const surfaceId = id.describe("追記のidと同じ値を使う");
const common = { id, weight: z.number().positive().max(1000).optional() };
const children = z.array(id).min(1).max(20);

// F-01は閲覧用UI。HTML・外部リソース・アクションや式は受け付けない。
// AIは完成済みの比較表を選ぶのではなく、これらの部品から構造を作る。
export const detailComponentSchema = z.discriminatedUnion("component", [
  z.object({ ...common, component: z.literal("Text"), text: z.string().max(6000),
    variant: z.enum(["h1", "h2", "h3", "h4", "h5", "body", "caption"]).optional() }).strict(),
  z.object({ ...common, component: z.literal("Column"), children }).strict(),
  z.object({ ...common, component: z.literal("Row"), children }).strict(),
  z.object({ ...common, component: z.literal("Card"), child: id }).strict(),
  z.object({ ...common, component: z.literal("Divider"), axis: z.enum(["horizontal", "vertical"]).optional() }).strict(),
]);

const messageSchema = z.union([
  z.object({ version: z.literal("v0.9"), createSurface: z.object({ surfaceId,
    catalogId: z.literal(DETAIL_CATALOG_ID) }).strict() }).strict(),
  z.object({ version: z.literal("v0.9"), updateComponents: z.object({ surfaceId,
    components: z.array(detailComponentSchema).min(1).max(80) }).strict() }).strict(),
]);

export const detailSectionSchema = z.object({
  id: id.describe("新しいidなら末尾へ追記し、同じidならその追記だけを置き換える"),
  title: z.string().min(1).max(160).describe("追記の見出し"),
  messages: z.array(messageSchema).length(2).describe(
    "A2UI v0.9。createSurface、updateComponentsの順に2件。surfaceIdは追記のidと同じ。rootを起点にText/Column/Row/Card/Dividerを組み合わせ、全コンポーネントを参照で接続する。各部品は1箇所からだけ参照し、80部品・12階層まで。更新時も完全な2件を渡す。",
  ),
}).strict().superRefine((section, ctx) => {
  const [create, update] = section.messages;
  const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!create || !("createSurface" in create) || !update || !("updateComponents" in update)) {
    invalid("createSurface、updateComponentsの順で指定してください");
    return;
  }
  if (create.createSurface.surfaceId !== section.id || update.updateComponents.surfaceId !== section.id) {
    invalid("surfaceIdは追記のidと一致させてください");
  }
  const nodes = new Map(update.updateComponents.components.map((node) => [node.id, node]));
  if (nodes.size !== update.updateComponents.components.length) invalid("コンポーネントidが重複しています");
  const references = new Set<string>();
  for (const node of nodes.values()) {
    const refs = "children" in node ? node.children : "child" in node ? [node.child] : [];
    for (const ref of refs) {
      if (references.has(ref)) invalid("同じUI部品を複数箇所から参照できません");
      references.add(ref);
    }
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const visit = (nodeId: string, depth: number) => {
    if (depth > 12 || active.has(nodeId)) { invalid("UIの参照が循環しているか、階層が深すぎます"); return; }
    if (visited.has(nodeId)) return;
    const node = nodes.get(nodeId);
    if (!node) { invalid(`参照先がありません: ${nodeId}`); return; }
    active.add(nodeId);
    if ("children" in node) for (const child of node.children) visit(child, depth + 1);
    if ("child" in node) visit(node.child, depth + 1);
    active.delete(nodeId);
    visited.add(nodeId);
  };
  visit("root", 0);
  if (visited.size !== nodes.size) invalid("rootから参照されていないUI部品があります");
});

export const detailUpdateSchema = z.object({
  questId: z.string().min(1).describe("現在開いているニュースのID。contextのものをそのまま使う"),
  section: detailSectionSchema,
}).strict();

export type DetailSection = z.infer<typeof detailSectionSchema>;

export interface DetailUpdate {
  title?: string;
  added: string[];
  updated: string[];
  section?: DetailSection;
  error?: string;
}

export const detailUpdateResultSchema = z.object({
  title: z.string().optional(), added: z.array(z.string()), updated: z.array(z.string()),
  section: detailSectionSchema.optional(), error: z.string().optional(),
});

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

export function updateOpenedDetail(
  current: Record<string, DetailSection[]>,
  quests: readonly { id: string; title: string }[] | undefined,
  openId: string | null, questId: string, section: DetailSection,
): { details: Record<string, DetailSection[]>; result: DetailUpdate } {
  const quest = quests?.find((q) => q.id === questId);
  if (!quest || openId !== questId) return { details: current, result: {
    added: [], updated: [], error: "現在詳細を開いているニュースだけに追記できます。contextのIDを確認してください。",
  } };
  const { sections, added, updated } = mergeSections(current[questId] ?? [], [section]);
  return { details: { ...current, [questId]: sections }, result: { title: quest.title, added, updated, section } };
}
