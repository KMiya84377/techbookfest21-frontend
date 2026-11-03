import type { CatalogDefinitions } from "@copilotkit/a2ui-renderer";
import { zodToJsonSchema } from "zod-to-json-schema";
// A2UIのカタログAPIはZod v3のスキーマ型を受け取る。
import { z } from "zod/v3";

// A2UI のレポート部品カタログ。フロントとRuntimeで同じ定義を使う。
export const REPORT_CATALOG_ID = "https://myvault.example/a2ui/quest-report";

const binding = z.object({ path: z.string() });
const dynamicString = z.union([z.string(), binding]);
const dynamicNumber = z.union([z.number().finite(), binding]);

// 描画に使える値を検証する。未到着や不正な値を0件へ置き換えず、描画側で区別する。
export const reportBarChartValuesSchema = z.object({
  items: z.array(z.object({ label: z.string(), value: z.number().finite().nonnegative() })),
  maxValue: z.number().finite().positive().optional(),
  unit: z.string().optional(),
  accessibleLabel: z.string().optional(),
});

const rawReportCatalogDefinitions = {
  BarChart: {
    description: "カテゴリごとの数値を、横幅の限られた場所にも収まる棒グラフで表示する",
    props: z.object({
      items: z.union([z.array(
        z.object({
          label: dynamicString,
          value: dynamicNumber,
        }),
      ), binding]).describe("棒グラフの配列。各要素はlabel（文字列）とvalue（学習件数の数値）を持つ。データモデルの配列を参照する場合は{path: '/daily'}のように指定する。"),
      maxValue: dynamicNumber.optional(),
      unit: dynamicString.optional(),
      accessibleLabel: dynamicString.optional(),
    }),
  },
};

// アプリ本体のZod v4互換APIで定義し、A2UIのZod v3境界で受け渡す。
export const reportCatalogDefinitions =
  rawReportCatalogDefinitions as unknown as CatalogDefinitions;

// 1.73.3のextractSchemaは配列要素・オブジェクト内部を省略するため、完全なJSON Schemaを渡す。
export const reportCatalogSchema = Object.entries(rawReportCatalogDefinitions).map(([name, definition]) => ({
  name,
  description: definition.description,
  props: zodToJsonSchema(definition.props, { $refStrategy: "none" }),
}));
