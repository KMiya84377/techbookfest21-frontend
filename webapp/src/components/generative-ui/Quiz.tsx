import { useState } from "react";
import {
  UseAgentUpdate,
  useAgent,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import { Button } from "../ui/button";
import { useQuestActions } from "../quests/QuestActions";
import ChatCard from "./ChatCard";
import OptionButtons from "./OptionButtons";

// 回答の結果の背景色
const RESULT_CLASS = {
  correct: "bg-[color-mix(in_srgb,#3e7254_18%,transparent)]",
  wrong: "bg-[color-mix(in_srgb,#77362e_16%,transparent)]",
} as const;

// エージェントが、ツール呼び出し(show_quiz)の引数として渡す、理解度チェックの問題
export const quizSchema = z.object({
  questId: z.string().describe("この問題の対象のクエストの ID"),
  question: z.string().describe("問題文"),
  options: z.array(z.string()).min(2).max(4).describe("選択肢(2〜4 個)"),
  answer: z.number().int().describe("正解の選択肢の番号(0 から始まる)"),
  explanation: z.string().describe("解説"),
});

type QuizProps = z.infer<typeof quizSchema>;

// エージェントに返す、初回の回答の内容
export interface QuizAnswer {
  selectedIndex: number;
  selectedOption: string;
  correct: boolean;
}

interface Props extends Partial<QuizProps> {
  // 回答を、エージェントに返す関数(エージェントの応答待ちの間だけ、渡される)
  respond?: (result: unknown) => Promise<void>;
  // 回答済みのときの、エージェントに返した内容(JSON の文字列)
  result?: string;
}

function parseFirstResult(result?: string): "correct" | "wrong" | null {
  if (!result) return null;
  try {
    return (JSON.parse(result) as QuizAnswer).correct ? "correct" : "wrong";
  } catch {
    return null;
  }
}

// 引数は、ストリーミングで少しずつ届くため、届いていない項目は undefined になる
// 単一選択の問題。回答するまで、正解は示さない。不正解なら、再回答できる
// エージェントに返すのは、初回の回答だけ(再回答は、画面の中だけ)
export default function Quiz(props: Props) {
  const {
    questId,
    question,
    options,
    answer,
    explanation,
    respond,
    result: returned,
  } = props;
  const actions = useQuestActions();
  // 実行中かどうかだけを見る(メッセージのストリーミングごとに描画し直さない)
  const { agent } = useAgent({ updates: [UseAgentUpdate.OnRunStatusChanged] });
  const { copilotkit } = useCopilotKit();
  const [selected, setSelected] = useState<number | null>(null);
  // 直近の回答の結果(null は、まだ回答していない)
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  // 初回の回答の結果。再回答しても、上書きしない
  const [firstResult, setFirstResult] = useState<"correct" | "wrong" | null>(
    null,
  );
  // 再読み込みなどで画面の状態が失われても、エージェントに返した内容から、初回の結果を復元する
  const first = firstResult ?? parseFirstResult(returned);

  // 引数は少しずつ届く。answer が選択肢の範囲外のうちは、問題を出さない
  const ready =
    question &&
    options &&
    options.length >= 2 &&
    answer !== undefined &&
    answer >= 0 &&
    answer < options.length &&
    explanation;
  if (!ready) {
    return <ChatCard loading>問題を作成しています…</ChatCard>;
  }

  const submit = () => {
    if (selected === null) return;
    const outcome = selected === answer ? "correct" : "wrong";
    setResult(outcome);
    if (first === null) {
      setFirstResult(outcome);
      const answered: QuizAnswer = {
        selectedIndex: selected,
        selectedOption: options[selected],
        correct: outcome === "correct",
      };
      void respond?.(answered);
      // 週間レポート用に、初回の回答を保存する(questId が、ボードのクエストに一致するときだけ)
      if (questId && actions.statusOf(questId) !== undefined) {
        actions.recordAnswer(questId, answered.correct);
      }
    }
  };
  const retry = () => {
    setSelected(null);
    setResult(null);
  };
  const locked = result !== null;

  // 続けて出題を頼む(ユーザーがチャットに書いたのと同じ形で、エージェントに送る)
  const askAnother = async () => {
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
      <div className="mb-1 text-xs tracking-[0.08em] text-[#74532b]">
        理解度チェック
      </div>
      <p className="mb-2.5 font-medium">{question}</p>
      <OptionButtons
        options={options.map((label, i) => ({ id: String(i), label }))}
        selectionMode="single"
        selectedIds={selected === null ? [] : [String(selected)]}
        onSelectionChange={(ids) =>
          setSelected(ids.length === 0 ? null : Number(ids[0]))
        }
        disabled={locked}
      />

      {result === null ? (
        <Button
          type="button"
          variant="questPrimary"
          size="lg"
          className="mt-2.5"
          disabled={selected === null}
          onClick={submit}
        >
          回答する
        </Button>
      ) : (
        <div
          className={`mt-2.5 rounded-lg px-3 py-2.5 ${RESULT_CLASS[result]}`}
          role="status"
        >
          <strong>{result === "correct" ? "正解です" : "不正解です"}</strong>
          <p className="mt-1">{explanation}</p>
          {first && (
            <p className="mt-1 text-xs text-[#746b5c]">
              初回の回答: {first === "correct" ? "正解" : "不正解"}
            </p>
          )}
          {result === "wrong" && (
            <Button
              type="button"
              variant="questPrimary"
              size="lg"
              className="mt-2.5"
              onClick={retry}
            >
              もう一度答える
            </Button>
          )}
        </div>
      )}

      {/* questId が、ボードのクエストに一致しないとき(エージェントが、ID を間違えたとき)は、出さない */}
      {result !== null &&
        questId &&
        actions.statusOf(questId) !== undefined && (
          <div
            className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#d9c9aa] pt-3"
            aria-label="次の操作"
          >
            {actions.statusOf(questId) === "cleared" ? (
              <span className="font-medium text-[#3e7254]" role="status">
                クリア済みです{actions.isReview(questId) && "(復習候補)"}
              </span>
            ) : (
              // 正解・不正解にかかわらず、回答したらクリアできる(仕様書 F-06)
              // 不正解のままクリアすると、復習候補になる
              <Button
                type="button"
                variant="questPrimary"
                size="lg"
                className="mt-0"
                onClick={() => actions.clear(questId, result === "wrong")}
              >
                クエストをクリアする
              </Button>
            )}
            <Button
              type="button"
              variant="questOutline"
              size="lg"
              disabled={agent.isRunning}
              onClick={() => void askAnother()}
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
