import { clsx } from "cn";
import {
  IMPORTANCE_LABEL,
  STATUS_LABEL,
  type Quest,
} from "../../lib/quests/model";
import { questCardClasses, questStatusClasses } from "./questCardStyles";

function QuestCardHeader({ publishedAt }: { publishedAt: string }) {
  const publishedDate = publishedAt.slice(0, 10).replaceAll("-", ".");
  return (
    <span className={questCardClasses.header}>
      <span className={questCardClasses.headerLabel}>GUILD REQUEST</span>
      <time dateTime={publishedAt}>{publishedDate}</time>
    </span>
  );
}

function QuestServices({ services }: { services: string[] }) {
  return (
    <span className={questCardClasses.services}>
      {services.map((service) => (
        <span key={service} className={questCardClasses.service}>
          {service}
        </span>
      ))}
    </span>
  );
}

function QuestMetadata({ quest }: { quest: Quest }) {
  return (
    <span className={questCardClasses.metadata}>
      <span
        className={clsx(questCardClasses.status, questStatusClasses[quest.status])}
      >
        {STATUS_LABEL[quest.status]}
        {quest.review && " · 復習"}
      </span>
      <span className={questCardClasses.minutes}>所要 約 {quest.minutes} 分</span>
      <span className={questCardClasses.importance}>
        {IMPORTANCE_LABEL[quest.importance]}
      </span>
    </span>
  );
}

// カードに載せる日付・タイトル・要約・サービス・学習情報。
export default function QuestCardContent({ quest }: { quest: Quest }) {
  return (
    <>
      <QuestCardHeader publishedAt={quest.publishedAt} />
      <span className={questCardClasses.title}>{quest.title}</span>
      <span className={questCardClasses.summary}>{quest.summary}</span>
      <QuestServices services={quest.services} />
      <QuestMetadata quest={quest} />
    </>
  );
}
