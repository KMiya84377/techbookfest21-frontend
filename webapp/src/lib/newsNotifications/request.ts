import type { ApiFetch } from "../../hooks/useApiFetch";

// JSON APIとして送信する。本文なしのPOSTはプロキシ経由でAstroのCSRFチェックに拒否される。
// ユーザー情報は本文ではなく、apiFetchが付ける認証ヘッダーからサーバーで検証する。
export function requestNewsReview(apiFetch: ApiFetch) {
  return apiFetch("/api/news-notifications", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}
