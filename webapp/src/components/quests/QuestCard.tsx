import { clsx } from "cn";
import { RANK, type Quest } from "../../lib/quests/model";
import { Button } from "../ui/button";
import InkStamp from "./InkStamp";
import QuestCardContent from "./QuestCardContent";
import QuestCardPaper from "./QuestCardPaper";
import { getQuestPaperStyle, questCardClasses } from "./questCardStyles";

interface Props {
  quest: Quest;
  windEnabled: boolean;
  onOpen: (id: string) => void;
}

export default function QuestCard({ quest, windEnabled, onOpen }: Props) {
  return (
    <Button
      variant="unstyled"
      type="button"
      className={clsx(
        questCardClasses.button,
        "quest",
        `status-${quest.status}`,
        `importance-${quest.importance}`,
      )}
      style={getQuestPaperStyle(quest.id)}
      onClick={() => onOpen(quest.id)}
    >
      <QuestCardPaper windEnabled={windEnabled}>
        <QuestCardContent quest={quest} />
        <InkStamp
          rank={RANK[quest.importance]}
          cleared={quest.status === "cleared"}
        />
      </QuestCardPaper>
    </Button>
  );
}
