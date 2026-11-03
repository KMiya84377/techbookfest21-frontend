import type { FilterChange } from "../../lib/quests/filter";
import { Alert, AlertTitle } from "../ui/alert";

interface Props {
  status: string;
  result?: string;
}

function parseChange(result?: string): FilterChange | null {
  if (!result) return null;
  try {
    return JSON.parse(result) as FilterChange;
  } catch {
    return null;
  }
}

// エージェントが、メイン領域の検索条件を変えたことを、チャットに示す(仕様書 SR-05)
export default function FilterChangeCard({ status, result }: Props) {
  const change = parseChange(result);
  if (!change) {
    return (
      <Alert variant="quest" className="my-2 text-[#746b5c]" role="status">
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
        <dt className="text-[#746b5c]">変更前</dt>
        <dd>{show(change.before)}</dd>
        <dt className="text-[#746b5c]">変更後</dt>
        <dd>{show(change.after)}</dd>
        <dt className="text-[#746b5c]">表示</dt>
        <dd>
          {change.count} 件(全 {change.total} 件)
        </dd>
      </dl>
    </Alert>
  );
}
