import { useCallback, useRef, useState } from "react";
import { CopilotKitProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import "../styles/tailwind.css";
import "../styles/quest.css";
import { AUTH_DISABLED } from "../lib/appMode";
import { useApiFetch } from "../hooks/useApiFetch";
import { useDetailExtras } from "../hooks/useDetailExtras";
import { useQuestFilter } from "../hooks/useQuestFilter";
import { useQuests } from "../hooks/useQuests";
import { useNewsNotifications } from "../hooks/useNewsNotifications";
import { useLearningInsights } from "../hooks/useLearningInsights";
import { useUserSettings } from "../hooks/useUserSettings";
import AuthGate from "./auth/AuthGate";
import ChatPanel from "./chat/ChatPanel";
import ChatSuggestions from "./chat/ChatSuggestions";
import MobileChatButton from "./chat/MobileChatButton";
import CopilotKitIntegration from "./copilotkit/CopilotKitIntegration";
import { reportCatalog } from "./generative-ui/ReportCatalog";
import { QuestActionsContext, type QuestActions } from "./quests/QuestActions";
import QuestBoard from "./quests/QuestBoard";
import {
  QuestLoadFailed,
  QuestLoading,
  StateErrorBanner,
} from "./quests/QuestBoardStatus";
import QuestDetail from "./quests/QuestDetail";
import QuestLayout from "./quests/QuestLayout";
import { QUEST_OPEN_GENERATIVE_UI_DESIGN_SKILL } from "../lib/generative-ui/openGenerativeUI";
import UserSettingsDialog from "./user-setting/UserSettingsDialog";
import UserSettingsButton from "./user-setting/UserSettingsButton";
import LearningNotifications from "./learning/LearningNotifications";

const RUNTIME_URL = "/api/copilotkit";

// getToken: アクセストークンを返す関数。渡さないとき(mock モード)は、認証ヘッダーを付けない
function Workspace({ getToken }: { getToken?: () => string }) {
  const apiFetch = useApiFetch(getToken);
  const {
    displayedQuests,
    displayedQuestsRef,
    loadFailed,
    loadQuests,
    reloadQuests,
    stateError,
    setStateError,
    findDisplayedQuest,
    markViewed,
    markCleared,
    recordQuizAnswer,
    learningEvent,
  } = useQuests(apiFetch);
  const {
    settings: userSettings,
    loading: settingsLoading,
    loadError: settingsLoadError,
    save: saveUserSettings,
  } = useUserSettings(apiFetch);
  const newsNotifications = useNewsNotifications(apiFetch);
  const learningInsights = useLearningInsights(
    apiFetch,
    learningEvent,
    userSettings.learningReviewEvery,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  // チャットの会話(スレッド)。新しい会話を始めるときに作り直す
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const startNewThread = useCallback(
    () => setThreadId(crypto.randomUUID()),
    [],
  );
  const chatRef = useRef<HTMLElement>(null);
  const { filter, updateFilter } = useQuestFilter(displayedQuestsRef);
  const { detailExtras, updateDetail } = useDetailExtras(
    displayedQuestsRef,
    openId,
  );
  const opened = openId ? findDisplayedQuest(openId) : undefined;

  const open = (id: string) => {
    setOpenId(id);
    markViewed(id);
  };
  const openNews = async (id: string) => {
    const quests = await reloadQuests();
    if (!quests.some((quest) => quest.id === id))
      throw new Error("通知のニュースが見つかりません");
    open(id);
  };
  const close = useCallback(() => setOpenId(null), []);

  const closeMobileChat = useCallback(() => setMobileChatOpen(false), []);

  // チャット内の部品が、クエストボードの状態を読み、操作するための窓口
  const actions: QuestActions = {
    statusOf: (id) => findDisplayedQuest(id)?.status,
    isReview: (id) => Boolean(findDisplayedQuest(id)?.review),
    clear: markCleared,
    recordAnswer: (id, correct) => void recordQuizAnswer(id, correct),
    open,
    focusChat: () => chatRef.current?.querySelector("textarea")?.focus(),
  };

  // ボードの領域に出すもの: 取得に失敗した、読み込み中、クエストボードのどれか
  const renderBoard = () => {
    if (loadFailed) return <QuestLoadFailed onRetry={loadQuests} />;
    if (!displayedQuests) return <QuestLoading />;
    return (
      <QuestBoard
        quests={displayedQuests}
        filter={filter}
        onFilterChange={updateFilter}
        onOpen={open}
      />
    );
  };

  return (
    <CopilotKitProvider
      runtimeUrl={RUNTIME_URL}
      headers={
        getToken ? () => ({ Authorization: `Bearer ${getToken()}` }) : undefined
      }
      a2ui={{ catalog: reportCatalog }}
      openGenerativeUI={{
        designSkill: QUEST_OPEN_GENERATIVE_UI_DESIGN_SKILL,
      }}
    >
      <QuestActionsContext.Provider value={actions}>
        <CopilotKitIntegration
          quests={displayedQuests ?? null}
          openedId={openId}
          filter={filter}
          updateFilter={updateFilter}
          reloadQuests={reloadQuests}
          onRefreshError={setStateError}
          detailExtras={detailExtras}
          updateDetail={updateDetail}
          userSettings={userSettings}
          userSettingsReady={!settingsLoading && !settingsLoadError}
        />
        <ChatSuggestions />
        <QuestLayout>
          <main className="board-area relative isolate min-w-0 overflow-hidden border-[11px] max-[520px]:border-[7px] max-[900px]:min-h-[660px]">
            <UserSettingsButton onOpenSettings={() => setSettingsOpen(true)} />
            <LearningNotifications
              insights={learningInsights.insights}
              busy={learningInsights.busy}
              error={learningInsights.error}
              onRetry={learningInsights.retry}
              onRead={learningInsights.markRead}
              news={newsNotifications.notifications}
              newsBusy={newsNotifications.busy}
              newsError={newsNotifications.error}
              onCheckNews={newsNotifications.check}
              onReadNews={newsNotifications.markRead}
              onOpenNews={openNews}
            />
            {!mobileChatOpen && (
              <MobileChatButton onOpen={() => setMobileChatOpen(true)} />
            )}
            {stateError && (
              <StateErrorBanner
                message={stateError}
                onClose={() => setStateError(null)}
              />
            )}
            <div
              aria-hidden={Boolean(opened)}
              inert={Boolean(opened)}
              className="h-full min-w-0 overflow-auto px-[clamp(20px,3.1vw,54px)] pb-[38px] [scrollbar-color:var(--quest-scrollbar-thumb)_var(--quest-scrollbar-track)] [scrollbar-width:thin] max-[900px]:h-auto max-[900px]:overflow-visible max-[520px]:px-[19px]"
            >
              {renderBoard()}
            </div>
            {opened && (
              <QuestDetail
                quest={opened}
                extras={detailExtras[opened.id]}
                onClose={close}
              />
            )}
          </main>
          <ChatPanel
            open={mobileChatOpen}
            onClose={closeMobileChat}
            threadId={threadId}
            onNewThread={startNewThread}
            ref={chatRef}
          />
        </QuestLayout>
        <UserSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={userSettings}
          loading={settingsLoading}
          loadError={settingsLoadError}
          onSave={saveUserSettings}
        />
      </QuestActionsContext.Provider>
    </CopilotKitProvider>
  );
}

export default function App() {
  // AUTH_DISABLED(開発サーバーの mock モード): ログイン画面を出さず、トークンなしで表示する
  if (AUTH_DISABLED) return <Workspace />;

  return <AuthGate>{(getToken) => <Workspace getToken={getToken} />}</AuthGate>;
}
