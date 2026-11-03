import { useState } from "react";
import { z } from "zod";
import { Button } from "../ui/button";
import ChatCard from "./ChatCard";
import OptionButtons, { type OptionButtonItem } from "./OptionButtons";

export const choicePromptSchema = z.object({
  question: z.string().min(1).describe("ユーザーに選んでもらう質問"),
  options: z
    .array(
      z.object({
        id: z.string().min(1).describe("選択肢を識別する一意な ID"),
        label: z.string().min(1).describe("選択肢の短いラベル"),
        description: z.string().optional().describe("選択肢の補足説明"),
      }),
    )
    .min(2)
    .max(6)
    .describe("ユーザーが選ぶ候補。2〜6 件"),
  selectionMode: z
    .enum(["single", "multiple"])
    .describe("単一選択か複数選択か"),
});

type ChoicePromptArgs = z.infer<typeof choicePromptSchema>;
type ChoicePromptResult = {
  selectedOptions: OptionButtonItem[];
};

interface Props extends Partial<ChoicePromptArgs> {
  respond?: (result: unknown) => Promise<void>;
  result?: string;
}

function parseResult(result?: string): ChoicePromptResult | null {
  if (!result) return null;
  try {
    const value: unknown = JSON.parse(result);
    if (
      typeof value === "object" &&
      value !== null &&
      "selectedOptions" in value &&
      Array.isArray(value.selectedOptions)
    ) {
      return {
        selectedOptions: value.selectedOptions.filter(
          (option): option is OptionButtonItem =>
            typeof option === "object" &&
            option !== null &&
            "id" in option &&
            typeof option.id === "string" &&
            "label" in option &&
            typeof option.label === "string",
        ),
      };
    }
  } catch {
    // 届きかけ・壊れた結果は無視して、選択肢の表示を続ける
  }
  return null;
}

// 固定レイアウトに、エージェントが渡した質問と選択肢だけを差し込む。
export default function ChoicePrompt({
  question,
  options,
  selectionMode,
  respond,
  result: returned,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const response = parseResult(returned);

  const ready =
    question && options && options.length >= 2 && selectionMode !== undefined;
  if (!ready) {
    return <ChatCard loading>選択肢を準備しています…</ChatCard>;
  }

  const selectedOptions = options.filter((option) =>
    selectedIds.includes(option.id),
  );
  const submit = async () => {
    if (!respond || selectedOptions.length === 0 || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      await respond({ selectedOptions });
    } catch {
      setSending(false);
      setSendFailed(true);
    }
  };

  return (
    <ChatCard as="section" aria-label="選択肢">
      <div className="mb-1 text-xs tracking-[0.08em] text-[#74532b]">
        選択してください
      </div>
      <p className="mb-2.5 font-medium">{question}</p>
      <OptionButtons
        options={options}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        disabled={Boolean(returned) || sending}
      />
      {response ? (
        <p className="mt-2.5 text-xs text-[#746b5c]" role="status">
          選択しました:{" "}
          {response.selectedOptions.map((option) => option.label).join("、")}
        </p>
      ) : (
        <Button
          type="button"
          variant="questPrimary"
          size="lg"
          className="mt-2.5"
          disabled={selectedOptions.length === 0 || !respond || sending}
          onClick={() => void submit()}
        >
          {sending ? "送信中…" : "選択する"}
        </Button>
      )}
      {sendFailed && (
        <p className="mt-2 text-xs text-[#8a1f1f]" role="alert">
          選択を送信できませんでした。もう一度お試しください。
        </p>
      )}
    </ChatCard>
  );
}
