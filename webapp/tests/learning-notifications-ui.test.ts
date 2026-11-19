import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LearningNotifications from "../src/components/learning/LearningNotifications";

const props: ComponentProps<typeof LearningNotifications> = {
  insights: [],
  busy: false,
  error: null,
  onRetry: async () => {},
  onRead: async () => {},
  news: [],
  newsBusy: false,
  newsError: null,
  onCheckNews: async () => {},
  onReadNews: async () => {},
  onOpenNews: async () => {},
};

test("通知トリガーは単一のボタンで、初期状態では一覧・図解を開かない", () => {
  const html = renderToStaticMarkup(
    createElement(LearningNotifications, props),
  );
  assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  assert.match(html, /aria-label="通知を開く"/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(
    html,
    /未読通知があります|学習済みのニュースを関連づけた図解です/,
  );
});

test("既読の新着は未読件数に含めず、分析中の状態はトリガーに残す", () => {
  const news = [
    {
      id: "unread",
      questId: "a",
      title: "新着A",
      reason: "理由",
      createdAt: "2026-11-19",
    },
    {
      id: "read",
      questId: "b",
      title: "新着B",
      reason: "理由",
      createdAt: "2026-11-19",
      readAt: "2026-11-19",
    },
  ];
  const html = renderToStaticMarkup(
    createElement(LearningNotifications, {
      ...props,
      news,
      busy: true,
    }),
  );
  assert.match(html, /1件の未読通知があります/);
  assert.doesNotMatch(html, /2件の未読通知があります/);
  assert.match(html, /animate-pulse/);
});
