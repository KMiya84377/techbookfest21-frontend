import { useMemo } from "react";
import { detailUpdateResultSchema } from "../../lib/quests/detailSections";
import {
  parseToolResult,
  type ToolResultProps,
} from "../../lib/copilotkit/toolResult";
import DetailA2UI from "./DetailA2UI";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";

// エージェントが、クエスト詳細(メイン領域)に、表示を追加・更新したことを、チャットに示す(本の F-01)
export default function DetailUpdateCard({ status, result }: ToolResultProps) {
  // 描画のたびに A2UI を作り直さないよう、結果が変わったときだけ読み直す
  const update = useMemo(
    () => parseToolResult(result, detailUpdateResultSchema),
    [result],
  );

  if (!update) {
    return (
      <Alert
        variant="quest"
        className="my-2 text-quest-card-muted"
        role="status"
      >
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
        <dt className="text-quest-card-muted">クエスト</dt>
        <dd>{update.title}</dd>
        {update.added.length > 0 && (
          <>
            <dt className="text-quest-card-muted">追加</dt>
            <dd>{update.added.join(" / ")}</dd>
          </>
        )}
        {update.updated.length > 0 && (
          <>
            <dt className="text-quest-card-muted">更新</dt>
            <dd>{update.updated.join(" / ")}</dd>
          </>
        )}
      </dl>
      {update.section && <DetailA2UI section={update.section} />}
    </Alert>
  );
}
