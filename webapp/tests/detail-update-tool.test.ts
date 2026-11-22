import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as detailSections from "../src/lib/quests/detailSections";
import { applyDetailUpdate, type UpdateDetail } from "../src/lib/quests/detailTools";
import { parseToolResult, type ToolResultProps } from "../src/lib/copilotkit/toolResult";
import * as alerts from "../src/components/ui/alert";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

interface DetailTool {
  name: string;
  handler: (args: unknown) => Promise<detailSections.DetailUpdate>;
  render: (props: ToolResultProps) => React.ReactElement;
}

async function registerTool(updateDetail: UpdateDetail, rendered: detailSections.DetailSection[]) {
  let tool: DetailTool | undefined;
  const { useUpdateQuestDetail } = await loadIsolatedModule<
    typeof import("../src/hooks/frontend-tool/useUpdateQuestDetail")
  >("src/hooks/frontend-tool/useUpdateQuestDetail.tsx", {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@copilotkit/react-core/v2": {
      useFrontendTool(value: DetailTool) { tool = value; },
    },
    "../../lib/quests/detailSections": detailSections,
    "../../lib/quests/detailTools": { applyDetailUpdate },
    "../../lib/copilotkit/toolResult": { parseToolResult },
    "../../components/ui/alert": alerts,
    "../../components/generative-ui/DetailA2UI": {
      __esModule: true,
      default: ({ section }: { section: detailSections.DetailSection }) => {
        rendered.push(section);
        return React.createElement("div", { "data-surface-id": section.id });
      },
    },
  });
  useUpdateQuestDetail(updateDetail);
  assert.ok(tool);
  return tool;
}

test("詳細追記ツールは検証したA2UIを更新処理とチャットの表示へ渡す", async () => {
  const rendered: detailSections.DetailSection[] = [];
  const section: detailSections.DetailSection = {
    id: "comparison", title: "比較",
    messages: [
      { version: "v0.9", createSurface: { surfaceId: "comparison", catalogId: detailSections.DETAIL_CATALOG_ID } },
      { version: "v0.9", updateComponents: { surfaceId: "comparison", components: [{ id: "root", component: "Text", text: "変更点" }] } },
    ],
  };
  const tool = await registerTool((questId, value) => {
    assert.equal(questId, "news");
    assert.deepEqual(value, section);
    return { title: "ニュース", added: [value.title], updated: [] };
  }, rendered);
  assert.equal(tool.name, "update_quest_detail");
  const result = await tool.handler({ questId: "news", section });
  const html = renderToStaticMarkup(tool.render({ status: "complete", result: JSON.stringify(result) }));
  assert.match(html, /クエスト詳細を更新しました/);
  assert.match(html, /ニュース/);
  assert.match(html, /比較/);
  assert.deepEqual(rendered, [section]);
});

test("詳細追記の未到着・不正な結果・更新失敗を区別して表示する", async () => {
  const rendered: detailSections.DetailSection[] = [];
  const tool = await registerTool(() => ({ added: [], updated: [] }), rendered);
  const html = (status: string, result?: string) => renderToStaticMarkup(tool.render({ status, result }));
  assert.match(html("executing"), /クエスト詳細を更新しています…/);
  assert.match(html("complete", "{"), /追記の結果を確認できませんでした/);
  const failed = html("complete", JSON.stringify({ added: [], updated: [], error: "詳細が開かれていません" }));
  assert.match(failed, /クエスト詳細を更新できませんでした/);
  assert.match(failed, /詳細が開かれていません/);
  assert.equal(rendered.length, 0);
});
