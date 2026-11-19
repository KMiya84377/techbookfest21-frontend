import { useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
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
import LearningDiagram from "./LearningDiagram";

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

// 通知の一覧の 1 件(関心に合う新着と、学習内容のつながりで共通)
function NotificationButton({
  read,
  title,
  detail,
  disabled = false,
  onClick,
}: {
  read: boolean;
  title: string;
  detail?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="unstyled"
      type="button"
      disabled={disabled}
      className="w-full rounded border border-quest-card-line bg-quest-card-header p-3 text-left hover:bg-quest-notice-hover disabled:opacity-60"
      onClick={onClick}
    >
      <span className="block text-xs text-quest-brown">
        {read ? "確認済み" : "未読"}
      </span>
      <span className="mt-1 block text-sm font-semibold">{title}</span>
      {detail && <span className="mt-1 block text-sm">{detail}</span>}
    </Button>
  );
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  // ニュース詳細・図解へ移るときは、Popoverから通知ボタンへフォーカスを戻さない。
  const handingOffFocus = useRef(false);
  const unread =
    insights.filter((insight) => !insight.readAt).length +
    news.filter((item) => !item.readAt).length;
  const openNews = async (notification: NewsNotification) => {
    if (opening) return;
    setOpening(true);
    setOpenError(null);
    handingOffFocus.current = true;
    try {
      await onOpenNews(notification.questId);
      setListOpen(false);
      // 既読の保存に失敗しても、詳細は開けている。未読のまま残り、次の確認で分かる
      await onReadNews(notification).catch(() => {});
    } catch (cause) {
      handingOffFocus.current = false;
      setOpenError(
        cause instanceof Error ? cause.message : "ニュースを開けませんでした",
      );
    } finally {
      setOpening(false);
    }
  };
  return (
    <>
      <Popover.Root
        open={listOpen}
        onOpenChange={(open) => {
          if (open) handingOffFocus.current = false;
          setListOpen(open);
        }}
      >
        <div className="absolute top-[7px] right-[78px] z-[8]">
          <Popover.Trigger
            ref={triggerRef}
            aria-label="通知を開く"
            render={
              <Button
                variant="questTavern"
                size="icon"
                className="relative size-[30px] rounded-full"
              />
            }
          >
            <BellIcon className="size-4" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-quest-unread-badge px-1 text-[10px] text-white">
                {unread}
              </span>
            )}
            {busy && (
              <span
                className="absolute -bottom-1 -right-1 size-2 animate-pulse rounded-full bg-quest-busy-dot"
                aria-hidden="true"
              />
            )}
          </Popover.Trigger>
          <span className="sr-only" role="status" aria-live="polite">
            {unread > 0 ? `${unread}件の未読通知があります` : ""}
          </span>
        </div>
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="end"
            sideOffset={10}
            collisionPadding={12}
            className="z-40"
          >
            <Popover.Popup
              className="max-h-[min(70dvh,480px,var(--available-height))] w-[min(350px,calc(100vw-24px))] overflow-auto rounded border border-quest-frame bg-quest-card p-4 text-quest-card-ink shadow-xl outline-none"
              aria-label="通知一覧"
              finalFocus={() => !handingOffFocus.current}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <Popover.Title render={<h2 />} className="font-semibold">
                  通知
                </Popover.Title>
                <Popover.Close
                  render={<Button variant="unstyled" />}
                  className="text-sm underline"
                >
                  閉じる
                </Popover.Close>
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
                    <NotificationButton
                      read={Boolean(notification.readAt)}
                      title={notification.title}
                      detail={notification.reason}
                      disabled={opening}
                      onClick={() => void openNews(notification)}
                    />
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
                  className="mb-3 rounded border border-quest-error-box-line p-2 text-sm"
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
                    <NotificationButton
                      read={Boolean(insight.readAt)}
                      title={insight.diagram.title}
                      onClick={() => {
                        handingOffFocus.current = true;
                        setSelected(insight);
                        setListOpen(false);
                        void onRead(insight);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          finalFocus={triggerRef}
          className="fixed top-1/2 left-1/2 max-h-[88dvh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-quest-frame bg-quest-card p-6 text-quest-card-ink shadow-xl max-[520px]:p-4"
        >
          <DialogTitle className="mb-2 pr-8 text-xl font-semibold">
            {selected?.diagram.title ?? "学習内容のつながり"}
          </DialogTitle>
          <DialogDescription className="mb-4 text-sm text-quest-card-muted">
            学習済みのニュースを関連づけた図解です。新しいニュースそのものを生成する機能ではありません。
          </DialogDescription>
          {selected && <LearningDiagram insight={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
