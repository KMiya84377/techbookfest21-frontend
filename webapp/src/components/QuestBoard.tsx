import {
  IMPORTANCE_LABEL,
  RANK,
  STATUS_LABEL,
  type Quest,
  type QuestStatus,
} from "../data/quests";
import {
  applyFilter,
  describeFilter,
  type FilterPatch,
  type QuestFilter,
} from "../lib/questFilter";

const TABS: { key: "all" | QuestStatus; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "todo", label: "未着手" },
  { key: "viewed", label: "閲覧済み" },
  { key: "cleared", label: "クリア済み" },
];

const IMPORTANCE_ORDER = { high: 0, medium: 1, low: 2 } as const;

interface Props {
  quests: Quest[];
  filter: QuestFilter;
  onFilterChange: (patch: FilterPatch) => void;
  onOpen: (id: string) => void;
}

export default function QuestBoard({ quests, filter, onFilterChange, onOpen }: Props) {
  // 重要度の高いクエストを、先に表示する
  const shown = applyFilter(quests, filter).sort(
    (a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance],
  );
  const conditions = describeFilter(filter);
  const activeTab = filter.status ?? "all";

  return (
    <section className="board" aria-label="クエストボード">
      <div className="board-head">
        <div>
          <h2>クエストボード</h2>
          <p className="muted">
            {shown.length} 件のクエスト
            {conditions.length > 0 && `(全 ${quests.length} 件)`}・サンプルデータ
          </p>
        </div>
        <div className="tabs" role="tablist" aria-label="状態で絞り込む">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? "tab active" : "tab"}
              onClick={() => onFilterChange({ status: tab.key === "all" ? null : tab.key })}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {conditions.length > 0 && (
        <div className="conditions" aria-label="適用中の条件">
          <span className="conditions-label">適用中の条件</span>
          {conditions.map((c) => (
            <span key={c} className="condition">
              {c}
            </span>
          ))}
          <button type="button" className="tab" onClick={() => onFilterChange({ reset: true })}>
            条件をすべて解除
          </button>
        </div>
      )}

      {quests.length === 0 ? (
        <p className="empty">クエストがまだありません。チャットで、クエストを探せます。</p>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>条件に合うクエストがありません。条件を減らすか、期間を広げてください。</p>
          <button
            type="button"
            className="tab active"
            onClick={() => onFilterChange({ reset: true })}
          >
            条件をすべて解除する
          </button>
        </div>
      ) : (
        <div className="quest-list">
          {shown.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`quest status-${q.status}`}
              data-stamp={q.status === "cleared" ? "済" : RANK[q.importance]}
              onClick={() => onOpen(q.id)}
            >
              <span className="quest-head">
                <span className="quest-title">{q.title}</span>
                <span className={`badge status ${q.status}`}>{STATUS_LABEL[q.status]}</span>
              </span>
              <span className="quest-copy">{q.summary}</span>
              <span className="meta-row">
                {q.services.map((s) => (
                  <span key={s} className="badge">
                    {s}
                  </span>
                ))}
                <span className={q.importance === "high" ? "badge high" : "badge"}>
                  {IMPORTANCE_LABEL[q.importance]}
                </span>
                {q.review && <span className="badge review">復習</span>}
                <span className="source">約 {q.minutes} 分</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
