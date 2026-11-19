import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { HttpAgentFetchFn } from "@ag-ui/client";
import {
  learningUIArgsSchema,
  learningUISchema,
  restrictedLearningUIContent,
  LEARNING_UI_TOOL,
} from "../src/lib/learning/openGenerativeUI";
import type { LearningEntry, LearningInsight } from "../src/lib/learning/model";
import LearningDiagram from "../src/components/learning/LearningDiagram";

const { HttpAgent } = createRequire(import.meta.url)(
  "@ag-ui/client",
) as typeof import("@ag-ui/client");
// 既存のAG-UIテストと同じく、tsxがfast-json-patchの未配布TSを選ばないようCJSで読む。
const { collectLearningUI } = createRequire(import.meta.url)(
  "../src/server/learning/collectUI.ts",
) as typeof import("../src/server/learning/collectUI");
const history: LearningEntry[] = ["a", "b"].map((questId) => ({
  questId,
  title: questId,
  summary: "学習内容",
  services: [],
  learnedAt: "2026-11-19",
  review: false,
}));
const diagram = {
  hasConnections: true,
  title: "ニュースのつながり",
  summary: "関係の説明",
  nodes: [
    { questId: "a", note: "A" },
    { questId: "b", note: "B" },
  ],
  edges: [{ from: "a", to: "b", label: "関係" }],
};
const output = {
  initialHeight: 400,
  css: "body{color:#382c1d}",
  html: "<main><h2>ニュースのつながり</h2><svg viewBox='0 0 300 100'><text x='10' y='40'>A → B</text></svg></main>",
  jsFunctions: "function label(){return '関係'}",
  jsExpressions: ["document.body.dataset.ready='yes'"],
};

function agentFor(outputs: unknown[] = [output], error = false) {
  const fetch: HttpAgentFetchFn = async (_url, init) => {
    const input = JSON.parse(init.body as string);
    assert.equal(input.forwardedProps.learningUI, true);
    assert.equal(input.forwardedProps.learningReview, true);
    assert.deepEqual(
      input.tools.map((tool: { name: string }) => tool.name),
      [LEARNING_UI_TOOL],
    );
    assert.equal(input.messages.length, 1);
    const context = JSON.parse(input.context[0].value);
    assert.equal(context.designSkill, "テスト用のデザイン指示");
    assert.deepEqual(context.diagram, diagram);
    assert.deepEqual(context.sources, history);
    const events = [
      { type: "RUN_STARTED", threadId: input.threadId, runId: input.runId },
      ...outputs.flatMap((args, i) => {
        const data = JSON.stringify(args);
        return [
          {
            type: "TOOL_CALL_START",
            toolCallId: `ui-${i}`,
            toolCallName: LEARNING_UI_TOOL,
          },
          ...Array.from({ length: Math.ceil(data.length / 17) }, (_, n) => ({
            type: "TOOL_CALL_ARGS",
            toolCallId: `ui-${i}`,
            delta: data.slice(n * 17, (n + 1) * 17),
          })),
          { type: "TOOL_CALL_END", toolCallId: `ui-${i}` },
        ];
      }),
      ...(error
        ? [{ type: "RUN_ERROR", message: "生成失敗" }]
        : [
            {
              type: "RUN_FINISHED",
              threadId: input.threadId,
              runId: input.runId,
            },
          ]),
    ];
    return new Response(
      events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      { headers: { "content-type": "text/event-stream" } },
    );
  };
  const agent = new HttpAgent({ url: "http://unused.test/agui", fetch });
  agent.addMessage({ id: "private", role: "user", content: "通常の会話" });
  return agent;
}

test("公式middlewareが分割ツール引数から作った完成済みactivityを保存用に取得する", async () => {
  const agent = agentFor();
  const ui = await collectLearningUI(
    agent,
    diagram,
    history,
    "テスト用のデザイン指示",
  );
  assert.equal(ui.version, 1);
  assert.equal(ui.content.generating, false);
  assert.equal(ui.content.htmlComplete, true);
  assert.equal(ui.content.cssComplete, true);
  assert.equal(ui.content.html.join(""), output.html);
  assert.equal(ui.content.jsFunctions, output.jsFunctions);
  assert.deepEqual(ui.content.jsExpressions, output.jsExpressions);
  assert.deepEqual(
    agent.messages.map((message) => message.id),
    ["private"],
  );
});

test("エラー・結果なし・複数のUI・不正なコード量は通知として保存しない", async () => {
  for (const [outputs, error] of [
    [[output], true],
    [[], false],
    [[output, output], false],
    [[{ ...output, html: "" }], false],
    [[{ ...output, html: "a".repeat(60_001) }], false],
  ] as const) {
    await assert.rejects(() =>
      collectLearningUI(
        agentFor([...outputs], error),
        diagram,
        history,
        "テスト用のデザイン指示",
      ),
    );
  }
});

test("関連なし・未検証のニュースIDはUI生成に進めない", async () => {
  await assert.rejects(() =>
    collectLearningUI(
      agentFor(),
      { ...diagram, hasConnections: false, nodes: [], edges: [] },
      history,
      "",
    ),
  );
  await assert.rejects(() =>
    collectLearningUI(
      agentFor(),
      { ...diagram, nodes: [{ questId: "fake", note: "偽" }] },
      history,
      "",
    ),
  );
});

test("表示時のCSPを生成HTMLより前へ置き、外部・同一オリジン通信を許可しない", () => {
  const ui = learningUISchema.parse({
    version: 1,
    messageId: "test",
    content: {
      ...output,
      html: [output.html],
      generating: false,
      cssComplete: true,
      htmlComplete: true,
    },
  });
  const restricted = restrictedLearningUIContent(ui);
  assert.match(
    restricted.html[0],
    /^<head><meta http-equiv="Content-Security-Policy"/,
  );
  assert.match(restricted.html[0], /connect-src 'none'/);
  assert.match(restricted.html[0], /frame-src 'none'/);
  assert.ok(restricted.html[0].endsWith(output.html));
  assert.equal(ui.content.html[0], output.html);
});

test("未完了・過大サイズのactivityと未知の引数を拒否する", () => {
  const content = {
    initialHeight: 400,
    css: "",
    html: ["<p>図</p>"],
    generating: false,
    cssComplete: true,
    htmlComplete: true,
  };
  for (const patch of [
    { generating: true },
    { htmlComplete: false },
    { initialHeight: 10000 },
    { html: [" "] },
    { html: ["あ".repeat(59_000)] },
  ]) {
    assert.equal(
      learningUISchema.safeParse({
        version: 1,
        messageId: "x",
        content: { ...content, ...patch },
      }).success,
      false,
    );
  }
  assert.equal(
    learningUIArgsSchema.safeParse({ ...output, remoteFunction: "host" })
      .success,
    false,
  );
});

test("旧通知と不正なUIを消さず、文章で関係と根拠を表示する", () => {
  const insight: LearningInsight = {
    id: "old",
    batch: 1,
    reviewEvery: 5,
    createdAt: "2026-11-19",
    diagram,
    sources: history,
  };
  const render = (value: LearningInsight) =>
    renderToStaticMarkup(createElement(LearningDiagram, { insight: value }));
  assert.match(render(insight), /旧形式の通知/);
  assert.match(render(insight), /ニュース同士の関係/);
  assert.doesNotMatch(render(insight), /<svg|<iframe/);
  assert.match(
    render({ ...insight, ui: {} as any }),
    /図解のデータを読み込めません/,
  );
});
