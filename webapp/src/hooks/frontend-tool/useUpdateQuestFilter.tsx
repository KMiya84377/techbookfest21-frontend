import { useFrontendTool } from "@copilotkit/react-core/v2";
import {
  filterPatchSchema,
  filterChangeSchema,
  type FilterChange,
  type FilterPatch,
} from "../../lib/quests/filter";
import {
  parseToolResult,
  type ToolResultProps,
} from "../../lib/copilotkit/toolResult";
import { Alert, AlertTitle } from "../../components/ui/alert";

// 検索条件を更新し、変更前後と件数をチャットに表示する。
export function useUpdateQuestFilter(
  updateFilter: (patch: FilterPatch) => FilterChange,
) {
  useFrontendTool({
    name: "update_quest_filter",
    description:
      "クエストボードの検索条件を変える。" +
      "ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、" +
      "クエストを絞り込みたいときに呼ぶ。" +
      "指定した条件だけを変え、null で条件を解除する。" +
      "すべて解除するときは reset を true にする。" +
      "変更前後の条件と、表示される件数が返る",
    parameters: filterPatchSchema,
    handler: async (args) => updateFilter(args),
    render: ({ status, result }) => (
      <FilterChangeCard status={status} result={result} />
    ),
  });
}

// エージェントが、メイン領域の検索条件を変えたことを、チャットに示す
function FilterChangeCard({ status, result }: ToolResultProps) {
  const change = parseToolResult(result, filterChangeSchema);

  if (!change) {
    return (
      <Alert
        variant="quest"
        className="my-2 text-quest-card-muted"
        role="status"
      >
        {status === "complete"
          ? "メイン領域を更新しました"
          : "メイン領域を更新しています…"}
      </Alert>
    );
  }

  const show = (labels: string[]) =>
    labels.length > 0 ? labels.join(" / ") : "条件なし";

  return (
    <Alert variant="quest" className="my-2 text-[13px]" role="status">
      <AlertTitle>メイン領域を更新しました</AlertTitle>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5">
        <dt className="text-quest-card-muted">変更前</dt>
        <dd>{show(change.before)}</dd>
        <dt className="text-quest-card-muted">変更後</dt>
        <dd>{show(change.after)}</dd>
        <dt className="text-quest-card-muted">表示</dt>
        <dd>
          {change.count} 件(全 {change.total} 件)
        </dd>
      </dl>
    </Alert>
  );
}
