import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_USER_SETTINGS,
  parseUserSettings,
  type UserSettings,
} from "../lib/userSettings/model";
import type { ApiFetch } from "./useApiFetch";

const SETTINGS_URL = "/api/settings";

async function readSettings(res: Response): Promise<UserSettings> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { settings?: unknown };
  const parsed = parseUserSettings(data.settings);
  if (!parsed) throw new Error("Invalid settings response");
  return parsed;
}

// ユーザー設定の取得と保存
export function useUserSettings(apiFetch: ApiFetch) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setSettings(await readSettings(await apiFetch(SETTINGS_URL)));
    } catch (error) {
      console.error("ユーザー設定の取得に失敗しました", error);
      setLoadError("保存済みの設定を読み込めませんでした。");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const save = useCallback(
    async (next: UserSettings) => {
      const res = await apiFetch(SETTINGS_URL, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      setSettings(await readSettings(res));
      setLoadError(null);
    },
    [apiFetch],
  );

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return { settings, loading, loadError, save };
}
