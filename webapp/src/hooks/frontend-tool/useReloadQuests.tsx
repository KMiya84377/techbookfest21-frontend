import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { Quest } from "../../lib/quests/model";
import { parseToolResult } from "../../lib/copilotkit/toolResult";
import { Alert } from "../../components/ui/alert";

// reload_quests が返す値(取得し直した後のクエストの数)
const reloadResultSchema = z.object({ count: z.number() });

interface Options {
  reloadQuests: () => Promise<Quest[]>;
  shareQuestBoard: (latest: Quest[]) => void;
}

// 一覧を取得し直し、共有状態を更新してチャットに件数を表示する。
export function useReloadQuests({ reloadQuests, shareQuestBoard }: Options) {
  useFrontendTool({
    name: "reload_quests",
    description:
      "保存済みのクエストを API から取得し直して、クエストボードを更新する。" +
      "通常は save_quests 後に Shared State が自動で更新を要求するため、" +
      "ユーザーから再読み込みを頼まれた場合に使う。" +
      "更新後のクエスト数が返る",
    parameters: z.object({}),
    handler: async () => {
      const latest = await reloadQuests();
      shareQuestBoard(latest);
      return { count: latest.length };
    },
    render: ({ status, result }) => {
      // エージェントがクエストボードを取得し直したことをチャットに表示する
      const count = parseToolResult(result, reloadResultSchema)?.count ?? null;

      return (
        <Alert variant="quest" className="my-2 text-[13px]" role="status">
          {status === "complete" && count !== null
            ? `クエストボードを更新しました(${count} 件)`
            : "クエストボードを更新しています…"}
        </Alert>
      );
    },
  });
}
