import assert from "node:assert/strict";
import test from "node:test";
import * as jsxRuntime from "react/jsx-runtime";
import { z } from "zod";
import { clsx } from "cn";
import { parseToolResult } from "../src/lib/copilotkit/toolResult";
import * as settings from "../src/lib/userSettings/model";
import { hookHarness } from "./helpers/hookHarness";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

function elements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}

function find(node: unknown, type: string): Element {
  const element = elements(node).find(element => element.type === type);
  assert.ok(element, `${type}が見つかりません`);
  return element;
}

test("選択肢の送信中と回答済みは選べず、送信失敗時だけ再試行できる", async () => {
  const harness = hookHarness();
  const pending = Promise.withResolvers<void>();
  const sent: unknown[] = [];
  let fails = true;
  const { default: ChoicePrompt } = await loadIsolatedModule<
    typeof import("../src/components/human-in-the-loop/ChoicePrompt")
  >("src/components/human-in-the-loop/ChoicePrompt.tsx", {
    react: harness.react, "react/jsx-runtime": jsxRuntime, zod: { z },
    "../../lib/copilotkit/toolResult": { parseToolResult },
    "../ui/button": { Button: "button" },
    "../chat/ChatCard": { __esModule: true, default: "chat-card" },
    "./OptionButtons": { __esModule: true, default: "options" },
  });
  const options = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
  const props = {
    question: "どちら？", options, selectionMode: "single" as const,
    result: undefined as string | undefined,
    respond: async (selection: unknown) => {
      sent.push(selection);
      if (fails) throw new Error("failed");
      await pending.promise;
    },
  };
  const render = () => harness.render(() => ChoicePrompt(props));
  assert.equal(find(render(), "button").props.disabled, true);
  (find(render(), "options").props.onSelectionChange as Function)(["b"]);
  (find(render(), "button").props.onClick as Function)();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(render(), "options").props.disabled, false);
  assert.ok(elements(render()).some(element => element.props.role === "alert"));
  fails = false;
  (find(render(), "button").props.onClick as Function)();
  assert.equal(find(render(), "options").props.disabled, true);
  pending.resolve();
  await new Promise(resolve => setImmediate(resolve));
  props.result = JSON.stringify({ selectedOptions: [options[1]] });
  assert.equal(find(render(), "options").props.disabled, true);
  assert.equal(elements(render()).some(element => element.type === "button"), false);
  assert.deepEqual(sent, [
    { selectedOptions: [options[1]] }, { selectedOptions: [options[1]] },
  ]);
});

test("設定画面は編集中の値だけを保存し、保存失敗後も下書きを保つ", async () => {
  const harness = hookHarness();
  const pending = Promise.withResolvers<void>();
  const saved: settings.UserSettings[] = [];
  let fails = true;
  const { default: UserSettingsDialog } = await loadIsolatedModule<
    typeof import("../src/components/user-setting/UserSettingsDialog")
  >("src/components/user-setting/UserSettingsDialog.tsx", {
    react: harness.react, "react/jsx-runtime": jsxRuntime,
    "lucide-react": { Settings2Icon: "settings-icon" }, cn: { clsx },
    "../ui/button": { Button: "button" },
    "../../lib/userSettings/model": settings,
    "../ui/dialog": {
      Dialog: "dialog", DialogContent: "dialog-content",
      DialogDescription: "dialog-description", DialogTitle: "dialog-title",
    },
    "./UserSettingsFields": {
      ChoiceFieldset: "choice-field", LearningTopicsFieldset: "topics-field",
      LearningReviewIntervalFieldset: "interval-field",
    },
  });
  const props = {
    open: true, onOpenChange() {}, settings: { ...settings.DEFAULT_USER_SETTINGS },
    loading: false, loadError: null,
    onSave: async (value: settings.UserSettings) => {
      saved.push(value);
      if (fails) throw new Error("failed");
      await pending.promise;
    },
  };
  const render = () => harness.render(() => UserSettingsDialog(props));
  render();
  (find(render(), "interval-field").props.onChange as Function)(10);
  (find(render(), "topics-field").props.onToggle as Function)("serverless");
  const submit = () => (find(render(), "form").props.onSubmit as Function)({ preventDefault() {} });
  submit();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(saved[0]?.learningReviewEvery, 10);
  assert.deepEqual(saved[0]?.learningTopics, ["serverless"]);
  assert.deepEqual(props.settings, settings.DEFAULT_USER_SETTINGS);
  assert.ok(elements(render()).some(element => element.props.role === "alert"));
  assert.equal(find(render(), "interval-field").props.value, 10);
  fails = false;
  submit();
  assert.equal(find(render(), "interval-field").props.disabled, true);
  pending.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(render(), "interval-field").props.disabled, false);
  assert.ok(elements(render()).some(element => element.props.children === "設定を保存しました。"));
});

