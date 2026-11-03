import { useEffect, useRef, useState, type ReactNode } from "react";
import { Authenticator, onAuthChange } from "@aws-blocks/blocks/ui";
import { authApi, session } from "../../../aws-blocks/authClient";

type Children = (getToken: () => string) => ReactNode;

// ログインするまで、Blocks のログイン画面を出す。ログイン後は、アクセストークンを返す関数を子へ渡す
export default function AuthGate({ children }: { children: Children }) {
  // Blocks の Authenticator(React ではない DOM 部品)を差し込む場所
  const mount = useRef<HTMLDivElement>(null);
  // 描画し直さずに最新のトークンを渡すため、state ではなく参照で持つ
  const token = useRef("");
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const host = mount.current;
    host?.replaceChildren(
      Authenticator(authApi, {
        // 公開環境は招待制。自己登録の禁止自体はCognito側でも強制する。
        hideActions: import.meta.env.PROD ? ["signUp"] : [],
        headings: {
          signedOut: "クエストボードにログイン",
          signingUp: "ユーザー登録",
        },
        actions: {
          signIn: {
            submitLabel: "ログイン",
            fields: {
              username: { label: "メールアドレス" },
              password: { label: "パスワード" },
            },
          },
          signUp: {
            submitLabel: "ユーザー登録",
            fields: {
              username: { label: "メールアドレス" },
              password: { label: "パスワード" },
            },
          },
          resetPassword: { submitLabel: "パスワードを忘れた場合" },
          confirmSignUp: {
            submitLabel: "登録を確認",
            fields: { code: { label: "確認コード" } },
          },
          resendSignUpCode: { submitLabel: "確認コードを再送信" },
        },
      }),
    );
    // セッションから、アクセストークンを取得し直す
    const refresh = async () => {
      try {
        const result = await session.fetchSession();
        token.current = result.accessToken;
        if (active) {
          setSignedIn(Boolean(result.accessToken));
          setError(null);
        }
      } catch {
        if (active) {
          token.current = "";
          setSignedIn(false);
          setError("ログイン情報を取得できませんでした");
        }
      }
    };
    const unsubscribe = onAuthChange(authApi, async (user) => {
      if (user) await refresh();
      else if (active) {
        token.current = "";
        setSignedIn(false);
      }
    });
    // サーバー側のセッションのトークンに追従するため、ログイン中は 5 分ごとに取得し直す
    const timer = setInterval(
      () => {
        if (token.current) void refresh();
      },
      5 * 60 * 1000,
    );
    return () => {
      active = false;
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
        className="quest-auth-shell grid min-h-screen place-items-center p-6 text-[#302b22]"
        data-bb-theme="light"
      >
        <section className="w-full max-w-md rounded border border-[#b99a67] bg-[#fffaf0] p-6">
          <h1 className="mb-2 text-2xl font-semibold">クエストボード</h1>
          <p className="mb-5 text-sm">技術ニュースを、次の一手に変える。</p>
          {import.meta.env.PROD && (
            <p className="mb-4 text-sm">現在は招待された方のみご利用いただけます。</p>
          )}
          <div ref={mount} />
          {error && <p role="alert">{error}</p>}
        </section>
      </div>
      {signedIn && children(() => token.current)}
    </>
  );
}
