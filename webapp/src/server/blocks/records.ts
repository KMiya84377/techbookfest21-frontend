import {
  getConsistentItem,
  isAwsBlock,
  listConsistentUserItems,
} from "./consistentReads";
import { userQuests } from "../../../aws-blocks/storage";

type UserRecord = {
  userId: string;
  newsId: string;
  version: number;
  [key: string]: unknown;
};
export const conditionalFailure = (error: unknown) =>
  error instanceof Error && error.name === "ConditionalCheckFailedException";
export const getUserRecord = async <T extends object>(
  userId: string,
  newsId: string,
) =>
  (isAwsBlock(userQuests)
    ? await getConsistentItem(userQuests, { userId, newsId })
    : await userQuests.get({ userId, newsId })) as (T & UserRecord) | null;

export async function listUserRecords<T extends object>(
  userId: string,
  prefix = "",
): Promise<(T & UserRecord)[]> {
  if (isAwsBlock(userQuests))
    return (await listConsistentUserItems(userQuests, userId, prefix)) as (T &
      UserRecord)[];
  const items = [];
  for await (const item of userQuests.query({
    where: {
      userId: { equals: userId },
      ...(prefix ? { newsId: { beginsWith: prefix } } : {}),
    },
  }))
    items.push(item as T & UserRecord);
  return items;
}

// DistributedTableは部分更新を持たないため、versionを条件に全体を書き戻す。
// 衝突時は読み直し、既読・クリア状態などの別リクエストの変更を保つ。
// change は、今の記録(なければ null)を受け取り、次を返す。
//   value: 書き込む内容。なければ書き込まない
//   result: この関数の戻り値
const MAX_ATTEMPTS = 8;
export async function changeUserRecord<T extends object, R>(
  userId: string,
  newsId: string,
  change: (current: (T & UserRecord) | null) => {
    // userId・newsId・version は、この関数が入れる
    value?: Omit<T, keyof UserRecord> & Partial<UserRecord>;
    result: R;
  },
): Promise<R> {
  for (let attempt = 1; ; attempt++) {
    const current = await getUserRecord<T>(userId, newsId);
    const { value, result } = change(current);
    if (!value) return result;
    const version = (current?.version ?? 0) + 1;
    try {
      await userQuests.put(
        { ...value, userId, newsId, version },
        current
          ? { ifFieldEquals: { version: current.version } }
          : { ifNotExists: true },
      );
      return result;
    } catch (error) {
      if (!conditionalFailure(error) || attempt === MAX_ATTEMPTS) throw error;
      // 再試行の前に待つ(5ms から倍ずつ、最大 100ms)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(5 * 2 ** (attempt - 1), 100)),
      );
    }
  }
}
