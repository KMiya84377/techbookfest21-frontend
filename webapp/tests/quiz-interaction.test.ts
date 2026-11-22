import assert from "node:assert/strict";
import test from "node:test";
import * as jsxRuntime from "react/jsx-runtime";
import { z } from "zod";
import { parseToolResult } from "../src/lib/copilotkit/toolResult";
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

async function quizScenario(submittedAnswerJson?: string) {
  const harness = hookHarness();
  const responses: unknown[] = [];
  const records: unknown[] = [];
  const clears: unknown[] = [];
  const messages: unknown[] = [];
  let runs = 0;
  const agent = {
    isRunning: false,
    addMessage(message: unknown) { messages.push(message); },
  };
  const { default: Quiz } = await loadIsolatedModule<
    typeof import("../src/components/human-in-the-loop/Quiz")
  >("src/components/human-in-the-loop/Quiz.tsx", {
    react: harness.react,
    "react/jsx-runtime": jsxRuntime,
    zod: { z },
    "@copilotkit/react-core/v2": {
      UseAgentUpdate: { OnRunStatusChanged: "run-status" },
      useAgent: () => ({ agent }),
      useCopilotKit: () => ({ copilotkit: { runAgent: async () => { runs++; } } }),
    },
    "../../lib/copilotkit/toolResult": { parseToolResult },
    "../ui/button": { Button: "button" },
    "../chat/ChatCard": { __esModule: true, default: "chat-card" },
    "./OptionButtons": { __esModule: true, default: "options" },
    "../../hooks/useQuestActions": {
      useQuestActions: () => ({
        statusOf: () => "todo", isReview: () => false,
        recordAnswer: (id: string, correct: boolean) => records.push({ id, correct }),
        clear: (id: string, review: boolean) => clears.push({ id, review }),
        open() {}, focusChat() {},
      }),
    },
  });
  const props = {
    questId: "quest", question: "問題", options: ["誤答", "正答"],
    answer: 1, explanation: "解説", result: submittedAnswerJson,
    respond: async (answer: unknown) => { responses.push(answer); },
  };
  const render = () => harness.render(() => Quiz(props));
  function button(label: string) {
    const found = elements(render()).find(element =>
      element.type === "button" && element.props.children === label);
    assert.ok(found, `ボタンが見つかりません: ${label}`);
    return found.props;
  }
  return {
    props, agent, responses, records, clears, messages, render, button,
    get runs() { return runs; },
    select(index: number) {
      const options = elements(render()).find(element => element.type === "options")!;
      const select = options.props.onSelectionChange as (ids: string[]) => void;
      select([String(index)]);
    },
    click(label: string) { return (button(label).onClick as () => void | Promise<void>)(); },
    optionsDisabled() {
      return elements(render()).find(element => element.type === "options")!.props.disabled;
    },
  };
}

test("クイズは初回回答だけを送信・保存し、再回答しても初回の正誤を変えない", async () => {
  const s = await quizScenario();
  assert.equal(s.button("回答する").disabled, true);
  s.select(0);
  s.click("回答する");
  assert.deepEqual(s.responses, [{ selectedIndex: 0, selectedOption: "誤答", correct: false }]);
  assert.deepEqual(s.records, [{ id: "quest", correct: false }]);
  assert.equal(s.optionsDisabled(), true);
  s.click("もう一度答える");
  assert.equal(s.optionsDisabled(), false);
  s.select(1);
  s.click("回答する");
  assert.equal(s.responses.length, 1);
  assert.equal(s.records.length, 1);
  const texts = elements(s.render()).flatMap(element => [element.props.children]);
  assert.ok(texts.some(text => Array.isArray(text) && text.includes("不正解")));
  s.click("クエストをクリアする");
  assert.deepEqual(s.clears, [{ id: "quest", review: false }]);
});

test("復元した初回回答があれば、画面で答え直しても再送・再保存しない", async () => {
  const s = await quizScenario(JSON.stringify({
    selectedIndex: 1, selectedOption: "正答", correct: true,
  }));
  s.select(0);
  s.click("回答する");
  assert.equal(s.responses.length, 0);
  assert.equal(s.records.length, 0);
  s.click("クエストをクリアする");
  assert.deepEqual(s.clears, [{ id: "quest", review: true }]);
});

test("追加出題はチャットとして送り、実行中なら依頼しない", async () => {
  const s = await quizScenario();
  s.select(1);
  s.click("回答する");
  await s.click("もう一問");
  assert.equal(s.messages.length, 1);
  assert.equal(s.runs, 1);
  s.agent.isRunning = true;
  assert.equal(s.button("もう一問").disabled, true);
  await s.click("もう一問");
  assert.equal(s.messages.length, 1);
  assert.equal(s.runs, 1);
});

test("正解番号が選択肢の範囲外なら、問題を作成中の表示を保つ", async () => {
  const s = await quizScenario();
  s.props.answer = 5;
  const ui = s.render() as unknown as Element;
  assert.equal(ui.props.loading, true);
  assert.equal(elements(ui).some(element => element.type === "options"), false);
  assert.equal(s.responses.length, 0);
  assert.equal(s.records.length, 0);
});
