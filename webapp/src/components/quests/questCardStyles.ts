import type { CSSProperties } from "react";
import type { QuestStatus } from "../../lib/quests/model";

// 長いスタイル指定を、カードの組み立てや表示内容から分離する。
export const questCardClasses = {
  button: [
    "group relative block w-[var(--quest-width)] min-w-0 mt-[var(--shift)] cursor-pointer border-0 bg-transparent p-0 text-left text-[var(--ink)] [font:inherit] [transform:rotate(var(--tilt))] [transform-origin:var(--pin-left)_14px] transition-transform duration-300 [-webkit-tap-highlight-color:transparent]",
    "hover:z-[3] hover:[transform:rotate(calc(var(--tilt)*0.35))_translateY(-5px)] focus-visible:z-[3] focus-visible:outline-2 focus-visible:outline-offset-[8px] focus-visible:outline-quest-focus-card focus-visible:[transform:rotate(calc(var(--tilt)*0.35))_translateY(-5px)]",
    "motion-reduce:transition-none motion-reduce:hover:[transform:rotate(var(--tilt))] motion-reduce:focus-visible:[transform:rotate(var(--tilt))]",
  ].join(" "),
  sheet: [
    "quest-sheet relative block [--quest-curl:32px] [transform-origin:var(--pin-left)_14px] [filter:drop-shadow(2px_8px_6px_var(--quest-sheet-shadow))] transition-[--quest-curl,filter] duration-300 ease-[ease] animate-[paper-breeze_var(--breeze-duration)_ease-in-out_var(--breeze-delay)_infinite]",
    "group-hover:[--quest-curl:42px] group-focus-visible:[--quest-curl:42px] group-hover:[filter:drop-shadow(3px_12px_9px_var(--quest-sheet-shadow-hover))] group-focus-visible:[filter:drop-shadow(3px_12px_9px_var(--quest-sheet-shadow-hover))] group-hover:[animation-play-state:paused] group-focus-visible:[animation-play-state:paused]",
    "motion-reduce:animate-none motion-reduce:transition-none",
  ].join(" "),
  pin: "quest-pin absolute top-2 left-[var(--pin-left)] z-[3] size-[10px] rounded-full border border-quest-pin-line",
  paper: "quest-paper relative flex aspect-[1/1.4142] min-h-0 flex-col px-[23px] pt-[30px] pb-[23px]",
  fold: "quest-fold pointer-events-none absolute inset-0",
  turnedCorner: "quest-turn pointer-events-none absolute right-0 bottom-0 size-[var(--quest-curl)] [filter:drop-shadow(-2px_-2px_2px_var(--quest-sheet-turn-shadow))]",
  header: "flex flex-wrap justify-between gap-[5px] mb-[13px] border-b border-quest-sheet-header-line pb-[10px] font-mono text-[8px] tracking-[0.16em] text-quest-sheet-header-ink",
  headerLabel: "font-quest-display text-[9px] tracking-[0.19em]",
  title: "block font-quest-tavern text-[clamp(17px,1.4vw,21px)] leading-[1.6] font-semibold tracking-[0.025em] [overflow-wrap:anywhere] [text-wrap:pretty] max-[600px]:text-[20px]",
  summary: "mt-3 block font-quest-copy text-[12px] leading-[1.9] text-quest-sheet-summary [overflow-wrap:anywhere]",
  services: "mt-[17px] flex flex-wrap gap-x-[10px] gap-y-[5px] pr-[54px] font-mono text-[10px] leading-[1.6] text-quest-sheet-services",
  service: "border-b border-quest-sheet-services-line",
  metadata: "mt-auto grid grid-cols-1 gap-[5px] pt-[19px] pr-[85px] text-[10px]",
  status: "font-quest-tavern text-[10px] before:mr-[5px]",
  minutes: "font-quest-tavern text-[10px] text-quest-sheet-minutes",
  importance: "text-[9px] text-quest-sheet-importance",
};

export const questStatusClasses: Record<QuestStatus, string> = {
  cleared: "text-quest-status-cleared before:content-['✓']",
  viewed: "text-quest-status-viewed before:content-['◇']",
  todo: "text-quest-status-todo before:content-['◇']",
};

// IDから決めるので、絞り込みや状態の更新でも同じ紙の個性を保つ。
export function getQuestPaperStyle(id: string): CSSProperties {
  const seed = Array.from(id).reduce(
    (hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0,
    7,
  );
  return {
    "--tilt": `${((seed % 61) / 10 - 3) * 1.35}deg`,
    "--shift": `${(seed % 19) - 9}px`,
    "--pin-left": `${42 + (seed % 19)}%`,
    "--breeze-delay": `${-(seed % 130) / 10}s`,
    "--breeze-duration": `${8 + (seed % 6)}s`,
    "--stamp-tilt": `${-19 + (seed % 28)}deg`,
  } as CSSProperties;
}
