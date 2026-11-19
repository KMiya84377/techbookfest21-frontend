# learning

新着ニュースの通知と、学習したニュース同士のつながりを示す図解の表示を置きます。通知の取得・既読保存・生成の依頼はフックとバックエンドが担い、このフォルダは受け取ったデータを表示します。

本の第2章2.5.1で扱う「トリガーと伝え方」の考え方や、第3章3.5のOpen Generative UIに関連する追加機能です。本のF-04はチャットで依頼したニュースの図解、F-05は週間レポートなので、このフォルダの通知機能とは分けています。

## ファイル

| ファイル | 役割 | UIの型 | UIのプロトコル・形式 | 本との対応 |
|---|---|---|---|---|
| [LearningNotifications.tsx](LearningNotifications.tsx) | 2種類の通知を一覧表示します。新着はニュース詳細へ移動し、学習内容の図解はダイアログで開きます | 通知一覧はGenerative UI未使用。図解部分は自由型です | Base UIの`Popover`・`Dialog`で通知一覧と表示枠を構成します。通知データはアプリ独自のJSONで、内部の図解はOpen Generative UIです。A2UI未使用です | 第2章2.5.1のトリガー・伝え方に関連します。代表5機能とは別の追加機能です |
| [LearningDiagram.tsx](LearningDiagram.tsx) | 保存済みUIを検証して表示し、関係の説明と参照ニュースを添えます。旧形式や描画失敗時は文章で確認できます | 自由型（生成した図解） | CopilotKitのOpen Generative UIを使います。生成UIと、関係・参照ニュースを表すアプリ独自のJSONを受け取ります。A2UI未使用です | 第3章3.5と同じ表示方式です。F-04とは図解の対象とトリガーが異なります |
| [LearningUIRenderer.tsx](LearningUIRenderer.tsx) | 保存済みの生成UIをCopilotKitの公式レンダラーへ渡します | 自由型 | CopilotKitの`OpenGenerativeUIActivityRenderer`を使います。`open-generative-ui` activityのHTML・CSS・必要に応じたJavaScriptをサンドボックス内に表示します。A2UI未使用です | 第3章3.5のOpen Generative UIに関連する追加機能です |

「自由型」は生成された図解部分の分類です。通知ボタンや一覧、ダイアログの枠までAIエージェントに生成させる構成ではありません。

## 2種類の通知

| 通知 | トリガーと処理 | ユーザーへの伝え方 |
|---|---|---|
| 関心に合う新着 | [useNewsNotifications.ts](../../hooks/useNewsNotifications.ts)が表示開始時と定期的に確認します。サーバー側のAIエージェントが、学習分野とニュースから候補を選びます | 未読件数と通知一覧を表示します。選ぶと既存のニュース詳細を開きます。UIコードは生成しません |
| 学習内容のつながり | クエストのクリア結果を[useLearningInsights.ts](../../hooks/useLearningInsights.ts)へ渡します。設定件数に応じた分析区間をサーバーで確認し、関連が見つかった場合に図解を生成します。表示開始時や設定変更時にも未処理の区間を確認します | 通知一覧から開くダイアログに、保存済みの図解と関係の説明を表示します。開くたびにAIを呼び直しません |

ブラウザーからは、[learning-insights API](../../pages/api/learning-insights.ts)・[news-notifications API](../../pages/api/news-notifications.ts)へHTTPでアクセスし、JSONを受け取ります。AIエージェントとのAG-UI通信はバックエンドで行います。この通知一覧自体がAG-UIのストリームを直接描画するわけではありません。

## 図解の生成・保存・再表示

1. [generate.ts](../../server/learning/generate.ts)がニュース同士の関係を分析します。関連がある場合だけ、別の実行でOpen Generative UIの`generateSandboxedUi`を呼ばせます。
2. [collectUI.ts](../../server/learning/collectUI.ts)が公式middlewareの作る完成済みactivityを検証し、[service.ts](../../server/learning/service.ts)が分析結果とUIをユーザー別に保存します。
3. 通知を開くと、`LearningDiagram`から`LearningUIRenderer`へ保存済みUIを渡して表示します。図解の読み込み・描画に失敗しても、関係の説明は残します。

[lib/learning/openGenerativeUI.ts](../../lib/learning/openGenerativeUI.ts)で保存形式・サイズ・高さを検証し、表示時には追加のCSPで外部・同一オリジンへの通信を禁止します。HTMLをホスト画面のDOMへ直接挿入せず、ホスト操作用の関数も公開していません。

本のF-04との違いや検証範囲は、[Webアプリ全体のREADME](../../../README.md#2つの図解の違い)と[移行・検証記録](../../../../doc/learning-open-generative-ui.md)を参照してください。
