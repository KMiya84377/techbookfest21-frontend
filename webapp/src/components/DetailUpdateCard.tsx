import type { DetailUpdate } from "../lib/detailSections";

interface Props {
  status: string;
  result?: string;
}

function parseUpdate(result?: string): DetailUpdate | null {
  if (!result) return null;
  try {
    return JSON.parse(result) as DetailUpdate;
  } catch {
    return null;
  }
}

// エージェントが、クエスト詳細(メイン領域)に、表示を追加・更新したことを、チャットに示す(仕様書 F-04)
export default function DetailUpdateCard({ status, result }: Props) {
  const update = parseUpdate(result);
  if (!update) {
    return (
      <div className="notice notice-loading">
        {status === "complete" ? "クエスト詳細を更新しました" : "クエスト詳細を更新しています…"}
      </div>
    );
  }
  if (update.error) {
    return (
      <div className="notice" role="status">
        <div className="notice-title">クエスト詳細を更新できませんでした</div>
        <p>{update.error}</p>
      </div>
    );
  }
  return (
    <div className="notice" role="status">
      <div className="notice-title">クエスト詳細を更新しました</div>
      <dl>
        <dt>クエスト</dt>
        <dd>{update.title}</dd>
        {update.added.length > 0 && (
          <>
            <dt>追加</dt>
            <dd>{update.added.join(" / ")}</dd>
          </>
        )}
        {update.updated.length > 0 && (
          <>
            <dt>更新</dt>
            <dd>{update.updated.join(" / ")}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
