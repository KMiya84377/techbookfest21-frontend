import { isAwsBlock, listConsistentUserItems } from "./consistentReads";
import { userQuests } from "../../../../../cdk-blocks/storage";

type RecordKeys = {
  userId: string;
  newsId: string;
  version: number;
};
type StoredRecord<T> = T & RecordKeys;
// キーとversionは共通処理で付けるので、呼び出し元は保存内容だけを作る。
type RecordData<T> = Omit<T, keyof RecordKeys>;

export function isConditionalWriteConflict(error: unknown): boolean {
  return (
    error instanceof Error && error.name === "ConditionalCheckFailedException"
  );
}

// UserQuestテーブルには、学習状態・分析結果・通知を保存する。
// get()は強い整合性の読み取りなので、保存直後の内容も読める。
export async function getUserQuestRecord<T extends object>(
  userId: string,
  newsId: string,
): Promise<StoredRecord<T> | null> {
  const record = await userQuests.get({ userId, newsId });
  // 保存する項目は用途ごとに異なるため、呼び出し元が型を指定する。
  return record as unknown as StoredRecord<T> | null;
}

export async function listUserQuestRecords<T extends object>(
  userId: string,
  prefix = "",
): Promise<StoredRecord<T>[]> {
  if (isAwsBlock(userQuests)) {
    const records = await listConsistentUserItems(userQuests, userId, prefix);
    return records as StoredRecord<T>[];
  }

  const where = {
    userId: { equals: userId },
    ...(prefix ? { newsId: { beginsWith: prefix } } : {}),
  };
  const records: StoredRecord<T>[] = [];
  for await (const entry of userQuests.query({ where })) {
    records.push(entry.value as unknown as StoredRecord<T>);
  }
  return records;
}

const MAX_ATTEMPTS = 8;

// makeNextRecordは、現在の記録から保存する内容を作る。nullなら更新しない。
// 保存できた記録を返す。競合時は読み直してmakeNextRecordからやり直すため、
// makeNextRecordではAPI呼び出しなどをせず、保存内容を作るだけにする。
export async function updateUserQuestRecord<T extends object>(
  userId: string,
  newsId: string,
  makeNextRecord: (current: StoredRecord<T> | null) => RecordData<T> | null,
): Promise<StoredRecord<T> | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const currentRecord = await getUserQuestRecord<T>(userId, newsId);
    const nextRecord = makeNextRecord(currentRecord);
    if (nextRecord === null) return null;

    const record = {
      ...nextRecord,
      userId,
      newsId,
      version: (currentRecord?.version ?? 0) + 1,
    } as StoredRecord<T>;

    // 読み取った後に別の処理が更新していたら、上書きせず競合エラーにする。
    try {
      const key = { userId, newsId };
      if (currentRecord) {
        await userQuests.put(key, record, {
          ifFieldEquals: { version: currentRecord.version },
        });
      } else {
        await userQuests.put(key, record, { ifNotExists: true });
      }
      return record;
    } catch (error) {
      if (!isConditionalWriteConflict(error) || attempt === MAX_ATTEMPTS) {
        throw error;
      }

      // 5msから待ち時間を増やし、最大100ms待ってから読み直す。
      const waitMs = Math.min(5 * 2 ** (attempt - 1), 100);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error("UserQuestの保存を完了できませんでした");
}
