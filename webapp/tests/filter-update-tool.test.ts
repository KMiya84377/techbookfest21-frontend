import assert from "node:assert/strict";
import test from "node:test";
import type { ReactElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as filters from "../src/lib/quests/filter";
import { parseToolResult, type ToolResultProps } from "../src/lib/copilotkit/toolResult";
import { Alert, AlertTitle } from "../src/components/ui/alert";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

interface FilterTool {
  name: string;
  handler: (patch: filters.FilterPatch) => Promise<filters.FilterChange>;
  render: (props: ToolResultProps) => ReactElement;
}

async function registerTool(updateFilter: (patch: filters.FilterPatch) => filters.FilterChange) {
  let tool: FilterTool | undefined;
  const { useUpdateQuestFilter } = await loadIsolatedModule<
    typeof import("../src/hooks/frontend-tool/useUpdateQuestFilter")
  >("src/hooks/frontend-tool/useUpdateQuestFilter.tsx", {
    "@copilotkit/react-core/v2": {
      useFrontendTool(value: FilterTool) { tool = value; },
    },
    "react/jsx-runtime": jsxRuntime,
    "../../lib/quests/filter": filters,
    "../../lib/copilotkit/toolResult": { parseToolResult },
    "../../components/ui/alert": { Alert, AlertTitle },
  });
  useUpdateQuestFilter(updateFilter);
  assert.ok(tool);
  return tool;
}

test("検索条件の変更を処理へ渡し、変更前後と件数をチャットに表示する", async () => {
  const patch = { services: ["Lambda"], sinceDays: 7 };
  const change = { before: ["未着手"], after: ["Lambda", "直近7日"], count: 2, total: 5 };
  const tool = await registerTool(value => {
    assert.equal(value, patch);
    return change;
  });
  assert.equal(tool.name, "update_quest_filter");
  assert.equal(await tool.handler(patch), change);
  const html = renderToStaticMarkup(tool.render({ status: "complete", result: JSON.stringify(change) }));
  for (const text of ["メイン領域を更新しました", "未着手", "Lambda / 直近7日", "2 件(全 5 件)"]) {
    assert.ok(html.includes(text), text);
  }
  assert.match(html, /role="status"/);
});

test("検索条件なし・0件・結果の未到着や不正なJSONでも従来の表示を維持する", async () => {
  const change = { before: [], after: [], count: 0, total: 0 };
  const tool = await registerTool(() => change);
  const html = (status: string, result?: string) => renderToStaticMarkup(tool.render({ status, result }));
  const empty = html("complete", JSON.stringify(change));
  assert.equal((empty.match(/条件なし/g) ?? []).length, 2);
  assert.ok(empty.includes("0 件(全 0 件)"));
  assert.match(html("executing"), /メイン領域を更新しています…/);
  assert.match(html("complete", "{"), /メイン領域を更新しました/);
});
