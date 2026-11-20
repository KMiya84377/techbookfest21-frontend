import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QuestCard from "../src/components/quests/QuestCard";
import {
  RANK,
  STATUS_LABEL,
  IMPORTANCE_LABEL,
  type Quest,
} from "../src/lib/quests/model";

const quest: Quest = {
  id: "card-test",
  title: "テストのニュース",
  summary: "ニュースの概要",
  publishedAt: "2026-11-19T00:00:00Z",
  services: ["Lambda", "Amazon Bedrock"],
  importance: "high",
  minutes: 5,
  status: "todo",
  source: { label: "AWS", url: "https://aws.amazon.com/new/" },
  changes: [],
  before: "変更前",
  after: "変更後",
  impact: { changes: "変更", unchanged: "維持", check: "確認" },
  checks: [],
};

function renderCard(value = quest, windEnabled = true) {
  return renderToStaticMarkup(
    createElement(QuestCard, { quest: value, windEnabled, onOpen() {} }),
  );
}

test("カードは1つのボタンのまま、日付・タイトル・要約・サービスを表示する", () => {
  const html = renderCard();
  assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<(?:div|p|h[1-6]|section|article|a|input)\b/);
  assert.match(html, /<time dateTime="2026-11-19T00:00:00Z">2026\.11\.19<\/time>/);
  for (const text of [quest.title, quest.summary, ...quest.services]) {
    assert.ok(html.includes(text), text);
  }
  assert.doesNotMatch(html, /<span class="block"><span/);
});

test("状態・重要度・復習表示を切り替えても、紙の傾きや位置を維持する", () => {
  const originalStyle = renderCard().match(/style="([^"]+)"/)?.[1];
  assert.ok(originalStyle);
  for (const status of ["todo", "viewed", "cleared"] as const) {
    for (const importance of ["high", "medium", "low"] as const) {
      for (const review of [false, true]) {
        const html = renderCard({ ...quest, status, importance, review });
        assert.match(html, new RegExp(`status-${status} importance-${importance}`));
        assert.ok(html.includes(STATUS_LABEL[status]));
        assert.ok(html.includes(IMPORTANCE_LABEL[importance]));
        assert.equal(html.includes(" · 復習"), review);
        const stampText = html.match(
          /<text\b[^>]*font-size="(?:35|44)"[^>]*>([^<]*)<\/text>/,
        )?.[1];
        assert.equal(stampText, status === "cleared" ? "済" : RANK[importance]);
        assert.equal(html.match(/style="([^"]+)"/)?.[1], originalStyle);
      }
    }
  }
  assert.doesNotMatch(renderCard(), /[\s"]animate-none[\s"]/);
  assert.match(renderCard(quest, false), /[\s"]animate-none[\s"]/);
});

test("カードを押すと、対象クエストのIDで詳細を開く", () => {
  const opened: string[] = [];
  const card = QuestCard({
    quest, windEnabled: true, onOpen: id => opened.push(id),
  });
  card.props.onClick();
  assert.deepEqual(opened, [quest.id]);
});
