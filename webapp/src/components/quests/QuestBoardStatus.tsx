import { clsx } from "cn";
import { Button } from "../ui/button";

// 状態の保存や再取得に失敗したときの通知
export function StateErrorBanner({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className={clsx(
        "mx-4 mb-3 flex items-start justify-between gap-3 border border-quest-error-line",
        "bg-quest-error-bg px-3 py-2.5 text-sm text-destructive",
      )}
      role="alert"
    >
      <p className="min-w-0 flex-1">{message}</p>
      <Button
        type="button"
        variant="questOutline"
        size="icon-sm"
        className={clsx(
          "-mr-1 -mt-1 shrink-0 border-transparent px-0 text-xl leading-none text-destructive",
          "hover:border-quest-error-line hover:bg-quest-error-hover",
        )}
        aria-label="エラー通知を閉じる"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </Button>
    </div>
  );
}

export function QuestLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="px-0 py-8 text-[var(--board-text)]" role="alert">
      <p>クエストを取得できませんでした。</p>
      <Button
        type="button"
        variant="questActive"
        size="sm"
        className="mt-3"
        onClick={onRetry}
      >
        もう一度取得する
      </Button>
    </div>
  );
}

export function QuestLoading() {
  return (
    <div className="px-0 py-8 text-[var(--board-text)]" role="status">
      クエストを読み込んでいます…
    </div>
  );
}
