import type { HttpAgent } from "@ag-ui/client";

// 1 回の実行の上限。学習内容の図解は 2 回続けて実行する(合計 90 秒まで)ので、
// 実行権の期限(180 秒)と SSR の Lambda の上限(5 分)の内に、失敗状態の保存まで終えられる。
const TIMEOUT_MS = 45_000;

interface StructuredToolRequest {
  // エージェントへの依頼文(ユーザーのメッセージとして送る)
  instruction: string;
  // エージェントに呼ばせるツール。引数のスキーマは JSON Schema で渡す
  tool: { name: string; description: string; parameters: unknown };
  // 参照データ(サーバーが DB から取得したもの)
  context: { description: string; value: string };
  // エージェント側で、通常の会話と分けるための目印(例: { newsReview: true })
  forwardedProps: Record<string, unknown>;
  // ツールが 1 回だけ呼ばれなかったときのエラーメッセージ
  missingMessage: string;
}

// 通常のチャットとは別のスレッドでエージェントを動かし、指定したツールの引数を 1 つだけ受け取る。
// 引数は、ツール呼び出しの完了イベントまで受信してから返す(検証は呼び出し側で行う)
export async function runStructuredTool(
  agent: HttpAgent,
  request: StructuredToolRequest,
): Promise<unknown> {
  agent.threadId = crypto.randomUUID();
  agent.addMessage({
    id: crypto.randomUUID(),
    role: "user",
    content: request.instruction,
  });
  const results: unknown[] = [];
  let runError: string | undefined;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await agent.runAgent(
      {
        abortController: controller,
        tools: [request.tool],
        context: [request.context],
        forwardedProps: request.forwardedProps,
      },
      {
        onToolCallEndEvent: ({ toolCallName, toolCallArgs }) => {
          if (toolCallName === request.tool.name) results.push(toolCallArgs);
        },
        onRunErrorEvent: ({ event }) => {
          runError = event.message;
        },
      },
    );
    if (runError) throw new Error(runError);
    if (results.length !== 1) throw new Error(request.missingMessage);
    return results[0];
  } finally {
    clearTimeout(timer);
  }
}
