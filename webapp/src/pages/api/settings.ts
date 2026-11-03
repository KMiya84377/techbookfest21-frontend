import { parseUserSettings } from "../../lib/userSettings/model";
import { loadUserSettings, saveUserSettings } from "../../server/userSettings/service";
import { badRequest, json, readJson, withUser } from "./_helpers";

export const prerender = false;

export const GET = withUser("settings.get", async ({ userId, log }) => {
  try {
    return json({ settings: await loadUserSettings(userId) });
  } catch (error) {
    log.error("ユーザー設定の取得に失敗しました", { err: error });
    return json({ error: "設定を取得できませんでした" }, 500);
  }
});

export const PUT = withUser("settings.put", async ({ request, userId, log }) => {
  const body = await readJson(request);
  if (body === undefined) return badRequest();

  const settings = parseUserSettings(body);
  if (!settings) return json({ error: "設定の値が不正です" }, 400);

  try {
    await saveUserSettings(userId, settings);
    return json({ settings });
  } catch (error) {
    log.error("ユーザー設定の保存に失敗しました", { err: error });
    return json({ error: "設定を保存できませんでした" }, 500);
  }
});
