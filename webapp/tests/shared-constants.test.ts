import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NEWS_FEED } from "../aws-blocks/constants.ts";
import { ANSWER_DETAILS, DIFFICULTIES, LEARNING_TOPICS } from "../src/lib/userSettings/model.ts";

// TypeScript と Python(agent/)の両方に同じ値を書いているものが、ずれていないことを確かめる。
// ずれると、画面では選べるのに、エージェント側の検証で弾かれる(エラーは出ない)。
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf-8");
const quoted = (text: string) => [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);

// Python の `NAME = {...}`(集合か辞書)の中身を取り出す
function pythonBlock(source: string, name: string): string {
  const match = source.match(new RegExp(`^${name}\\s*=\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(match, `${name} が見つかりません(Python 側の書き方を変えたら、このテストも直す)`);
  return match[1]!;
}

const settings = read("agent/chat/user_settings.py");
const sorted = (values: Iterable<string>) => [...values].sort();

test("学習分野のIDが、TypeScript と Python で一致する", () => {
  assert.deepEqual(sorted(quoted(pythonBlock(settings, "_TOPICS"))), sorted(LEARNING_TOPICS.map(({ id }) => id)));
});

test("学習分野の表示名が、TypeScript と Python で一致する", () => {
  const pairs = [...pythonBlock(settings, "_TOPIC_LABELS").matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(sorted(pairs.map((p) => p.join("="))), sorted(LEARNING_TOPICS.map(({ id, label }) => `${id}=${label}`)));
});

test("難易度と回答の詳しさが、TypeScript と Python で一致する", () => {
  assert.deepEqual(sorted(quoted(pythonBlock(settings, "_DIFFICULTIES"))), sorted(DIFFICULTIES));
  assert.deepEqual(sorted(quoted(pythonBlock(settings, "_ANSWER_DETAILS"))), sorted(ANSWER_DETAILS));
});

test("ニュースのフィード名が、TypeScript と Python で一致する", () => {
  const match = read("agent/common/tools.py").match(/^NEWS_FEED\s*=\s*"([^"]+)"/m);
  assert.ok(match, "NEWS_FEED が見つかりません");
  assert.equal(match[1], NEWS_FEED);
});
