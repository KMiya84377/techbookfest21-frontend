import { useMemo } from "react";
import { detailUpdateResultSchema, type DetailUpdate } from "../../lib/quests/detailSections";
import DetailA2UI from "./DetailA2UI";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

interface Props {
  status: string;
  result?: string;
}

function parseUpdate(result?: string): DetailUpdate | null {
  if (!result) return null;
  try {
    const parsed = detailUpdateResultSchema.safeParse(JSON.parse(result));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// エージェントが、クエスト詳細(メイン領域)に、表示を追加・更新したことを、チャットに示す(仕様書 F-04)
export default function DetailUpdateCard({ status, result }: Props) {
  const update = useMemo(() => parseUpdate(result), [result]);
  if (!update) {
    return (
      <Alert variant="quest" className="my-2 text-[#746b5c]" role="status">
        {status === "complete"
          ? "追記の結果を確認できませんでした"
          : "クエスト詳細を更新しています…"}
      </Alert>
    );
  }
  if (update.error) {
    return (
      <Alert variant="quest" className="my-2 text-[13px]" role="status">
        <AlertTitle>クエスト詳細を更新できませんでした</AlertTitle>
        <AlertDescription>{update.error}</AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="quest" className="my-2 text-[13px]" role="status">
      <AlertTitle>クエスト詳細を更新しました</AlertTitle>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5">
        <dt className="text-[#746b5c]">クエスト</dt>
        <dd>{update.title}</dd>
        {update.added.length > 0 && (
          <>
            <dt className="text-[#746b5c]">追加</dt>
            <dd>{update.added.join(" / ")}</dd>
          </>
        )}
        {update.updated.length > 0 && (
          <>
            <dt className="text-[#746b5c]">更新</dt>
            <dd>{update.updated.join(" / ")}</dd>
          </>
        )}
      </dl>
      {update.section && <DetailA2UI section={update.section} />}
    </Alert>
  );
}
