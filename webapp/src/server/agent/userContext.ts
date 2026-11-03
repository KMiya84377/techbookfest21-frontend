import { AsyncLocalStorage } from "node:async_hooks";

// エージェント接続時に参照する、検証済みユーザー ID をリクエストの処理中だけ保持する
// (CopilotRuntime から、エージェントへの送信まで、同じ処理の流れの中で、読み出す)
export const userContext = new AsyncLocalStorage<{ userId: string; localAuthCookie?: string }>();

// エージェントへ送る AG-UI のリクエストの本文に、サーバーが検証したユーザー ID を入れる
// 画面が送ってきた forwardedProps.userId は、必ず上書きする(または、取り除く)ので、偽装できない
export function withUserId(body: string): string {
  if (!body) return body;
  const userId = userContext.getStore()?.userId;
  const input = JSON.parse(body) as { forwardedProps?: Record<string, unknown> };
  const props = { ...(input.forwardedProps ?? {}) };
  const cookie = userContext.getStore()?.localAuthCookie;
  if (cookie) props.localAuthCookie = cookie;
  else delete props.localAuthCookie;
  if (userId) props.userId = userId;
  else delete props.userId;
  return JSON.stringify({ ...input, forwardedProps: props });
}
