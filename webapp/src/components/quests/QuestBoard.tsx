import { useState, type CSSProperties } from "react";
import { clsx } from "cn";
import {
  IMPORTANCE_LABEL,
  RANK,
  STATUS_LABEL,
  type Quest,
  type QuestStatus,
} from "../../lib/quests/model";
import {
  applyFilter,
  describeFilter,
  type FilterPatch,
  type QuestFilter,
} from "../../lib/quests/filter";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import GuildEmblem from "./GuildEmblem";
import InkStamp from "./InkStamp";

const STATUSES: QuestStatus[] = ["todo", "viewed", "cleared"];
const TABS: { key: "all" | QuestStatus; label: string }[] = [
  { key: "all", label: "すべて" },
  ...STATUSES.map((status) => ({ key: status, label: STATUS_LABEL[status] })),
];

// 状態の表示の色と、先頭の印
const STATUS_CLASS: Record<QuestStatus, string> = {
  cleared: "text-quest-status-cleared before:content-['✓']",
  viewed: "text-quest-status-viewed before:content-['◇']",
  todo: "text-quest-status-todo before:content-['◇']",
};

const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

const SCATTER_CLASS = [
  // 基本
  "relative z-[1] grid [--quest-width:360px] grid-cols-[repeat(auto-fit,minmax(var(--quest-width),var(--quest-width)))] items-start justify-center gap-x-[27px] gap-y-7 px-2 pt-[26px] pb-10 [perspective:1600px]",
  // 4 枚ごとのずらし
  "[&>button:nth-child(4n+2)]:mt-12 [&>button:nth-child(4n+3)]:left-3 [&>button:nth-child(4n+4)]:mt-[15px] [&>button:nth-child(4n+4)]:left-[-8px]",
  // 1750px 以上
  "min-[1750px]:grid-cols-[repeat(3,var(--quest-width))]",
  // 901〜1160px
  "min-[901px]:max-[1160px]:[--quest-width:340px] min-[901px]:max-[1160px]:mx-auto min-[901px]:max-[1160px]:max-w-[460px]",
  // 900px 以下
  "max-[900px]:[--quest-width:340px] max-[900px]:grid-cols-[minmax(0,min(var(--quest-width),100%))] max-[900px]:[&>button]:w-[min(var(--quest-width),100%)]",
  // 600px 以下
  "max-[600px]:[--quest-width:320px] max-[600px]:gap-y-[27px] max-[600px]:px-[7px] max-[600px]:pt-[26px] max-[600px]:pb-[35px] max-[600px]:[&>button:nth-child(n)]:mt-0 max-[600px]:[&>button:nth-child(n)]:ml-0 max-[600px]:[&>button:nth-child(n)]:w-[min(var(--quest-width),100%)] max-[600px]:[&>button:nth-child(3n)]:left-[7px]",
].join(" ");

const QUEST_CARD_CLASS = [
  // 基本
  "group relative block w-[var(--quest-width)] min-w-0 mt-[var(--shift)] cursor-pointer border-0 bg-transparent p-0 text-left text-[var(--ink)] [font:inherit] [transform:rotate(var(--tilt))] [transform-origin:var(--pin-left)_14px] transition-transform duration-300 [-webkit-tap-highlight-color:transparent]",
  // ホバー・フォーカス
  "hover:z-[3] hover:[transform:rotate(calc(var(--tilt)*0.35))_translateY(-5px)] focus-visible:z-[3] focus-visible:outline-2 focus-visible:outline-offset-[8px] focus-visible:outline-quest-focus-card focus-visible:[transform:rotate(calc(var(--tilt)*0.35))_translateY(-5px)]",
  // 動きを減らす設定
  "motion-reduce:transition-none motion-reduce:hover:[transform:rotate(var(--tilt))] motion-reduce:focus-visible:[transform:rotate(var(--tilt))]",
].join(" ");

const QUEST_SHEET_CLASS = [
  // 基本
  "quest-sheet relative block [--quest-curl:32px] [transform-origin:var(--pin-left)_14px] [filter:drop-shadow(2px_8px_6px_var(--quest-sheet-shadow))] transition-[--quest-curl,filter] duration-300 ease-[ease] animate-[paper-breeze_var(--breeze-duration)_ease-in-out_var(--breeze-delay)_infinite]",
  // ホバー・フォーカス中(親)
  "group-hover:[--quest-curl:42px] group-focus-visible:[--quest-curl:42px] group-hover:[filter:drop-shadow(3px_12px_9px_var(--quest-sheet-shadow-hover))] group-focus-visible:[filter:drop-shadow(3px_12px_9px_var(--quest-sheet-shadow-hover))] group-hover:[animation-play-state:paused] group-focus-visible:[animation-play-state:paused]",
  // 動きを減らす設定
  "motion-reduce:animate-none motion-reduce:transition-none",
].join(" ");

