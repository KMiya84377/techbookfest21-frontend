import { Alert } from "../ui/alert";

interface Props {
  status: string;
  result?: string;
}

function parseCount(result?: string): number | null {
  try {
    return (JSON.parse(result ?? "") as { count: number }).count;
  } catch {
    return null;
  }
}

// エージェントが、クエストボードを取得し直したことを、チャットに示す
export default function ReloadCard({ status, result }: Props) {
  const count = parseCount(result);
  return (
    <Alert variant="quest" className="my-2 text-[13px]" role="status">
      {status === "complete" && count !== null
        ? `クエストボードを更新しました(${count} 件)`
        : "クエストボードを更新しています…"}
    </Alert>
  );
}
