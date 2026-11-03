import { useEffect, useRef } from "react";
import {
  IMPORTANCE_LABEL,
  STATUS_LABEL,
  type Quest,
} from "../../lib/quests/model";
import type { DetailSection } from "../../lib/quests/detailSections";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import DetailA2UI from "../generative-ui/DetailA2UI";

const PANEL_CLASS = "p-3.5 bg-[#bca27222] text-[13px] leading-[1.8]";
const PANEL_TITLE_CLASS =
  "mb-2 flex flex-wrap items-center gap-2 font-[var(--font-tavern)] text-[15px] font-medium";
const COMPARE_GRID_CLASS =
  "grid grid-cols-[1fr_auto_1fr] items-stretch gap-2.5 max-[600px]:grid-cols-1";
const COMPARE_SIDE_CLASS = "p-[11px] bg-[#f0e4c488] text-xs leading-[1.7]";

interface Props {
  quest: Quest;
  // チャットから追加された表示
  extras?: DetailSection[];
  onClose: () => void;
}

// ニュースの内容と、アプリが生成した説明を、見分けられるようにする
function Origin({ kind }: { kind: "news" | "ai" }) {
  return kind === "news" ? (
    <Badge variant="news">ニュース</Badge>
  ) : (
    <Badge variant="ai">AI 生成</Badge>
  );
}

// AIがA2UIで構成した表示。チャットと同じメッセージを詳細でも使う。
function ExtraSection({ section }: { section: DetailSection }) {
  return (
    <section
      className={`${PANEL_CLASS} border-l-[3px] border-l-[var(--wax)]`}
      aria-label={section.title}
    >
      <h3 className={PANEL_TITLE_CLASS}>
        {section.title} <Origin kind="ai" />
        <Badge variant="chat">チャットで追加</Badge>
      </h3>
      <DetailA2UI section={section} />
    </section>
  );
}

export default function QuestDetail({ quest, extras = [], onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // 開いたときに戻るボタンへフォーカスする。チャットの操作は妨げない。
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
      <section
        role="region"
        className="detail-layer absolute inset-0 z-10 overflow-auto p-6 max-[600px]:fixed max-[600px]:w-screen max-[600px]:h-[100dvh] max-[600px]:max-h-[100dvh] max-[600px]:p-[17px] max-[600px]:[-webkit-overflow-scrolling:touch]"
        aria-label={`クエスト詳細: ${quest.title}`}
        onKeyDown={(event) => {
          if (event.key === "Escape") { event.stopPropagation(); onClose(); }
        }}
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Button
            ref={closeRef}
            type="button"
            variant="quest"
            className="h-auto cursor-pointer rounded-[2px] border-[#b4976655] bg-[#21170fc9] px-3 py-[9px] font-[var(--font-tavern)] text-xs text-[var(--board-text)] shadow-none hover:bg-[#302116] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--brass)]"
            onClick={onClose}
          >
            ← クエストボードへ戻る
          </Button>
          <span className="text-xs text-[var(--board-muted)]">
            {STATUS_LABEL[quest.status]}
            {quest.review && "(復習候補)"}・{IMPORTANCE_LABEL[quest.importance]}
            ・約 {quest.minutes} 分
          </span>
        </div>

        <article className="strategy-sheet mx-auto max-w-[820px] p-[clamp(20px,3vw,40px)] text-[var(--ink)] shadow-[3px_9px_18px_var(--shadow)]">
          <div className="font-mono text-[11px] tracking-[0.08em] text-[#78603c]">
            {quest.services.join(" / ")}
          </div>
          <h2 className="mt-[9px] font-[var(--font-tavern)] text-[25px] leading-[1.6] font-medium max-[600px]:text-[21px]">
            {quest.title}
          </h2>

          <div className="mt-[18px] grid gap-[10px]">
            <section className={PANEL_CLASS}>
              <h3 className={PANEL_TITLE_CLASS}>
                要約 <Origin kind="news" />
              </h3>
              <p>{quest.summary}</p>
            </section>

            <section className={PANEL_CLASS}>
              <h3 className={PANEL_TITLE_CLASS}>
                何が変わったか <Origin kind="news" />
              </h3>
              <ul className="my-0 pl-[18px]">
                {quest.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>

            <section className={PANEL_CLASS}>
              <h3 className={PANEL_TITLE_CLASS}>
                従来との違い <Origin kind="ai" />
              </h3>
              <div className={COMPARE_GRID_CLASS}>
                <div className={COMPARE_SIDE_CLASS}>
                  <strong className="mb-1 block font-medium">これまで</strong>
                  {quest.before}
                </div>
                <div
                  className="self-center text-lg max-[600px]:justify-self-center max-[600px]:rotate-90"
                  aria-hidden="true"
                >
                  →
                </div>
                <div className={COMPARE_SIDE_CLASS}>
                  <strong className="mb-1 block font-medium">更新後</strong>
                  {quest.after}
                </div>
              </div>
            </section>

            <section className={PANEL_CLASS}>
              <h3 className={PANEL_TITLE_CLASS}>
                ユーザーへの影響 <Origin kind="ai" />
              </h3>
              <div className="grid grid-cols-3 gap-2 max-[600px]:grid-cols-1">
                <div className={COMPARE_SIDE_CLASS}>
                  <strong className="mb-1 block font-medium">変わる</strong>
                  {quest.impact.changes}
                </div>
                <div className={COMPARE_SIDE_CLASS}>
                  <strong className="mb-1 block font-medium">変わらない</strong>
                  {quest.impact.unchanged}
                </div>
                <div className={COMPARE_SIDE_CLASS}>
                  <strong className="mb-1 block font-medium">要検証</strong>
                  {quest.impact.check}
                </div>
              </div>
            </section>

            <section className={PANEL_CLASS}>
              <h3 className={PANEL_TITLE_CLASS}>
                確認すべき事項 <Origin kind="ai" />
              </h3>
              <ul className="my-0 pl-[18px]">
                {quest.checks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>

            {extras.map((section) => (
              <ExtraSection key={section.id} section={section} />
            ))}

            <section className={PANEL_CLASS}>
              <h3 className={PANEL_TITLE_CLASS}>元情報</h3>
              <a
                className="text-[var(--wax)] underline"
                href={quest.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {quest.source.label}
              </a>
            </section>
          </div>
        </article>
      </section>
  );
}
