import { filterChangeSchema } from "../../lib/quests/filter";
import {
  parseToolResult,
  type ToolResultProps,
} from "../../lib/copilotkit/toolResult";
import { Alert, AlertTitle } from "../ui/alert";

// エージェントが、メイン領域の検索条件を変えたことを、チャットに示す
export default function FilterChangeCard({ status, result }: ToolResultProps) {
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
