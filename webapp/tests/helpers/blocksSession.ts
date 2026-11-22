import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

// AWS CDK Blocks 1.0.0のローカルCognito保存形式(.cdk-blocks/local/data/…/state.json)を使うテスト用ヘルパー。実AWSには使わない。
export async function blocksSession(base: string) {
  assert.ok(
    ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
    "BlocksのAPIテストはローカル環境専用です",
  );
  let cookie = "";
  const username = `test-${crypto.randomUUID()}@example.test`,
    password = "LocalTest123!";
  async function rpc(action: string, values: Record<string, string>) {
    const response = await fetch(base + "/cdk-blocks/api", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "authApi.setAuthState",
        params: [{ action, ...values }],
      }),
    });
    const cookies = response.headers
      .getSetCookie()
      .map((item) => item.split(";")[0]);
    if (cookies.length) cookie = cookies.join("; ");
    const result = await response.json();
    assert.ok(!result.error, JSON.stringify(result.error));
    return result.result;
  }
  await rpc("signUp", { username, password });
  const local = JSON.parse(
    await readFile(".cdk-blocks/local/data/quests-auth/state.json", "utf8"),
  );
  // ユーザーと確認コードは、メールアドレスではなく、ユーザーID(userSub)をキーに保存される。
  const user = Object.values<{ userSub: string; attributes: { email: string } }>(
    local.users,
  ).find((item) => item.attributes.email === username);
  assert.ok(user, "登録したユーザーがローカルの保存先にありません");
  const code = local.codes[`signUp:${user.userSub}`].code;
  await rpc("confirmSignUp", { username, code });
  assert.equal((await rpc("signIn", { username, password })).state, "signedIn");
  async function request(path: string, method = "GET", body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: { cookie, origin: base, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  }
  return { request };
}
