import { Settings2Icon } from "lucide-react";
import { Button } from "../ui/button";

// クエストボードの飾り(角の印、設定ボタン)
export default function BoardChrome({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  return (
    <>
      <span
        className="pointer-events-none absolute top-2 left-[11px] z-[4] text-[19px] text-quest-ornament [text-shadow:0_2px_2px_var(--quest-ornament-shadow)]"
        aria-hidden="true"
      >
        ✦
      </span>
      <span
        className="pointer-events-none absolute top-2 right-[11px] z-[4] text-[19px] text-quest-ornament [text-shadow:0_2px_2px_var(--quest-ornament-shadow)]"
        aria-hidden="true"
      >
        ✦
      </span>
      <Button
        type="button"
        variant="questTavern"
        size="icon"
        className="absolute top-[7px] right-[39px] z-[6] size-[30px] rounded-full border-quest-corner-button-line bg-quest-corner-button-bg p-0 text-quest-corner-button-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quest-focus"
        aria-label="ユーザー設定を開く"
        title="ユーザー設定"
        onClick={onOpenSettings}
      >
        <Settings2Icon className="size-4" aria-hidden="true" />
      </Button>
    </>
  );
}
