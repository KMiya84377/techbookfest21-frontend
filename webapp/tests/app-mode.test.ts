import assert from "node:assert/strict";
import test from "node:test";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

test("モック・ローカル・本番で、認証とAI処理の切り替えを維持する", async () => {
  const cases = [
    { mode: "mock", authDisabled: true, blocksLocal: false, mockAi: true },
    { mode: "blocks-mock", authDisabled: false, blocksLocal: true, mockAi: true },
    { mode: "development", authDisabled: false, blocksLocal: true, mockAi: false },
    { mode: "custom", authDisabled: false, blocksLocal: true, mockAi: false },
    { mode: "", authDisabled: false, blocksLocal: false, mockAi: false },
    { mode: undefined, authDisabled: false, blocksLocal: false, mockAi: false },
  ];
  for (const { mode, authDisabled, blocksLocal, mockAi } of cases) {
    const definitions: Record<string, string> =
      mode === undefined ? {} : { __DEV_MODE__: JSON.stringify(mode) };
    const flags = await loadIsolatedModule<typeof import("../src/lib/appMode")>(
      "src/lib/appMode.ts", {}, definitions,
    );
    assert.deepEqual(
      [flags.AUTH_DISABLED, flags.BLOCKS_LOCAL, flags.MOCK_AI],
      [authDisabled, blocksLocal, mockAi],
      `モード: ${mode ?? "未定義"}`,
    );
  }
});
