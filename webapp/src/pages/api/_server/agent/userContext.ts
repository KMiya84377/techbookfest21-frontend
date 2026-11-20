import { AsyncLocalStorage } from "node:async_hooks";

// エージェント接続時に参照する、検証済みユーザー ID をリクエストの処理中だけ保持する
// (CopilotRuntime から、エージェントへの送信まで、同じ処理の流れの中で、読み出す)
interface VerifiedUserContext {
  userId: string;
  localAuthCookie?: string;
}

export const userContext = new AsyncLocalStorage<VerifiedUserContext>();

// AG-UIのリクエスト本文に、検証済みユーザーIDとローカル認証用Cookieを入れる。
// 画面が送ってきた forwardedProps.userId は、必ず上書きする(または、取り除く)ので、偽装できない
export function attachVerifiedUserContext(body: string): string {
  if (!body) return body;

  const verifiedUser = userContext.getStore();
  const requestBody = JSON.parse(body) as {
    forwardedProps?: Record<string, unknown>;
  };
  const forwardedProps = { ...(requestBody.forwardedProps ?? {}) };

  // ブラウザーから渡された認証情報は採用せず、検証済みの値で上書きする。
  if (verifiedUser?.localAuthCookie) {
    forwardedProps.localAuthCookie = verifiedUser.localAuthCookie;
  } else {
    delete forwardedProps.localAuthCookie;
  }
  if (verifiedUser?.userId) {
    forwardedProps.userId = verifiedUser.userId;
  } else {
    delete forwardedProps.userId;
  }

  return JSON.stringify({ ...requestBody, forwardedProps });
}
