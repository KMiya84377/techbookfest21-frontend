import { BLOCKS_LOCAL } from "../../lib/blocks/config";

// サーバー(Node)専用の接続情報。環境変数から読む
export function serverConfig() {
  const config = JSON.parse(process.env.BLOCKS_CONFIG ?? "{}") as { auth?: { userPoolId?: string; clientId?: string; region?: string } };
  return {
    apiUrl: process.env.BLOCKS_API_URL ?? (BLOCKS_LOCAL ? "http://127.0.0.1:3000" : undefined),
    userPoolId: process.env.COGNITO_USER_POOL_ID ?? config.auth?.userPoolId,
    clientId: process.env.COGNITO_CLIENT_ID ?? config.auth?.clientId,
  };
}
