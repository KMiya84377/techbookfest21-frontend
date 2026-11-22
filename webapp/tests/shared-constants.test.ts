import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NEWS_FEED } from "../cdk-blocks/constants.ts";
import {
  ANSWER_DETAILS,
  DIFFICULTIES,
  LEARNING_TOPICS,
} from "../src/lib/userSettings/model.ts";

// TypeScript と Python(chat-agent/・batch-agent/)の両方に同じ値を書いているものが、ずれていないことを確かめる。
// ずれると、画面では選べるのに、エージェント側の検証で弾かれる(エラーは出ない)。
const read = (path: string) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf-8");
const quoted = (text: string) =>
  [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);

// Python の `NAME = {...}`(集合か辞書)の中身を取り出す
function pythonBlock(source: string, name: string): string {
  const match = source.match(new RegExp(`^${name}\\s*=\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(
    match,
    `${name} が見つかりません(Python 側の書き方を変えたら、このテストも直す)`,
  );
  return match[1]!;
}

const settings = read("chat-agent/chat/user_settings.py");
const sorted = (values: Iterable<string>) => [...values].sort();

// Python の分野の ID(_TOPICS)は、_TOPIC_LABELS のキーから作る
test("学習分野のIDが、TypeScript と Python で一致する", () => {
  assert.match(settings, /^_TOPICS = set\(_TOPIC_LABELS\)$/m);
  const ids = [
    ...pythonBlock(settings, "_TOPIC_LABELS").matchAll(/"([^"]+)"\s*:/g),
  ].map((m) => m[1]!);
  assert.deepEqual(sorted(ids), sorted(LEARNING_TOPICS.map(({ id }) => id)));
});

test("学習分野の表示名が、TypeScript と Python で一致する", () => {
  const pairs = [
    ...pythonBlock(settings, "_TOPIC_LABELS").matchAll(
      /"([^"]+)"\s*:\s*"([^"]+)"/g,
    ),
  ].map((m) => [m[1], m[2]]);
  assert.deepEqual(
    sorted(pairs.map((p) => p.join("="))),
    sorted(LEARNING_TOPICS.map(({ id, label }) => `${id}=${label}`)),
  );
});

test("難易度と回答の詳しさが、TypeScript と Python で一致する", () => {
  assert.deepEqual(
    sorted(quoted(pythonBlock(settings, "_DIFFICULTIES"))),
    sorted(DIFFICULTIES),
  );
  assert.deepEqual(
    sorted(quoted(pythonBlock(settings, "_ANSWER_DETAILS"))),
    sorted(ANSWER_DETAILS),
  );
});

// チャットと定期実行で、同じニュースのフィードを使う。
for (const path of ["chat-agent/chat/news_source.py", "batch-agent/batch/tools.py"]) {
  test(`ニュースのフィード名が、TypeScript と Python(${path})で一致する`, () => {
    const match = read(path).match(/^NEWS_FEED\s*=\s*"([^"]+)"/m);
    assert.ok(match, "NEWS_FEED が見つかりません");
    assert.equal(match[1], NEWS_FEED);
  });
}

// 2 つのエージェントは、ニュースの保存形式(QuestInput と _news_item)を、それぞれのツールに持つ。
// 片方だけを変えると、チャットと定期実行で保存されるニュースの形がずれるので、同じことを確かめる。
function pythonTopLevel(source: string, header: string): string {
  const start = source.indexOf(header);
  assert.ok(start >= 0, `${header} が見つかりません`);
  // 次のトップレベルの定義(行頭の def・class・@)の手前まで
  const rest = source.slice(start + header.length);
  const end = rest.search(/\n(?=(def |class |@))/);
  return header + (end >= 0 ? rest.slice(0, end) : rest);
}

for (const header of ["class QuestInput(", "def _news_item("]) {
  test(`ニュースの保存形式(${header})が、2 つのエージェントで一致する`, () => {
    assert.equal(
      pythonTopLevel(read("batch-agent/batch/tools.py"), header),
      pythonTopLevel(read("chat-agent/chat/quest_storage.py"), header),
    );
  });
}
