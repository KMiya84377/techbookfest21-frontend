import { useCallback, useRef, useState, type RefObject } from "react";
import type { Quest } from "../lib/quests/model";
import {
  updateOpenedDetail,
  type DetailSection,
  type DetailUpdate,
} from "../lib/quests/detailSections";

// チャットの質問に応じて、詳細に追加された表示(クエストごと)。保存はしない
export function useDetailExtras(
  shownRef: RefObject<Quest[] | undefined>,
  openId: string | null,
) {
  const [detailExtras, setDetailExtras] = useState<
    Record<string, DetailSection[]>
  >({});
  const detailExtrasRef = useRef(detailExtras);
  const openIdRef = useRef(openId);
  openIdRef.current = openId;

  // 詳細を開いているクエストの詳細に、表示を追加・更新する(エージェントのツールから使う)
  const updateDetail = useCallback(
    (questId: string, section: DetailSection): DetailUpdate => {
      const { details, result } = updateOpenedDetail(
        detailExtrasRef.current, shownRef.current, openIdRef.current, questId, section,
      );
      if (!result.error) {
        detailExtrasRef.current = details;
        setDetailExtras(details);
      }
      return result;
    },
    [shownRef],
  );

  return { detailExtras, updateDetail };
}
