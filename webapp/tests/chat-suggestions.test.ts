import assert from "node:assert/strict";
import test from "node:test";
import type { useConfigureSuggestions } from "@copilotkit/react-core/v2";
import { loadIsolatedModule } from "./helpers/loadIsolatedModule";

type SuggestionsConfig = NonNullable<Parameters<typeof useConfigureSuggestions>[0]>;

async function configuredSuggestions() {
  const configs: SuggestionsConfig[] = [];
  const { useChatSuggestions } = await loadIsolatedModule<
    typeof import("../src/hooks/useChatSuggestions")
  >("src/hooks/useChatSuggestions.ts", {
    "@copilotkit/react-core/v2": {
      useConfigureSuggestions(config: SuggestionsConfig) {
        configs.push(config);
      },
    },
  });
  useChatSuggestions();
  return configs;
}

test("会話前は、送信するメッセージを持つ固定の候補を3件登録する", async () => {
  const configs = await configuredSuggestions();
  const initial = configs.find(config => config.available === "before-first-message");
  assert.ok(initial && "suggestions" in initial);
  assert.deepEqual(initial.suggestions.map(suggestion => suggestion.title), [
    "おすすめのニュース", "理解度チェック", "週間レポート",
  ]);
  assert.ok(initial.suggestions.every(suggestion => suggestion.message.trim()));
  assert.equal("instructions" in initial, false);
});

test("会話後は、固定の候補と混ぜずにAI生成の候補を2〜3件登録する", async () => {
  const configs = await configuredSuggestions();
  assert.equal(configs.length, 2);
  const followUp = configs.find(config => config.available === "after-first-message");
  assert.ok(followUp && "instructions" in followUp);
  assert.equal(followUp.minSuggestions, 2);
  assert.equal(followUp.maxSuggestions, 3);
  assert.match(followUp.instructions, /直近の会話/);
  assert.match(followUp.instructions, /実行できない操作/);
  assert.equal("suggestions" in followUp, false);
});
