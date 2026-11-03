import assert from "node:assert/strict";
import test from "node:test";
import { basicCatalog } from "@copilotkit/a2ui-renderer";
import { MessageProcessor } from "@a2ui/web_core/v0_9";
import { createDetailTool } from "../src/lib/quests/detailTools";
import { DETAIL_CATALOG_ID, detailUpdateSchema, mergeSections, updateOpenedDetail, type DetailSection } from "../src/lib/quests/detailSections";
import { readFile } from "node:fs/promises";

const section = (id: string, text = "元情報を確認する"): DetailSection => ({
  id, title: "比較と影響", messages: [
    { version: "v0.9", createSurface: { surfaceId: id, catalogId: DETAIL_CATALOG_ID } },
    { version: "v0.9", updateComponents: { surfaceId: id, components: [
      { id: "root", component: "Column", children: ["heading", "compare", "divider", "impact"] },
      { id: "heading", component: "Text", text: "変更点", variant: "h3" },
      { id: "compare", component: "Row", children: ["before", "after"] },
      { id: "before", component: "Text", text: "これまで" },
      { id: "after", component: "Text", text: "更新後" },
      { id: "divider", component: "Divider" },
      { id: "impact", component: "Card", child: "note" },
      { id: "note", component: "Text", text },
    ] } },
  ],
});
const payload = () => ({ questId: "news-1", section: section("comparison") });

test("AIのA2UI構造を変換せずに詳細へ渡し、同じメッセージをチャットの結果にも返す", async () => {
  let stored: DetailSection | undefined;
  const tool = createDetailTool((questId, content) => {
    assert.equal(questId, "news-1");
    stored = content;
    return { added: [content.title], updated: [] };
  });
  const args = payload();
  const result = await tool.handler(args);
  assert.equal(tool.name, "update_quest_detail");
  assert.deepEqual(stored, args.section);
  assert.deepEqual(result.section, args.section);
  assert.equal(result.error, undefined);
  // A2UIの実際のプロセッサーへ、チャットと詳細を独立した表示として読み込む。
  for (const content of [stored!, result.section!]) {
    const processor = new MessageProcessor([basicCatalog]);
    processor.processMessages(content.messages);
    const surface = processor.model.getSurface(content.id)!;
    assert.equal(surface.componentsModel.get("root")!.type, "Column");
    assert.equal(surface.componentsModel.get("compare")!.type, "Row");
    assert.equal(surface.componentsModel.get("note")!.properties.text, "元情報を確認する");
    // 許可した部品のプロパティは公式カタログのスキーマにも適合する。
    for (const [, node] of surface.componentsModel.entries) {
      assert.ok(basicCatalog.components.get(node.type)!.schema.safeParse(node.properties).success, node.type);
    }
  }
});

test("循環・参照欠落・重複ID・異なるsurface・不許可の部品やコードを拒否し、画面を変更しない", async () => {
  let writes = 0;
  const tool = createDetailTool(() => { writes++; return { added: [], updated: [] }; });
  const cases = Array.from({ length: 9 }, payload) as any[];
  cases[0].section.messages[1].updateComponents.components[0].children = ["root"];
  cases[1].section.messages[1].updateComponents.components[0].children = ["missing"];
  cases[2].section.messages[1].updateComponents.components.push({ id: "note", component: "Text", text: "重複" });
  cases[3].section.messages[1].updateComponents.surfaceId = "other";
  cases[4].section.messages[1].updateComponents.components[1] = { id: "heading", component: "Image", url: "https://example.com/a.png" };
  cases[5].section.messages[1].updateComponents.components[1].html = "<script>alert(1)</script>";
  cases[6].section.messages.reverse();
  cases[7].section.messages[0].createSurface.catalogId = "https://example.com/unknown";
  cases[8].section.messages[1].updateComponents.components.push({ id: "orphan", component: "Text", text: "未参照" });
  for (const args of [...cases, { questId: "news-1", rows: [] }, { questId: "news-1", section: {} }]) {
    const result = await tool.handler(args);
    assert.ok(result.error);
    assert.equal(result.section, undefined);
    assert.deepEqual(result.added, []);
  }
  assert.equal(writes, 0);
});

