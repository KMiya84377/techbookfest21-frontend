# generative-ui

エージェントの呼び出しに応じて、チャットや画面に出る部品と、そのツールの登録をまとめたフォルダです。`CopilotKitProvider` の中で使います(`App.tsx`)。

## ファイル

| ファイル | 役割 |
|---|---|
| `GenerativeUI.tsx` | ツールの登録と、画面状態のエージェントへの共有。表示は何も出さない(`null` を返す) |
| `Quiz.tsx` | `show_quiz` の表示。理解度チェックの問題と、回答をエージェントに返す |
| `ChoicePrompt.tsx` | `show_choices` の表示。候補をボタンで出し、選択結果をエージェントに返す |
| `OptionButtons.tsx` | `Quiz` と `ChoicePrompt` が共通で使う選択肢ボタン |
| `FilterChangeCard.tsx` | `update_quest_filter` の結果カード(変更前後の条件と件数) |
| `DetailUpdateCard.tsx` | 追記結果と、詳細画面と同じA2UIをチャット欄に表示 |
| `DetailA2UI.tsx` | A2UI v0.9メッセージの描画。チャットと詳細の両方で使う |
| `ReportCatalog.tsx` | A2UI のレポート部品(`BarChart`)の描画 |

## `GenerativeUI.tsx` が登録するもの

| 名前 | 種類 | 内容 |
|---|---|---|
| `show_quiz` | `useHumanInTheLoop` | 理解度チェックを表示する。回答が返るまで、エージェントは止まる |
| `show_choices` | `useHumanInTheLoop` | 有限個の候補から選んでもらう |
| `update_quest_filter` | `useFrontendTool` | クエストボードの検索条件を変える |
| `update_quest_detail` | `useFrontendTool` | AIがA2UIで構成したUIを、開いている詳細へ追記・更新し、同じUIをチャットにも表示する |
| `reload_quests` | `useFrontendTool` | クエストを取得し直す(通常は共有状態の `refreshRequested` で自動更新される) |

あわせて、次の状態をエージェントに渡します。
- 共有状態 `questBoard`(クエスト一覧と、保存後の再取得の要求)と `userSettings`。`userSettings` は、保存済みの設定を読み込めてから渡す。
- context として、クエスト一覧、詳細を開いているクエスト、適用中の検索条件。context はエージェントの会話履歴(Memory)には保存されない。

## 関連するファイル

- `lib/generative-ui/reportCatalog.ts` — A2UI のカタログ定義。`ReportCatalog.tsx`(描画)と、`pages/api/copilotkit/[...slug].ts`(Runtime)の両方が使う。
- `lib/generative-ui/design-skill.md`、`openGenerativeUI.ts` — Open Generative UI に渡すデザイン指示。`App.tsx` が `CopilotKitProvider` に渡す。
- `lib/quests/filter.ts`、`lib/quests/detailSections.ts` — ツールの引数のスキーマ。追記ではA2UIのメッセージ順序、surfaceId、部品と参照構造を検証する。
- `lib/quests/detailTools.ts` — 追記ツールの定義と引数の検証。AIが構成したText・Column・Row・Card・DividerのA2UIメッセージを受け取る。HTML・外部リソース・アクションは受け付けない。
- `hooks/useDetailExtras.ts`、`components/quests/QuestDetail.tsx` — 開いているニュースの確認と、追記の保持・描画。新しいIDは末尾へ追記し、同じIDはその位置で更新する。DBへは保存しない。

## 新しいツールを足す

1. 引数のスキーマ(zod)を決める。表示の部品がある場合は、部品のファイルから `export` する(`quizSchema` と同じ形)。
2. 表示の部品を、このフォルダに作る。
3. `GenerativeUI.tsx` で、`useFrontendTool`(画面を操作する)か `useHumanInTheLoop`(ユーザーの回答を待つ)で登録する。
4. エージェント側が呼べるよう、`agent/` のプロンプトやツール定義を合わせる(未確認: 必要かどうかはツールの種類による)。

A2UI のレポート部品を足す場合は、`lib/generative-ui/reportCatalog.ts` に定義を足し、`ReportCatalog.tsx` に描画を足す。
