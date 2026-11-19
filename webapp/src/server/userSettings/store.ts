import { AUTH_DISABLED } from "../../lib/blocks/config";
import type { UserSettings } from "../../lib/userSettings/model";
import { blocksUserSettingsStore } from "./repository";

// ユーザー設定の読み書き。保存先は、ここで1度だけ選ぶ(Blocks か、mock モードのメモリ)
export interface UserSettingsStore {
  get(userId: string): Promise<UserSettings>;
  put(userId: string, settings: UserSettings): Promise<void>;
}

// AUTH_DISABLED は、本番ビルドでは定数 false になり、mock/ の読み込みごと消える
export const userSettingsStore: UserSettingsStore = AUTH_DISABLED
  ? (await import("../../../mock/userSettingsStore")).mockUserSettingsStore
  : blocksUserSettingsStore;
