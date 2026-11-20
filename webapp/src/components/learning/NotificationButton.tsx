import { Button } from "../ui/button";

// 通知の一覧の 1 件(関心に合う新着と、学習内容のつながりで共通)
export default function NotificationButton({
  read,
  title,
  detail,
  disabled = false,
  onClick,
}: {
  // 確認済みか(false なら「未読」と表示する)
  read: boolean;
  title: string;
  // タイトルの下に出す補足(関心に合う新着の、選定理由)
  detail?: string;
  // true なら、押せなくする(別のニュースを開いている間など)
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="unstyled"
      type="button"
      disabled={disabled}
      className="w-full rounded border border-quest-card-line bg-quest-card-header p-3 text-left hover:bg-quest-notice-hover disabled:opacity-60"
      onClick={onClick}
    >
      <span className="block text-xs text-quest-brown">
        {read ? "確認済み" : "未読"}
      </span>
      <span className="mt-1 block text-sm font-semibold">{title}</span>
      {detail && <span className="mt-1 block text-sm">{detail}</span>}
    </Button>
  );
}
