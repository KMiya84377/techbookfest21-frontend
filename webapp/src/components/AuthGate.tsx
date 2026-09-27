import { useEffect, useRef, useState, type ReactNode } from "react";
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { outputs } from "../lib/outputs";

if (outputs) Amplify.configure(outputs as Parameters<typeof Amplify.configure>[0]);

// アクセストークンの更新間隔(ミリ秒)
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

type Children = (getToken: () => string) => ReactNode;

function Session({ children }: { children: Children }) {
  const token = useRef("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const session = await fetchAuthSession();
      token.current = session.tokens?.accessToken?.toString() ?? "";
      if (active) setReady(true);
    };
    refresh();
    const id = setInterval(refresh, TOKEN_REFRESH_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // トークンを取得するまで、ランタイムに接続しない
  if (!ready) return null;
  return <>{children(() => token.current)}</>;
}

// ログインした人にだけ、子(トークンの取得関数を受け取る)を表示する
export default function AuthGate({ children }: { children: Children }) {
  if (!outputs) {
    return (
      <p style={{ padding: 24 }}>
        amplify_outputs.json がありません。npx ampx sandbox などで生成するか、認証なしで動かす場合は
        npm run dev:mock を使ってください。
      </p>
    );
  }
  return (
    <Authenticator>
      {() => <Session>{children}</Session>}
    </Authenticator>
  );
}