// IDから決めるので、絞り込みや状態の更新でも同じ紙の個性を保つ。
function paperStyle(id: string): CSSProperties {
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

interface Props {
  quests: Quest[];
  filter: QuestFilter;
  onFilterChange: (patch: FilterPatch) => void;
  onOpen: (id: string) => void;
}

export default function QuestBoard({
  quests,
  filter,
  onFilterChange,
  onOpen,
}: Props) {
  const [windEnabled, setWindEnabled] = useState(true);
  // 重要度の高いクエストを、先に表示する
  const shown = applyFilter(quests, filter).sort(
    (a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance],
  );
  const conditions = describeFilter(filter);
  const activeTab = filter.status ?? "all";

  return (
    <section className="relative min-h-full" aria-label="クエストボード">
      <div className="flex flex-wrap items-center justify-between gap-[14px] pt-[28px] pb-[10px] max-[600px]:gap-[13px]">
        <div className="flex items-baseline gap-3">
          <h2 className="font-quest-tavern text-base font-medium tracking-[0.1em] text-[var(--board-text)]">
            クエストボード
          </h2>
          <span
            className="text-[10px] text-[var(--board-muted)]"
            aria-live="polite"
          >
            {shown.length} 件の依頼
            {conditions.length > 0 && ` / 全 ${quests.length} 件`}
          </span>
        </div>
        <ToggleGroup
          className="flex flex-wrap gap-1 max-[600px]:gap-[7px]"
          aria-label="状態で絞り込む"
          value={[activeTab]}
          onValueChange={(value) => {
            const selected = TABS.find((tab) => tab.key === value[0])?.key;
            if (!selected) return;
            onFilterChange({
              status: selected === "all" ? null : selected,
            });
          }}
        >
          {TABS.map((tab) => (
            <ToggleGroupItem
              key={tab.key}
              className="min-h-8 rounded-[1px] border border-transparent bg-transparent px-[9px] py-1 text-[11px] text-quest-tab-ink shadow-none max-[600px]:min-h-[38px] data-[pressed=true]:border-quest-tab-selected-line data-[pressed=true]:bg-quest-tab-selected-bg data-[pressed=true]:text-quest-tab-selected-ink data-[pressed=true]:shadow-[inset_0_0_8px_var(--quest-tab-selected-glow)] hover:bg-quest-tab-hover-bg hover:text-quest-tab-hover-ink focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-quest-focus-tab"
              value={tab.key}
            >
              {tab.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {conditions.length > 0 && (
        <div
          className="mb-3.5 flex flex-wrap items-center gap-1.5"
          aria-label="適用中の条件"
        >
          <span className="text-xs text-[var(--board-muted)]">
            適用中の条件
          </span>
          {conditions.map((condition) => (
            <Badge
              key={condition}
              variant="condition"
              className="rounded-full px-2 py-1 text-xs"
            >
              {condition}
            </Badge>
          ))}
          <Button
            type="button"
            variant="quest"
            size="sm"
            onClick={() => onFilterChange({ reset: true })}
          >
            条件をすべて解除
          </Button>
        </div>
      )}

      {quests.length === 0 ? (
        <p className="px-0 py-8 text-[var(--board-text)]">
          クエストがまだありません。チャットで、クエストを探せます。
        </p>
      ) : shown.length === 0 ? (
        <div className="px-0 py-8 text-[var(--board-text)]">
          <p>
            条件に合うクエストがありません。条件を減らすか、期間を広げてください。
          </p>
          <Button
            type="button"
            variant="questActive"
            size="sm"
            onClick={() => onFilterChange({ reset: true })}
          >
            条件をすべて解除する
          </Button>
        </div>
      ) : (
        <div className={SCATTER_CLASS}>
          {shown.map((quest) => (
            <Button
              variant="unstyled"
              key={quest.id}
              type="button"
              className={clsx(
                QUEST_CARD_CLASS,
                "quest",
                `status-${quest.status}`,
                `importance-${quest.importance}`,
              )}
              style={paperStyle(quest.id)}
              onClick={() => onOpen(quest.id)}
            >
              <span
                className="quest-pin absolute top-2 left-[var(--pin-left)] z-[3] size-[10px] rounded-full border border-quest-pin-line"
                aria-hidden="true"
              />
              <span
                className={clsx(
                  QUEST_SHEET_CLASS,
                  !windEnabled && "animate-none",
                )}
              >
                <span className="quest-paper relative flex aspect-[1/1.4142] min-h-0 flex-col px-[23px] pt-[30px] pb-[23px]">
                  <span
                    className="quest-fold pointer-events-none absolute inset-0"
                    aria-hidden="true"
                  />
                  <span className="flex flex-wrap justify-between gap-[5px] mb-[13px] border-b border-quest-sheet-header-line pb-[10px] font-mono text-[8px] tracking-[0.16em] text-quest-sheet-header-ink">
                    <span className="font-quest-display text-[9px] tracking-[0.19em]">
                      GUILD REQUEST
                    </span>
                    <span>
                      {quest.publishedAt.slice(0, 10).replaceAll("-", ".")}
                    </span>
                  </span>
                  <span className="block">
                    <span className="block font-quest-tavern text-[clamp(17px,1.4vw,21px)] leading-[1.6] font-semibold tracking-[0.025em] [overflow-wrap:anywhere] [text-wrap:pretty] max-[600px]:text-[20px]">
                      {quest.title}
                    </span>
                  </span>
                  <span className="mt-3 block font-quest-copy text-[12px] leading-[1.9] text-quest-sheet-summary [overflow-wrap:anywhere]">
                    {quest.summary}
                  </span>
                  <span className="mt-[17px] flex flex-wrap gap-x-[10px] gap-y-[5px] pr-[54px] font-mono text-[10px] leading-[1.6] text-quest-sheet-services">
                    {quest.services.map((service) => (
                      <span
                        key={service}
                        className="border-b border-quest-sheet-services-line"
                      >
                        {service}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto grid grid-cols-1 gap-[5px] pt-[19px] pr-[85px] text-[10px]">
                    <span
                      className={clsx(
                        "font-quest-tavern text-[10px] before:mr-[5px]",
                        STATUS_CLASS[quest.status],
                      )}
                    >
                      {STATUS_LABEL[quest.status]}
                      {quest.review && " · 復習"}
                    </span>
                    <span className="font-quest-tavern text-[10px] text-quest-sheet-minutes">
                      所要 約 {quest.minutes} 分
                    </span>
                    <span className="text-[9px] text-quest-sheet-importance">
                      {IMPORTANCE_LABEL[quest.importance]}
                    </span>
                  </span>
                  <InkStamp
                    rank={RANK[quest.importance]}
                    cleared={quest.status === "cleared"}
                  />
                </span>
                <span
                  className="quest-turn pointer-events-none absolute right-0 bottom-0 size-[var(--quest-curl)] [filter:drop-shadow(-2px_-2px_2px_var(--quest-sheet-turn-shadow))]"
                  aria-hidden="true"
                />
              </span>
            </Button>
          ))}
        </div>
      )}
      <footer className="relative z-[1] flex flex-wrap justify-between gap-[15px] px-0 pt-[5px] pb-6 font-quest-tavern text-[11px] tracking-[0.04em] text-quest-board-footer max-[600px]:text-[10px]">
        <Button
          variant="ghost"
          size="xs"
          className="h-auto rounded-none border-0 border-b border-quest-board-footer-line bg-transparent px-0 py-1 text-[9px] font-mono font-normal text-quest-board-footer shadow-none hover:bg-transparent hover:text-quest-board-footer focus-visible:outline-2 focus-visible:outline-offset-[5px] focus-visible:outline-[var(--brass)]"
          type="button"
          aria-pressed={windEnabled}
          onClick={() => setWindEnabled((enabled) => !enabled)}
        >
          紙の揺れ {windEnabled ? "ON" : "OFF"}
        </Button>
      </footer>
      <div
        className="pointer-events-none mx-auto mt-[-14px] flex w-[165px] flex-col items-center gap-[10px] text-quest-board-emblem opacity-[0.22]"
        aria-hidden="true"
      >
        <GuildEmblem className="w-[115px]" />
        <span className="font-quest-display text-[7px] tracking-[0.18em]">
          PER ASPERA AD ASTRA
        </span>
      </div>
    </section>
  );
}
