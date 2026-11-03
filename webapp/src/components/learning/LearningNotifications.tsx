import { useState } from "react";
import { BellIcon } from "lucide-react";
import type { NewsNotification } from "../../lib/newsNotifications/model";
import type { LearningInsight } from "../../lib/learning/model";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import LearningDiagram from "../generative-ui/LearningDiagram";

interface Props {
  // 学習内容のつながり(関連分析の図解)
  insights: LearningInsight[];
  busy: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
  onRead: (insight: LearningInsight) => Promise<void>;
  // 関心に合う新着のニュース
  news: NewsNotification[];
  newsBusy: boolean;
  newsError: string | null;
  onCheckNews: () => Promise<void>;
  onReadNews: (notification: NewsNotification) => Promise<void>;
  onOpenNews: (questId: string) => Promise<void>;
}

// クエストボード右上の通知ボタンと一覧。図解は、選ぶとダイアログで開く
export default function LearningNotifications({
  insights,
  busy,
  error,
  onRetry,
  onRead,
  news,
  newsBusy,
  newsError,
  onCheckNews,
  onReadNews,
  onOpenNews,
}: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [selected, setSelected] = useState<LearningInsight | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const unread =
    insights.filter((insight) => !insight.readAt).length +
    news.filter((item) => !item.readAt).length;
  const openNews = async (notification: NewsNotification) => {
    if (opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      await onOpenNews(notification.questId);
      setListOpen(false);
      // 既読の保存に失敗しても、詳細は開けている。未読のまま残り、次の確認で分かる
      await onReadNews(notification).catch(() => {});
    } catch (cause) {
      setOpenError(
        cause instanceof Error ? cause.message : "ニュースを開けませんでした",
      );
    } finally {
      setOpening(false);
    }
  };
  return (
    <>
      <div className="absolute top-[7px] right-[78px] z-[8]">
        <Button
          variant="questTavern"
          size="icon"
          className="relative size-[30px] rounded-full"
          aria-label="通知を開く"
          aria-expanded={listOpen}
          onClick={() => setListOpen((open) => !open)}
        >
          <BellIcon className="size-4" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-[#9a493b] px-1 text-[10px] text-white">
              {unread}
            </span>
          )}
          {busy && (
            <span
              className="absolute -bottom-1 -right-1 size-2 animate-pulse rounded-full bg-[#d3b276]"
              aria-hidden="true"
            />
          )}
        </Button>
        <span className="sr-only" role="status" aria-live="polite">
          {unread > 0 ? `${unread}件の未読通知があります` : ""}
        </span>
        {listOpen && (
          <section
            className="absolute top-10 -right-12 max-h-[min(70dvh,480px)] w-[min(350px,calc(100vw-70px))] overflow-auto rounded border border-[#b99a67] bg-[#fffaf0] p-4 text-[#302b22] shadow-xl"
            aria-label="通知一覧"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-semibold">通知</h2>
              <button
                type="button"
                onClick={() => setListOpen(false)}
                className="text-sm underline"
              >
                閉じる
              </button>
            </div>
            <h3 className="mb-2 text-sm font-semibold">関心に合う新着</h3>
            {newsBusy && (
              <p className="mb-2 text-sm" role="status">
                新着を確認しています…
              </p>
            )}
            {(newsError || openError) && (
              <div role="alert" className="mb-2 text-sm">
                <p>{openError ?? newsError}</p>
                <Button
                  variant="questOutline"
                  disabled={newsBusy || opening}
                  onClick={() => {
                    setOpenError(null);
                    void onCheckNews();
                  }}
                >
                  再確認
                </Button>
              </div>
            )}
            {!news.length && !newsBusy && (
              <p className="mb-3 text-sm">新着の通知はまだありません。</p>
            )}
            <ul className="mb-4 space-y-2">
              {news.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    disabled={opening}
                    className="w-full rounded border border-[#d9c9aa] bg-[#f4e8ce] p-3 text-left hover:bg-[#ecdcba] disabled:opacity-60"
                    onClick={() => void openNews(notification)}
                  >
                    <span className="block text-xs text-[#74532b]">
                      {notification.readAt ? "確認済み" : "未読"}
                      {notification.mock ? " · モック" : ""}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {notification.title}
                    </span>
                    <span className="mt-1 block text-sm">
                      {notification.reason}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className="mb-2 text-sm font-semibold">学習内容のつながり</h3>
            {busy && (
              <p className="mb-3 text-sm" role="status">
                学習内容のつながりを分析しています…
              </p>
            )}
            {error && (
              <div
                role="alert"
                className="mb-3 rounded border border-[#b98476] p-2 text-sm"
              >
                <p>{error}</p>
                <Button
                  variant="questOutline"
                  className="mt-2"
                  disabled={busy}
                  onClick={() => void onRetry()}
                >
                  再試行
                </Button>
              </div>
            )}
            {!insights.length && !busy && (
              <p className="text-sm leading-relaxed">
                通知はまだありません。学習が進むと、学んだニュース同士のつながりをお知らせします。
              </p>
            )}
            <ul className="space-y-2">
              {insights.map((insight) => (
                <li key={insight.id}>
                  <button
                    type="button"
                    className="w-full rounded border border-[#d9c9aa] bg-[#f4e8ce] p-3 text-left hover:bg-[#ecdcba]"
                    onClick={() => {
                      setSelected(insight);
                      setListOpen(false);
                      void onRead(insight);
                    }}
                  >
                    <span className="block text-xs text-[#74532b]">
                      {insight.readAt ? "確認済み" : "未読"}
                      {insight.mock ? " · モック" : ""}
                    </span>
                    <span className="mt-1 block text-sm font-semibold">
                      {insight.diagram.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="fixed top-1/2 left-1/2 max-h-[88dvh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-[#b99a67] bg-[#fffaf0] p-6 text-[#302b22] shadow-xl max-[520px]:p-4">
          <DialogTitle className="mb-2 pr-8 text-xl font-semibold">
            {selected?.diagram.title ?? "学習内容のつながり"}
          </DialogTitle>
          <DialogDescription className="mb-4 text-sm text-[#746b5c]">
            学習済みのニュースを関連づけた図解です。新しいニュースそのものを生成する機能ではありません。
          </DialogDescription>
          {selected && <LearningDiagram insight={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
