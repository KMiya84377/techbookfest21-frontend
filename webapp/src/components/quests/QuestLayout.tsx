import type { ReactNode } from "react";

// 画面全体の枠。左にクエストボード、右にチャット(スマホでは縦に並べる)
export default function QuestLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tavern-app grid h-[100dvh] min-w-0 grid-cols-[minmax(0,1fr)_360px] gap-[14px] p-[14px] min-[1600px]:grid-cols-[minmax(0,1fr)_400px] max-[900px]:h-auto max-[900px]:min-h-[100dvh] max-[900px]:grid-cols-1 max-[900px]:gap-3 max-[900px]:p-2 max-[520px]:p-[5px]">
      {children}
    </div>
  );
}
