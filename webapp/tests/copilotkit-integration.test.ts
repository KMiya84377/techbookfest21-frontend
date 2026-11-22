import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestActionsContext, type QuestActions } from "../src/contexts/QuestActionsContext";
import { useQuestActions } from "../src/hooks/useQuestActions";
import { DEFAULT_USER_SETTINGS } from "../src/lib/userSettings/model";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

test("登録フックは状態共有・画面情報・各ツール・サジェストを登録する", async () => {
  const calls: string[] = [];
  const shareQuestBoard = () => {};
  const options: Parameters<typeof import("../src/hooks/copilotkit/useCopilotKitIntegration").useCopilotKitIntegration>[0] = {
    quests: [], openedId: null, filter: {}, detailExtras: {},
    reloadQuests: async () => [], onRefreshError() {},
    updateFilter: () => { throw new Error("このテストでは呼びません"); },
    updateDetail: () => { throw new Error("このテストでは呼びません"); },
    userSettings: DEFAULT_USER_SETTINGS, userSettingsReady: true,
  };
  const { useCopilotKitIntegration } = await loadIsolatedModule<
    typeof import("../src/hooks/copilotkit/useCopilotKitIntegration")
  >("src/hooks/copilotkit/useCopilotKitIntegration.ts", {
    "./useSharedAgentState": { useSharedAgentState(value: unknown) {
      calls.push("state");
      assert.deepEqual(value, {
        quests: options.quests, reloadQuests: options.reloadQuests,
        onRefreshError: options.onRefreshError, userSettings: options.userSettings,
        userSettingsReady: options.userSettingsReady,
      });
      return { shareQuestBoard };
    } },
    "./useScreenContext": { useScreenContext(value: unknown) {
      calls.push("context");
      assert.deepEqual(value, { quests: options.quests, openedId: null, filter: options.filter, detailExtras: options.detailExtras });
    } },
    "./useShowQuiz": { useShowQuiz: () => calls.push("quiz") },
    "./useShowChoices": { useShowChoices: () => calls.push("choices") },
    "./useUpdateQuestFilter": { useUpdateQuestFilter(handler: unknown) {
      calls.push("filter"); assert.equal(handler, options.updateFilter);
    } },
    "./useUpdateQuestDetail": { useUpdateQuestDetail(handler: unknown) {
      calls.push("detail"); assert.equal(handler, options.updateDetail);
    } },
    "./useReloadQuests": { useReloadQuests(value: unknown) {
      calls.push("reload"); assert.deepEqual(value, { reloadQuests: options.reloadQuests, shareQuestBoard });
    } },
    "./useChatSuggestions": { useChatSuggestions: () => calls.push("suggestions") },
  });
  useCopilotKitIntegration(options);
  assert.deepEqual(calls, ["state", "context", "quiz", "choices", "filter", "detail", "reload", "suggestions"]);
});

test("useQuestActionsはProviderから渡された操作をそのまま返す", () => {
  const actions: QuestActions = {
    statusOf: () => "cleared", isReview: () => true,
    clear() {}, recordAnswer() {}, open() {}, focusChat() {},
  };
  let received: QuestActions | undefined;
  function Consumer() {
    received = useQuestActions();
    return null;
  }
  renderToStaticMarkup(createElement(QuestActionsContext.Provider, {
    value: actions, children: createElement(Consumer),
  }));
  assert.equal(received, actions);
});
