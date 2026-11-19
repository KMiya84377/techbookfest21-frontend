import { useCallback, useEffect, useRef } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import type { Quest } from "../../lib/quests/model";
import type { UserSettings } from "../../lib/userSettings/model";

// エージェントと共有するクエストの項目(本文などの長い項目は渡さない)
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

export const toSharedQuests = (quests: Quest[]): SharedQuest[] =>
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

interface Options {
  // API から取得したボードのクエスト
  quests: Quest[] | null;
  // クエストを取得し直して、ボードを更新する
  reloadQuests: () => Promise<Quest[]>;
  onRefreshError: (message: string) => void;
  // 明示的に保存されたユーザーの学習設定
  userSettings: UserSettings;
  // 保存済みの設定を読み込めたか。読み込み前・失敗時は、既定値をエージェントへ渡さない
  userSettingsReady: boolean;
}

// 読み書きできる状態共有(useAgent)。記事 3.2
//   - クエスト一覧(questBoard)と学習設定(userSettings)を、エージェントの共有状態に入れる
//   - エージェントがクエストを保存すると questBoard.refreshRequested が立つので、API から取得し直す
// 共有状態のクエスト一覧を、最新の一覧で書き換える関数を返す(reload_quests ツールが使う)
export function useSharedAgentState({
  quests,
  reloadQuests,
  onRefreshError,
  userSettings,
  userSettingsReady,
}: Options) {
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
  const boardQuestsJson = JSON.stringify(toSharedQuests(quests ?? []));
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
      .then((latest) => {
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

  return { shareQuestBoard };
}
