import { useCallback, useEffect, useRef, useState } from "react";
import type { Quest, QuestStatus } from "../lib/quests/model";
import type { ApiFetch } from "./useApiFetch";
import type { LearningProgress } from "../lib/learning/model";

const QUESTS_URL = "/api/quests";
const QUIZ_ANSWERS_URL = "/api/quiz-answers";

// クエストの取得と、閲覧・クリア状態の保存
//   クエストは、エージェントを通さず、API から取得する
export function useQuests(apiFetch: ApiFetch) {
  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [failed, setFailed] = useState(false);
  // APIから取得した状態に、画面の直近の変更を重ねる
  const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
  // 不正解のままクリアした、復習候補の印
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const [stateError, setStateError] = useState<string | null>(null);
  const [learningEvent, setLearningEvent] = useState<{
    progress: LearningProgress | null;
    version: number;
  } | null>(null);
  const pendingClears = useRef(new Set<string>());
  // 表示中のクエスト(下で、描画のたびに更新する)。エージェントのツールなど、描画の外から読む
  const shownRef = useRef<Quest[] | undefined>(undefined);

  const fetchQuests = useCallback(async (): Promise<Quest[]> => {
    const res = await apiFetch(QUESTS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).quests as Quest[];
  }, [apiFetch]);

  // 最初の取得(読み込み中の表示を出す)
  const load = useCallback(async () => {
    setFailed(false);
    setQuests(null);
    try {
      setQuests(await fetchQuests());
    } catch {
      setFailed(true);
    }
  }, [fetchQuests]);

  // 取得し直す。共有状態から更新要求が来た場合も、永続 API を正として使う。
  const reloadQuests = useCallback(async (): Promise<Quest[]> => {
    const latest = await fetchQuests();
    // 次の描画を待たずに、直後の操作(検索条件の件数など)が最新の一覧を使えるようにする
    shownRef.current = latest;
    setQuests(latest);
    return latest;
  }, [fetchQuests]);

  // クエストの状態を保存する。mock モードでも開発サーバー内に保持する
  const saveQuestState = useCallback(
    async (
      quest: Pick<Quest, "id" | "publishedAt">,
      status: "viewed" | "cleared",
      review?: boolean,
    ) => {
      const res = await apiFetch(QUESTS_URL, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...quest, status, review }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { learning?: LearningProgress | null };
    },
    [apiFetch],
  );

  // 理解度チェックの、初回の回答を保存する(失敗しても、クイズの操作は止めない)
  const recordQuizAnswer = useCallback(
    async (questId: string, correct: boolean) => {
      try {
        const res = await apiFetch(QUIZ_ANSWERS_URL, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ questId, correct }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (error) {
        console.error("理解度チェックの回答を保存できませんでした", error);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const shown = quests?.map((quest) => ({
    ...quest,
    status: statuses[quest.id] ?? quest.status,
    review: reviews[quest.id] ?? quest.review,
  }));
  shownRef.current = shown;

  // 表示中のクエストを ID で探す。取得し直した直後(次の描画の前)にも最新の一覧で探せるよう、参照から読む
  const findShown = (id: string) =>
    shownRef.current?.find((quest) => quest.id === id);

  // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
  const markViewed = (id: string) => {
    const quest = findShown(id);
    if (!quest || quest.status !== "todo") return;
    setStateError(null);
    setStatuses((current) => ({ ...current, [id]: "viewed" }));
    void saveQuestState(quest, "viewed").catch((error) => {
      console.error("クエストの閲覧状態を保存できませんでした", error);
      setStateError(
        "クエストの閲覧状態を保存できませんでした。再読み込みで再試行してください。",
      );
    });
  };

  const markCleared = (id: string, review: boolean) => {
    const quest = findShown(id);
    if (!quest || quest.status === "cleared" || pendingClears.current.has(id))
      return;
    pendingClears.current.add(id);
    setStateError(null);
    void saveQuestState(quest, "cleared", review)
      .then((result) => {
        // 保存に成功するまではクリア済みにしない。失敗時にも再試行できる。
        setStatuses((current) => ({ ...current, [id]: "cleared" }));
        setReviews((current) => ({ ...current, [id]: review }));
        setLearningEvent((current) => ({
          progress: result?.learning ?? null,
          version: (current?.version ?? 0) + 1,
        }));
      })
      .catch((error) => {
        console.error("クエストのクリア状態を保存できませんでした", error);
        setStateError(
          "クエストのクリア状態を保存できませんでした。再読み込みで再試行してください。",
        );
      })
      .finally(() => pendingClears.current.delete(id));
  };

  return {
    shown,
    shownRef,
    findShown,
    failed,
    load,
    reloadQuests,
    stateError,
    setStateError,
    markViewed,
    markCleared,
    recordQuizAnswer,
    learningEvent,
  };
}
