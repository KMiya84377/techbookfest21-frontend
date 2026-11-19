import { Component, lazy, Suspense, type ReactNode } from "react";
import type { LearningInsight } from "../../lib/learning/model";
import { learningUISchema } from "../../lib/learning/openGenerativeUI";

const LearningUIRenderer = lazy(() => import("./LearningUIRenderer"));

class DiagramBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert" className="p-4 text-sm">
        図解を表示できません。関係の説明を以下で確認できます。
      </p>
    ) : (
      this.props.children
    );
  }
}

// 保存済みの完成したUIを公式レンダラーで再表示する。開くたびにAIを呼び直さない。
export default function LearningDiagram({
  insight,
}: {
  insight: LearningInsight;
}) {
  const parsed = learningUISchema.safeParse(insight.ui);
  const sources = new Map(
    insight.sources.map((source) => [source.questId, source]),
  );
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed">{insight.diagram.summary}</p>
      {parsed.success ? (
        <div
          className="max-h-[1000px] overflow-auto rounded border border-quest-card-line bg-quest-diagram-bg"
          role="group"
          aria-label={`${insight.diagram.title}の図解`}
        >
          <DiagramBoundary key={parsed.data.messageId}>
            <Suspense
              fallback={
                <p role="status" className="p-4 text-sm">
                  図解を読み込んでいます…
                </p>
              }
            >
              <LearningUIRenderer ui={parsed.data} />
            </Suspense>
          </DiagramBoundary>
        </div>
      ) : (
        <p className="text-sm text-quest-card-muted" role="status">
          {insight.ui
            ? "図解のデータを読み込めません。関係の説明を以下で確認できます。"
            : "旧形式の通知です。ニュース同士の関係を文章で表示します。"}
        </p>
      )}
      <ol className="space-y-3" aria-label="ニュース同士の関係">
        {insight.diagram.edges.map((edge, index) => (
          <li
            key={`${edge.from}-${edge.to}`}
            className="rounded border border-quest-card-line p-3 text-sm"
          >
            <div className="font-semibold">
              {index + 1}. {sources.get(edge.from)?.title} →{" "}
              {sources.get(edge.to)?.title}
            </div>
            <p className="mt-1 leading-relaxed">{edge.label}</p>
          </li>
        ))}
      </ol>
      <details className="text-sm">
        <summary className="cursor-pointer text-quest-brown">
          関連づけに使った学習内容
        </summary>
        <ul className="mt-3 space-y-3">
          {insight.diagram.nodes.map((node) => (
            <li key={node.questId}>
              <strong>{sources.get(node.questId)?.title}</strong>
              <p className="mt-1">{node.note}</p>
              <p className="mt-1 text-quest-card-muted">
                学習時の要約：{sources.get(node.questId)?.summary}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
