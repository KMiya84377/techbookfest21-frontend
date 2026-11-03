import { createConfiguredAgent } from "../agent/configuredAgent";
import { userContext } from "../agent/userContext";
import type { LearningConnections, LearningEntry } from "../../lib/learning/model";
import { collectConnections } from "./collectConnections";

// 通常のチャットとは別のスレッドで、構造化した図解だけを受け取る。
export async function generateConnections(userId: string, history: LearningEntry[]): Promise<LearningConnections> {
  return userContext.run({ userId }, async () => collectConnections(await createConfiguredAgent(), history));
}
