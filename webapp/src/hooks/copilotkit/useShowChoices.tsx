import { useHumanInTheLoop } from "@copilotkit/react-core/v2";
import ChoicePrompt, {
  choicePromptSchema,
} from "../../components/human-in-the-loop/ChoicePrompt";

// 候補をボタンで表示し、ユーザーの選択を待ってエージェントへ返す。
export function useShowChoices() {
  useHumanInTheLoop({
    name: "show_choices",
    description:
      "ユーザーに有限個の候補から選んでもらう必要があるとき、質問と2〜6個の選択肢をボタンでチャットに表示する。選択結果が返るまで待ち、その結果を使って会話を続ける。理解度クイズには show_quiz を使う",
    parameters: choicePromptSchema,
    render: ({ args, respond, result }) => (
      <ChoicePrompt {...args} respond={respond} result={result} />
    ),
  });
}
