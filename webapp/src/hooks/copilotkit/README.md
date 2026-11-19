# copilotkit

WebアプリとAIエージェントの状態共有・コンテキスト・ツール登録のカスタムフックを置きます。

## ファイル

| ファイル | 役割 |
|---|---|
| `useSharedAgentState.ts` | 読み書きできる状態共有(`useAgent`)。クエスト一覧と学習設定を共有し、保存後の再取得の要求に応える(記事 3.2) |
| `useScreenContext.ts` | 読み取り専用の状態共有(`useAgentContext`)。クエスト一覧、開いているクエスト、検索条件を渡す(記事 3.2、F-02) |
| `useUpdateQuestFilter.tsx` | `update_quest_filter`を登録し、検索条件を変更して結果をチャットに表示する |
| `useUpdateQuestDetail.tsx` | `update_quest_detail`を登録し、A2UIを詳細へ追記して同じ内容をチャットにも表示する(F-01) |
| `useReloadQuests.tsx` | `reload_quests`を登録し、一覧の再取得・共有状態の更新・件数の表示を行う |
| `useShowQuiz.tsx` | `show_quiz`を`useHumanInTheLoop`で登録し、クイズの初回回答を待つ(F-03、記事 3.4) |
| `useShowChoices.tsx` | `show_choices`を`useHumanInTheLoop`で登録し、候補からの選択結果を待つ(記事 3.4) |

[`CopilotKitIntegration.tsx`](../../components/copilotkit/CopilotKitIntegration.tsx) が `App.tsx` の `CopilotKitProvider` 内でこれらのフックを呼びます。画面に配置するこのコンポーネントは、`components/copilotkit/` に残しています。

## フロントエンドツール

| 名前 | 登録するファイル | 内容 |
|---|---|---|
| `update_quest_filter` | [useUpdateQuestFilter.tsx](useUpdateQuestFilter.tsx) | クエストボードの検索条件を変える |
| `update_quest_detail` | [useUpdateQuestDetail.tsx](useUpdateQuestDetail.tsx) | AIがA2UIで構成したUIを、開いている詳細へ追記・更新し、同じUIをチャットにも表示する |
| `reload_quests` | [useReloadQuests.tsx](useReloadQuests.tsx) | クエストを取得し直す(通常は共有状態の `refreshRequested` で自動更新される) |

ツール登録のフックは、フロントエンドツール・Human in the Loopともに1ツールにつき1ファイルです。各フックにツール名・説明・引数スキーマの指定・`render`をまとめ、`CopilotKitIntegration`から個別に呼びます。フロントエンドツールでは`handler`も定義します。共通の型や検証・反映処理は`lib`、表示部品は`components`に置きます。

`show_quiz`は[useShowQuiz.tsx](useShowQuiz.tsx)、`show_choices`は[useShowChoices.tsx](useShowChoices.tsx)で登録します。

## 共有する状態

- 共有状態 `questBoard`(クエスト一覧と、保存後の再取得の要求)と `userSettings`。`userSettings` は、保存済みの設定を読み込めてから渡します。
- context として、クエスト一覧、詳細を開いているクエスト、適用中の検索条件。context はエージェントの会話履歴(Memory)には保存されません。

## ツールを足す

1. 引数のスキーマ(zod)を決めます。
2. 結果を表示する場合は、`../../components/generative-ui/` に表示部品を作ります。
3. このフォルダに専用のカスタムフックを作り、`useFrontendTool()`で登録します。`handler`で画面の処理を呼び出し、`render`で結果を表示します。
4. `CopilotKitIntegration.tsx`から新しいフックを呼びます。エージェント側で特別な使い分けが必要な場合は、`chat-agent/`のプロンプトやツール定義も確認します。

ユーザーの回答を待つツールも、このフォルダに専用フックを作って`useHumanInTheLoop()`で登録します。表示部品は`../../components/human-in-the-loop/`に置き、`CopilotKitIntegration`から新しいフックを呼びます。
