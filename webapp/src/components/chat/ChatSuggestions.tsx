import { useConfigureSuggestions } from "@copilotkit/react-core/v2";

export default function ChatSuggestions() {
  useConfigureSuggestions({
    instructions: [
      "直近の会話と、利用可能な画面操作・ツールに基づいて、ユーザーが次にできる具体的な質問や操作を提案してください。",
      "候補は直前の会話に関連させ、すでに完了した依頼を繰り返さないでください。",
      "利用可能なツールで実行できない操作や、画面状態・会話に根拠のないクエスト情報は提案しないでください。",
      "候補のタイトルは短く、メッセージはチャットにそのまま送れる自然な日本語にしてください。",
    ].join("\n"),
    minSuggestions: 2,
    maxSuggestions: 3,
    available: "after-first-message",
  });

  return null;
}
