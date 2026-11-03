import { Button } from "../ui/button";

export interface OptionButtonItem {
  id: string;
  label: string;
  description?: string;
}

interface Props {
  options: readonly OptionButtonItem[];
  selectionMode: "single" | "multiple";
  selectedIds: readonly string[];
  onSelectionChange: (selectedIds: string[]) => void;
  disabled?: boolean;
}

const OPTION_CLASS =
  "h-auto w-full justify-start gap-2 whitespace-normal rounded-lg px-2.5 py-2 text-left font-normal text-inherit";
// 選択中の選択肢(ホバーしても、色を変えない)
const OPTION_SELECTED_CLASS = [
  "border-[#74532b]",
  "bg-[color-mix(in_srgb,#74532b_14%,transparent)]",
  "hover:bg-[color-mix(in_srgb,#74532b_14%,transparent)]",
].join(" ");
// 選択肢の左の丸(単一選択)・四角(複数選択)の印
const MARK_CLASS =
  "mt-0.5 flex size-4 shrink-0 items-center justify-center border border-[#9b7847] text-[10px] leading-none";

// 選択内容だけを差し替え、クイズや確認UIで共通して使う選択ボタン。
export default function OptionButtons({
  options,
  selectionMode,
  selectedIds,
  onSelectionChange,
  disabled = false,
}: Props) {
  const toggle = (id: string) => {
    if (selectionMode === "single") {
      onSelectionChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }

    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="grid gap-1.5" role="group" aria-label="選択肢">
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <Button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            variant="questOutline"
            className={`${OPTION_CLASS} ${selected ? OPTION_SELECTED_CLASS : ""}`}
            onClick={() => toggle(option.id)}
          >
            <span
              className={`${MARK_CLASS} ${
                selectionMode === "single" ? "rounded-full" : "rounded-[2px]"
              }`}
              aria-hidden="true"
            >
              {selected ? (selectionMode === "single" ? "●" : "✓") : null}
            </span>
            <span className="min-w-0">
              <span className="block">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 block text-xs text-[#746b5c]">
                  {option.description}
                </span>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
