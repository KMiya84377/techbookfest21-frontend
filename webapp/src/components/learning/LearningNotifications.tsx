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
import NewsNotificationList from "./NewsNotificationList";
import LearningInsightList from "./LearningInsightList";

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
  const [selectedInsight, setSelectedInsight] = useState<LearningInsight | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // ニュース詳細・図解へ移るときは、Popoverから通知ボタンへフォーカスを戻さない。
  const handingOffFocus = useRef(false);
  // Popover を閉じたあとに、通知ボタンへフォーカスを戻すか(true なら戻す。false なら動かさない)
  const returnFocusToTrigger = () => !handingOffFocus.current;
  const unread =
    insights.filter((insight) => !insight.readAt).length +
    news.filter((item) => !item.readAt).length;
  const openNewsNotification = async (notification: NewsNotification) => {
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
  const openLearningInsight = (insight: LearningInsight) => {
    handingOffFocus.current = true;
    setSelectedInsight(insight);
    setListOpen(false);
    void onRead(insight);
  };

  const retryNewsNotifications = () => {
    setOpenError(null);
    void onCheckNews();
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
              finalFocus={returnFocusToTrigger}
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
              <NewsNotificationList
                news={news}
                newsBusy={newsBusy}
                newsError={newsError}
                openError={openError}
                opening={opening}
                onRetry={retryNewsNotifications}
                onOpen={(notification) => void openNewsNotification(notification)}
              />
              <LearningInsightList
                insights={insights}
                busy={busy}
                error={error}
                onRetry={onRetry}
                onOpen={openLearningInsight}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Dialog
        open={selectedInsight !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedInsight(null);
        }}
      >
        <DialogContent
          finalFocus={triggerRef}
          className="fixed top-1/2 left-1/2 max-h-[88dvh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-quest-frame bg-quest-card p-6 text-quest-card-ink shadow-xl max-[520px]:p-4"
        >
          <DialogTitle className="mb-2 pr-8 text-xl font-semibold">
            {selectedInsight?.diagram.title ?? "学習内容のつながり"}
          </DialogTitle>
          <DialogDescription className="mb-4 text-sm text-quest-card-muted">
            学習済みのニュースを関連づけた図解です。新しいニュースそのものを生成する機能ではありません。
          </DialogDescription>
          {selectedInsight && <LearningDiagram insight={selectedInsight} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
