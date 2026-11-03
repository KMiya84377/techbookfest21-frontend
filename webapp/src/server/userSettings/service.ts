import { AUTH_DISABLED } from "../../lib/blocks/config";
import { getUserSettings, putUserSettings } from "./repository";
import type { UserSettings } from "../../lib/userSettings/model";

interface UserSettingsStore {
  get(userId: string): Promise<UserSettings>;
  put(userId: string, settings: UserSettings): Promise<void>;
}

const blocksStore: UserSettingsStore = { get: getUserSettings, put: putUserSettings };
const store: UserSettingsStore = AUTH_DISABLED
  ? (await import("../../../mock/userSettingsStore")).mockUserSettingsStore
  : blocksStore;

// 設定APIと学習件数の判定が、同じユーザーの保存済み設定を参照する。
export const loadUserSettings = (userId: string): Promise<UserSettings> => store.get(userId);
export const saveUserSettings = (userId: string, settings: UserSettings): Promise<void> => store.put(userId, settings);
