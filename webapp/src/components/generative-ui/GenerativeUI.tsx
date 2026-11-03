import { useCallback, useEffect, useRef } from "react";
import {
  useAgent,
  useAgentContext,
  useFrontendTool,
  useHumanInTheLoop,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import type { Quest } from "../../lib/quests/model";
import {
  describeFilter,
  filterPatchSchema,
  type FilterChange,
  type FilterPatch,
  type QuestFilter,
} from "../../lib/quests/filter";
import {
  type DetailSection,
} from "../../lib/quests/detailSections";
import { createDetailTool, type UpdateDetail } from "../../lib/quests/detailTools";
import type { UserSettings } from "../../lib/userSettings/model";
import DetailUpdateCard from "./DetailUpdateCard";
import FilterChangeCard from "./FilterChangeCard";
import ReloadCard from "./ReloadCard";
import Quiz, { quizSchema } from "./Quiz";
import ChoicePrompt, { choicePromptSchema } from "./ChoicePrompt";

type SharedQuest = Pick<
  Quest,
  | "id"
  | "title"
  | "services"
  | "importance"
  | "minutes"
  | "status"
  | "publishedAt"
  | "summary"
>;

const toSharedQuests = (quests: Quest[]): SharedQuest[] =>
  quests.map(
    ({
      id,
      title,
      services,
      importance,
      minutes,
      status,
      publishedAt,
      summary,
    }) => ({
      id,
      title,
      services,
      importance,
      minutes,
      status,
      publishedAt,
      summary,
    }),
  );

interface Props {
  // API から取得したボードのクエストと、詳細を開いているクエストの ID、適用中の検索条件
  quests: Quest[] | null;
  openedId: string | null;
  filter: QuestFilter;
  // メイン領域(クエストボード)の検索条件を変える。変更の内容を返す
  updateFilter: (patch: FilterPatch) => FilterChange;
  // クエストを取得し直して、ボードを更新する
  reloadQuests: () => Promise<{ quests: Quest[]; count: number }>;
  onRefreshError: (message: string) => void;
  // 詳細を開いているクエストに、チャットで追加した表示(クエストの ID ごと)
  detailExtras: Record<string, DetailSection[]>;
  // 詳細を開いているクエストの詳細に、表示を追加・更新する。結果を返す
  updateDetail: UpdateDetail;
  // 明示的に保存されたユーザーの学習設定
  userSettings: UserSettings;
  // 保存済みの設定を読み込めたか。読み込み前・失敗時は、既定値をエージェントへ渡さない
  userSettingsReady: boolean;
}

// エージェントが呼び出せる UI と画面操作ツールを登録し、画面状態を共有する
// (CopilotKitProvider の中に置く)
export default function GenerativeUI({
  quests,
  openedId,
  filter,
  updateFilter,
  reloadQuests,
  onRefreshError,
  detailExtras,
  updateDetail,
  userSettings,
  userSettingsReady,
}: Props) {
  const { agent } = useAgent();
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const questBoard = (
    agent.state as {
      questBoard?: {
        quests?: unknown;
        refreshRequested?: boolean;
      };
    }
  ).questBoard;
  const boardQuests = toSharedQuests(quests ?? []);
  const boardQuestsJson = JSON.stringify(boardQuests);
  const shareQuestBoard = useCallback((latest: Quest[]) => {
    const currentAgent = agentRef.current;
    currentAgent.setState({
      ...(currentAgent.state as Record<string, unknown>),
      questBoard: {
        quests: toSharedQuests(latest),
        refreshRequested: false,
      },
    });
  }, []);

  // API が正規データ。初回取得・状態更新後に、エージェントと共有する状態を同期する。
  useEffect(() => {
    if (!quests || questBoard?.refreshRequested) return;
    if (JSON.stringify(questBoard?.quests) === boardQuestsJson) return;

    shareQuestBoard(quests);
  }, [
    agent,
    boardQuestsJson,
    quests,
    questBoard?.quests,
    questBoard?.refreshRequested,
    shareQuestBoard,
  ]);

  // ユーザー設定は明示的な値なので、会話履歴の推測より優先してエージェントへ共有する。
  useEffect(() => {
    if (!userSettingsReady) return;
    const currentAgent = agentRef.current;
    const currentState = currentAgent.state as Record<string, unknown>;
    if (
      JSON.stringify(currentState.userSettings) === JSON.stringify(userSettings)
    ) {
      return;
    }
    currentAgent.setState({ ...currentState, userSettings });
  }, [agent, userSettings, userSettingsReady]);

  // エージェントが保存後に共有状態で更新を要求したら、永続 API から正規データを取り直す。
  useEffect(() => {
    if (!questBoard?.refreshRequested) return;
    let cancelled = false;

    void reloadQuests()
      .then(({ quests: latest }) => {
        if (cancelled) return;
        shareQuestBoard(latest);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("共有状態からのクエスト再取得に失敗しました", error);
        const currentAgent = agentRef.current;
        const currentState = currentAgent.state as Record<string, unknown>;
        const currentBoard = currentState.questBoard;
        currentAgent.setState({
          ...currentState,
          questBoard: {
            ...(typeof currentBoard === "object" && currentBoard !== null
              ? currentBoard
              : {}),
            refreshRequested: false,
            refreshError: true,
          },
        });
        onRefreshError(
          "クエストボードを更新できませんでした。再読み込みをお試しください。",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    agent,
    onRefreshError,
    questBoard?.refreshRequested,
    reloadQuests,
    shareQuestBoard,
  ]);

  // 画面の状況は context として渡す(エージェントの会話履歴には保存されない)。
  // ユーザー設定は、エージェント側で検証してから使うため、共有状態だけで渡す。
  useAgentContext({
    description:
      "クエストボードのクエスト一覧(id つき)。クエストの id は、ここにあるものを使う",
    value: boardQuests,
  });
  const opened = quests?.find((q) => q.id === openedId);
  useAgentContext({
    // 先頭の [opened_quest] は、エージェントの UI ルーターが詳細を開いているかを見分ける目印
    // (agent/chat/ui_router.py の OPENED_QUEST_CONTEXT_MARKER と合わせる)
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

  // 理解度チェック: 問題を表示し、ユーザーの初回の回答を、エージェントに返す
  // 回答が返るまで、エージェントの実行は止まる
  useHumanInTheLoop({
    name: "show_quiz",
    description:
      "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。questId は、クエスト一覧の id を、そのまま使う。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
    parameters: quizSchema,
    render: ({ args, respond, result }) => (
      <Quiz {...args} respond={respond} result={result} />
    ),
  });

  // 汎用的な選択肢: 候補をボタンで表示し、選択結果をエージェントへ返す
  useHumanInTheLoop({
    name: "show_choices",
    description:
      "ユーザーに有限個の候補から選んでもらう必要があるとき、質問と2〜6個の選択肢をボタンでチャットに表示する。選択結果が返るまで待ち、その結果を使って会話を続ける。理解度クイズには show_quiz を使う",
    parameters: choicePromptSchema,
    render: ({ args, respond, result }) => (
      <ChoicePrompt {...args} respond={respond} result={result} />
    ),
  });

  // クエストボードの検索条件の変更: ユーザーの依頼(期間、サービス、重要度など)を、メイン領域に反映する
  // 変更の内容(変更前、変更後、件数)を、チャットに表示し、エージェントにも返す
  useFrontendTool({
    name: "update_quest_filter",
    description:
      "クエストボードの検索条件を変える。ユーザーが、期間、AWS サービス、重要度、想定学習時間、状態で、クエストを絞り込みたいときに呼ぶ。指定した条件だけを変え、null で条件を解除する。すべて解除するときは reset を true にする。変更前後の条件と、表示される件数が返る",
    parameters: filterPatchSchema,
    handler: async (args) => updateFilter(args),
    render: ({ status, result }) => (
      <FilterChangeCard status={status} result={result} />
    ),
  });

  // AIが構成したA2UIを詳細へ追記し、同じメッセージをチャットにも表示する。
  useFrontendTool({
    ...createDetailTool(updateDetail),
    render: ({ status, result }) => (
      <DetailUpdateCard status={status} result={result} />
    ),
  });

  // クエストの取得し直し: ユーザーから明示的に依頼された場合などの手動更新用
  useFrontendTool({
    name: "reload_quests",
    description:
      "保存済みのクエストを API から取得し直して、クエストボードを更新する。通常は save_quests 後に Shared State が自動で更新を要求するため、ユーザーから再読み込みを頼まれた場合に使う。更新後のクエスト数が返る",
    parameters: z.object({}),
    handler: async () => {
      const latest = await reloadQuests();
      shareQuestBoard(latest.quests);
      return { count: latest.count };
    },
    render: ({ status, result }) => (
      <ReloadCard status={status} result={result} />
    ),
  });

  return null;
}
