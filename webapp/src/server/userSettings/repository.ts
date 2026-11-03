import { getConsistentItem, isAwsBlock } from "../blocks/consistentReads";
import { settings as table } from "../../../aws-blocks/storage";
import { DEFAULT_USER_SETTINGS, parseUserSettings, type UserSettings } from "../../lib/userSettings/model";
export async function getUserSettings(userId: string): Promise<UserSettings> {
  return parseUserSettings(isAwsBlock(table) ? await getConsistentItem(table, { userId }) : await table.get({ userId })) ?? DEFAULT_USER_SETTINGS;
}
export async function putUserSettings(userId: string, settings: UserSettings): Promise<void> {
  await table.put({ userId, ...settings, updatedAt: new Date().toISOString() });
}
