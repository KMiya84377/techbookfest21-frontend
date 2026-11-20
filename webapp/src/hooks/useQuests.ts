import { useCallback, useEffect, useRef, useState } from "react";
import type { Quest, QuestStatus } from "../lib/quests/model";
import type { ApiFetch } from "./useApiFetch";
import type { LearningProgress } from "../lib/learning/model";

const QUESTS_URL = "/api/quests";
const QUIZ_ANSWERS_URL = "/api/quiz-answers";

// クエストの取得と、閲覧・クリア状態の保存
//   クエストは、エージェントを通さず、API から取得する
export function useQuests(apiFetch: ApiFetch) {
  const [questsFromApi, setQuestsFromApi] = useState<Quest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // APIから取得した状態に、画面の直近の変更を重ねる
  const [localStatusById, setLocalStatusById] = useState<
    Record<string, QuestStatus>
  >({});
  // 不正解のままクリアした、復習候補の印
  const [localReviewById, setLocalReviewById] = useState<
    Record<string, boolean>
  >({});
  const [stateError, setStateError] = useState<string | null>(null);
  const [learningEvent, setLearningEvent] = useState<{
    progress: LearningProgress | null;
    version: number;
  } | null>(null);
  const pendingClearIds = useRef(new Set<string>());
  // 表示中のクエスト(下で、描画のたびに更新する)。エージェントのツールなど、描画の外から読む
  const displayedQuestsRef = useRef<Quest[] | undefined>(undefined);

  const fetchQuests = useCallback(async (): Promise<Quest[]> => {
    const response = await apiFetch(QUESTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()).quests as Quest[];
  }, [apiFetch]);

  // 最初の取得(読み込み中の表示を出す)
  const loadQuests = useCallback(async () => {
    setLoadFailed(false);
    setQuestsFromApi(null);
    try {
      const quests = await fetchQuests();
      setQuestsFromApi(quests);
    } catch {
      setLoadFailed(true);
    }
  }, [fetchQuests]);

  // 取得し直す。共有状態から更新要求が来た場合も、永続 API を正として使う。
  const reloadQuests = useCallback(async (): Promise<Quest[]> => {
    const latest = await fetchQuests();
    // 次の描画を待たずに、直後の操作(検索条件の件数など)が最新の一覧を使えるようにする
    displayedQuestsRef.current = latest;
    setQuestsFromApi(latest);
    return latest;
  }, [fetchQuests]);

  // クエストの状態を保存する。mock モードでも開発サーバー内に保持する
  const saveQuestState = useCallback(
    async (
      quest: Pick<Quest, "id" | "publishedAt">,
      status: "viewed" | "cleared",
      review?: boolean,
    ) => {
      const response = await apiFetch(QUESTS_URL, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...quest, status, review }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as { learning?: LearningProgress | null };
    },
    [apiFetch],
  );

  // 理解度チェックの、初回の回答を保存する(失敗しても、クイズの操作は止めない)
  const recordQuizAnswer = useCallback(
    async (questId: string, correct: boolean) => {
      try {
        const response = await apiFetch(QUIZ_ANSWERS_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questId, correct }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.error("理解度チェックの回答を保存できませんでした", error);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    void loadQuests();
  }, [loadQuests]);

  // APIの取得値に画面内の変更を重ね、表示用の一覧を作る。
  const displayedQuests = questsFromApi?.map((quest) => ({
    ...quest,
    status: localStatusById[quest.id] ?? quest.status,
    review: localReviewById[quest.id] ?? quest.review,
  }));
  displayedQuestsRef.current = displayedQuests;

  // 表示中のクエストを ID で探す。取得し直した直後(次の描画の前)にも最新の一覧で探せるよう、参照から読む
  const findDisplayedQuest = (id: string) =>
    displayedQuestsRef.current?.find((quest) => quest.id === id);

  async function saveViewedQuest(quest: Quest): Promise<void> {
    try {
      await saveQuestState(quest, "viewed");
    } catch (error) {
      console.error("クエストの閲覧状態を保存できませんでした", error);
      setStateError(
        "クエストの閲覧状態を保存できませんでした。再読み込みで再試行してください。",
      );
    }
  }

  // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
  const markViewed = (id: string) => {
    const quest = findDisplayedQuest(id);
    if (!quest || quest.status !== "todo") return;
    setStateError(null);
    // 閲覧は先に画面へ反映し、その後に保存する。
    setLocalStatusById((current) => ({ ...current, [id]: "viewed" }));
    void saveViewedQuest(quest);
  };

  async function saveClearedQuest(quest: Quest, review: boolean): Promise<void> {
    try {
      const response = await saveQuestState(quest, "cleared", review);
      // クリアは保存成功後に画面へ反映する。失敗した場合は再試行できる。
      setLocalStatusById((current) => ({ ...current, [quest.id]: "cleared" }));
      setLocalReviewById((current) => ({ ...current, [quest.id]: review }));
      setLearningEvent((current) => ({
        progress: response?.learning ?? null,
        version: (current?.version ?? 0) + 1,
      }));
    } catch (error) {
      console.error("クエストのクリア状態を保存できませんでした", error);
      setStateError(
        "クエストのクリア状態を保存できませんでした。再読み込みで再試行してください。",
      );
    } finally {
      pendingClearIds.current.delete(quest.id);
    }
  }

  const markCleared = (id: string, review: boolean) => {
    const quest = findDisplayedQuest(id);
    if (!quest || quest.status === "cleared" || pendingClearIds.current.has(id)) {
      return;
    }
    pendingClearIds.current.add(id);
    setStateError(null);
    void saveClearedQuest(quest, review);
  };

  return {
    displayedQuests,
    displayedQuestsRef,
    findDisplayedQuest,
    loadFailed,
    loadQuests,
    reloadQuests,
    stateError,
    setStateError,
    markViewed,
    markCleared,
    recordQuizAnswer,
    learningEvent,
  };
}
