import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-sm",
    "border px-1.5 py-0.5 text-[10px] font-medium leading-none tracking-[0.04em]",
  ],
  {
    variants: {
      variant: {
        default: "border-[var(--line)] bg-[var(--paper-2)] text-[var(--ink)]",
        outline: "border-current bg-transparent text-current",
        news: "border-quest-badge-news/45 bg-quest-badge-news/10 text-quest-badge-news",
        ai: "border-[var(--wax)]/45 bg-[var(--wax)]/10 text-[var(--wax)]",
        chat: "border-quest-badge-chat/45 bg-quest-badge-chat/10 text-quest-badge-chat",
        condition:
          "border-[var(--line)]/55 bg-[var(--paper)] text-[var(--ink)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
