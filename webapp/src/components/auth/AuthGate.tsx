import { useEffect, useRef, useState, type ReactNode } from "react";
import { Authenticator, onAuthChange } from "@aws-blocks/blocks/ui";
import { authenticatorOptions } from "./authenticatorOptions";
import { authApi, session } from "../../../aws-blocks/authClient";

// ログイン後に、アクセストークンを返す関数(getToken)を受け取って、画面を作る関数
type RenderWithToken = (getToken: () => string) => ReactNode;

// ログインするまで、Blocks のログイン画面を出す。ログイン後は、アクセストークンを返す関数を子へ渡す
export default function AuthGate({ children }: { children: RenderWithToken }) {
  const authenticatorMount = useRef<HTMLDivElement>(null);
  const accessTokenRef = useRef("");

  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const host = authenticatorMount.current;
    host?.replaceChildren(Authenticator(authApi, authenticatorOptions));

    // セッションから、アクセストークンを取得し直す
    async function refreshSession() {
      try {
        const result = await session.fetchSession();
        accessTokenRef.current = result.accessToken;
        if (isMounted) {
          setSignedIn(Boolean(result.accessToken));
          setError(null);
        }
      } catch {
        if (isMounted) {
          accessTokenRef.current = "";
          setSignedIn(false);
          setError("ログイン情報を取得できませんでした");
        }
      }
    }

    const unsubscribe = onAuthChange(
      authApi,
      async function handleAuthChange(user) {
        if (user) await refreshSession();
        else if (isMounted) {
          accessTokenRef.current = "";
          setSignedIn(false);
        }
      },
    );

    // サーバー側のセッションのトークンに追従するため、ログイン中は 5 分ごとに取得し直す
    const timer = setInterval(
      () => {
        if (accessTokenRef.current) void refreshSession();
      },
      5 * 60 * 1000,
    );
    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(timer);
      host?.replaceChildren();
    };
  }, []);

  return (
    <>
      {/* grid クラスが hidden 属性の display: none を上書きするため、style でも隠す */}
      <div
        hidden={signedIn}
        style={{ display: signedIn ? "none" : undefined }}
        className="quest-auth-shell grid min-h-screen place-items-center p-6 text-quest-card-ink"
        data-bb-theme="light"
      >
        <section className="w-full max-w-md rounded border border-quest-frame bg-quest-card p-6">
          <h1 className="mb-2 text-2xl font-semibold">クエストボード</h1>
          <p className="mb-5 text-sm">技術ニュースを、次の一手に変える。</p>
          {import.meta.env.PROD && (
            <p className="mb-4 text-sm">
              現在は招待された方のみご利用いただけます。
            </p>
          )}
          <div ref={authenticatorMount} />
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
      {signedIn && children(() => accessTokenRef.current)}
    </>
  );
}
