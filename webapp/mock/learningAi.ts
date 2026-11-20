import {
  validateConnections,
  type LearningConnections,
  type LearningEntry,
} from "../src/lib/learning/model";
import { learningUISchema } from "../src/lib/learning/openGenerativeUI";

const escapeHTML = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

// 生成済みactivityの形を模した、AIを呼ばない表示確認用のデータ。
export function mockLearningDiagram(history: LearningEntry[]) {
  const diagram = mockConnections(history);
  const titles = new Map(history.map((entry) => [entry.questId, entry.title]));
  const ui = learningUISchema.parse({
    version: 1,
    messageId: `mock-learning-ui-${crypto.randomUUID()}`,
    content: {
      initialHeight: 650,
      generating: false,
      css: "body{margin:0;background:#eee0bc;color:#382c1d;font:16px system-ui}main{padding:24px}h2{font-size:20px}.nodes{display:flex;align-items:center;gap:16px}.node{flex:1;min-width:0;overflow-wrap:anywhere;border:2px solid #926e38;border-radius:6px;padding:16px;background:#eee4ca}.relation{text-align:center;color:#75644b}@media(max-width:520px){.nodes{flex-direction:column}.node{box-sizing:border-box;width:100%}}",
      cssComplete: true,
      html: [
        `<main><h2>学んだニュースのつながり（モック）</h2><p>生成済みUIの表示確認用です。AIによる分析・生成ではありません。</p><div class="nodes">${diagram.nodes.map((node) => `<section class="node">${escapeHTML(titles.get(node.questId) ?? node.questId)}</section>`).join('<span aria-hidden="true">↔</span>')}</div><p class="relation">${escapeHTML(diagram.edges[0].label)}</p></main>`,
      ],
      htmlComplete: true,
    },
  });
  return { diagram, ui };
}

// mockモード専用。AIを呼ばずに、画面確認用の関連図を返す
export function mockConnections(history: LearningEntry[]): LearningConnections {
  return validateConnections(
    {
      hasConnections: true,
      title: "学んだニュースのつながり（モック）",
      summary:
        "学習済みの２件を使った画面確認用の表示です。AIによる関連分析ではありません。",
      nodes: history.slice(-2).map((entry) => ({
        questId: entry.questId,
        note: "学習済みのニュース",
      })),
      edges: [
        {
          from: history.at(-2)!.questId,
          to: history.at(-1)!.questId,
          label: "２件の関係を表示するモック",
        },
      ],
    },
    history,
  );
}
