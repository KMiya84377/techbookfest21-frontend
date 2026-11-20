# generative-ui

AIエージェントの出力をチャットや詳細画面へ表示する部品を置きます。本の第2章で説明するGenerative UIの型と、第3章で説明するCopilotKitの実装を対応づけています。

第2章2.1.2では制御型・宣言型・自由型を、第2章2.5.2ではF-01〜F-05での型の選び方を説明しています。CopilotKitで使う機能は第3章3.5、各機能の設計判断は第3章3.6に対応します。

## プロトコル・形式の見方

AG-UIはAIエージェントとのイベント通信に使います。以下の表は、その中でやり取りするUIの内容がA2UIなのか、アプリ独自のJSONなのかを示します。「A2UI未使用」は「AG-UI未使用」という意味ではありません。

A2UIはUIの構造などをJSONで記述する共通プロトコルです。一方、「独自JSON」は、このアプリで定義したツールの引数・結果を指します。Open Generative UIはCopilotKitの機能名で、HTML・CSS・JavaScriptを生成して表示します。

## ファイル

| ファイル | 役割 | UIの型 | UIのプロトコル・形式 | 本との対応 |
|---|---|---|---|---|
| [FilterChangeCard.tsx](FilterChangeCard.tsx) | 検索条件の変更前後と件数を表示します | 制御型 | CopilotKitの`useFrontendTool()`の`render`で、自前のReact UIを表示します。データは独自JSONで、A2UI未使用です | 第2章2.2・第3章3.3、3.5に対応します。代表5機能とは別の実装例です |
| [DetailUpdateCard.tsx](DetailUpdateCard.tsx) | 追記結果と、詳細画面と同じUIをチャット欄に表示します | 宣言型（追記内容） | 結果の外枠は独自JSON。`section.messages` がA2UI v0.9です | F-01、第3章3.6.1です |
| [DetailA2UI.tsx](DetailA2UI.tsx) | 追記のA2UIメッセージを、チャット欄と詳細画面で描画します | 宣言型 | A2UI v0.9。標準カタログの部品を使います | F-01、第2章2.3.1・第3章3.6.1です |
| [ReportCatalog.tsx](ReportCatalog.tsx) | 標準カタログに棒グラフを追加し、グラフをRechartsで描画します | 宣言型 | A2UI v0.9。標準カタログとカスタムの`BarChart`を使います | F-05、第2章2.3.1・第3章3.6.5です |
| [ReloadCard.tsx](ReloadCard.tsx) | 一覧の再取得結果と件数を表示します | 制御型 | CopilotKitの`useFrontendTool()`の`render`で、自前のReact UIを表示します。データは独自JSONで、A2UI未使用です | 第2章2.2・第3章3.3、3.5に対応します。代表5機能とは別の実装例です |

表のA2UI v0.9は、実装で使うメッセージの`version: "v0.9"`を指します。

検索条件変更・再取得のカードは、AIエージェントのツール呼び出しに応じて、実行結果をWebアプリ側で用意した固定レイアウトに表示する制御型のGenerative UIです。本の代表5機能に含まれるかどうかと、Generative UIの型は別の話です。

## 別フォルダ・SDK側にある実装

本のGenerative UIの実装が、すべてこのフォルダにあるわけではありません。

| 機能 | UIの型 | UIのプロトコル・形式 | 実装・本との対応 |
|---|---|---|---|
| F-02：表示中のニュースを踏まえて回答します | Generative UI未使用 | 通常のテキストです。A2UI未使用です | [useScreenContext.ts](../../hooks/copilotkit/useScreenContext.ts)で画面の情報を渡します。第3章3.6.2です |
| F-03：クイズを表示し、回答を待ちます | 制御型 | CopilotKitの`useHumanInTheLoop()`の`render`で、自前のReact UIを表示し、`respond`で回答を返します。データは独自JSONで、A2UI未使用です | [Quiz.tsx](../human-in-the-loop/Quiz.tsx)と[useShowQuiz.tsx](../../hooks/copilotkit/useShowQuiz.tsx)です。第2章2.2・第3章3.6.3です |
| F-04：AWSニュースを図解します | 自由型 | Open Generative UIでHTML・CSS・JavaScriptを生成します。A2UI未使用です | [App.tsx](../App.tsx)と[Runtime](../../pages/api/copilotkit/%5B...slug%5D.ts)で有効化し、チャット内の描画はCopilotKit SDKが担います。第3章3.5・3.6.4です |

