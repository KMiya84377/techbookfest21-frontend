import { HttpAgent } from "@ag-ui/client";
import type { HttpAgentFetchFn } from "@ag-ui/client";
import { Sha256 } from "@aws-crypto/sha256-js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import { userContext, withUserId } from "./userContext";

// セッション ID の長さの制約(InvokeAgentRuntime の runtimeSessionId)
const SESSION_ID_MIN_LENGTH = 33;
const SESSION_ID_MAX_LENGTH = 256;

// AgentCore Runtime の ARN から、リージョンを取り出す
// 例: arn:aws:bedrock-agentcore:ap-northeast-1:123456789012:runtime/xxxx
const regionOf = (arn: string): string => {
  const region = arn.split(":")[3];
  if (!region) throw new Error(`AgentCore Runtime の ARN が不正です: ${arn}`);
  return region;
};

// AG-UI の threadId から、AgentCore のセッション ID を作る(同じスレッドは同じセッション)
const sessionIdOf = (threadId: string): string => {
  const padded = threadId.padEnd(SESSION_ID_MIN_LENGTH, "0");
  return padded.slice(0, SESSION_ID_MAX_LENGTH);
};

// リクエストに SigV4 で署名して送る fetch(サービス名は bedrock-agentcore)
const createSigV4Fetch = (region: string): HttpAgentFetchFn => {
  const signer = new SignatureV4({
    credentials: fromNodeProviderChain(),
    region,
    service: "bedrock-agentcore",
    sha256: Sha256,
  });

  return async (url, init) => {
    const target = new URL(url);
    // 検証済みのユーザー ID を、本文に入れる(署名は、この本文に対して行う)
    const body = withUserId(typeof init.body === "string" ? init.body : "");
    const threadId = (JSON.parse(body || "{}") as { threadId?: string }).threadId ?? "default";
    const userId = userContext.getStore()?.userId;
    const headers: Record<string, string> = {
      host: target.host,
      "content-type": "application/json",
      accept: "text/event-stream",
      "x-amzn-bedrock-agentcore-runtime-session-id": sessionIdOf(threadId),
    };
    // This ID comes from the server-side authenticated request context, never from browser input.
    if (userId) {
      headers["x-amzn-bedrock-agentcore-runtime-user-id"] = userId;
    }

    const request = new HttpRequest({
      method: "POST",
      protocol: target.protocol,
      hostname: target.hostname,
      path: target.pathname,
      query: Object.fromEntries(target.searchParams),
      headers,
      body,
    });

    const signed = await signer.sign(request);
    return fetch(target, {
      method: "POST",
      headers: signed.headers,
      body,
      signal: init.signal,
    });
  };
};

// AgentCore Runtime(AG-UI)に、SigV4 署名つきで接続するエージェント
export const createAgentCoreAgent = (runtimeArn: string): HttpAgent => {
  const region = regionOf(runtimeArn);
  const url =
    `https://bedrock-agentcore.${region}.amazonaws.com` +
    `/runtimes/${encodeURIComponent(runtimeArn)}/invocations?qualifier=DEFAULT`;
  return new HttpAgent({ url, fetch: createSigV4Fetch(region) });
};

// ローカルのエージェント(署名なし)に接続するエージェント
// AgentCore と同じく、検証済みのユーザー ID を、本文に入れる
export const createLocalAgent = (url: string): HttpAgent =>
  new HttpAgent({
    url,
    fetch: (target, init) =>
      fetch(target, {
        ...init,
        body: typeof init.body === "string" ? withUserId(init.body) : init.body,
      }),
  });
