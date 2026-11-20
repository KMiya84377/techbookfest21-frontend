import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

// 対象ファイルだけを読み、通信や認証などの依存先をテスト用の処理に差し替える。
export async function loadIsolatedModule<T>(
  file: string,
  imports: Record<string, unknown>,
  definitions: Record<string, string> = {},
): Promise<T> {
  const source = await readFile(new URL(`../../${file}`, import.meta.url), "utf8");
  const compiled = await transform(source, {
    loader: file.endsWith(".tsx") ? "tsx" : "ts",
    format: "cjs",
    jsx: "automatic",
    define: { "import.meta.env": "{}", ...definitions },
  });
  const module = { exports: {} };
  const requireStub = (name: string) => {
    if (!Object.hasOwn(imports, name)) {
      throw new Error(`差し替えていない依存先です: ${name}`);
    }
    return imports[name];
  };
  const execute = new Function("require", "module", "exports", compiled.code);
  execute(requireStub, module, module.exports);
  return module.exports as T;
}
