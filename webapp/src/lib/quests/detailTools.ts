import {
  detailUpdateSchema,
  type DetailSection,
  type DetailUpdate,
} from "./detailSections";

export type UpdateDetail = (
  questId: string,
  section: DetailSection,
) => DetailUpdate;

// ツールの引数を検証し、追記の処理へ渡す。ツール登録と描画の設定はフック側に置く。
export function applyDetailUpdate(
  args: unknown,
  updateDetail: UpdateDetail,
): DetailUpdate {
  const parsed = detailUpdateSchema.safeParse(args);
  if (!parsed.success)
    return {
      added: [],
      updated: [],
      error: `追記できません。A2UIの引数を確認してください: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => issue.message)
        .join(" / ")}`,
    };
  const { questId, section } = parsed.data;
  const result = updateDetail(questId, section);
  return result.error ? result : { ...result, section };
}
