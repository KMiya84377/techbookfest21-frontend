// 開発モードに応じて、認証・保存・AI処理を切り替える。
// 本番ビルドではモックを無効にする。
declare const __DEV_MODE__: string | undefined;
const devMode = typeof __DEV_MODE__ === "undefined" ? undefined : __DEV_MODE__;

function isLocalBlocksMode(mode: string | undefined): boolean {
  if (mode === undefined) return false;
  if (mode === "") return false;
  if (mode === "mock") return false;
  return true;
}

export const AUTH_DISABLED = devMode === "mock";
export const BLOCKS_LOCAL = isLocalBlocksMode(devMode);
export const MOCK_AI = AUTH_DISABLED || devMode === "blocks-mock";
