// サンプルのクエスト(画面確認と、初期データの投入に使う固定データ。実際のニュースではない)
import type { Quest } from "../src/lib/quests/model";

const SAMPLES: Omit<Quest, "publishedAt">[] = [
  {
    id: "agentcore-agui",
    title: "AgentCore Runtime の AG-UI 対応",
    services: ["AgentCore", "フロントエンド"],
    summary:
      "AgentCore Runtime に、AG-UI のサーバーをそのままデプロイできます。フロントエンドとエージェントの接続方式を見直せます。",
    importance: "high",
    minutes: 5,
    status: "todo",
    source: { label: "AWS What's New(サンプル)", url: "https://aws.amazon.com/new/" },
    changes: ["AG-UI のプロトコルを指定して、Runtime を作れる", "エージェントは、/invocations で SSE を返す"],
    before: "フロントエンドとエージェントの間に、独自の中継層を作って運用する。",
    after: "Runtime の AG-UI エンドポイントへ、直接つなぐ選択肢が増える。",
    impact: {
      changes: "接続方式と、認証の境界を見直せる",
      unchanged: "Generative UI の部品づくりは必要",
      check: "CopilotRuntime を残す理由があるか",
    },
    checks: ["認証方式(SigV4 か JWT か)", "ストリーミングの経路と、タイムアウト"],
  },
  {
    id: "lambda-streaming",
    title: "Lambda のストリーミング応答を確認する",
    services: ["Lambda", "SSE"],
    summary:
      "応答ストリーミングの制約と適用範囲の更新です。SSE を使うエージェント UI の設計に関係します。",
    importance: "medium",
    minutes: 4,
    status: "todo",
    source: { label: "AWS What's New(サンプル)", url: "https://aws.amazon.com/new/" },
    changes: ["ストリーミング応答の扱いに、変更がある", "対象のランタイムと制限値を確認する"],
    before: "応答をまとめて返すか、独自にストリームの経路を用意する。",
    after: "新しい制約を踏まえて、SSE の経路とタイムアウトを設計し直せる。",
    impact: {
      changes: "初回応答までの体感を改善できる",
      unchanged: "UI 側の逐次描画は、引き続き必要",
      check: "既存のプロキシ設定と制限値",
    },
    checks: ["API Gateway と CloudFront の設定", "タイムアウトの値"],
  },
  {
    id: "bedrock-models",
    title: "Bedrock のモデル更新を比較する",
    services: ["Bedrock", "AI"],
    summary:
      "新しいモデルバージョンと既存モデルを、用途、料金、コンテキスト長で比べます。",
    importance: "medium",
    minutes: 6,
    status: "viewed",
    source: { label: "AWS ニュースブログ(サンプル)", url: "https://aws.amazon.com/blogs/aws/" },
    changes: ["新しいモデルバージョンが選べる", "料金とコンテキスト長が異なる"],
    before: "既存モデルを前提に、プロンプトとコストを最適化している。",
    after: "新モデルを候補に加え、品質、速度、料金を同じ条件で比べられる。",
    impact: {
      changes: "用途別に、モデルを選び直せる",
      unchanged: "評価データと UI は再利用できる",
      check: "移行時の品質の差と、月額コスト",
    },
    checks: ["リージョンごとの提供状況", "推論プロファイルの ID"],
  },
  {
    id: "cloudfront-pricing",
    title: "CloudFront の料金変更を理解する",
    services: ["CloudFront", "料金"],
    summary: "料金変更の対象範囲と、自分の構成で確認する項目を整理します。",
    importance: "low",
    minutes: 3,
    status: "cleared",
    source: { label: "AWS What's New(サンプル)", url: "https://aws.amazon.com/new/" },
    changes: ["料金の体系に、変更がある", "対象のリクエスト種別を確認する"],
    before: "旧料金を前提に、月額コストを見積もっていた。",
    after: "新料金の対象範囲を反映して、見積もりを更新する。",
    impact: {
      changes: "新料金で、再計算できる",
      unchanged: "配信の構成そのものは変わらない",
      check: "リージョンごとの実利用量",
    },
    checks: ["価格クラスの設定", "キャッシュのヒット率"],
  },
];

// 新しい順に、1 日ずつ古くなる公開日時を付ける
export function buildSampleQuests(now = new Date()): Quest[] {
  return SAMPLES.map((q, i) => ({
    ...q,
    publishedAt: new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString(),
  }));
}
