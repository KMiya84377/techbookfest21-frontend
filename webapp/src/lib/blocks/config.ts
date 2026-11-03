// 開発サーバーのモード(astro.config.mjs が、ビルド時に値を埋め込む)。
// 本番ビルドでは空文字になり、下のフラグはビルド時に定数 false へ畳まれて、モックのコードも消える。
// Vite を通らない実行(テストなど)では、定義されないので undefined になる。
declare const __DEV_MODE__: string | undefined;
const devMode = typeof __DEV_MODE__ === "undefined" ? undefined : __DEV_MODE__;

// mockは画面・AG-UIだけの確認用。通常のローカル開発はBlocksの認証・保存を使う。
export const AUTH_DISABLED = devMode === "mock";
export const BLOCKS_LOCAL = !!devMode && !AUTH_DISABLED;
export const MOCK_AI = AUTH_DISABLED || devMode === "blocks-mock";
