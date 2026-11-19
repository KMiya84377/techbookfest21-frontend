import { useFrontendTool } from "@copilotkit/react-core/v2";
import { detailUpdateSchema } from "../../lib/quests/detailSections";
import {
  applyDetailUpdate,
  type UpdateDetail,
} from "../../lib/quests/detailTools";
import DetailUpdateCard from "../../components/generative-ui/DetailUpdateCard";

// F-01: A2UIを詳細へ追記し、同じ内容をチャットにも表示する。
export function useUpdateQuestDetail(updateDetail: UpdateDetail) {
  useFrontendTool({
    name: "update_quest_detail",
    description:
      "開いているニュースへA2UIのUIを追記・更新し、同じUIをチャット欄にも表示する。比較や影響、補足をText/Column/Row/Card/Dividerで自由に構成する。generate_a2uiを重ねて呼ぶ必要はない。同じsection.idは更新、新しいidは追記。UIの構造・本文はA2UI v0.9メッセージで渡す。",
    parameters: detailUpdateSchema,
    handler: async (args: unknown) => applyDetailUpdate(args, updateDetail),
    render: ({ status, result }) => (
      <DetailUpdateCard status={status} result={result} />
    ),
  });
}
