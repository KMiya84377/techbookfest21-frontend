import { CognitoJwtVerifier } from "aws-jwt-verify";
import { AUTH_DISABLED, outputs } from "./outputs";

// mock モード(認証なし)で使うユーザー ID
export const MOCK_USER_ID = "mock-user";

// Cognito のアクセストークンを検証する
// `astro dev --mode mock` のときだけ、認証を外す(ビルドでは外れない)
if (!AUTH_DISABLED && !outputs) {
  throw new Error(
    "amplify_outputs.json がありません。npx ampx sandbox などで生成するか、認証なしで動かす場合は npm run dev:mock を使ってください",
  );
}
const verifier =
  !AUTH_DISABLED && outputs
    ? CognitoJwtVerifier.create({
        userPoolId: outputs.auth.user_pool_id,
        tokenUse: "access",
        clientId: outputs.auth.user_pool_client_id,
      })
    : undefined;

// リクエストのトークンを検証して、ユーザー ID(Cognito の sub)を返す
// 認証に失敗したら null を返す
export async function authenticate(request: Request): Promise<string | null> {
  if (!verifier) return MOCK_USER_ID;
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  try {
    const payload = await verifier.verify(token);
    return payload.sub;
  } catch {
    return null;
  }
}
