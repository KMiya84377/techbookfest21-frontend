import { defineMiddleware } from "astro:middleware";

// 画面(HTML)の応答に、CSP(読み込み・通信できる先の制限)を付ける。
//
// 目的は、Open Generative UI(F-04)が生成した UI に、外部と通信させないこと。
// 生成した UI は sandbox の iframe(srcdoc)で動き、srcdoc の iframe は親のページの CSP を引き継ぐ。
// そのため、このページの CSP が、生成した UI にも効く(外部への fetch・画像・スクリプトなどが止まる)。
//
// - script-src の 'unsafe-inline' は、生成した UI のインラインスクリプトを動かすために必要。
//   Astro の security.csp はハッシュで許可する方式で、生成した UI のスクリプトまで止めてしまうので使わない。
// - 通信先は、同じオリジン(API、CopilotKit、Blocks の認証)だけ。
// - 開発サーバーだけ、Vite の HMR(WebSocket)と eval を許可する。
const directives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${import.meta.env.DEV ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${import.meta.env.DEV ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
];
const CONTENT_SECURITY_POLICY = directives.join("; ");

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  if (response.headers.get("content-type")?.includes("text/html")) {
    response.headers.set("content-security-policy", CONTENT_SECURITY_POLICY);
  }
  return response;
});
