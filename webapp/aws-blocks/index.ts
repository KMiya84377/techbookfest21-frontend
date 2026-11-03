import { ApiNamespace } from "@aws-blocks/blocks";
import { auth } from "./auth";
import { scope } from "./storage";

export { auth } from "./auth";
// storage.tsのDistributedTableも、同じBlocksバックエンドに構築される。
export { news, userQuests, settings } from "./storage";

export const authApi = auth.createApi();

export const session = new ApiNamespace(scope, "session", (context) => ({
  async identity() {
    const user = await auth.requireAuth(context);
    return { userId: user.userSub };
  },

  async fetchSession() {
    await auth.requireAuth(context);
    const value = await auth.fetchAuthSession(context);
    return {
      accessToken: value.tokens?.accessToken.toString() ?? "",
      userSub: value.userSub,
    };
  },
}));
