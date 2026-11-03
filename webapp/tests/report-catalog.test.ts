import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GenericBinder, SurfaceModel, ComponentContext, ComponentModel } from "@a2ui/web_core/v0_9";
import { reportCatalog, ReportBarChart } from "../src/components/generative-ui/ReportCatalog";
import { reportCatalogSchema } from "../src/lib/generative-ui/reportCatalog";

const render = (props: unknown) => renderToStaticMarkup(createElement(ReportBarChart, { props }));

test("レポートのデータが未到着・不正でも描画が落ちず、0件と偽らない", () => {
  for (const props of [undefined, {}, { items: null }, { items: {} }, { items: [null] }, { items: [{ label: "月", value: "3" }] }, { items: [{ label: "月", value: Infinity }] }]) {
    assert.match(render(props), /データが揃っていません/);
  }
  assert.match(render({ items: [] }), /表示するデータがありません/);
  const html = render({ items: [{ label: "月", value: 0 }, { label: "火", value: 3 }], unit: "件" });
  assert.match(html, /月: 0件/);
  assert.match(html, /火: 3件/);
  assert.doesNotMatch(html, /NaN|Infinity|データが揃っていません/);
});

test("AIへ渡すJSON Schemaに配列要素のlabelとvalueの定義を含める", () => {
  const props = reportCatalogSchema[0].props as any;
  assert.equal(props.properties.items.anyOf[0].type, "array");
  assert.equal(props.properties.items.anyOf[0].items.properties.label.anyOf[0].type, "string");
  assert.equal(props.properties.items.anyOf[0].items.properties.value.anyOf[0].type, "number");
  assert.ok(props.required.includes("items"));
});

test("実際のA2UI Binderで未到着→更新とデータモデル参照を描画できる", () => {
  const surface = new SurfaceModel("report", reportCatalog);
  surface.componentsModel.addComponent(new ComponentModel("chart", "BarChart", {}));
  const context = new ComponentContext(surface, "chart");
  const binder = new GenericBinder(context, reportCatalog.components.get("BarChart")!.schema);
  const subscription = binder.subscribe(() => {});
  assert.match(render(binder.snapshot), /データが揃っていません/);
  surface.dataModel.set("/daily", [{ label: "月", value: 2 }]);
  context.componentModel.properties = { items: { path: "/daily" }, unit: "件" };
  assert.match(render(binder.snapshot), /月: 2件/);
  surface.dataModel.set("/daily", [{ label: "月", value: 4 }]);
  assert.match(render(binder.snapshot), /月: 4件/);
  subscription.unsubscribe();
  binder.dispose();
});
