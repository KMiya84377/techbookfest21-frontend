import { createConfiguredAgent } from "../agent/configuredAgent";
import { userContext } from "../agent/userContext";
import type {
  LearningConnections,
  LearningEntry,
} from "../../../../lib/learning/model";
import { collectConnections } from "./collectConnections";
import { collectLearningUI } from "./collectUI";
import type { LearningUI } from "../../../../lib/learning/openGenerativeUI";
import designSkill from "../../../../lib/generative-ui/design-skill.md?raw";

export interface GeneratedLearningDiagram {
  diagram: LearningConnections;
  ui?: LearningUI;
}

// 通常のチャットとは別のスレッドで、構造化した図解だけを受け取る。
export async function generateConnections(
  userId: string,
  history: LearningEntry[],
): Promise<GeneratedLearningDiagram> {
  return userContext.run({ userId }, async () => {
    const diagram = await collectConnections(
      await createConfiguredAgent(),
      history,
    );
    if (!diagram.hasConnections) return { diagram };
    const ui = await collectLearningUI(
      await createConfiguredAgent(),
      diagram,
      history,
      designSkill.trim(),
    );
    return { diagram, ui };
  });
}
