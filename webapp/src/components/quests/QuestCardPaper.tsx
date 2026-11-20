import type { ReactNode } from "react";
import { clsx } from "cn";
import { questCardClasses } from "./questCardStyles";

interface Props {
  windEnabled: boolean;
  children: ReactNode;
}

// ピン、紙の折り目、右下のめくれを表示する。
export default function QuestCardPaper({ windEnabled, children }: Props) {
  return (
    <>
      <span className={questCardClasses.pin} aria-hidden="true" />
      <span
        className={clsx(questCardClasses.sheet, !windEnabled && "animate-none")}
      >
        <span className={questCardClasses.paper}>
          <span className={questCardClasses.fold} aria-hidden="true" />
          {children}
        </span>
        <span className={questCardClasses.turnedCorner} aria-hidden="true" />
      </span>
    </>
  );
}
