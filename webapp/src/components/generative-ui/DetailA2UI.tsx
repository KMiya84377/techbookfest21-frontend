import { useEffect } from "react";
import { A2UIProvider, A2UIRenderer, useA2UI, useA2UIError } from "@copilotkit/a2ui-renderer";
import type { DetailSection } from "../../lib/quests/detailSections";

function Content({ section }: { section: DetailSection }) {
  const { processMessages, clearSurfaces } = useA2UI();
  const error = useA2UIError();
  useEffect(() => {
    clearSurfaces();
    processMessages(section.messages);
  }, [processMessages, clearSurfaces, section.messages]);
  if (error) return <p role="alert">追記のUIを表示できませんでした。</p>;
  return <A2UIRenderer surfaceId={section.id} fallback={<p role="status">UIを準備しています…</p>} />;
}

// チャットと詳細に同じA2UIを描画する。表示ごとにProviderを分け、surfaceIdの衝突を防ぐ。
export default function DetailA2UI({ section }: { section: DetailSection }) {
  return <A2UIProvider><Content section={section} /></A2UIProvider>;
}
