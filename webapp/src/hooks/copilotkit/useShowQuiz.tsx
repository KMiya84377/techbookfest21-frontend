import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
import Quiz, { quizSchema } from "../../components/human-in-the-loop/Quiz";

// F-03: クイズを表示し、ユーザーの初回回答を待ってエージェントへ返す。
export function useShowQuiz() {
  useHumanInTheLoop({
    name: "show_quiz",
    description:
      "クエストの内容に合わせた、単一選択の理解度チェックの問題を、チャットに表示する。questId は、クエスト一覧の id を、そのまま使う。ユーザーが回答すると、その内容(選んだ選択肢と、正誤)が返る",
    parameters: quizSchema,
    render: ({ args, respond, result }) => (
      <Quiz {...args} respond={respond} result={result} />
    ),
  });
}
