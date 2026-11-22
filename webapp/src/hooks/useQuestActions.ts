import { useContext } from "react";
import { QuestActionsContext } from "../contexts/QuestActionsContext";

export function useQuestActions() {
  return useContext(QuestActionsContext);
}