汎用の選択肢UIである[ChoicePrompt.tsx](../human-in-the-loop/ChoicePrompt.tsx)も、制御型のUIとHuman in the Loopを組み合わせています。状態共有やツール登録の配置は[hooks/copilotkitのREADME](../../hooks/copilotkit/README.md)を参照してください。

学習したニュース同士のつながりを通知から表示する[LearningDiagram.tsx](../learning/LearningDiagram.tsx)・[LearningUIRenderer.tsx](../learning/LearningUIRenderer.tsx)も、Open Generative UIを使います。ただし、本のF-04で扱う「チャットで依頼したニュースの図解」とは別の機能です。

## 生成した UI の外部通信(Open Generative UI)

生成したUIは、サンドボックスのiframe(`srcdoc`)で動きます。[middleware.ts](../../middleware.ts)のCSPで、ページと生成UIの外部への通信・画像・スクリプトの読み込みを制限しています。デザインスキルでも、外部通信を使わないよう指示しています。CSPを変えるときは、生成したUIにも効くことに注意してください。

通知から再表示する保存済みのUIには、[restrictedLearningUIContent()](../../lib/learning/openGenerativeUI.ts)で追加のCSPを付け、同一オリジンを含む通信を禁止しています。

## 関連するファイル

- [lib/generative-ui/reportCatalog.ts](../../lib/generative-ui/reportCatalog.ts)は、A2UIのカスタムカタログ定義です。フロントエンドの描画とRuntimeの両方が使います。
- [lib/generative-ui/design-skill.md](../../lib/generative-ui/design-skill.md)・[openGenerativeUI.ts](../../lib/generative-ui/openGenerativeUI.ts)は、Open Generative UIへ渡すデザイン指示です。チャットのUI生成と、通知用のUI生成で使います。
- [lib/quests/detailSections.ts](../../lib/quests/detailSections.ts)・[detailTools.ts](../../lib/quests/detailTools.ts)は、追記のA2UIの順序・`surfaceId`・参照構造と、ツールの引数を検証します。Text・Column・Row・Card・Dividerを受け付け、HTML・外部リソース・アクションは受け付けません。ツール名・引数・処理・描画の登録は[useUpdateQuestDetail.tsx](../../hooks/copilotkit/useUpdateQuestDetail.tsx)にまとめています。
- [hooks/useDetailExtras.ts](../../hooks/useDetailExtras.ts)・[QuestDetail.tsx](../quests/QuestDetail.tsx)は、開いているニュースの確認と、追記の保持・描画を担います。新しいIDは追記し、同じIDは更新します。追記はDBへ保存しません。

## 表示部品を足す

A2UIのレポート部品を足す場合は、[lib/generative-ui/reportCatalog.ts](../../lib/generative-ui/reportCatalog.ts)に定義を足し、[ReportCatalog.tsx](ReportCatalog.tsx)に描画を足します。

フロントエンドツールの結果を表示するカードは、このフォルダに置きます。[useUpdateQuestFilter.tsx](../../hooks/copilotkit/useUpdateQuestFilter.tsx)・[useUpdateQuestDetail.tsx](../../hooks/copilotkit/useUpdateQuestDetail.tsx)・[useReloadQuests.tsx](../../hooks/copilotkit/useReloadQuests.tsx)の各`render`から使います。ユーザーの回答を待つUIは[human-in-the-loop](../human-in-the-loop/README.md)、チャット内の共通のカード枠は[ChatCard.tsx](../chat/ChatCard.tsx)に分けます。
