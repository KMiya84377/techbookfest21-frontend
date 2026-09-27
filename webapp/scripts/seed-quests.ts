// サンプルのクエストを、Quests テーブルに入れる
//   使い方: npm run seed -- <ユーザー ID(Cognito の sub)>
//   テーブル名とリージョンは、amplify_outputs.json から読む(QUEST_TABLE でも指定できる)
import { existsSync, readFileSync } from "node:fs";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { buildSampleQuests } from "../src/data/sampleQuests";
import { toItem } from "../src/lib/questItem";

const userId = process.argv[2];
if (!userId) {
  console.error("使い方: npm run seed -- <ユーザー ID(Cognito の sub)>");
  process.exit(1);
}

const outputs = existsSync("amplify_outputs.json")
  ? JSON.parse(readFileSync("amplify_outputs.json", "utf-8"))
  : undefined;
const tableName: string | undefined =
  process.env.QUEST_TABLE ?? outputs?.custom?.questTableName;
if (!tableName) {
  console.error("テーブル名がありません。QUEST_TABLE を設定するか、バックエンドをデプロイしてください");
  process.exit(1);
}

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: outputs?.auth?.aws_region }),
);
const items = buildSampleQuests().map((q) => toItem(userId, q));
await client.send(
  new BatchWriteCommand({
    RequestItems: { [tableName]: items.map((Item) => ({ PutRequest: { Item } })) },
  }),
);
console.log(`${items.length} 件のクエストを、${tableName} に入れました(ユーザー: ${userId})`);
