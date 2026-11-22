export const AGENT_RUNTIME_PARAMETER = "/quest-board/chat-runtime-arn";

// ニュースのフィード名(Python 側は chat-agent/chat/tools.py と batch-agent/batch/tools.py の NEWS_FEED。tests/shared-constants.test.ts が一致を確認する)
export const NEWS_FEED = "aws-whats-new";

// Webスタックの名前と、BlocksのBlockのスコープ・id。
// DynamoDBのテーブル名は、<スタック名>-<スコープ名>-<id>で決まる(KVStoreの仕様。idを変えると、名前も変わる)。
// index.cdk.tsは、この定数からテーブル名を作り、エージェントのスタックへ渡す。
export const WEB_STACK_NAME = "QuestBoardWeb";
export const BLOCKS_SCOPE = "quests";
export const NEWS_TABLE_ID = "news";
export const USER_QUESTS_TABLE_ID = "user-quests";
export const USER_SETTINGS_TABLE_ID = "user-settings";
