import { useConfigureSuggestions } from "@copilotkit/react-core/v2";

export function useChatSuggestions() {
  // 会話前は、AIの生成を待たずに固定の候補を表示する。
  useConfigureSuggestions({
    suggestions: [
      {
        title: "おすすめのニュース",
        message: "表示中のニュースから、学習におすすめのものを教えてください。",
      },
      {
        title: "理解度チェック",
        message: "ニュースを選んで、理解度チェックに挑戦したいです。",
      },
      {
        title: "週間レポート",
        message: "今週の学習レポートを表示してください。",
      },
    ],
    available: "before-first-message",
  });

  // 会話後は、やり取りに合った候補をAIが生成する。
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
}
