// ローカルのBlocks保存領域だけを初期化する。開発サーバーを起動する前に実行する。
import { news } from "../../cdk-blocks/storage";
import { buildSampleQuests } from "../sampleQuests";
import { isConditionalWriteConflict } from "../../src/pages/api/_server/blocks/userQuestRecords";
import { toNewsItem } from "../../src/pages/api/_server/quests/newsItem";

if (
  process.env.BLOCKS_STACK_NAME ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.execArgv.some((arg) => arg.includes("aws-runtime"))
)
  throw new Error("このseedコマンドはローカル専用です");

for (const quest of buildSampleQuests()) {
  try {
    const item = toNewsItem(quest) as Parameters<typeof news.put>[1];
    await news.put({ newsId: quest.id }, item, { ifNotExists: true });
  } catch (error) {
    // すでにあるニュースは上書きしない
    if (!isConditionalWriteConflict(error)) throw error;
  }
}

console.log("ローカルのBlocksへサンプルニュースを保存しました");
