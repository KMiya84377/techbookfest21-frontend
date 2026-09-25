import { useEffect, useRef, useState } from "react";
import { Amplify } from "aws-amplify";
import { fetchAuthSession } from "aws-amplify/auth";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { CopilotKitProvider, CopilotPopup } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import outputs from "../../amplify_outputs.json";

Amplify.configure(outputs);

const RUNTIME_URL = "/api/copilotkit";
// アクセストークンの更新間隔(ミリ秒)
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

function Assistant() {
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

  return (
    <CopilotKitProvider
      runtimeUrl={RUNTIME_URL}
      headers={() => ({ Authorization: `Bearer ${token.current}` })}
    >
      <CopilotPopup
        labels={{ modalHeaderTitle: "AI Assistant", welcomeMessageText: "こんにちは!" }}
      />
    </CopilotKitProvider>
  );
}

export default function AiAssistant() {
  return <Authenticator>{() => <Assistant />}</Authenticator>;
}
