import { Logger } from "@aws-blocks/blocks";
import { scope } from "../../../aws-blocks/storage";

// サーバー(Astro の SSR)側の共通ロガー。1行のJSONを標準出力に出し、Lambda が CloudWatch Logs に送る。
// ブラウザーのコードでは使えない(hooks/・components/ では console を使う)。
const logger = new Logger(scope, "ssr");

// API の1リクエスト用のロガー。全ログに route・requestId・userId が付く。
export function requestLogger(route: string, userId: string) {
  return logger.child({ route, requestId: crypto.randomUUID(), userId });
}

// API の1リクエストごとの記録(1行)。route・status 別の件数や処理時間を、Logs Insights で集計する:
//   filter message = "API リクエスト" | stats count(*), avg(durationMs), pct(durationMs, 99) by route, status
export function logApiRequest(route: string, status: number, durationMs: number) {
  logger.info("API リクエスト", { route, status, durationMs });
}
