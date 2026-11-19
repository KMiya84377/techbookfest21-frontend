import assert from "node:assert/strict";
import test from "node:test";
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GenericBinder,
  SurfaceModel,
  ComponentContext,
  ComponentModel,
} from "@a2ui/web_core/v0_9";
import {
  reportCatalog,
  ReportBarChart,
} from "../src/components/generative-ui/ReportCatalog";
import { reportCatalogSchema } from "../src/lib/generative-ui/reportCatalog";

const render = (props: unknown) =>
  renderToStaticMarkup(createElement(ReportBarChart, { props }));

function components(node: ReactNode): ReactElement<Record<string, any>>[] {
  if (!isValidElement<Record<string, any>>(node)) return [];
  return [node, ...Children.toArray(node.props.children).flatMap(components)];
}

test("描画はRechartsへ委ね、データ・軸・ラベル・単位を渡す", () => {
  const items = [{ label: "月", value: 0 }, { label: "火", value: 5 }];
  const props = { items, unit: "件", maxValue: 2, accessibleLabel: "日別の学習件数" };
  const nodes = components(ReportBarChart({ props }));
  const find = (type: unknown) => nodes.find((node) => node.type === type)!;
  assert.equal(find(ResponsiveContainer).props.width, "100%");
  assert.deepEqual(find(BarChart).props.data, items);
  assert.equal(find(XAxis).props.dataKey, "label");
  assert.deepEqual(find(YAxis).props.domain, [0, 5]);
  assert.equal(find(YAxis).props.allowDecimals, false);
  assert.equal(find(Bar).props.dataKey, "value");
  assert.equal(find(Bar).props.isAnimationActive, false);
  assert.equal(find(LabelList).props.dataKey, "value");
  assert.deepEqual(find(Tooltip).props.formatter(5), ["5件", "学習数"]);
  assert.match(render(props), /日別の学習件数/);
  assert.match(render(props), /recharts-responsive-container/);
});

test("7件以外の期間と全件0を扱い、データの値を変更しない", () => {
  const items = Array.from({ length: 14 }, (_, i) => ({ label: `${i + 1}日`, value: 0 }));
  const props = { items, maxValue: 20 };
  const nodes = components(ReportBarChart({ props }));
  const chart = nodes.find((node) => node.type === BarChart)!;
  assert.deepEqual(chart.props.data, items);
  assert.equal(chart.props.data.length, 14);
  assert.deepEqual(nodes.find((node) => node.type === YAxis)!.props.domain, [0, 20]);
  const html = render(props);
  assert.match(html, /14日: 0/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("レポートのデータが未到着・不正でも描画が落ちず、0件と偽らない", () => {
  for (const props of [
    undefined,
    {},
    { items: null },
    { items: {} },
    { items: [null] },
    { items: [{ label: "月", value: "3" }] },
    { items: [{ label: "月", value: Infinity }] },
  ]) {
    assert.match(render(props), /データが揃っていません/);
  }
  assert.match(render({ items: [] }), /表示するデータがありません/);
  const html = render({
    items: [
      { label: "月", value: 0 },
      { label: "火", value: 3 },
    ],
    unit: "件",
  });
  assert.match(html, /月: 0件/);
  assert.match(html, /火: 3件/);
  assert.doesNotMatch(html, /NaN|Infinity|データが揃っていません/);
});

test("AIへ渡すJSON Schemaに配列要素のlabelとvalueの定義を含める", () => {
  const props = reportCatalogSchema[0].props as any;
  assert.equal(props.properties.items.anyOf[0].type, "array");
  assert.equal(
    props.properties.items.anyOf[0].items.properties.label.anyOf[0].type,
    "string",
  );
  assert.equal(
    props.properties.items.anyOf[0].items.properties.value.anyOf[0].type,
    "number",
  );
  assert.ok(props.required.includes("items"));
});

test("実際のA2UI Binderで未到着→更新とデータモデル参照を描画できる", () => {
  const surface = new SurfaceModel("report", reportCatalog);
  surface.componentsModel.addComponent(
    new ComponentModel("chart", "BarChart", {}),
  );
  const context = new ComponentContext(surface, "chart");
  const binder = new GenericBinder(
    context,
    reportCatalog.components.get("BarChart")!.schema,
  );
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
