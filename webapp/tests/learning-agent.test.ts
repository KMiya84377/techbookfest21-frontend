import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import type { HttpAgentFetchFn } from "@ag-ui/client";
import { collectConnections, CONNECTIONS_TOOL } from "../src/server/learning/collectConnections.ts";
import type { LearningEntry } from "../src/lib/learning/model.ts";

// tsxのESM解決がfast-json-patchの未配布TSソースを選ぶため、公開CJSエントリを使う。
const { HttpAgent } = createRequire(import.meta.url)("@ag-ui/client") as typeof import("@ag-ui/client");

const history: LearningEntry[] = ["a", "b"].map((questId) => ({ questId, title: questId, summary: "学習内容", services: [], learnedAt: "2026-10-24", review: false }));
const result = { hasConnections: true, title: "関係図", summary: "２件の関係", nodes: [{ questId: "a", note: "A" }, { questId: "b", note: "B" }], edges: [{ from: "a", to: "b", label: "関連" }] };

function agentFor(output: unknown, error = false, missing = false) {
  const fetch: HttpAgentFetchFn = async (_url, init) => {
    const input = JSON.parse(init.body as string);
    assert.equal(input.forwardedProps.learningReview, true);
    assert.deepEqual(input.tools.map((tool: { name: string }) => tool.name), [CONNECTIONS_TOOL]);
    assert.deepEqual(JSON.parse(input.context[0].value), history);
    const args = JSON.stringify(output);
    const events = [
      { type: "RUN_STARTED", threadId: input.threadId, runId: input.runId },
      ...(error ? [{ type: "RUN_ERROR", message: "model failed" }] : [
        ...(!missing ? [
          { type: "TOOL_CALL_START", toolCallId: "t1", toolCallName: CONNECTIONS_TOOL },
          { type: "TOOL_CALL_ARGS", toolCallId: "t1", delta: args.slice(0, 30) },
          { type: "TOOL_CALL_ARGS", toolCallId: "t1", delta: args.slice(30) },
          { type: "TOOL_CALL_END", toolCallId: "t1" },
        ] : []),
        { type: "RUN_FINISHED", threadId: input.threadId, runId: input.runId },
      ]),
    ];
    return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } });
  };
  return new HttpAgent({ url: "http://unused.test/agui", fetch });
}

test("実際のAG-UIクライアントで分割されたツール引数を受信する", async () => assert.deepEqual(await collectConnections(agentFor(result), history), result));
test("AG-UI実行エラーを通知データとして保存しない", async () => assert.rejects(() => collectConnections(agentFor(result, true), history)));
test("ツール呼び出しがない応答を成功にしない", async () => assert.rejects(() => collectConnections(agentFor(result, false, true), history)));
test("モデルが返した架空のニュースを拒否する", async () => assert.rejects(() => collectConnections(agentFor({ ...result, nodes: [{ questId: "other", note: "偽" }] }), history)));
test("関係が見つからない応答も受信できる", async () => {
  const none = { hasConnections: false, title: "関連なし", summary: "関係の根拠がありません", nodes: [], edges: [] };
  assert.deepEqual(await collectConnections(agentFor(none), history), none);
});
