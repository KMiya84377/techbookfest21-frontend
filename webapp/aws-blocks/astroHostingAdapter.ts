import { astroAdapter, type FrameworkAdapterFn } from "@aws-blocks/hosting/adapters";
import { mkdirSync, readFileSync, symlinkSync, existsSync, writeFileSync } from "node:fs";
import * as path from "node:path";

// 公開0.4.1の同期設定ローダーはAstro 7のESM依存を読めない。
// 実際のビルドはAstro自身に任せ、公式アダプターへ共通の配信設定と生成済み出力を渡す。
export const astroHostingAdapter: FrameworkAdapterFn = (root) => {
  const stage = path.join(root, ".blocks", "astro-manifest");
  mkdirSync(stage, { recursive: true });
  for (const name of ["dist", "node_modules", "package.json"]) {
    const target = path.join(stage, name);
    if (!existsSync(target)) symlinkSync(path.join(root, name), target);
  }
  const metadata = JSON.parse(readFileSync(path.join(root, "astro-deploy.config.json"), "utf8"));
  writeFileSync(path.join(stage, "astro.config.cjs"), `module.exports = ${JSON.stringify(metadata)};\n`);
  const manifest = astroAdapter({ projectDir: stage, skipBuild: true });
  // CDKのアセットはシンボリックリンクではなく、実際のビルド出力を参照する。
  const normalize = (value: unknown): unknown => {
    if (typeof value === "string") return value.startsWith(stage + path.sep) ? root + value.slice(stage.length) : value;
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
    return value;
  };
  return normalize(manifest) as typeof manifest;
};
