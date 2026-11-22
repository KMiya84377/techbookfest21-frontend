# hooks

画面の状態・API呼び出しと、AIエージェントとの連携を扱うカスタムフックを置きます。本の第3章3.2〜3.4で説明するCopilotKitのフックを、サンプルアプリでどう使っているかも、このフォルダで確認できます。

ライブラリ名ではなく役割で分けます。`frontend-tool/`は画面側の処理を呼ぶツール、`human-in-the-loop/`はユーザーの回答を待つツールです。状態共有・サジェスト・全体の登録処理は直下に置きます。

## AIエージェントとの連携

| ファイル | 役割 | 本との対応 |
|---|---|---|
| [useCopilotKitIntegration.ts](useCopilotKitIntegration.ts) | 状態共有・ツール登録・サジェストのフックをまとめて呼ぶ | 第3章3.2〜3.4、3.6 |
| [useChatSuggestions.ts](useChatSuggestions.ts) | `useConfigureSuggestions()`で、会話前は固定候補、会話後はAIが生成した候補を表示する | チャット欄の補助機能 |
| [useSharedAgentState.ts](useSharedAgentState.ts) | 読み書きできる状態共有(`useAgent()`)。クエスト一覧と学習設定を共有し、保存後の再取得の要求に応える | 第3章3.2 |
| [useScreenContext.ts](useScreenContext.ts) | 読み取り専用の状態共有(`useAgentContext()`)。クエスト一覧、開いているクエスト、検索条件を渡す | 第3章3.2、F-02(3.6.2) |
| [useUpdateQuestFilter.tsx](frontend-tool/useUpdateQuestFilter.tsx) | `update_quest_filter`を`useFrontendTool()`で登録し、検索条件を変更して結果をチャットに表示する | 第3章3.3 |
| [useUpdateQuestDetail.tsx](frontend-tool/useUpdateQuestDetail.tsx) | `update_quest_detail`を`useFrontendTool()`で登録し、A2UIを詳細へ追記して同じ内容をチャットにも表示する | 第3章3.3、F-01(3.6.1) |
| [useReloadQuests.tsx](frontend-tool/useReloadQuests.tsx) | `reload_quests`を`useFrontendTool()`で登録し、一覧の再取得・共有状態の更新・件数の表示を行う | 第3章3.3 |
| [useShowQuiz.tsx](human-in-the-loop/useShowQuiz.tsx) | `show_quiz`を`useHumanInTheLoop()`で登録し、クイズの初回回答を待つ。クイズ画面も同じファイル内にまとめる | 第3章3.4、F-03(3.6.3) |
| [useShowChoices.tsx](human-in-the-loop/useShowChoices.tsx) | `show_choices`を`useHumanInTheLoop()`で登録し、候補からの選択結果を待つ。選択肢の表示も同じファイル内にまとめる | 第3章3.4 |

本の第3章3.4・3.5で紹介する`useInterrupt()`と`useComponent()`は、このアプリでは使っていません。

[`useCopilotKitIntegration.ts`](useCopilotKitIntegration.ts) がこれらのフックをまとめて呼びます。`App.tsx`の`QuestWorkspace`から、`CopilotKitProvider`配下で呼び出します。

## フロントエンドツール

| 名前 | 登録するファイル | 内容 |
|---|---|---|
| `update_quest_filter` | [useUpdateQuestFilter.tsx](frontend-tool/useUpdateQuestFilter.tsx) | クエストボードの検索条件を変える |
| `update_quest_detail` | [useUpdateQuestDetail.tsx](frontend-tool/useUpdateQuestDetail.tsx) | AIがA2UIで構成したUIを、開いている詳細へ追記・更新し、同じUIをチャットにも表示する |
| `reload_quests` | [useReloadQuests.tsx](frontend-tool/useReloadQuests.tsx) | クエストを取得し直す(通常は共有状態の `refreshRequested` で自動更新される) |

ツール登録のフックは、フロントエンドツール・Human in the Loopともに1ツールにつき1ファイルです。ツール名・説明・引数スキーマの指定・`render`と、そのツール専用のUIを同じファイルにまとめます。フロントエンドツールでは`handler`も定義します。UIでReactフックを使う場合は、同じファイル内の独立したコンポーネントにし、`render`から表示します。共通の型や検証・反映処理は`lib`、複数箇所で使う表示部品は`components`に置きます。

`show_quiz`は[useShowQuiz.tsx](human-in-the-loop/useShowQuiz.tsx)、`show_choices`は[useShowChoices.tsx](human-in-the-loop/useShowChoices.tsx)で登録します。

## 画面の状態とAPI呼び出し

| ファイル | 役割 |
|---|---|
| [useApiFetch.ts](useApiFetch.ts) | 認証トークンがあれば、Authorizationヘッダーを付けてAPIを呼ぶ |
| [useQuests.ts](useQuests.ts) | クエストの取得、閲覧・クリア状態、初回回答の保存を扱う |
| [useQuestFilter.ts](useQuestFilter.ts) | 一覧の検索条件と絞り込みを扱う |
| [useDetailExtras.ts](useDetailExtras.ts) | 開いているニュースへのA2UIの追記を画面内に保持する。DBには保存しない |
| [useQuestActions.ts](useQuestActions.ts) | React Contextから、クイズなどで使う画面の操作関数を取得する |
| [useUserSettings.ts](useUserSettings.ts) | 学習設定の取得・保存を扱う |
| [useNewsNotifications.ts](useNewsNotifications.ts) | 関心に合う新着ニュースの選定依頼と、通知の取得・既読保存を扱う |
| [useLearningInsights.ts](useLearningInsights.ts) | 学習内容の関連分析の依頼と、図解の通知の取得・既読保存を扱う |

## 共有する状態

- 共有状態 `questBoard`(クエスト一覧と、保存後の再取得の要求)と `userSettings`。`userSettings` は、保存済みの設定を読み込めてから渡します。
- context として、クエスト一覧、詳細を開いているクエスト、適用中の検索条件。context はエージェントの会話履歴(Memory)には保存されません。

## ツールを足す

1. 引数のスキーマ(zod)を決めます。
2. `frontend-tool/`に専用のカスタムフックを作り、`useFrontendTool()`で登録します。`handler`で画面の処理を呼び出し、`render`で結果を表示します。専用UIも同じファイルに置きます。
3. 複数箇所で使う表示部品だけを`../components/`に分けます。
4. `useCopilotKitIntegration.ts`から新しいフックを呼びます。エージェント側で特別な使い分けが必要な場合は、[chat-agent/](../../../chat-agent/README.md)のプロンプトやツール定義も確認します。

ユーザーの回答を待つツールは、`human-in-the-loop/`に専用フックを作って`useHumanInTheLoop()`で登録し、そのツール専用の画面も同じファイルにまとめます。複数のツールで使う表示部品は`../components/human-in-the-loop/`に置き、`useCopilotKitIntegration`から新しいフックを呼びます。
