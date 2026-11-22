import { useMemo } from "react";
import { useFrontendTool } from "@copilotkit/react-core/v2";
import {
  detailUpdateSchema,
  detailUpdateResultSchema,
} from "../../lib/quests/detailSections";
import {
  applyDetailUpdate,
  type UpdateDetail,
} from "../../lib/quests/detailTools";
import {
  parseToolResult,
  type ToolResultProps,
} from "../../lib/copilotkit/toolResult";
import DetailA2UI from "../../components/generative-ui/DetailA2UI";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../components/ui/alert";

// F-01: A2UIを詳細へ追記し、同じ内容をチャットにも表示する。
export function useUpdateQuestDetail(updateDetail: UpdateDetail) {
  useFrontendTool({
    name: "update_quest_detail",
    description:
      "開いているニュースへA2UIのUIを追記・更新し、同じUIをチャット欄にも表示する。" +
      "比較や影響、補足をText/Column/Row/Card/Dividerで自由に構成する。" +
      "generate_a2uiを重ねて呼ぶ必要はない。" +
      "同じsection.idは更新、新しいidは追記。" +
      "UIの構造・本文はA2UI v0.9メッセージで渡す。",
    parameters: detailUpdateSchema,
    handler: async (args: unknown) => applyDetailUpdate(args, updateDetail),
    render: ({ status, result }) => (
      <DetailUpdateCard status={status} result={result} />
    ),
  });
}

// エージェントが、クエスト詳細(メイン領域)に、表示を追加・更新したことを、チャットに示す(本の F-01)
function DetailUpdateCard({ status, result }: ToolResultProps) {
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
