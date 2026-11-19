import { useAgentContext } from "@copilotkit/react-core/v2";
import type { Quest } from "../../lib/quests/model";
import { describeFilter, type QuestFilter } from "../../lib/quests/filter";
import type { DetailSection } from "../../lib/quests/detailSections";
import { toSharedQuests } from "./useSharedAgentState";

interface Options {
  // API から取得したボードのクエストと、詳細を開いているクエストの ID、適用中の検索条件
  quests: Quest[] | null;
  openedId: string | null;
  filter: QuestFilter;
  // 詳細を開いているクエストに、チャットで追加した表示(クエストの ID ごと)
  detailExtras: Record<string, DetailSection[]>;
}

// 読み取り専用の状態共有(useAgentContext)。記事 3.2、F-02
// 画面の状況は context として渡す(エージェントの会話履歴には保存されない)。
// ユーザー設定は、エージェント側で検証してから使うため、共有状態(useSharedAgentState)だけで渡す。
export function useScreenContext({
  quests,
  openedId,
  filter,
  detailExtras,
}: Options) {
  useAgentContext({
    description:
      "クエストボードのクエスト一覧(id つき)。クエストの id は、ここにあるものを使う",
    value: toSharedQuests(quests ?? []),
  });
  const opened = quests?.find((quest) => quest.id === openedId);
  useAgentContext({
    // 先頭の [opened_quest] は、エージェントの UI ルーターが詳細を開いているかを見分ける目印
    // (chat-agent/chat/ui_router.py の OPENED_QUEST_CONTEXT_MARKER と合わせる)
    description:
      "[opened_quest] ユーザーが、いま詳細を開いているクエスト(なければ null)。「このクエスト」は、これを指す",
    value: opened
      ? {
          // value は JSON の値の型。Quest の省略可能な項目(undefined)を落とすため、JSON を通す
          ...JSON.parse(JSON.stringify(opened)),
          // すでにチャットで追加した表示(更新するときは、同じ id を使う)
          chatAddedSections: detailExtras[opened.id] ?? [],
        }
      : null,
  });
  useAgentContext({
    description: "クエストボードで、適用中の検索条件(空なら、条件なし)",
    value: describeFilter(filter),
  });
}
