import type { Quest } from "../lib/quests/model";
import type {
  FilterChange,
  FilterPatch,
  QuestFilter,
} from "../lib/quests/filter";
import type { DetailSection } from "../lib/quests/detailSections";
import type { UpdateDetail } from "../lib/quests/detailTools";
import type { UserSettings } from "../lib/userSettings/model";
import { useShowQuiz } from "./human-in-the-loop/useShowQuiz";
import { useShowChoices } from "./human-in-the-loop/useShowChoices";
import { useUpdateQuestFilter } from "./frontend-tool/useUpdateQuestFilter";
import { useUpdateQuestDetail } from "./frontend-tool/useUpdateQuestDetail";
import { useReloadQuests } from "./frontend-tool/useReloadQuests";
import { useScreenContext } from "./useScreenContext";
import { useSharedAgentState } from "./useSharedAgentState";
import { useChatSuggestions } from "./useChatSuggestions";

interface Options {
  // API から取得したボードのクエストと、詳細を開いているクエストの ID、適用中の検索条件
  quests: Quest[] | null;
  openedId: string | null;
  filter: QuestFilter;
  // メイン領域(クエストボード)の検索条件を変える。変更の内容を返す
  updateFilter: (patch: FilterPatch) => FilterChange;
  // クエストを取得し直して、ボードを更新する
  reloadQuests: () => Promise<Quest[]>;
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

// 画面とAIエージェントをつなぐ設定をまとめる。CopilotKitProvider配下で呼ぶ。
//   - useSharedAgentState: 読み書きできる状態共有(useAgent)
//   - useScreenContext: 読み取り専用の状態共有(useAgentContext)
//   - 各Human in the Loopツール: クイズ・選択肢の回答待ち
//   - 各フロントエンドツール: 検索条件の更新・詳細への追記・一覧の再取得
export function useCopilotKitIntegration({
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
}: Options) {
  const { shareQuestBoard } = useSharedAgentState({
    quests,
    reloadQuests,
    onRefreshError,
    userSettings,
    userSettingsReady,
  });
  useScreenContext({ quests, openedId, filter, detailExtras });
  useShowQuiz();
  useShowChoices();
  useUpdateQuestFilter(updateFilter);
  useUpdateQuestDetail(updateDetail);
  useReloadQuests({ reloadQuests, shareQuestBoard });
  useChatSuggestions();
}
