# generative-ui

チャット欄と詳細画面で共通に使うA2UIの描画部品と、レポート用のカタログを置きます。本の第2章で説明するGenerative UIの型と、第3章で説明するCopilotKitの実装を対応づけています。

第2章2.1.2では制御型・宣言型・自由型を、第2章2.5.2ではF-01〜F-05での型の選び方を説明しています。CopilotKitで使う機能は第3章3.5、各機能の設計判断は第3章3.6に対応します。

## プロトコル・形式の見方

AG-UIはAIエージェントとのイベント通信に使います。以下の表は、その中でやり取りするUIの内容がA2UIなのか、アプリ独自のJSONなのかを示します。「A2UI未使用」は「AG-UI未使用」という意味ではありません。

A2UIはUIの構造などをJSONで記述する共通プロトコルです。一方、「独自JSON」は、このアプリで定義したツールの引数・結果を指します。Open Generative UIはCopilotKitの機能名で、HTML・CSS・JavaScriptを生成して表示します。

## ファイル

| ファイル | 役割 | UIの型 | UIのプロトコル・形式 | 本との対応 |
|---|---|---|---|---|
| [DetailA2UI.tsx](DetailA2UI.tsx) | 追記のA2UIメッセージを、チャット欄と詳細画面で描画します | 宣言型 | A2UI v0.9。標準カタログの部品を使います | F-01、第2章2.3.1・第3章3.6.1です |
| [ReportCatalog.tsx](ReportCatalog.tsx) | 標準カタログに棒グラフを追加し、グラフをRechartsで描画します | 宣言型 | A2UI v0.9。標準カタログとカスタムの`BarChart`を使います | F-05、第2章2.3.1・第3章3.6.5です |

表のA2UI v0.9は、実装で使うメッセージの`version: "v0.9"`を指します。

## 別フォルダ・SDK側にある実装

本のGenerative UIの実装が、すべてこのフォルダにあるわけではありません。

| 機能 | UIの型 | UIのプロトコル・形式 | 実装・本との対応 |
|---|---|---|---|
| F-01：ニュースの詳細画面に比較や影響を追加します | 宣言型（追記内容） | 結果の外枠は独自JSON。`section.messages`がA2UI v0.9です | [useUpdateQuestDetail.tsx](../../hooks/frontend-tool/useUpdateQuestDetail.tsx)がツール登録・追記処理・結果表示をまとめます。描画はこのフォルダの`DetailA2UI`を使います。第3章3.6.1です |
| F-02：表示中のニュースを踏まえて回答します | Generative UI未使用 | 通常のテキストです。A2UI未使用です | [useScreenContext.ts](../../hooks/useScreenContext.ts)で画面の情報を渡します。第3章3.6.2です |
| F-03：クイズを表示し、回答を待ちます | 制御型 | CopilotKitの`useHumanInTheLoop()`の`render`で、自前のReact UIを表示し、`respond`で回答を返します。データは独自JSONで、A2UI未使用です | 登録と表示を[useShowQuiz.tsx](../../hooks/human-in-the-loop/useShowQuiz.tsx)にまとめています。第2章2.2・第3章3.6.3です |
| F-04：AWSニュースを図解します | 自由型 | Open Generative UIでHTML・CSS・JavaScriptを生成します。A2UI未使用です | [App.tsx](../App.tsx)と[Runtime](../../pages/api/copilotkit/%5B...slug%5D.ts)で有効化し、チャット内の描画はCopilotKit SDKが担います。第3章3.5・3.6.4です |
| 検索条件の変更・一覧の再取得 | 制御型 | CopilotKitの`useFrontendTool()`の`render`で固定のReact UIを表示します。データは独自JSONで、A2UI未使用です | 登録・処理・結果表示は[useUpdateQuestFilter.tsx](../../hooks/frontend-tool/useUpdateQuestFilter.tsx)・[useReloadQuests.tsx](../../hooks/frontend-tool/useReloadQuests.tsx)です。代表5機能とは別の実装例です |

汎用の選択肢UIも、制御型のUIとHuman in the Loopを組み合わせています。ツールの登録と表示は[useShowChoices.tsx](../../hooks/human-in-the-loop/useShowChoices.tsx)にまとめています。状態共有やツール登録の配置は[hooksのREADME](../../hooks/README.md)を参照してください。

学習したニュース同士のつながりを通知から表示する[LearningDiagram.tsx](../learning/LearningDiagram.tsx)・[LearningUIRenderer.tsx](../learning/LearningUIRenderer.tsx)も、Open Generative UIを使います。ただし、本のF-04で扱う「チャットで依頼したニュースの図解」とは別の機能です。

## 生成した UI の外部通信(Open Generative UI)

生成したUIは、サンドボックスのiframe(`srcdoc`)で動きます。[middleware.ts](../../middleware.ts)のCSPで、ページと生成UIの外部への通信・画像・スクリプトの読み込みを制限しています。デザインスキルでも、外部通信を使わないよう指示しています。CSPを変えるときは、生成したUIにも効くことに注意してください。

通知から再表示する保存済みのUIには、[restrictedLearningUIContent()](../../lib/learning/openGenerativeUI.ts)で追加のCSPを付け、同一オリジンを含む通信を禁止しています。

## 関連するファイル

- [lib/generative-ui/reportCatalog.ts](../../lib/generative-ui/reportCatalog.ts)は、A2UIのカスタムカタログ定義です。フロントエンドの描画とRuntimeの両方が使います。
- [lib/generative-ui/design-skill.md](../../lib/generative-ui/design-skill.md)は、Open Generative UIへ渡すデザイン指示です。チャットのUI生成と、通知用のUI生成で直接読み込みます。
- [lib/quests/detailSections.ts](../../lib/quests/detailSections.ts)・[detailTools.ts](../../lib/quests/detailTools.ts)は、追記のA2UIの順序・`surfaceId`・参照構造と、ツールの引数を検証します。Text・Column・Row・Card・Dividerを受け付け、HTML・外部リソース・アクションは受け付けません。ツール名・引数・処理・描画の登録は[useUpdateQuestDetail.tsx](../../hooks/frontend-tool/useUpdateQuestDetail.tsx)にまとめています。
- [hooks/useDetailExtras.ts](../../hooks/useDetailExtras.ts)・[QuestDetail.tsx](../quests/QuestDetail.tsx)は、開いているニュースの確認と、追記の保持・描画を担います。新しいIDは追記し、同じIDは更新します。追記はDBへ保存しません。

## 表示部品を足す

A2UIのレポート部品を足す場合は、[lib/generative-ui/reportCatalog.ts](../../lib/generative-ui/reportCatalog.ts)に定義を足し、[ReportCatalog.tsx](ReportCatalog.tsx)に描画を足します。

複数箇所で使うGenerative UIの描画部品は、このフォルダに置きます。ツール専用の結果表示や回答待ち画面は、[hooks](../../hooks/README.md)の各ツール登録と同じファイルにまとめます。共通の選択ボタンは[OptionButtons.tsx](../human-in-the-loop/OptionButtons.tsx)、チャット内の共通のカード枠は[ChatCard.tsx](../chat/ChatCard.tsx)です。
