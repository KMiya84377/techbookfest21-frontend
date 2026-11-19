import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { Button } from "../src/components/ui/button";
import QuestBoard from "../src/components/quests/QuestBoard";
import type { Quest } from "../src/lib/quests/model";

test("スタイルなしのButtonはカード・背景のレイアウトを変更しない", () => {
  const html = renderToStaticMarkup(
    createElement(Button, {
      variant: "unstyled",
      className: "fixed inset-0 text-left",
      "aria-label": "閉じる",
    }),
  );
  assert.match(html, /<button\b[^>]*type="button"/);
  assert.match(html, /data-slot="button"/);
  assert.match(html, /fixed inset-0 text-left/);
  assert.match(html, /focus-visible:ring-2/);
  assert.doesNotMatch(html, /inline-flex|h-8|px-2\.5|whitespace-nowrap|translate-y/);
});

test("既存のButtonのスタイルと無効化は維持する", () => {
  const styled = renderToStaticMarkup(
    createElement(Button, { variant: "questOutline", children: "実行" }),
  );
  assert.match(styled, /inline-flex/);
  assert.match(styled, /h-8/);
  assert.match(styled, /border-quest-card-line/);
  const disabled = renderToStaticMarkup(
    createElement(Button, {
      variant: "unstyled",
      disabled: true,
      children: "通知",
    }),
  );
  assert.match(disabled, /disabled=""/);
});

test("DialogとPopoverのCloseにButtonを合成しても、ボタンを入れ子にしない", () => {
  const trees = [
    createElement(
      Dialog.Root,
      { defaultOpen: true },
      createElement(Dialog.Close, {
        render: createElement(Button, { variant: "unstyled" }),
        children: "閉じる",
      }),
    ),
    createElement(
      Popover.Root,
      { defaultOpen: true },
      createElement(Popover.Close, {
        render: createElement(Button, { variant: "unstyled" }),
        children: "閉じる",
      }),
    ),
  ];
  for (const tree of trees) {
    const html = renderToStaticMarkup(tree);
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
    assert.match(html, /data-slot="button"/);
    assert.match(html, /閉じる/);
  }
});

test("クエストカードは共通Buttonを使い、独自の紙面レイアウトを維持する", () => {
  const quest: Quest = {
    id: "button-test",
    title: "テストのニュース",
    publishedAt: "2026-11-19T00:00:00Z",
    services: ["Lambda"],
    summary: "ニュースの概要",
    importance: "high",
    minutes: 5,
    status: "todo",
    source: { label: "ニュース", url: "https://aws.amazon.com/new/" },
    changes: [],
    before: "変更前",
    after: "変更後",
    impact: { changes: "変更", unchanged: "維持", check: "確認" },
    checks: [],
  };
  const html = renderToStaticMarkup(
    createElement(QuestBoard, {
      quests: [quest],
      filter: {},
      onFilterChange: () => {},
      onOpen: () => {},
    }),
  );
  const card = html.match(/<button\b[^>]*class="[^"]*quest status-todo[^>]*>/)?.[0];
  assert.ok(card);
  assert.match(card, /data-slot="button"/);
  assert.match(card, /text-left/);
  assert.doesNotMatch(card, /inline-flex|h-8|whitespace-nowrap/);
  assert.doesNotMatch(html, /<button\b[^>]*>(?:(?!<\/button>)[\s\S])*<button\b/);
});
