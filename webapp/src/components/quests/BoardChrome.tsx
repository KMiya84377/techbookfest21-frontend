import { Settings2Icon } from "lucide-react";
import { AUTH_DISABLED } from "../../lib/blocks/config";
import { Button } from "../ui/button";

// クエストボードの飾り(角の印、設定ボタン、mock モードの表示)
export default function BoardChrome({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  return (
    <>
      <span
        className="pointer-events-none absolute top-2 left-[11px] z-[4] text-[19px] text-[#aa8955] [text-shadow:0_2px_2px_#000]"
        aria-hidden="true"
      >
        ✦
      </span>
      <span
        className="pointer-events-none absolute top-2 right-[11px] z-[4] text-[19px] text-[#aa8955] [text-shadow:0_2px_2px_#000]"
        aria-hidden="true"
      >
        ✦
      </span>
      <Button
        type="button"
        variant="questTavern"
        size="icon"
        className="absolute top-[7px] right-[39px] z-[6] size-[30px] rounded-full border-[#c2a36888] bg-[#241a13e8] p-0 text-[#e6d2aa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e6c98f]"
        aria-label="ユーザー設定を開く"
        title="ユーザー設定"
        onClick={onOpenSettings}
      >
        <Settings2Icon className="size-4" aria-hidden="true" />
      </Button>
      {AUTH_DISABLED && (
        <div className="pointer-events-none absolute right-3.5 bottom-2 z-[5] border border-[#91754c55] bg-[#241a13e8] px-2 py-1 font-mono text-[9px] tracking-[0.08em] text-[#d6c09b]">
          SAMPLE QUESTS · mock
        </div>
      )}
    </>
  );
}
