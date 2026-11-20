import { getSdkIdentifiers } from "@aws-blocks/blocks";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

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

// DistributedTableにはConsistentRead指定がない(0.9.0の型定義で確認)。
// 排他・既読・設定の読み取りは、AWS上だけ同じテーブルを強い整合性で読む。
export async function getConsistentItem(
  block: { fullId: string },
  key: Record<string, unknown>,
) {
  const command = new GetCommand({
    TableName: getTableName(block),
    Key: key,
    ConsistentRead: true,
  });
  const result = await getDatabaseClient().send(command);
  return result.Item ?? null;
}

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
    items.push(...(result.Items ?? []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items;
}
