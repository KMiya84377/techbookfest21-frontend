# 学習内容のつながりをOpen Generative UIへ移行する

## 対象と変更しないもの

学習履歴が設定件数に達したときに関連分析を行い、通知から図解を開く機能の描画を、固定SVGからOpen Generative UIへ変更した。

学習履歴の記録、閾値のユーザー設定、実行の重複排除、通知・既読のユーザー別保存、週間レポート、新着ニュースの通知、チャットで依頼するニュースの図解は残す。AWSデプロイ・IAM変更・既存DBデータの削除は行っていない。

## 役割分担

- `collectConnections.ts`：分析結果のJSONを受け取る。履歴にないニュースや不正な参照を拒否する既存処理は維持。
- `collectUI.ts`：分析結果を再検証し、関係がある場合だけ、対象ニュースとデザインスキルを渡して `generateSandboxedUi` を実行する。通常のチャットから分離し、会話の記憶には保存しない。
- 公式 `OpenGenerativeUIMiddleware`：ツール引数のストリームを `open-generative-ui` activityへ変換する。アプリが独自にJSON Patchを実装しない。
- `learningUISchema`：完成フラグ、データ構造、サイズ、高さを検証する。保存前にはツール引数とactivityのHTML・CSS・JavaScriptの一致も確認。
- `service.ts`：完成したUIを `insight.ui` に保存してから通知をreadyにする。関連なしならUI生成を省略し、生成エラー時はfailedとして既存の再試行経路へ戻す。
- `LearningDiagram.tsx` / `LearningUIRenderer.tsx`：保存した完成UIを公式 `OpenGenerativeUIActivityRenderer` に渡す。開き直してもモデルを呼ばない。

通知のAPI契約は維持し、`insights[].ui` を追加した。旧通知にはこの値がないため、関係と根拠を文章で表示する。新形式のUIが不正な場合もホストDOMには挿入せず、文章で確認できる。

## 制約

- 関係ありのときは分析・UI生成の2回のモデル実行となる。各実行の45秒上限は既存の値を維持している。実AWSでの生成時間とCloudFront等の配信タイムアウトとの整合性は未検証。設定変更は行っていない。
- HTMLは最大60,000文字、CSSと共通JSは各20,000文字、JS式は各5,000文字・最大12件。完成content全体はUTF-8 JSONで160,000バイト以下。高さは200〜1,000px。
- iframeは公式rendererの `allow-scripts` を使い、same-originは許可しない。先頭のCSPで `connect-src 'none'` とし、外部スクリプト・子iframe・フォーム送信・base URLも禁止。evalは許可しない。親ページのCSPは変更していない。
- 共通のCopilotKitProviderにはsandbox用のホスト関数を公開していない。将来 `sandboxFunctions` を追加する際は、保存UIにもその関数を公開することになるため、改めて権限設計を確認する。
- JSONの参照整合性は検証するが、生成された図が事実を正しく表現しているかはプロンプトだけでは保証できない。実モデルによる生成品質・再現性の評価は別途必要。

## 根拠

- [CopilotKit公式：Open Generative UI](https://docs.copilotkit.ai/generative-ui/open-generative-ui)：`generateSandboxedUi` → middleware → activity → sandbox rendererの役割分担。
- 使用版は `@copilotkit/react-core` と `@copilotkit/shared` の1.73.3。導入済みパッケージの公開型定義・middleware・renderer実装を確認して組み込んだ。
- `@jetbrains/websandbox` の導入済み実装では、iframeは `allow-scripts` のみ。`runCode` はiframe内のscript要素で実行し、evalを要求しない。

## 検証

- `tests/learning-ui.test.ts`：実際のAG-UI HttpAgentと公式middlewareで、分割ツール引数から完成UIを取得。実行エラー・結果なし・複数UI・サイズ超過・未完了・不正なニュースIDを拒否。旧通知の文章表示も確認。
- `tests/learning-api.test.ts`：mockサーバーで保存→件数→関連分析→UI保存→通知→既読→再取得を確認し、再取得時に同じUIが残ることを確認。
- ブラウザー：実際の通知ダイアログからmockの保存UIを公式iframeへ表示できた。別の検証用UIではJavaScriptの実行と、親DOM・Web Storage・API通信へのアクセス拒否を確認。
- mockのUIは描画確認用の固定データ。実LLMの生成結果ではない。実AWS・実LLMの通し検証はしていない。
- Webの型チェック・本番ビルド成功。全68テスト中64件成功・4件は環境指定が必要なためスキップ。別途、mockサーバーを指定して学習通知APIと新着ニュース通知APIのテストをそれぞれ実行し成功。チャットエージェントの単体テスト47件も成功。
