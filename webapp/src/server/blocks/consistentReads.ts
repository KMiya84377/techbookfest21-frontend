import { getSdkIdentifiers } from "@aws-blocks/blocks";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

let client: DynamoDBDocumentClient | undefined;
const database = () => client ??= DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = (block: { fullId: string }) => getSdkIdentifiers(block).tableName;
export const isAwsBlock = (block: { fullId: string }) => !tableName(block).startsWith("mock-");

// 公開0.2.2のDistributedTableにはConsistentRead指定がない。
// 排他・既読・設定の読み取りは、AWS上だけ同じテーブルを強い整合性で読む。
export async function getConsistentItem(block: { fullId: string }, key: Record<string, unknown>) {
  return (await database().send(new GetCommand({ TableName: tableName(block), Key: key, ConsistentRead: true }))).Item ?? null;
}
export async function listConsistentUserItems(block: { fullId: string }, userId: string, prefix: string) {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const result = await database().send(new QueryCommand({
      TableName: tableName(block), ConsistentRead: true, ExclusiveStartKey: startKey,
      KeyConditionExpression: "userId = :user" + (prefix ? " AND begins_with(newsId, :prefix)" : ""),
      ExpressionAttributeValues: { ":user": userId, ...(prefix ? { ":prefix": prefix } : {}) },
    }));
    items.push(...(result.Items ?? []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);
  return items;
}
