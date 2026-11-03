import { useEffect, type Ref } from "react";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { MessageSquarePlusIcon } from "lucide-react";
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
        <button
          type="button"
          className="fixed inset-0 z-[25] hidden cursor-pointer border-0 bg-[#0e0a08a6] max-[900px]:block"
          aria-label="作戦会議を閉じる"
          onClick={onClose}
        />
      )}
      <aside
        id="quest-chat"
        className={`chat-area relative flex min-w-0 min-h-0 flex-col overflow-hidden rounded-[3px] border border-[#a489584f] shadow-[0_3px_14px_#0007] [&>*]:min-h-0 [&>*]:flex-1 max-[900px]:h-[620px] max-[900px]:max-h-[85dvh] max-[900px]:min-h-[430px]${open ? " max-[900px]:fixed max-[900px]:right-3 max-[900px]:bottom-3 max-[900px]:left-3 max-[900px]:z-[30] max-[900px]:h-[min(640px,calc(100dvh-24px))] max-[900px]:max-h-[calc(100dvh-24px)] max-[900px]:min-h-0 max-[900px]:border-[#c2a36899] max-[900px]:shadow-[0_12px_34px_#000b]" : " max-[900px]:hidden"}`}
        aria-label="チャット"
        aria-modal={open ? "true" : undefined}
        role={open ? "dialog" : undefined}
        ref={ref}
      >
        <Button
          type="button"
          variant="questOutline"
          size="icon"
          className="absolute top-[10px] right-[10px] z-[4] size-[30px] rounded-full border-[#8e764e88] bg-[#ead9b5e6] p-0 text-[#55432d] shadow-[0_2px_5px_#2c1b0c55] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#e6c98f] max-[900px]:right-[46px]"
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
          className="absolute top-[10px] right-[10px] z-[4] hidden size-[30px] rounded-full border-[#8e764e88] bg-[#ead9b5e6] p-0 text-[22px] leading-none text-[#55432d] shadow-[0_2px_5px_#2c1b0c55] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#e6c98f] max-[900px]:inline-flex"
          aria-label="チャットを閉じる"
          onClick={onClose}
        >
          ×
        </Button>
        <CopilotChat
          threadId={threadId}
          labels={{
            chatInputPlaceholder: "案内人にクエストについて聞く…",
          }}
        />
      </aside>
    </>
  );
}
