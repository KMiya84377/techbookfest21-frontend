import type { FilterChange } from "../lib/questFilter";

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
      <div className="notice notice-loading">
        {status === "complete" ? "メイン領域を更新しました" : "メイン領域を更新しています…"}
      </div>
    );
  }
  const show = (labels: string[]) => (labels.length > 0 ? labels.join(" / ") : "条件なし");
  return (
    <div className="notice" role="status">
      <div className="notice-title">メイン領域を更新しました</div>
      <dl>
        <dt>変更前</dt>
        <dd>{show(change.before)}</dd>
        <dt>変更後</dt>
        <dd>{show(change.after)}</dd>
        <dt>表示</dt>
        <dd>
          {change.count} 件(全 {change.total} 件)
        </dd>
      </dl>
    </div>
  );
}
