import { useState } from "react";
import {
  UseAgentUpdate,
  useHumanInTheLoop,
  useAgent,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import {
  parseToolResult,
  type HumanInTheLoopProps,
} from "../../lib/copilotkit/toolResult";
import { Button } from "../../components/ui/button";
import { useQuestActions } from "../useQuestActions";
import ChatCard from "../../components/chat/ChatCard";
import OptionButtons from "../../components/human-in-the-loop/OptionButtons";

// 回答の結果の背景色
const RESULT_CLASS = {
  correct: "bg-[color-mix(in_srgb,var(--quest-success)_18%,transparent)]",
  wrong: "bg-[color-mix(in_srgb,var(--quest-wrong)_16%,transparent)]",
} as const;

// エージェントが、ツール呼び出し(show_quiz)の引数として渡す、理解度チェックの問題
const quizSchema = z.object({
  questId: z.string().describe("この問題の対象のクエストの ID"),
  question: z.string().describe("問題文"),
  options: z.array(z.string()).min(2).max(4).describe("選択肢(2〜4 個)"),
  answer: z.number().int().describe("正解の選択肢の番号(0 から始まる)"),
  explanation: z.string().describe("解説"),
});

type QuizProps = z.infer<typeof quizSchema>;

// エージェントに返す、初回の回答の内容
const quizAnswerSchema = z.object({
  selectedIndex: z.number(),
  selectedOption: z.string(),
  correct: z.boolean(),
});
type QuizAnswer = z.infer<typeof quizAnswerSchema>;

// 回答の結果(null は、まだ回答していない)
type Outcome = "correct" | "wrong" | null;

type Props = Partial<QuizProps> & HumanInTheLoopProps;

function readSubmittedOutcome(submittedAnswerJson?: string): Outcome {
  const submittedAnswer = parseToolResult(submittedAnswerJson, quizAnswerSchema);
  if (!submittedAnswer) return null;
  return submittedAnswer.correct ? "correct" : "wrong";
}

// F-03: クイズを表示し、ユーザーの初回回答を待ってエージェントへ返す。
export function useShowQuiz() {
  useHumanInTheLoop({
    name: "show_quiz",
    description:
      "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。" +
      "questId は、クエスト一覧の id を、そのまま使う。" +
      "ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
    parameters: quizSchema,
    render: ({ args, respond, result }) => (
      <Quiz {...args} respond={respond} result={result} />
    ),
  });
}

// 引数は、ストリーミングで少しずつ届くため、届いていない項目は undefined になる
// 単一選択の問題。回答するまで、正解は示さない。不正解なら、再回答できる
// エージェントに返すのは、初回の回答だけ(再回答は、画面の中だけ)
export function Quiz(props: Props) {
  const {
    questId,
    question,
    options,
    answer,
    explanation,
    respond,
    result: submittedAnswerJson,
  } = props;
  const actions = useQuestActions();
  // 実行中かどうかだけを見る(メッセージのストリーミングごとに描画し直さない)
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnRunStatusChanged] });
  const { copilotkit } = useCopilotKit();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  // 直近の回答の結果
  const [currentOutcome, setCurrentOutcome] = useState<Outcome>(null);
  // この画面での初回回答。再回答しても、上書きしない
  const [firstLocalOutcome, setFirstLocalOutcome] = useState<Outcome>(null);
  // 再読み込みなどで画面の状態が失われても、エージェントに返した内容から、初回の結果を復元する
  const firstAnswerOutcome =
    firstLocalOutcome ?? readSubmittedOutcome(submittedAnswerJson);

  // 引数は少しずつ届く。answer が選択肢の範囲外のうちは、問題を出さない
  const quizReady =
    question &&
    options &&
    options.length >= 2 &&
    answer !== undefined &&
    answer >= 0 &&
    answer < options.length &&
    explanation;
  if (!quizReady) {
    return <ChatCard loading>問題を作成しています…</ChatCard>;
  }

  const submitAnswer = () => {
    if (selectedIndex === null) return;
    const outcome = selectedIndex === answer ? "correct" : "wrong";
    setCurrentOutcome(outcome);
    if (firstAnswerOutcome === null) {
      setFirstLocalOutcome(outcome);
      const userAnswer: QuizAnswer = {
        selectedIndex,
        selectedOption: options[selectedIndex],
        correct: outcome === "correct",
      };
      void respond?.(userAnswer);
      // 週間レポート用に、初回の回答を保存する(questId が、ボードのクエストに一致するときだけ)
      if (questId && actions.statusOf(questId) !== undefined) {
        actions.recordAnswer(questId, userAnswer.correct);
      }
    }
  };
  const resetAnswer = () => {
    setSelectedIndex(null);
    setCurrentOutcome(null);
  };
  const choicesLocked = currentOutcome !== null;
  const outcomeLabel = currentOutcome === "correct" ? "正解です" : "不正解です";
  const firstAnswerLabel = firstAnswerOutcome === "correct" ? "正解" : "不正解";

  // 続けて出題を頼む(ユーザーがチャットに書いたのと同じ形で、エージェントに送る)
  const requestAnotherQuiz = async () => {
    if (!questId || agent.isRunning) return;
    agent.addMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: `このクエスト(id: ${questId})について、さっきとは別の観点で、理解度チェックをもう一問出して`,
    });
    try {
      await copilotkit.runAgent({ agent });
    } catch (error) {
      console.error("理解度チェックの追加の依頼に失敗しました", error);
    }
  };

  return (
    <ChatCard role="group" aria-label="理解度チェック">
      <div className="mb-1 text-xs tracking-[0.08em] text-quest-brown">
        理解度チェック
      </div>
      <p className="mb-2.5 font-medium">{question}</p>
      <OptionButtons
        options={options.map((label, index) => ({ id: String(index), label }))}
        selectionMode="single"
        selectedIds={selectedIndex === null ? [] : [String(selectedIndex)]}
        onSelectionChange={(ids) =>
          setSelectedIndex(ids.length === 0 ? null : Number(ids[0]))
        }
        disabled={choicesLocked}
      />

      {currentOutcome === null ? (
        <Button
          type="button"
          variant="questPrimary"
          size="lg"
          className="mt-2.5"
          disabled={selectedIndex === null}
          onClick={submitAnswer}
        >
          回答する
        </Button>
      ) : (
        <div
          className={`mt-2.5 rounded-lg px-3 py-2.5 ${RESULT_CLASS[currentOutcome]}`}
          role="status"
        >
          <strong>{outcomeLabel}</strong>
          <p className="mt-1">{explanation}</p>
          {firstAnswerOutcome && (
            <p className="mt-1 text-xs text-quest-card-muted">
              初回の回答: {firstAnswerLabel}
            </p>
          )}
          {currentOutcome === "wrong" && (
            <Button
              type="button"
              variant="questPrimary"
              size="lg"
              className="mt-2.5"
              onClick={resetAnswer}
            >
              もう一度答える
            </Button>
          )}
        </div>
      )}

      {/* questId が、ボードのクエストに一致しないとき(エージェントが、ID を間違えたとき)は、出さない */}
      {currentOutcome !== null &&
        questId &&
        actions.statusOf(questId) !== undefined && (
          <div
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-quest-card-line pt-3"
            aria-label="次の操作"
          >
            {actions.statusOf(questId) === "cleared" ? (
              <span className="font-medium text-quest-success" role="status">
                クリア済みです{actions.isReview(questId) && "(復習候補)"}
              </span>
            ) : (
              // 正解・不正解にかかわらず、回答したらクリアできる
              // 不正解のままクリアすると、復習候補になる
              <Button
                type="button"
                variant="questPrimary"
                size="lg"
                className="mt-0"
                onClick={() => actions.clear(questId, currentOutcome === "wrong")}
              >
                クエストをクリアする
              </Button>
            )}
            <Button
              type="button"
              variant="questOutline"
              size="lg"
              disabled={agent.isRunning}
              onClick={() => void requestAnotherQuiz()}
            >
              もう一問
            </Button>
            <Button
              type="button"
              variant="questOutline"
              size="lg"
              onClick={() => actions.open(questId)}
            >
              詳細へ戻る
            </Button>
            <Button
              type="button"
              variant="questOutline"
              size="lg"
              onClick={actions.focusChat}
            >
              追加で質問する
            </Button>
          </div>
        )}
    </ChatCard>
  );
}
