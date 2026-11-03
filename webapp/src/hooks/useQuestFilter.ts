import { useCallback, useRef, useState, type RefObject } from "react";
import type { Quest } from "../lib/quests/model";
import {
  EMPTY_FILTER,
  applyFilter,
  describeFilter,
  mergeFilter,
  type FilterChange,
  type FilterPatch,
  type QuestFilter,
} from "../lib/quests/filter";

// クエストボードの検索条件。詳細を閉じても、維持する(仕様書 F-03)
export function useQuestFilter(shownRef: RefObject<Quest[] | undefined>) {
  const [filter, setFilter] = useState<QuestFilter>(EMPTY_FILTER);
  const filterRef = useRef(filter);

  // 検索条件を変える(画面の操作と、エージェントのツールの、どちらからも使う)
  // 変更前後の条件と、表示される件数を返す
  const updateFilter = useCallback(
    (patch: FilterPatch): FilterChange => {
      const before = filterRef.current;
      const after = mergeFilter(before, patch);
      filterRef.current = after;
      setFilter(after);
      const all = shownRef.current ?? [];
      return {
        before: describeFilter(before),
        after: describeFilter(after),
        count: applyFilter(all, after).length,
        total: all.length,
      };
    },
    [shownRef],
  );

  return { filter, updateFilter };
}