test("通知からニュース・図解を開くときだけ、フォーカスの受け渡しと既読保存を行う", async () => {
  const harness = hookHarness();
  const opened: string[] = [];
  const read: string[] = [];
  let failOpen = true;
  const pending = Promise.withResolvers<void>();
  const { default: LearningNotifications } = await loadIsolatedModule<
    typeof import("../src/components/learning/LearningNotifications")
  >("src/components/learning/LearningNotifications.tsx", {
    react: harness.react, "react/jsx-runtime": jsxRuntime,
    "@base-ui/react/popover": { Popover: {
      Root: "popover", Trigger: "trigger", Portal: "portal", Positioner: "positioner",
      Popup: "popup", Title: "title", Close: "close",
    } },
    "lucide-react": { BellIcon: "bell" }, "../ui/button": { Button: "button" },
    "../ui/dialog": {
      Dialog: "dialog", DialogContent: "dialog-content",
      DialogDescription: "dialog-description", DialogTitle: "dialog-title",
    },
    "./LearningDiagram": { __esModule: true, default: "diagram" },
    "./NewsNotificationList": { __esModule: true, default: "news-list" },
    "./LearningInsightList": { __esModule: true, default: "insight-list" },
  });
  const notification = { id: "new", questId: "quest", title: "新着", reason: "理由", createdAt: "now" };
  const insight = {
    id: "insight", batch: 1, reviewEvery: 5, createdAt: "now", sources: [],
    diagram: { hasConnections: false, title: "関連分析", summary: "結果", nodes: [], edges: [] },
  };
  const props = {
    insights: [insight], busy: false, error: null, news: [notification], newsBusy: false, newsError: null,
    onRetry: async () => {}, onCheckNews: async () => {},
    onRead: async () => { read.push("insight"); },
    onReadNews: async () => { read.push("news"); throw new Error("read failed"); },
    onOpenNews: async (id: string) => {
      opened.push(id);
      if (failOpen) throw new Error("open failed");
      await pending.promise;
    },
  };
  const render = () => harness.render(() => LearningNotifications(props));
  const openList = () => (find(render(), "popover").props.onOpenChange as Function)(true);
  const openNews = () => (find(render(), "news-list").props.onOpen as Function)(notification);
  const returnsFocus = () => (find(render(), "popup").props.finalFocus as Function)();
  openList();
  openNews();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(render(), "popover").props.open, true);
  assert.equal(find(render(), "news-list").props.openError, "open failed");
  assert.equal(returnsFocus(), true);
  assert.deepEqual(read, []);
  failOpen = false;
  openNews();
  openNews();
  assert.equal(find(render(), "news-list").props.opening, true);
  assert.deepEqual(opened, ["quest", "quest"], "開いている間の二重実行を防ぐ");
  pending.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(find(render(), "popover").props.open, false);
  assert.equal(returnsFocus(), false);
  assert.deepEqual(read, ["news"], "既読保存に失敗しても詳細は閉じない");
  openList();
  assert.equal(returnsFocus(), true);
  (find(render(), "insight-list").props.onOpen as Function)(insight);
  assert.equal(find(render(), "dialog").props.open, true);
  assert.equal(find(render(), "popover").props.open, false);
  assert.equal(returnsFocus(), false);
  assert.deepEqual(read, ["news", "insight"]);
});
