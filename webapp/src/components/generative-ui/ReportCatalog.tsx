import { createCatalog } from "@copilotkit/a2ui-renderer";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  REPORT_CATALOG_ID,
  reportCatalogDefinitions,
  reportBarChartValuesSchema,
} from "../../lib/generative-ui/reportCatalog";

// A2UIの入力を検証し、棒・軸・ラベルの描画はRechartsへ任せる。
export function ReportBarChart({ props }: { props: unknown }) {
  const result = reportBarChartValuesSchema.safeParse(props);
  if (!result.success) {
    return <p role="status">棒グラフのデータが揃っていません。</p>;
  }
  const { items, maxValue, unit = "", accessibleLabel } = result.data;
  if (!items.length) {
    return <p role="status">棒グラフに表示するデータがありません。</p>;
  }
  const max = items.reduce(
    (highest, item) => Math.max(highest, item.value),
    maxValue ?? 1,
  );

  return (
    <div
      className="my-[10px] min-w-0 text-[var(--ink)]"
      role="group"
      aria-label={accessibleLabel ?? "棒グラフ"}
    >
      <ResponsiveContainer
        width="100%"
        height={180}
        minWidth={0}
        initialDimension={{ width: 300, height: 180 }}
      >
        <BarChart
          data={items}
          margin={{ top: 24, right: 8, bottom: 0, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--ink)", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
          />
          <YAxis
            domain={[0, max]}
            allowDecimals={false}
            width={28}
            tick={{ fill: "var(--ink)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(value) => [`${value}${unit}`, "学習数"]}
            contentStyle={{
              backgroundColor: "var(--paper)",
              borderColor: "var(--line)",
              color: "var(--ink)",
              fontSize: 12,
            }}
          />
          <Bar
            dataKey="value"
            name="学習数"
            fill="var(--wax)"
            maxBarSize={28}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="top"
              fill="var(--ink)"
              fontSize={10}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* グラフを操作せずに各数値を確認できる、読み上げ用の一覧。 */}
      <ul className="sr-only" aria-label="棒グラフの数値">
        {items.map((item, index) => (
          <li
            key={`${index}-${item.label}`}
          >{`${item.label}: ${item.value}${unit}`}</li>
        ))}
      </ul>
    </div>
  );
}

export const reportCatalog = createCatalog(
  reportCatalogDefinitions,
  { BarChart: ReportBarChart },
  { catalogId: REPORT_CATALOG_ID, includeBasicCatalog: true },
);
