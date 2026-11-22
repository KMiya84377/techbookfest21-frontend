import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { Alert } from "../src/components/ui/alert";
import { parseToolResult, type ToolResultProps } from "../src/lib/copilotkit/toolResult";
import type { Quest } from "../src/lib/quests/model";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

interface ReloadTool {
  name: string;
  handler: () => Promise<{ count: number }>;
  render: (props: ToolResultProps) => ReactElement;
}

async function registerTool(
  reloadQuests: () => Promise<Quest[]>,
  shareQuestBoard: (quests: Quest[]) => void,
) {
  let registered: ReloadTool | undefined;
  const { useReloadQuests } = await loadIsolatedModule<
    typeof import("../src/hooks/frontend-tool/useReloadQuests")
  >("src/hooks/frontend-tool/useReloadQuests.tsx", {
    "@copilotkit/react-core/v2": {
      useFrontendTool(tool: ReloadTool) { registered = tool; },
    },
    "react/jsx-runtime": jsxRuntime,
    zod: { z },
    "../../lib/copilotkit/toolResult": { parseToolResult },
    "../../components/ui/alert": { Alert },
  });
  useReloadQuests({ reloadQuests, shareQuestBoard });
  assert.ok(registered);
  return registered;
}

test("再取得した一覧をそのまま共有し、件数をツール結果に返す", async () => {
  const latest: Quest[] = [];
  const calls: string[] = [];
  const tool = await registerTool(async () => {
    calls.push("reload");
    return latest;
  }, quests => {
    calls.push("share");
    assert.equal(quests, latest);
  });
  assert.equal(tool.name, "reload_quests");
  assert.deepEqual(await tool.handler(), { count: 0 });
  assert.deepEqual(calls, ["reload", "share"]);
});

test("再取得に失敗した場合は共有状態を変更しない", async () => {
  let shared = false;
  const tool = await registerTool(async () => {
    throw new Error("fetch failed");
  }, () => { shared = true; });
  await assert.rejects(tool.handler(), /fetch failed/);
  assert.equal(shared, false);
});

test("render内で更新中・完了件数・未到着や不正な結果を表示する", async () => {
  const tool = await registerTool(async () => [], () => {});
  for (const count of [0, 3]) {
    const html = renderToStaticMarkup(tool.render({ status: "complete", result: JSON.stringify({ count }) }));
    assert.ok(html.includes(`クエストボードを更新しました(${count} 件)`));
    assert.match(html, /role="status"/);
  }
  for (const result of [undefined, "{", '{"count":"3"}', "null"]) {
    assert.match(renderToStaticMarkup(tool.render({ status: "complete", result })), /クエストボードを更新しています…/);
  }
  assert.match(renderToStaticMarkup(tool.render({ status: "executing", result: '{"count":3}' })), /クエストボードを更新しています…/);
});
