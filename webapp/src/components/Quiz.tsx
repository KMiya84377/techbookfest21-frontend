import { useState } from "react";
import { z } from "zod";
import { useQuestActions } from "./QuestActions";

// エージェントが、ツール呼び出し(show_quiz)の引数として渡す、理解度チェックの問題
export const quizSchema = z.object({
  questId: z.string().describe("この問題の対象のクエストの ID"),
  question: z.string().describe("問題文"),
  options: z.array(z.string()).describe("選択肢(2〜4 個)"),
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
  const { questId, question, options, answer, explanation, respond, result: returned } = props;
  const actions = useQuestActions();
  const [selected, setSelected] = useState<number | null>(null);
  // 直近の回答の結果(null は、まだ回答していない)
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  // 初回の回答の結果。再回答しても、上書きしない
  const [firstResult, setFirstResult] = useState<"correct" | "wrong" | null>(null);
  // 再読み込みなどで画面の状態が失われても、エージェントに返した内容から、初回の結果を復元する
  const first = firstResult ?? parseFirstResult(returned);

  const ready = question && options && options.length >= 2 && answer !== undefined && explanation;
  if (!ready) {
    return <div className="quiz quiz-loading">問題を作成しています…</div>;
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
    }
  };
  const retry = () => {
    setSelected(null);
    setResult(null);
  };
  const locked = result !== null;

  return (
    <div className="quiz" role="group" aria-label="理解度チェック">
      <div className="quiz-kicker">理解度チェック</div>
      <p className="quiz-question">{question}</p>
      <div className="quiz-options" role="radiogroup" aria-label="選択肢">
        {options.map((option, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={selected === i}
            disabled={locked}
            className={selected === i ? "quiz-option selected" : "quiz-option"}
            onClick={() => setSelected(i)}
          >
            {option}
          </button>
        ))}
      </div>

      {result === null ? (
        <button type="button" className="quiz-submit" disabled={selected === null} onClick={submit}>
          回答する
        </button>
      ) : (
        <div className={`quiz-result ${result}`} role="status">
          <strong>{result === "correct" ? "正解です" : "不正解です"}</strong>
          <p>{explanation}</p>
          {first && (
            <p className="quiz-first">
              初回の回答: {first === "correct" ? "正解" : "不正解"}
            </p>
          )}
          {result === "wrong" && (
            <button type="button" className="quiz-submit" onClick={retry}>
              もう一度答える
            </button>
          )}
        </div>
      )}

      {/* questId が、ボードのクエストに一致しないとき(エージェントが、ID を間違えたとき)は、出さない */}
      {result !== null && questId && actions.statusOf(questId) !== undefined && (
        <div className="quiz-actions" aria-label="次の操作">
          {actions.statusOf(questId) === "cleared" ? (
            <span className="quiz-cleared" role="status">
              クリア済みです{actions.isReview(questId) && "(復習候補)"}
            </span>
          ) : (
            // 正解・不正解にかかわらず、回答したらクリアできる(仕様書 F-06)
            // 不正解のままクリアすると、復習候補になる
            <button
              type="button"
              className="quiz-submit"
              onClick={() => actions.clear(questId, result === "wrong")}
            >
              クエストをクリアする
            </button>
          )}
          <button type="button" className="quiz-secondary" onClick={() => actions.open(questId)}>
            詳細へ戻る
          </button>
          <button type="button" className="quiz-secondary" onClick={actions.focusChat}>
            追加で質問する
          </button>
        </div>
      )}
    </div>
  );
}
