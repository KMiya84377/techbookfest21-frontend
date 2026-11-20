import { Toggle } from "@base-ui/react/toggle";
import { clsx } from "cn";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Button } from "../ui/button";

interface OptionButtonItem {
  id: string;
  label: string;
  description?: string;
}

interface Props {
  options: readonly OptionButtonItem[];
  selectionMode: "single" | "multiple";
  selectedIds: readonly string[];
  onSelectionChange: (selectedIds: string[]) => void;
  // true なら、すべての選択肢を押せなくする(回答済み、送信中など)
  disabled?: boolean;
}

const OPTION_CLASS =
  "h-auto w-full justify-start gap-2 whitespace-normal rounded-lg px-2.5 py-2 text-left font-normal text-inherit";
// 選択中の選択肢(ホバーしても、色を変えない)
const OPTION_SELECTED_CLASS = [
  "border-quest-brown",
  "bg-[color-mix(in_srgb,var(--quest-brown)_14%,transparent)]",
  "hover:bg-[color-mix(in_srgb,var(--quest-brown)_14%,transparent)]",
].join(" ");
// 選択肢の左の丸(単一選択)・四角(複数選択)の印
const MARK_CLASS =
  "mt-0.5 flex size-4 shrink-0 items-center justify-center border border-quest-option-mark-line text-[10px] leading-none";

// 選択内容だけを差し替え、クイズや確認UIで共通して使う選択ボタン。
// 単一選択でも再クリックで解除できるため、RadioGroupではなくToggleGroupを使う。
export default function OptionButtons({
  options,
  selectionMode,
  selectedIds,
  onSelectionChange,
  disabled = false,
}: Props) {
  // 選択中の選択肢に出す印(単一選択は丸、複数選択はチェック)
  const selectedMark = selectionMode === "single" ? "●" : "✓";

  return (
    <ToggleGroup
      className="grid gap-1.5"
      aria-label={
        selectionMode === "single" ? "選択肢（単一選択）" : "選択肢（複数選択）"
      }
      orientation="vertical"
      multiple={selectionMode === "multiple"}
      value={selectedIds}
      onValueChange={onSelectionChange}
      disabled={disabled}
    >
      {options.map((option) => {
        const selected = selectedIds.includes(option.id);
        return (
          <Toggle
            key={option.id}
            value={option.id}
            render={<Button type="button" variant="questOutline" />}
            className={clsx(OPTION_CLASS, selected && OPTION_SELECTED_CLASS)}
          >
            <span
              className={clsx(
                MARK_CLASS,
                selectionMode === "single" ? "rounded-full" : "rounded-[2px]",
              )}
              aria-hidden="true"
            >
              {selected ? selectedMark : null}
            </span>
            <span className="min-w-0">
              <span className="block">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 block text-xs text-quest-card-muted">
                  {option.description}
                </span>
              )}
            </span>
          </Toggle>
        );
      })}
    </ToggleGroup>
  );
}
