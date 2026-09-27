import { useEffect, useRef } from "react";
import { IMPORTANCE_LABEL, STATUS_LABEL, type Quest } from "../data/quests";
import type { DetailSection } from "../lib/detailSections";

interface Props {
  quest: Quest;
  // チャットから追加された表示
  extras?: DetailSection[];
  onClose: () => void;
}

// ニュースの内容と、アプリが生成した説明を、見分けられるようにする
function Origin({ kind }: { kind: "news" | "ai" }) {
  return kind === "news" ? (
    <span className="origin news">ニュース</span>
  ) : (
    <span className="origin ai">AI 生成</span>
  );
}

// チャットでの質問に応じて、エージェントが追加した表示(見た目は固定。中身だけがエージェントの出力)
function ExtraSection({ section }: { section: DetailSection }) {
  return (
    <section className="generated-panel extra-panel" aria-label={section.title}>
      <h3>
        {section.title} <Origin kind="ai" />
        <span className="origin chat">チャットで追加</span>
      </h3>
      {section.kind === "comparison" && (
        <div className="compare-rows">
          {(section.rows ?? []).map((row) => (
            <div key={row.label} className="compare-row">
              <div className="compare-label">{row.label}</div>
              <div className="compare-grid">
                <div className="compare-side">
                  <strong>これまで</strong>
                  {row.before}
                </div>
                <div className="compare-arrow" aria-hidden="true">
                  →
                </div>
                <div className="compare-side">
                  <strong>更新後</strong>
                  {row.after}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {section.kind === "impact" && (
        <div className="impact-list">
          {(section.items ?? []).map((item) => (
            <div key={item.label} className="impact-item">
              <strong>{item.label}</strong>
              {item.text}
            </div>
          ))}
        </div>
      )}
      {section.kind === "text" && <p>{section.body}</p>}
    </section>
  );
}

export default function QuestDetail({ quest, extras = [], onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="detail-layer" role="dialog" aria-label={`クエスト詳細: ${quest.title}`}>
      <div className="detail-toolbar">
        <button ref={closeRef} type="button" className="back-button" onClick={onClose}>
          ← クエストボードへ戻る
        </button>
        <span className="muted">
          {STATUS_LABEL[quest.status]}{quest.review && "(復習候補)"}・{IMPORTANCE_LABEL[quest.importance]}・約 {quest.minutes} 分
        </span>
      </div>

      <article className="strategy-sheet">
        <div className="strategy-kicker">{quest.services.join(" / ")}</div>
        <h2 className="strategy-title">{quest.title}</h2>

        <div className="generated-stack">
          <section className="generated-panel">
            <h3>
              要約 <Origin kind="news" />
            </h3>
            <p>{quest.summary}</p>
          </section>

          <section className="generated-panel">
            <h3>
              何が変わったか <Origin kind="news" />
            </h3>
            <ul>
              {quest.changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          <section className="generated-panel">
            <h3>
              従来との違い <Origin kind="ai" />
            </h3>
            <div className="compare-grid">
              <div className="compare-side">
                <strong>これまで</strong>
                {quest.before}
              </div>
              <div className="compare-arrow" aria-hidden="true">
                →
              </div>
              <div className="compare-side">
                <strong>更新後</strong>
                {quest.after}
              </div>
            </div>
          </section>

          <section className="generated-panel">
            <h3>
              ユーザーへの影響 <Origin kind="ai" />
            </h3>
            <div className="impact-list">
              <div className="impact-item">
                <strong>変わる</strong>
                {quest.impact.changes}
              </div>
              <div className="impact-item">
                <strong>変わらない</strong>
                {quest.impact.unchanged}
              </div>
              <div className="impact-item">
                <strong>要検証</strong>
                {quest.impact.check}
              </div>
            </div>
          </section>

          <section className="generated-panel">
            <h3>
              確認すべき事項 <Origin kind="ai" />
            </h3>
            <ul>
              {quest.checks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>

          {extras.map((section) => (
            <ExtraSection key={section.id} section={section} />
          ))}

          <section className="generated-panel">
            <h3>元情報</h3>
            <a href={quest.source.url} target="_blank" rel="noreferrer">
              {quest.source.label}
            </a>
          </section>
        </div>
      </article>
    </div>
  );
}
