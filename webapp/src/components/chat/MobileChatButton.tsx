import { clsx } from "cn";
import { Button } from "../ui/button";

// スマホで、チャットのポップアップを開くボタン
export default function MobileChatButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="questTavern"
      size="lg"
      className={clsx(
        "fixed right-[18px] bottom-[18px] z-20 hidden h-auto items-center gap-2 rounded-[2px]",
        "px-[15px] py-3 text-xs tracking-[0.08em] font-quest-tavern",
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-quest-focus",
        "max-[900px]:inline-flex",
      )}
      aria-expanded={false}
      aria-controls="quest-chat"
      onClick={onOpen}
    >
      <span
        className="size-[6px] rounded-full bg-quest-chat-open-dot shadow-[0_0_7px_var(--quest-chat-open-glow)]"
        aria-hidden="true"
      />
      作戦会議
    </Button>
  );
}
