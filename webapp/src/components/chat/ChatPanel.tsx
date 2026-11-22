import { useEffect, type Ref } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { MessageSquarePlusIcon } from "lucide-react";
import { clsx } from "cn";
import { Button } from "../ui/button";

// チャット欄。スマホでは、open のときだけポップアップとして表示する
//   threadId を変えると、CopilotChat は表示中の会話を消して、新しいスレッドにつなぎ直す
export default function ChatPanel({
  open,
  onClose,
  threadId,
  onNewThread,
  ref,
}: {
  open: boolean;
  onClose: () => void;
  threadId: string;
  onNewThread: () => void;
  ref: Ref<HTMLElement>;
}) {
  // スマホのチャットポップアップは、Escapeキーでも閉じられる
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <Button
          variant="unstyled"
          type="button"
          className="fixed inset-0 z-[25] hidden cursor-pointer border-0 bg-quest-chat-backdrop max-[900px]:block"
          aria-label="作戦会議を閉じる"
          onClick={onClose}
        />
      )}
      <aside
        id="quest-chat"
        className={clsx(
          "chat-area relative flex min-w-0 min-h-0 flex-col overflow-hidden rounded-[3px] border",
          "border-quest-chat-line shadow-[0_3px_14px_var(--quest-chat-shadow)]",
          "[&>*]:min-h-0 [&>*]:flex-1",
          "max-[900px]:h-[620px] max-[900px]:max-h-[85dvh] max-[900px]:min-h-[430px]",
          open
            ? // スマホでは、開いているときだけ、画面の上に重ねて出す
              [
                "max-[900px]:fixed max-[900px]:right-3 max-[900px]:bottom-3 max-[900px]:left-3",
                "max-[900px]:z-[30] max-[900px]:h-[min(640px,calc(100dvh-24px))]",
                "max-[900px]:max-h-[calc(100dvh-24px)] max-[900px]:min-h-0",
                "max-[900px]:border-quest-chat-popup-line",
                "max-[900px]:shadow-[0_12px_34px_var(--quest-chat-popup-shadow)]",
              ]
            : "max-[900px]:hidden",
        )}
        aria-label="チャット"
        aria-modal={open ? "true" : undefined}
        role={open ? "dialog" : undefined}
        ref={ref}
      >
        <Button
          type="button"
          variant="questOutline"
          size="icon"
          className={clsx(
            "absolute top-[10px] right-[10px] z-[4] size-[30px] rounded-full",
            "border-quest-chat-button-line bg-quest-chat-button-bg p-0 text-quest-chat-button-ink",
            "shadow-[0_2px_5px_var(--quest-chat-button-shadow)]",
            "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-quest-focus",
            "max-[900px]:right-[46px]",
          )}
          aria-label="新しい会話を始める"
          title="新しい会話"
          onClick={onNewThread}
        >
          <MessageSquarePlusIcon className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="questOutline"
          size="icon"
          className={clsx(
            "absolute top-[10px] right-[10px] z-[4] hidden size-[30px] rounded-full",
            "border-quest-chat-button-line bg-quest-chat-button-bg p-0 text-[22px] leading-none",
            "text-quest-chat-button-ink shadow-[0_2px_5px_var(--quest-chat-button-shadow)]",
            "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-quest-focus",
            "max-[900px]:inline-flex",
          )}
          aria-label="チャットを閉じる"
          onClick={onClose}
        >
          ×
        </Button>
        <CopilotChat
          threadId={threadId}
          labels={{
            chatInputPlaceholder: "クエストについて質問する",
          }}
        />
      </aside>
    </>
  );
}
