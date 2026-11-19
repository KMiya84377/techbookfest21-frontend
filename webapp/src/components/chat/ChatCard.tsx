import type { ComponentProps } from "react";
import { cn } from "cn";

// チャットの中に出す、カードの外枠(理解度チェック、選択肢など)
//   loading: 引数が届ききるまでの「作成しています…」の表示(文字を薄くする)
type Props = ComponentProps<"div"> & {
  as?: "div" | "section";
  loading?: boolean;
};

export default function ChatCard({
  as: Tag = "div",
  loading = false,
  className,
  ...props
}: Props) {
  return (
    <Tag
      className={cn(
        "my-2 rounded-xl border border-quest-card-line bg-quest-card p-3.5 text-sm leading-relaxed",
        loading ? "text-quest-card-muted" : "text-quest-card-ink",
        className,
      )}
      {...props}
    />
  );
}
