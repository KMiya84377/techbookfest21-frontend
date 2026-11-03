import { DEFAULT_USER_SETTINGS, type UserSettings } from "../src/lib/userSettings/model";

const settings = new Map<string, UserSettings>();
export const getMockUserSettings = (userId: string): UserSettings => settings.get(userId) ?? DEFAULT_USER_SETTINGS;
export const putMockUserSettings = (userId: string, value: UserSettings): void => { settings.set(userId, value); };

export const mockUserSettingsStore = {
  get: async (userId: string) => getMockUserSettings(userId),
  put: async (userId: string, value: UserSettings) => putMockUserSettings(userId, value),
};
