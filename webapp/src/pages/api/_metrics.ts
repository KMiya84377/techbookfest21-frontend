import { Metrics } from "@aws-blocks/blocks";
import { scope } from "../../../aws-blocks/storage";
import { logApiRequest } from "./_logger";

// サーバー(Astro の SSR)側のメトリクス。1行の EMF(埋め込みメトリクス形式)の JSON を標準出力に出し、
// Lambda のログが CloudWatch Logs に送られると、CloudWatch がメトリクスにする(追加の設定は不要)。
// 費用は「メトリクス名 × 次元の組み合わせ」の数で決まるので、次元は service だけにして3つに絞る。
// route ごとの内訳は、リクエストごとのログ(logApiRequest)を Logs Insights で集計して見る。
const metrics = new Metrics(scope, "ssr-metrics", {
  namespace: "QuestBoard/Web",
  defaultDimensions: { service: "ssr" },
});

// API の1リクエストの結果を記録する。ApiRequests は全件、ApiErrors は 5xx なら1・それ以外は0
// (合計が件数、平均がエラー率になる)、ApiLatency は処理時間
function recordApiRequest(route: string, status: number, durationMs: number) {
  const duration = Math.round(durationMs);
  metrics.emitBatch([
    { name: "ApiRequests", value: 1, unit: "Count" },
    { name: "ApiErrors", value: status >= 500 ? 1 : 0, unit: "Count" },
    { name: "ApiLatency", value: duration, unit: "Milliseconds" },
  ]);
  logApiRequest(route, status, duration);
}

// run を実行して、結果を記録する。例外で終わったときは 5xx 扱いにして、例外はそのまま投げ直す。
// 処理時間は、レスポンスが返るまで(ストリーミングの応答は、最初の応答が返るまで)
export async function measureApi(route: string, run: () => Promise<Response>): Promise<Response> {
  const startedAt = performance.now();
  let status = 500;
  try {
    const response = await run();
    status = response.status;
    return response;
  } finally {
    recordApiRequest(route, status, performance.now() - startedAt);
  }
}
