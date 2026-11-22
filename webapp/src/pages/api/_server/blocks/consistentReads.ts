import { getSdkIdentifiers } from "aws-cdk-blocks";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

let client: DynamoDBDocumentClient | undefined;

function getDatabaseClient(): DynamoDBDocumentClient {
  if (!client) {
    client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }
  return client;
}

function getTableName(block: { fullId: string }): string {
  return getSdkIdentifiers(block).tableName;
}

export function isAwsBlock(block: { fullId: string }): boolean {
  const tableName = getTableName(block);
  return !tableName.startsWith("mock-");
}

// KVStoreのget()は、既定で強い整合性の読み取りになる(READMEで確認)。
// 一方、query()は結果整合性のため、保存直後の一覧が必要な読み取りは、AWS上だけ同じテーブルを直接、強い整合性で読む。
// ブロックの内部用の項目(_bkv_で始まる名前)は、取り除く。
export async function listConsistentUserItems(
  block: { fullId: string },
  userId: string,
  prefix: string,
) {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;

  let keyCondition = "userId = :user";
  const values: Record<string, string> = { ":user": userId };
  if (prefix) {
    keyCondition += " AND begins_with(newsId, :prefix)";
    values[":prefix"] = prefix;
  }

  // 一度で全件を取得できない場合は、次のページも読む。
  do {
    const command = new QueryCommand({
      TableName: getTableName(block),
      ConsistentRead: true,
      ExclusiveStartKey: startKey,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: values,
    });
    const result = await getDatabaseClient().send(command);
    for (const item of result.Items ?? []) {
      items.push(
        Object.fromEntries(
          Object.entries(item).filter(([name]) => !name.startsWith("_bkv_")),
        ),
      );
    }
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items;
}
