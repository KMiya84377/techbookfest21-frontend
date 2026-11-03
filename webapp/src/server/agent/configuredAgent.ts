import { createAgentCoreAgent, createLocalAgent } from "./agentcore";
import { agentRuntimeSetting } from "../../../aws-blocks/storage";
export async function createConfiguredAgent() {
  const arn = process.env.AGENT_RUNTIME_ARN ?? import.meta.env?.AGENT_RUNTIME_ARN;
  if (arn) return createAgentCoreAgent(arn);
  if (import.meta.env?.PROD) return createAgentCoreAgent(await agentRuntimeSetting.get());
  return createLocalAgent(process.env.AGENT_URL ?? import.meta.env?.AGENT_URL ?? "http://localhost:4010/agui");
}
