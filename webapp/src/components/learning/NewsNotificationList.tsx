import type { NewsNotification } from "../../lib/newsNotifications/model";
import { Button } from "../ui/button";
import NotificationButton from "./NotificationButton";

interface Props {
  news: NewsNotification[];
  newsBusy: boolean;
  newsError: string | null;
  openError: string | null;
  opening: boolean;
  onRetry: () => void;
  onOpen: (notification: NewsNotification) => void;
}

export default function NewsNotificationList({
  news,
  newsBusy,
  newsError,
  openError,
  opening,
  onRetry,
  onOpen,
}: Props) {
  return (
    <>
      <h3 className="mb-2 text-sm font-semibold">関心に合う新着</h3>
      {newsBusy && (
        <p className="mb-2 text-sm" role="status">
          新着を確認しています…
        </p>
      )}
      {(newsError || openError) && (
        <div role="alert" className="mb-2 text-sm">
          <p>{openError ?? newsError}</p>
          <Button
            variant="questOutline"
            disabled={newsBusy || opening}
            onClick={onRetry}
          >
            再確認
          </Button>
        </div>
      )}
      {!news.length && !newsBusy && (
        <p className="mb-3 text-sm">新着の通知はまだありません。</p>
      )}
      <ul className="mb-4 space-y-2">
        {news.map((notification) => (
          <li key={notification.id}>
            <NotificationButton
              read={Boolean(notification.readAt)}
              title={notification.title}
              detail={notification.reason}
              disabled={opening}
              onClick={() => onOpen(notification)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
