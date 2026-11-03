import { createCatalog } from "@copilotkit/a2ui-renderer";
import {
  REPORT_CATALOG_ID,
  reportCatalogDefinitions,
  reportBarChartValuesSchema,
} from "../../lib/generative-ui/reportCatalog";

// 棒グラフ(7 本が横に並ぶ)のクラス
const CHART_CLASS =
  "my-[10px] mx-2 grid min-h-[132px] grid-cols-7 items-end gap-[6px] text-[var(--ink)]";
const COLUMN_CLASS =
  "grid min-w-0 grid-rows-[auto_86px_auto] items-end text-center";
const LABEL_CLASS =
  "overflow-hidden text-ellipsis whitespace-nowrap text-[10px]";
const VALUE_CLASS = `${LABEL_CLASS} text-[color-mix(in_srgb,var(--ink)_70%,transparent)]`;
const NAME_CLASS = `${LABEL_CLASS} mt-[5px] text-[var(--ink)]`;
const TRACK_CLASS =
  "flex h-[86px] w-full items-end justify-center border-b border-[var(--line)] px-1";
const BAR_CLASS = [
  "min-h-0 w-[min(22px,100%)] border border-b-0",
  "border-[color-mix(in_srgb,var(--wax)_72%,var(--ink))] bg-[var(--wax)]",
].join(" ");

export function ReportBarChart({ props }: { props: unknown }) {
  const result = reportBarChartValuesSchema.safeParse(props);
  if (!result.success) {
    return <p role="status">棒グラフのデータが揃っていません。</p>;
  }
  const { items, maxValue, unit = "", accessibleLabel } = result.data;
  if (!items.length) {
    return <p role="status">棒グラフに表示するデータがありません。</p>;
  }
  const max = Math.max(maxValue ?? 1, ...items.map((item) => item.value));

  return (
    <div
      className={CHART_CLASS}
      role="group"
      aria-label={accessibleLabel ?? "棒グラフ"}
    >
      {items.map((item, index) => {
        const height = item.value <= 0 ? 0 : Math.max((item.value / max) * 100, 4);
        return (
          <div
            className={COLUMN_CLASS}
            // ラベルと値は、エージェントの出力なので重なりうる。並び順で区別する
            key={`${index}-${item.label}`}
            aria-label={`${item.label}: ${item.value}${unit}`}
          >
            <span className={VALUE_CLASS}>
              {item.value}
              {unit}
            </span>
            <div className={TRACK_CLASS} aria-hidden="true">
              <div className={BAR_CLASS} style={{ height: `${height}%` }} />
            </div>
            <span className={NAME_CLASS}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export const reportCatalog = createCatalog(
  reportCatalogDefinitions,
  { BarChart: ReportBarChart },
  { catalogId: REPORT_CATALOG_ID, includeBasicCatalog: true },
);
