import { useId } from "react";
import type { LearningInsight } from "../../lib/learning/model";

// 図の中のニュース 1 件の枠
const NODE_CLASS =
  "h-full overflow-hidden rounded border-2 border-[#b99a67] bg-[#f4e8ce] p-3 text-[#302b22]";

// AIが指定したニュース・関係を描画する。コードやHTMLは受け取らない。
export default function LearningDiagram({
  insight,
}: {
  insight: LearningInsight;
}) {
  const markerId = "learning-arrow-" + useId().replaceAll(":", "");
  const nodes = insight.diagram.nodes;
  const columns = Math.min(3, nodes.length);
  const width = columns * 280 + 40;
  const height = Math.ceil(nodes.length / columns) * 180 + 30;
  const positions = new Map(
    nodes.map((node, index) => [
      node.questId,
      {
        x: 160 + (index % columns) * 280,
        y: 90 + Math.floor(index / columns) * 180,
      },
    ]),
  );
  const sources = new Map(
    insight.sources.map((source) => [source.questId, source]),
  );

  return (
    <div className="space-y-4">
      {insight.mock && (
        <p className="rounded border border-[#b99a67] bg-[#f4e8ce] p-3 text-sm">
          モック表示です。AIによる関連分析ではありません。
        </p>
      )}
      <p className="text-sm leading-relaxed">{insight.diagram.summary}</p>
      <div className="overflow-x-auto rounded border border-[#d9c9aa] bg-[#fffdf8]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[600px] w-full"
          role="img"
          aria-label={`${insight.diagram.title}。関係の説明は図の下にあります。`}
        >
          <defs>
            <marker
              id={markerId}
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#74532b" />
            </marker>
          </defs>
          {insight.diagram.edges.map((edge, index) => {
            const a = positions.get(edge.from)!;
            const b = positions.get(edge.to)!;
            const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
            const direction = horizontal
              ? Math.sign(b.x - a.x)
              : Math.sign(b.y - a.y);
            const x1 = a.x + (horizontal ? direction * 112 : 0);
            const y1 = a.y + (horizontal ? 0 : direction * 58);
            const x2 = b.x - (horizontal ? direction * 112 : 0);
            const y2 = b.y - (horizontal ? 0 : direction * 58);
            const x = (x1 + x2) / 2;
            const y = (y1 + y2) / 2;
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#74532b"
                  strokeWidth="2"
                  markerEnd={`url(#${markerId})`}
                />
                <circle cx={x} cy={y} r="12" fill="#74532b" />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fill="#fffaf0"
                  fontSize="13"
                >
                  {index + 1}
                </text>
              </g>
            );
          })}
          {nodes.map((node, index) => {
            const position = positions.get(node.questId)!;
            return (
              <foreignObject
                key={node.questId}
                x={position.x - 112}
                y={position.y - 58}
                width="224"
                height="116"
              >
                <div className={NODE_CLASS}>
                  <div className="mb-1 text-xs text-[#74532b]">
                    学習済み {index + 1}
                  </div>
                  <div className="line-clamp-3 text-sm leading-snug font-semibold">
                    {sources.get(node.questId)?.title}
                  </div>
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
      <ol className="space-y-3" aria-label="ニュース同士の関係">
        {insight.diagram.edges.map((edge, index) => (
          <li
            key={`${edge.from}-${edge.to}`}
            className="rounded border border-[#d9c9aa] p-3 text-sm"
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
        <summary className="cursor-pointer text-[#74532b]">
          関連づけに使った学習内容
        </summary>
        <ul className="mt-3 space-y-3">
          {nodes.map((node) => (
            <li key={node.questId}>
              <strong>{sources.get(node.questId)?.title}</strong>
              <p className="mt-1">{node.note}</p>
              <p className="mt-1 text-[#746b5c]">
                学習時の要約：{sources.get(node.questId)?.summary}
              </p>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
