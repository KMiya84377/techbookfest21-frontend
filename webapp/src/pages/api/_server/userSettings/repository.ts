import { settings as settingsTable } from "../../../../../cdk-blocks/storage";
import {
  DEFAULT_USER_SETTINGS,
  parseUserSettings,
  type UserSettings,
} from "../../../../lib/userSettings/model";
import type { UserSettingsStore } from "./store";

export async function getUserSettings(userId: string): Promise<UserSettings> {
  // get()は強い整合性の読み取りなので、保存直後の設定も読める。
  const record = await settingsTable.get({ userId });
  const settings = parseUserSettings(record);
  if (!settings) return DEFAULT_USER_SETTINGS;
  return settings;
}

export async function putUserSettings(
  userId: string,
  settings: UserSettings,
): Promise<void> {
  const record = {
    userId,
    ...settings,
    updatedAt: new Date().toISOString(),
  };
  await settingsTable.put({ userId }, record);
}

// Blocks(KVStore)の保存先。mock モードとの切り替えは store.ts
export const blocksUserSettingsStore: UserSettingsStore = {
  get: getUserSettings,
  put: putUserSettings,
};
