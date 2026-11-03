# クエストボードのデザインシステム

生成する UI は、AWS ニュースを RPG のクエストとして学ぶアプリの一部です。木製の掲示板に貼られた羊皮紙のような世界観を保ちながら、情報の読みやすさを最優先してください。

## 見た目

- 背景には深い木の色、情報面には明るい羊皮紙色、文字には濃いインク色を使います。
- 色、書体、境界線は下記の CSS カスタムプロパティを基準にします。ホスト画面の CSS は sandbox iframe に継承されないため、生成 UI の `<style>` に `:root` として定義してください。

```css
:root {
  --quest-bg: #211911;
  --quest-board: #523a25;
  --quest-board-dark: #21170f;
  --quest-board-text: #f0dcaf;
  --quest-board-muted: #c6af87;
  --quest-paper: #eee0bc;
  --quest-paper-raised: #eee4ca;
  --quest-paper-muted: #d7bf91;
  --quest-ink: #382c1d;
  --quest-muted: #75644b;
  --quest-line: #b8a27c;
  --quest-accent: #926e38;
  --quest-wax: #8b3c2d;
  --quest-brass: #c2a368;
  --quest-green: #436c59;
  --quest-shadow: #130d09b8;
  --quest-font-heading: "Palatino Linotype", "Book Antiqua", "Yu Mincho",
    "Hiragino Mincho ProN", Georgia, serif;
  --quest-font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
    "Hiragino Sans", sans-serif;
}
```

- 見出しは `--quest-font-heading`、本文と操作部品は `--quest-font-body` を使います。
- 通常の情報面には `--quest-paper` / `--quest-paper-raised` と `--quest-ink` を使い、木の色は背景や見出し帯など限られた面に使います。
- `--quest-wax` は重要な注意や主要操作、`--quest-brass` は補助的な強調、`--quest-green` は成功・完了に使います。色だけで意味を伝えず、ラベルや説明も添えます。
- 角丸は控えめにし、細い境界線と弱い影で階層を作ります。派手なグラデーション、強い発光、過度な影、装飾目的のアニメーション、絵文字の多用は避けます。

## 情報設計と操作

- 依頼に必要な内容だけを表示し、見出し、要約、詳細の順に整理します。アプリ全体やチャット画面を再現しません。
- 与えられたクエストやニュースの情報・数値だけを使い、根拠のない事実、統計、比較結果を作りません。推定値を使う場合は推定と明示します。
- 表やグラフにはタイトル、単位、凡例または直接ラベルを付けます。色だけに依存しない表現にします。
- 操作が必要な場合だけ操作部品を置き、何をするか分かるラベルを付けます。操作できない装飾的なボタンは置きません。
- 意味に合った HTML 要素を使い、キーボードフォーカスを見えるようにします。本文は十分な文字サイズとコントラストを保ちます。
- 狭い画面でも横スクロールを強いず、カードや表・図表が幅に合わせて読みやすくなるようにします。

## sandbox 上の制約

- UI は sandbox iframe 内で動きます。ホスト画面の DOM、CSS、状態にはアクセスできません。
- HTML、CSS、JavaScript は生成 UI 内で完結させます。`fetch` / XMLHttpRequest、Cookie、Web Storage、IndexedDB、外部 API は使いません。
- このアプリでは sandbox とホストをつなぐ関数を公開していません。ホストアプリの状態変更やデータ取得が必要な UI は生成せず、既存の画面機能を使います。
- 外部スクリプトや外部フォントは原則使わず、必要な図表は HTML / CSS / SVG で表現します。
