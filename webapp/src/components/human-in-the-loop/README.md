# human-in-the-loop

ユーザーの回答を待ち、その回答をAIエージェントへ返すUIを置きます。表示方法としては制御型Generative UIでもありますが、コードは回答待ちの責務でまとめています。ツール登録のフックは [`../../hooks/copilotkit/`](../../hooks/copilotkit/README.md) に置きます。

## ファイル

| ファイル | 役割 |
|---|---|
| `Quiz.tsx` | 理解度チェックの問題を表示し、ユーザーの初回の回答をエージェントへ返す |
| `ChoicePrompt.tsx` | 候補をボタンで表示し、選択結果をエージェントへ返す |
| `OptionButtons.tsx` | 共通の選択肢。Base UI ToggleGroupで単一・複数選択、選択解除、矢印キーによる移動を扱う |

## 連携

`../copilotkit/CopilotKitIntegration.tsx`が[useShowQuiz.tsx](../../hooks/copilotkit/useShowQuiz.tsx)・[useShowChoices.tsx](../../hooks/copilotkit/useShowChoices.tsx)を呼び、各ツールを登録します。回答待ちの間は`respond`を表示部品へ渡し、ユーザーが回答するとエージェントの処理を再開します。

チャット内の共通のカード枠は `../chat/ChatCard.tsx`、通常の表示部品は [`../generative-ui/`](../generative-ui/README.md) です。

新しい回答待ちのUIを足す場合は、引数のスキーマと表示部品をこのフォルダに作ります。`../../hooks/copilotkit/`に専用フックを作って`useHumanInTheLoop()`で登録し、`CopilotKitIntegration`から呼びます。
