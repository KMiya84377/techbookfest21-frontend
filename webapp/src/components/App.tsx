import { useCallback, useEffect, useRef, useState } from "react";
import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import "../styles/quest.css";
import type { Quest, QuestStatus } from "../data/quests";
import { mergeSections, type DetailSection, type DetailUpdate } from "../lib/detailSections";
import { AUTH_DISABLED } from "../lib/outputs";
import {
  EMPTY_FILTER,
  applyFilter,
  describeFilter,
  mergeFilter,
  type FilterChange,
  type FilterPatch,
  type QuestFilter,
} from "../lib/questFilter";
import AuthGate from "./AuthGate";
import GenerativeUI from "./GenerativeUI";
import QuestBoard from "./QuestBoard";
import { QuestActionsContext, type QuestActions } from "./QuestActions";
import QuestDetail from "./QuestDetail";

const RUNTIME_URL = "/api/copilotkit";
const QUESTS_URL = "/api/quests";

function Workspace({ getToken }: { getToken?: () => string }) {
  // getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  const [quests, setQuests] = useState<Quest[] | null>(null);
  const [failed, setFailed] = useState(false);
  // APIから取得した状態に、画面の直近の変更を重ねる
  const [statuses, setStatuses] = useState<Record<string, QuestStatus>>({});
  // 不正解のままクリアした、復習候補の印
  const [reviews, setReviews] = useState<Record<string, boolean>>({});
  const [stateError, setStateError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const chatRef = useRef<HTMLElement>(null);
  // クエストボードの検索条件。詳細を閉じても、維持する(仕様書 F-03)
  const [filter, setFilter] = useState<QuestFilter>(EMPTY_FILTER);
  const filterRef = useRef(filter);

  // クエストは、エージェントを通さず、API から取得する
  const fetchQuests = useCallback(async (): Promise<Quest[]> => {
    const token = tokenRef.current?.();
    const res = await fetch(QUESTS_URL, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).quests as Quest[];
  }, []);

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

  // 取得し直す(画面は、そのまま。エージェントが、クエストを保存したあとに使う)
  const reloadQuests = useCallback(async (): Promise<{ count: number }> => {
    const latest = await fetchQuests();
    setQuests(latest);
    return { count: latest.length };
  }, [fetchQuests]);

  // クエストの状態を保存する。mock モードでも開発サーバー内に保持する
  const saveQuestState = useCallback(
    async (quest: Pick<Quest, "id" | "publishedAt">, status: QuestStatus, review?: boolean) => {
      if (status === "todo") return;
      const token = tokenRef.current?.();
      const res = await fetch(QUESTS_URL, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...quest, status, review }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
  );

  useEffect(() => {
    void load();
  }, [load]);

  const shown = quests?.map((q) => ({
    ...q,
    status: statuses[q.id] ?? q.status,
    review: reviews[q.id] ?? q.review,
  }));
  const opened = shown?.find((q) => q.id === openId);
  const shownRef = useRef(shown);
  shownRef.current = shown;

  // 検索条件を変える(画面の操作と、エージェントのツールの、どちらからも使う)
  // 変更前後の条件と、表示される件数を返す
  const updateFilter = useCallback((patch: FilterPatch): FilterChange => {
    const before = filterRef.current;
    const after = mergeFilter(before, patch);
    filterRef.current = after;
    setFilter(after);
    const all = shownRef.current ?? [];
    return {
      before: describeFilter(before),
      after: describeFilter(after),
      count: applyFilter(all, after).length,
      total: all.length,
    };
  }, []);

  // チャットの質問に応じて、詳細に追加された表示(クエストごと)。保存はしない
  const [detailExtras, setDetailExtras] = useState<Record<string, DetailSection[]>>({});
  const detailExtrasRef = useRef(detailExtras);
  const openIdRef = useRef(openId);
  openIdRef.current = openId;

  // 詳細を開いているクエストの詳細に、表示を追加・更新する(エージェントのツールから使う)
  const updateDetail = useCallback((questId: string, sections: DetailSection[]): DetailUpdate => {
    const quest = shownRef.current?.find((q) => q.id === questId);
    if (!quest) {
      return { added: [], updated: [], error: `クエスト(${questId})が見つかりません。context のクエストの id を使ってください` };
    }
    if (openIdRef.current !== questId) {
      return { title: quest.title, added: [], updated: [], error: "このクエストの詳細は、開かれていません。詳細を開いているクエストだけを更新できます" };
    }
    const { sections: merged, added, updated } = mergeSections(
      detailExtrasRef.current[questId] ?? [],
      sections,
    );
    detailExtrasRef.current = { ...detailExtrasRef.current, [questId]: merged };
    setDetailExtras(detailExtrasRef.current);
    return { title: quest.title, added, updated };
  }, []);

  // 詳細を開いたクエストは、閲覧済みにする(クリア済みは、そのまま)
  const open = (id: string) => {
    setOpenId(id);
    const quest = quests?.find((q) => q.id === id);
    const current = statuses[id] ?? quest?.status;
    if (!quest || current !== "todo") return;
    setStateError(null);
    setStatuses((s) => ({ ...s, [id]: "viewed" }));
    void saveQuestState(quest, "viewed").catch((error) => {
      console.error("クエストの閲覧状態を保存できませんでした", error);
      setStateError("クエストの閲覧状態を保存できませんでした。再読み込みで再試行してください。");
    });
  };
  const close = useCallback(() => setOpenId(null), []);

  // チャット内の部品が、クエストボードの状態を読み、操作するための窓口
  const actions: QuestActions = {
    statusOf: (id) => shown?.find((q) => q.id === id)?.status,
    isReview: (id) => Boolean(shown?.find((q) => q.id === id)?.review),
    clear: (id, review) => {
      const quest = shown?.find((q) => q.id === id);
      if (!quest || quest.status === "cleared") return;
      setStateError(null);
      setStatuses((s) => ({ ...s, [id]: "cleared" }));
      setReviews((r) => ({ ...r, [id]: review }));
      void saveQuestState(quest, "cleared", review).catch((error) => {
        console.error("クエストのクリア状態を保存できませんでした", error);
        setStateError("クエストのクリア状態を保存できませんでした。再読み込みで再試行してください。");
      });
    },
    open,
    focusChat: () => chatRef.current?.querySelector("textarea")?.focus(),
  };

  return (
    <CopilotKitProvider
      runtimeUrl={RUNTIME_URL}
      headers={getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined}
    >
      <QuestActionsContext.Provider value={actions}>
      <GenerativeUI
        quests={shown ?? []}
        openedId={openId}
        filter={filter}
        updateFilter={updateFilter}
        reloadQuests={reloadQuests}
        detailExtras={detailExtras}
        updateDetail={updateDetail}
      />
      <div className="app">
        <main className="board-area">
          {AUTH_DISABLED && <div className="mode-banner">mock モード(認証なし)</div>}
          {stateError && <div className="state-error" role="alert">{stateError}</div>}
          <div className="board-scroll">
            {failed ? (
              <div className="board-message" role="alert">
                <p>クエストを取得できませんでした。</p>
                <button type="button" className="tab active" onClick={load}>
                  もう一度取得する
                </button>
              </div>
            ) : !shown ? (
              <div className="board-message" role="status">
                クエストを読み込んでいます…
              </div>
            ) : (
              <QuestBoard
                quests={shown}
                filter={filter}
                onFilterChange={updateFilter}
                onOpen={open}
              />
            )}
          </div>
          {opened && (
            <QuestDetail quest={opened} extras={detailExtras[opened.id]} onClose={close} />
          )}
        </main>
        <aside className="chat-area" aria-label="チャット" ref={chatRef}>
          <CopilotChat
            labels={{
              welcomeMessageText: "クエストについて、なんでも聞いてください。",
              chatInputPlaceholder: "クエストについて質問する",
            }}
          />
        </aside>
      </div>
      </QuestActionsContext.Provider>
    </CopilotKitProvider>
  );
}

export default function App() {
  if (AUTH_DISABLED) return <Workspace />;
  return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
}
