import { detailUpdateSchema, type DetailSection, type DetailUpdate } from "./detailSections";

export type UpdateDetail = (questId: string, section: DetailSection) => DetailUpdate;

export function createDetailTool(updateDetail: UpdateDetail) {
  return {
    name: "update_quest_detail",
    description:
      "開いているニュースへA2UIのUIを追記・更新し、同じUIをチャット欄にも表示する。比較や影響、補足をText/Column/Row/Card/Dividerで自由に構成する。generate_a2uiを重ねて呼ぶ必要はない。同じsection.idは更新、新しいidは追記。UIの構造・本文はA2UI v0.9メッセージで渡す。",
    parameters: detailUpdateSchema,
    handler: async (args: unknown): Promise<DetailUpdate> => {
      const parsed = detailUpdateSchema.safeParse(args);
      if (!parsed.success) return {
        added: [], updated: [],
        error: `追記できません。A2UIの引数を確認してください: ${parsed.error.issues.slice(0, 3).map((issue) => issue.message).join(" / ")}`,
      };
      const { questId, section } = parsed.data;
      const result = updateDetail(questId, section);
      return result.error ? result : { ...result, section };
    },
  };
}
