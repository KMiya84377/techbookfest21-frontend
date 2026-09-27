import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Quest } from "../data/quests";
import { outputs } from "./outputs";
import { toQuest, type QuestItem } from "./questItem";

// Quests テーブルの名前
//   QUEST_TABLE があればそれを、なければ amplify_outputs.json の値を使う
const tableName =
  process.env.QUEST_TABLE ??
  (import.meta.env.QUEST_TABLE as string | undefined) ??
  outputs?.custom?.questTableName;

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: outputs?.auth.aws_region }),
);

// ユーザーのクエストを、公開日時の新しい順に返す
export async function listQuests(userId: string): Promise<Quest[]> {
  if (!tableName) {
    throw new Error(
      "Quests テーブルの名前がありません。QUEST_TABLE を設定するか、バックエンドをデプロイして amplify_outputs.json を更新してください",
    );
  }
  const result = await client.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "userId = :u",
      ExpressionAttributeValues: { ":u": userId },
      ScanIndexForward: false,
      Limit: 200,
    }),
  );
  return (result.Items as QuestItem[] | undefined)?.map(toQuest) ?? [];
}

// ユーザーが所有するクエストの状態を保存する
// questId は、一覧取得と同じ「公開日時#ニュースの ID」で組み立てる
export async function updateQuestState(
  userId: string,
  quest: Pick<Quest, "id" | "publishedAt">,
  status: "viewed" | "cleared",
  review?: boolean,
): Promise<void> {
  if (!tableName) {
    throw new Error(
      "Quests テーブルの名前がありません。QUEST_TABLE を設定するか、バックエンドをデプロイして amplify_outputs.json を更新してください",
    );
  }

  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = { ":status": status };
  let updateExpression = "SET #status = :status";

  if (review !== undefined) {
    names["#review"] = "review";
    values[":review"] = review;
    updateExpression += ", #review = :review";
  }

  await client.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        userId,
        questId: `${quest.publishedAt}#${quest.id}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ConditionExpression: "attribute_exists(userId) AND attribute_exists(questId)",
    }),
  );
}
