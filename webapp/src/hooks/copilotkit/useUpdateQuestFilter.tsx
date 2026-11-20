import { useFrontendTool } from "@copilotkit/react-core/v2";
import {
  filterPatchSchema,
  type FilterChange,
  type FilterPatch,
} from "../../lib/quests/filter";
import FilterChangeCard from "../../components/generative-ui/FilterChangeCard";

// 検索条件を更新し、変更前後と件数をチャットに表示する。
export function useUpdateQuestFilter(
  updateFilter: (patch: FilterPatch) => FilterChange,
) {
  useFrontendTool({
    name: "update_quest_filter",
    description:
      "クエストボードの検索条件を変える。ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、クエストを絞り込みたいときに呼ぶ。指定した条件だけを変え、null で条件を解除する。すべて解除するときは reset を true にする。変更前後の条件と、表示される件数が返る",
    parameters: filterPatchSchema,
    handler: async (args) => updateFilter(args),
    render: ({ status, result }) => (
      <FilterChangeCard status={status} result={result} />
    ),
  });
}
