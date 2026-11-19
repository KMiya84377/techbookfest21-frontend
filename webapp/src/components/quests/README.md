# quests

AWSニュースをクエストとして表示する一覧・詳細画面と、その操作の窓口を置きます。本の第3章3.6で説明する「ニュースの一覧や詳細を表示する領域」に対応します。チャット欄は[chat](../chat/ChatPanel.tsx)、AIエージェントとの連携フックは[hooks/copilotkit](../../hooks/copilotkit/README.md)に分けています。

一覧や詳細の基本画面は、Webアプリ側で実装した通常のReact UIです。F-01で追記する部分だけは、AIエージェントが構成したA2UIを描画します。画面内に「AI生成」の説明文があっても、画面の構造までGenerative UIで生成しているわけではありません。

## ファイル

| ファイル | 役割 | UIの型 | UIのプロトコル・形式 | 本との対応 |
|---|---|---|---|---|
| [QuestBoard.tsx](QuestBoard.tsx) | クエストを絞り込み、一覧から詳細を開きます | Generative UI未使用 | Reactの固定画面です。共通`Button`とBase UIを使った`ToggleGroup`で操作します。A2UI未使用です | 第3章3.6の基本画面です。F-01〜F-04で扱うニュースを選びます |
| [QuestDetail.tsx](QuestDetail.tsx) | ニュースの要約・比較・影響と、チャットからの追記を表示します | 基本画面はGenerative UI未使用。追記は宣言型です | 基本画面はReactです。追記は`DetailA2UI`を通じてCopilotKitの`A2UIProvider`・`A2UIRenderer`でA2UI v0.9を描画します | F-01、第3章3.6.1の表示先です。F-02、第3章3.6.2で参照するニュースの画面でもあります |
| [QuestActions.tsx](QuestActions.tsx) | クイズなどのチャット内UIへ、状態参照・クリア・回答記録・詳細表示の操作関数を渡します | UIを描画しません | React Contextと付属の`useQuestActions()`を使います。AG-UIの共有状態やA2UIのメッセージではありません | F-03、第3章3.6.3のクイズから画面を操作し、F-05用の回答記録につなぎます |
| [QuestLayout.tsx](QuestLayout.tsx) | ニュース表示領域とチャット欄を配置する画面全体の枠です | Generative UI未使用 | ReactとCSS Gridによるレイアウトです。AIエージェントがUI構造を決める部分ではありません | 第3章3.6冒頭の画面構成です |
| [QuestBoardStatus.tsx](QuestBoardStatus.tsx) | 読み込み中・取得失敗・状態保存失敗の表示と再試行の操作を提供します | Generative UI未使用 | Reactの固定表示と共通`Button`を使います。A2UI未使用です | 一覧・状態保存のための画面部品です。代表5機能に固有の部品ではありません |
| [BoardChrome.tsx](BoardChrome.tsx) | ボードの装飾とユーザー設定を開くボタンを表示します | Generative UI未使用 | 固定のReact UIと共通`Button`を使います。A2UI未使用です | サンプルアプリの共通画面です |
| [GuildEmblem.tsx](GuildEmblem.tsx) | ボードの紋章を表示します | Generative UI未使用 | コードで用意した固定のSVGです。AIが生成する図解ではありません | サンプルアプリの装飾です |
| [InkStamp.tsx](InkStamp.tsx) | 重要度のランクやクリア済みの印を表示します | Generative UI未使用 | `rank`と`cleared`に応じて、コードで用意したSVGの表示を切り替えます | サンプルアプリの装飾です |

## F-01の追記を表示する流れ

1. [useUpdateQuestDetail.tsx](../../hooks/copilotkit/useUpdateQuestDetail.tsx)が`useFrontendTool()`で`update_quest_detail`を登録します。AIエージェントはニュースIDとA2UIメッセージを渡します。
2. [detailTools.ts](../../lib/quests/detailTools.ts)・[detailSections.ts](../../lib/quests/detailSections.ts)で引数を検証し、[useDetailExtras.ts](../../hooks/useDetailExtras.ts)で現在開いているニュースへの追記を保持します。新しいIDは追加し、同じIDは更新します。追記はDBへ保存しません。
3. `QuestDetail`が[DetailA2UI.tsx](../generative-ui/DetailA2UI.tsx)で追記を描画します。同じA2UIは[DetailUpdateCard.tsx](../generative-ui/DetailUpdateCard.tsx)からチャット欄にも表示します。

UIの構成をAIエージェントが決める部分はA2UI、詳細画面への反映はフロントエンドツールです。どちらか一方だけでF-01を実装しているわけではありません。

## 状態・保存・AIエージェントとの分担

- [App.tsx](../App.tsx)が一覧・詳細・チャットを組み合わせ、各操作とフックを接続します。`QuestActionsContext`はクイズから画面の処理を呼ぶための窓口です。
- [useQuests.ts](../../hooks/useQuests.ts)がAPI経由の取得・閲覧状態・クリア状態・初回回答の保存を担います。[useQuestFilter.ts](../../hooks/useQuestFilter.ts)が一覧の検索条件を管理します。
- F-02で現在開いているニュースをAIエージェントへ伝えるのは、[useScreenContext.ts](../../hooks/copilotkit/useScreenContext.ts)の`useAgentContext()`です。`QuestDetail`から直接AIエージェントを呼び出しません。

クイズの制御型UIや週間レポートの宣言型UIは、それぞれ[human-in-the-loop](../human-in-the-loop/README.md)・[generative-ui](../generative-ui/README.md)を参照してください。
