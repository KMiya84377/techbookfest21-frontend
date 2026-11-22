import { clsx } from "cn";
import { useState } from "react";
import {
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
import QuestCard from "./QuestCard";

const STATUSES: QuestStatus[] = ["todo", "viewed", "cleared"];
const TABS: { key: "all" | QuestStatus; label: string }[] = [
  { key: "all", label: "すべて" },
  ...STATUSES.map((status) => ({ key: status, label: STATUS_LABEL[status] })),
];

const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

const SCATTER_CLASS = [
  // 基本
  "relative z-[1] grid [--quest-width:360px]",
  "grid-cols-[repeat(auto-fit,minmax(var(--quest-width),var(--quest-width)))] items-start",
  "justify-center gap-x-[27px] gap-y-7 px-2 pt-[26px] pb-10 [perspective:1600px]",
  // 4 枚ごとのずらし
  "[&>button:nth-child(4n+2)]:mt-12",
  "[&>button:nth-child(4n+3)]:left-3",
  "[&>button:nth-child(4n+4)]:mt-[15px] [&>button:nth-child(4n+4)]:left-[-8px]",
  // 1750px 以上
  "min-[1750px]:grid-cols-[repeat(3,var(--quest-width))]",
  // 901〜1160px
  "min-[901px]:max-[1160px]:[--quest-width:340px] min-[901px]:max-[1160px]:mx-auto",
  "min-[901px]:max-[1160px]:max-w-[460px]",
  // 900px 以下
  "max-[900px]:[--quest-width:340px]",
  "max-[900px]:grid-cols-[minmax(0,min(var(--quest-width),100%))]",
  "max-[900px]:[&>button]:w-[min(var(--quest-width),100%)]",
  // 600px 以下
  "max-[600px]:[--quest-width:320px] max-[600px]:gap-y-[27px] max-[600px]:px-[7px]",
  "max-[600px]:pt-[26px] max-[600px]:pb-[35px] max-[600px]:[&>button:nth-child(n)]:mt-0",
  "max-[600px]:[&>button:nth-child(n)]:ml-0",
  "max-[600px]:[&>button:nth-child(n)]:w-[min(var(--quest-width),100%)]",
  "max-[600px]:[&>button:nth-child(3n)]:left-[7px]",
].join(" ");

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
  const filteredQuests = applyFilter(quests, filter).sort(
    (a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance],
  );
  const conditions = describeFilter(filter);
  const activeTab = filter.status ?? "all";

  // クエストの領域に出すもの: クエストがない、条件に合うものがない、一覧のどれか
  const renderQuests = () => {
    if (quests.length === 0)
      return (
        <p className="px-0 py-8 text-[var(--board-text)]">
          クエストがまだありません。チャットで、クエストを探せます。
        </p>
      );
    if (filteredQuests.length === 0)
      return (
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
      );
    return (
      <div className={SCATTER_CLASS}>
        {filteredQuests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            windEnabled={windEnabled}
            onOpen={onOpen}
          />
        ))}
      </div>
    );
  };

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
            {filteredQuests.length} 件の依頼
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
              className={clsx(
                "min-h-8 rounded-[1px] border border-transparent bg-transparent px-[9px] py-1 text-[11px]",
                "text-quest-tab-ink shadow-none",
                "max-[600px]:min-h-[38px]",
                "data-[pressed=true]:border-quest-tab-selected-line",
                "data-[pressed=true]:bg-quest-tab-selected-bg",
                "data-[pressed=true]:text-quest-tab-selected-ink",
                "data-[pressed=true]:shadow-[inset_0_0_8px_var(--quest-tab-selected-glow)]",
                "hover:bg-quest-tab-hover-bg hover:text-quest-tab-hover-ink",
                "focus-visible:outline-2 focus-visible:outline-offset-3",
                "focus-visible:outline-quest-focus-tab",
              )}
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

      {renderQuests()}
      <footer className={clsx(
        "relative z-[1] flex flex-wrap justify-between gap-[15px] px-0 pt-[5px] pb-6",
        "font-quest-tavern text-[11px] tracking-[0.04em] text-quest-board-footer",
        "max-[600px]:text-[10px]",
      )}>
        <Button
          variant="ghost"
          size="xs"
          className={clsx(
            "h-auto rounded-none border-0 border-b border-quest-board-footer-line bg-transparent px-0",
            "py-1 text-[9px] font-mono font-normal text-quest-board-footer shadow-none",
            "hover:bg-transparent hover:text-quest-board-footer",
            "focus-visible:outline-2 focus-visible:outline-offset-[5px]",
            "focus-visible:outline-[var(--brass)]",
          )}
          type="button"
          aria-pressed={windEnabled}
          onClick={() => setWindEnabled((enabled) => !enabled)}
        >
          紙の揺れ {windEnabled ? "ON" : "OFF"}
        </Button>
      </footer>
      <div
        className={clsx(
          "pointer-events-none mx-auto mt-[-14px] flex w-[165px] flex-col items-center gap-[10px]",
          "text-quest-board-emblem opacity-[0.22]",
        )}
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
