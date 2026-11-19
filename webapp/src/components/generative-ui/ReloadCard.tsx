import { z } from "zod";
import {
  parseToolResult,
  type ToolResultProps,
} from "../../lib/copilotkit/toolResult";
import { Alert } from "../ui/alert";

// reload_quests が返す値(取得し直した後のクエストの数)
const reloadResultSchema = z.object({ count: z.number() });

// エージェントが、クエストボードを取得し直したことを、チャットに示す
export default function ReloadCard({ status, result }: ToolResultProps) {
  const count = parseToolResult(result, reloadResultSchema)?.count ?? null;

  return (
    <Alert variant="quest" className="my-2 text-[13px]" role="status">
      {status === "complete" && count !== null
        ? `クエストボードを更新しました(${count} 件)`
        : "クエストボードを更新しています…"}
    </Alert>
  );
}
