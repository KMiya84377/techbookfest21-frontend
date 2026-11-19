import { useMemo } from "react";
import { OpenGenerativeUIActivityRenderer } from "@copilotkit/react-core/v2";
import {
  LEARNING_UI_ACTIVITY,
  restrictedLearningUIContent,
  type LearningUI,
} from "../../lib/learning/openGenerativeUI";

export default function LearningUIRenderer({ ui }: { ui: LearningUI }) {
  const content = useMemo(() => restrictedLearningUIContent(ui), [ui]);
  return (
    <OpenGenerativeUIActivityRenderer
      activityType={LEARNING_UI_ACTIVITY}
      content={content}
      message={{
        id: ui.messageId,
        role: "activity",
        activityType: LEARNING_UI_ACTIVITY,
        content,
      }}
      agent={undefined}
    />
  );
}
