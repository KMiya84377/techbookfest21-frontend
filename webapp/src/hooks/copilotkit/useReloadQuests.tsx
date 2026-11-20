import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { Quest } from "../../lib/quests/model";
import ReloadCard from "../../components/generative-ui/ReloadCard";

interface Options {
  reloadQuests: () => Promise<Quest[]>;
  shareQuestBoard: (latest: Quest[]) => void;
}

// 一覧を取得し直し、共有状態を更新してチャットに件数を表示する。
export function useReloadQuests({ reloadQuests, shareQuestBoard }: Options) {
  useFrontendTool({
    name: "reload_quests",
    description:
      "保存済みのクエストを API から取得し直して、クエストボードを更新する。通常は save_quests 後に Shared State が自動で更新を要求するため、ユーザーから再読み込みを頼まれた場合に使う。更新後のクエスト数が返る",
    parameters: z.object({}),
    handler: async () => {
      const latest = await reloadQuests();
      shareQuestBoard(latest);
      return { count: latest.length };
    },
    render: ({ status, result }) => (
      <ReloadCard status={status} result={result} />
    ),
  });
}
