import { useState } from "react";
import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
import { z } from "zod";
import {
  parseToolResult,
  type HumanInTheLoopProps,
} from "../../lib/copilotkit/toolResult";
import { Button } from "../../components/ui/button";
import ChatCard from "../../components/chat/ChatCard";
import OptionButtons from "../../components/human-in-the-loop/OptionButtons";

const optionSchema = z.object({
  id: z.string().min(1).describe("選択肢を識別する一意な ID"),
  label: z.string().min(1).describe("選択肢の短いラベル"),
  description: z.string().optional().describe("選択肢の補足説明"),
});

const choicePromptSchema = z.object({
  question: z.string().min(1).describe("ユーザーに選んでもらう質問"),
  options: z
    .array(optionSchema)
    .min(2)
    .max(6)
    .describe("ユーザーが選ぶ候補。2〜6 件"),
  selectionMode: z
    .enum(["single", "multiple"])
    .describe("単一選択か複数選択か"),
});

type ChoicePromptArgs = z.infer<typeof choicePromptSchema>;

// エージェントに返した、選択の結果
const choicePromptResultSchema = z.object({
  selectedOptions: z.array(optionSchema),
});

type Props = Partial<ChoicePromptArgs> & HumanInTheLoopProps;

// 候補をボタンで表示し、ユーザーの選択を待ってエージェントへ返す。
export function useShowChoices() {
  useHumanInTheLoop({
    name: "show_choices",
    description:
      "ユーザーに有限個の候補から選んでもらう必要があるとき、" +
      "質問と2〜6個の選択肢をボタンでチャットに表示する。" +
      "選択結果が返るまで待ち、その結果を使って会話を続ける。" +
      "理解度クイズには show_quiz を使う",
    parameters: choicePromptSchema,
    render: ({ args, respond, result }) => (
      <ChoicePrompt {...args} respond={respond} result={result} />
    ),
  });
}

// 固定レイアウトに、エージェントが渡した質問と選択肢だけを差し込む。
export function ChoicePrompt({
  question,
  options,
  selectionMode,
  respond,
  result: submittedSelectionJson,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  // 届きかけ・壊れた結果は null になり、選択肢の表示を続ける
  const submittedSelection = parseToolResult(submittedSelectionJson, choicePromptResultSchema);

  const choicesReady =
    question && options && options.length >= 2 && selectionMode !== undefined;
  if (!choicesReady) {
    return <ChatCard loading>選択肢を準備しています…</ChatCard>;
  }

  const selectedOptions = options.filter((option) =>
    selectedIds.includes(option.id),
  );
  const submitLabel = isSubmitting ? "送信中…" : "選択する";
  const submitSelection = async () => {
    if (!respond || selectedOptions.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitFailed(false);
    try {
      await respond({ selectedOptions });
    } catch {
      setIsSubmitting(false);
      setSubmitFailed(true);
    }
  };

  return (
    <ChatCard as="section" aria-label="選択肢">
      <div className="mb-1 text-xs tracking-[0.08em] text-quest-brown">
        選択してください
      </div>
      <p className="mb-2.5 font-medium">{question}</p>
      <OptionButtons
        options={options}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        disabled={Boolean(submittedSelectionJson) || isSubmitting}
      />
      {submittedSelection ? (
        <p className="mt-2.5 text-xs text-quest-card-muted" role="status">
          選択しました:{" "}
          {submittedSelection.selectedOptions.map((option) => option.label).join("、")}
        </p>
      ) : (
        <Button
          type="button"
          variant="questPrimary"
          size="lg"
          className="mt-2.5"
          disabled={selectedOptions.length === 0 || !respond || isSubmitting}
          onClick={() => void submitSelection()}
        >
          {submitLabel}
        </Button>
      )}
      {submitFailed && (
        <p className="mt-2 text-xs text-destructive" role="alert">
          選択を送信できませんでした。もう一度お試しください。
        </p>
      )}
    </ChatCard>
  );
}
