import type { LearningInsight } from "../../lib/learning/model";
import { Button } from "../ui/button";
import NotificationButton from "./NotificationButton";

interface Props {
  insights: LearningInsight[];
  busy: boolean;
  error: string | null;
  onRetry: () => Promise<void>;
  onOpen: (insight: LearningInsight) => void;
}

export default function LearningInsightList({
  insights,
  busy,
  error,
  onRetry,
  onOpen,
}: Props) {
  return (
    <>
      <h3 className="mb-2 text-sm font-semibold">学習内容のつながり</h3>
      {busy && (
        <p className="mb-3 text-sm" role="status">
          学習内容のつながりを分析しています…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-3 rounded border border-quest-error-box-line p-2 text-sm"
        >
          <p>{error}</p>
          <Button
            variant="questOutline"
            className="mt-2"
            disabled={busy}
            onClick={() => void onRetry()}
          >
            再試行
          </Button>
        </div>
      )}
      {!insights.length && !busy && (
        <p className="text-sm leading-relaxed">
          通知はまだありません。学習が進むと、学んだニュース同士のつながりをお知らせします。
        </p>
      )}
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li key={insight.id}>
            <NotificationButton
              read={Boolean(insight.readAt)}
              title={insight.diagram.title}
              onClick={() => onOpen(insight)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
