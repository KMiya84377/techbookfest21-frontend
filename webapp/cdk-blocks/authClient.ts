import { ApiNamespaceClient } from "aws-cdk-blocks/client";
import type { authApi as AuthApi, session as Session } from "./index";

// ブラウザーでは常に同一オリジン。開発時はAstro、AWS上ではHostingが中継する。
const API_URL = "/cdk-blocks/api";

export const authApi = ApiNamespaceClient<{
  [K in keyof typeof AuthApi]: (typeof AuthApi)[K];
}>("authApi", { url: API_URL });

export const session = ApiNamespaceClient<typeof Session>("session", {
  url: API_URL,
});
