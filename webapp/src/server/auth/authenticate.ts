import { CognitoJwtVerifier } from "aws-jwt-verify";
import { AUTH_DISABLED, BLOCKS_LOCAL } from "../../lib/blocks/config";
import { serverConfig } from "../blocks/serverConfig";

export const MOCK_USER_ID = "mock-user";

type Authenticate = (request: Request) => Promise<string | null>;

// mock モード: 認証なしで、固定のユーザーとして扱う
const authenticateMock: Authenticate = async () => MOCK_USER_ID;

// BlocksのローカルCognito実装にはAWS署名のJWTがないため、ローカル認証APIでセッションを確認する。
// この経路は開発サーバーだけ。AWS上では必ずCognitoのJWTを検証する。
const authenticateLocal: Authenticate = async (request) => {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const response = await fetch(new URL("/aws-blocks/api", serverConfig().apiUrl!), {
    method: "POST", headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "session.identity", params: [] }),
  });
  const body = await response.json() as { result?: { userId?: string }; error?: unknown };
  return response.ok && !body.error && typeof body.result?.userId === "string" ? body.result.userId : null;
};

// AWS上: CognitoのアクセストークンのJWTを検証する
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined;
const authenticateCognito: Authenticate = async (request) => {
  const { userPoolId, clientId } = serverConfig();
  if (!userPoolId || !clientId) throw new Error("BlocksのCognito接続情報がありません");
  verifier ??= CognitoJwtVerifier.create({ userPoolId, tokenUse: "access", clientId });
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return null;
  try { return (await verifier.verify(token)).sub; } catch { return null; }
};

export const authenticate: Authenticate = AUTH_DISABLED ? authenticateMock : BLOCKS_LOCAL ? authenticateLocal : authenticateCognito;
