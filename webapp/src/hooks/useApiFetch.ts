import { useCallback, useRef } from "react";

export type ApiFetch = (
  url: string,
  init?: Omit<RequestInit, "headers"> & { headers?: Record<string, string> },
) => Promise<Response>;

// ログイン中なら、Authorization ヘッダーを付けて fetch する
//   getToken は、レンダリングのたびに作り直されることがあるため、参照で持つ
export function useApiFetch(getToken?: () => string): ApiFetch {
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;

  return useCallback((url, init = {}) => {
    const token = tokenRef.current?.();
    return fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, []);
}
