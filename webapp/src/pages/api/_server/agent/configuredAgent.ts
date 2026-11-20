import { createAgentCoreAgent, createLocalAgent } from "./agentcore";
import { agentRuntimeSetting } from "../../../../../aws-blocks/storage";

// 対話用 Runtime の ARN(SSM のパラメーター)。デプロイのときにしか変わらないので、
// Lambda の実行環境の中で 1 度だけ読む(失敗したら、次の呼び出しで読み直す)
let runtimeArnPromise: Promise<string> | undefined;

function loadRuntimeArn(): Promise<string> {
  if (runtimeArnPromise) return runtimeArnPromise;

  runtimeArnPromise = agentRuntimeSetting.get().catch((error: unknown) => {
    runtimeArnPromise = undefined;
    throw error;
  });
  return runtimeArnPromise;
}

// エージェントの接続先を選ぶ
//   1. 環境変数 AGENT_RUNTIME_ARN があれば、その AgentCore Runtime
//   2. 本番ビルド(AWS 上)では、SSM に保存された AgentCore Runtime
//   3. それ以外(ローカル開発)は、AGENT_URL の AG-UI サーバー(既定は aimock)
export async function createConfiguredAgent() {
  const arn =
    process.env.AGENT_RUNTIME_ARN ?? import.meta.env?.AGENT_RUNTIME_ARN;
  if (arn) {
    return createAgentCoreAgent(arn);
  }
  if (import.meta.env?.PROD) {
    const runtimeArn = await loadRuntimeArn();
    return createAgentCoreAgent(runtimeArn);
  }

  const localUrl =
    process.env.AGENT_URL ??
    import.meta.env?.AGENT_URL ??
    "http://localhost:4010/agui";
  return createLocalAgent(localUrl);
}
