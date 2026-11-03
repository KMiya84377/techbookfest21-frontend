// ローカルのBlocks保存領域だけを初期化する。開発サーバーを起動する前に実行する。
import { news } from "../aws-blocks/storage";
import { buildSampleQuests } from "../mock/sampleQuests";
import { toNewsItem } from "../src/server/quests/newsItem";
if (process.env.BLOCKS_STACK_NAME || process.env.AWS_LAMBDA_FUNCTION_NAME || process.execArgv.some((arg) => arg.includes("aws-runtime"))) throw new Error("このseedコマンドはローカル専用です");
for (const quest of buildSampleQuests()) {
  try { await news.put(toNewsItem(quest) as Parameters<typeof news.put>[0], { ifNotExists: true }); }
  catch (error) { if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") throw error; }
}
console.log("ローカルのBlocksへサンプルニュースを保存しました");