test("開いていないニュースや存在しないニュースには追記しない", () => {
  const current = { "news-1": [section("existing")] };
  const quests = [{ id: "news-1", title: "ニュース1" }, { id: "news-2", title: "ニュース2" }];
  for (const [openId, questId] of [[null, "news-1"], ["news-2", "news-1"], ["missing", "missing"]]) {
    const result = updateOpenedDetail(current, quests, openId, questId!, section("new"));
    assert.equal(result.details, current);
    assert.ok(result.result.error);
  }
});

test("UI部品の多重参照や過剰な階層を拒否し、描画量を制限する", () => {
  const shared = payload();
  const message = shared.section.messages[1];
  if (!("updateComponents" in message)) throw new Error("fixture");
  message.updateComponents.components[0] = { id: "root", component: "Row", children: ["heading", "heading"] };
  assert.equal(detailUpdateSchema.safeParse(shared).success, false);
  const deep = payload();
  deep.section.messages[1] = { version: "v0.9", updateComponents: { surfaceId: "comparison", components: [
    ...Array.from({ length: 13 }, (_, i) => ({ id: i ? `node${i}` : "root", component: "Column" as const, children: [`node${i + 1}`] })),
    { id: "node13", component: "Text", text: "深すぎるUI" },
  ] } };
  assert.equal(detailUpdateSchema.safeParse(deep).success, false);
});

test("新IDは追記、同じIDはA2UIの構造ごと更新し、過去の追記を残す", () => {
  const original = section("comparison");
  const current = { "news-1": [original, section("impact")] };
  const updated = section("comparison", "比較を訂正");
  updated.messages[1] = { version: "v0.9", updateComponents: { surfaceId: "comparison", components: [
    { id: "root", component: "Card", child: "summary" },
    { id: "summary", component: "Text", text: "UI構造も変更できる" },
  ] } };
  assert.ok(detailUpdateSchema.safeParse({ questId: "news-1", section: updated }).success);
  const result = updateOpenedDetail(current, [{ id: "news-1", title: "ニュース1" }], "news-1", "news-1", updated);
  assert.deepEqual(result.details["news-1"].map((s) => s.id), ["comparison", "impact"]);
  assert.equal(result.details["news-1"][0], updated);
  assert.equal(result.details["news-1"][1], current["news-1"][1]);
  assert.equal(current["news-1"][0], original);
  const appended = mergeSections(result.details["news-1"], [section("note")]);
  assert.deepEqual(appended.sections.map((s) => s.id), ["comparison", "impact", "note"]);
});

test("不正・途中の引数は拒否し、UI構造を含むツール引数をJSON Schemaへ変換できる", () => {
  assert.equal(detailUpdateSchema.safeParse({ questId: "news-1" }).success, false);
  // CopilotKitはフロントエンドツールをJSON SchemaにしてAG-UI経由で渡す。
  const schema = JSON.stringify(createDetailTool(() => ({ added: [], updated: [] })).parameters.toJSONSchema());
  assert.match(schema, /createSurface/);
  assert.match(schema, /updateComponents/);
  assert.match(schema, /Column/);
});

test("モックの追記ツールもA2UI形式で、分割した引数を復元できる", async () => {
  const mock = JSON.parse(await readFile(new URL("../mock/aimock.json", import.meta.url), "utf8"));
  let count = 0;
  function walk(value: any) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value.events)) {
      for (const event of value.events) {
        if (event.type !== "TOOL_CALL_START" || event.toolCallName !== "update_quest_detail") continue;
        const args = value.events.filter((e: any) => e.type === "TOOL_CALL_ARGS" && e.toolCallId === event.toolCallId).map((e: any) => e.delta).join("");
        assert.ok(detailUpdateSchema.safeParse(JSON.parse(args)).success, event.toolCallId);
        count++;
      }
    }
    for (const item of Object.values(value)) walk(item);
  }
  walk(mock);
  assert.ok(count >= 4);
});
