import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

const alertVariants = cva(
  "relative w-full rounded-sm border px-3.5 py-3 text-sm leading-relaxed",
  {
    variants: {
      variant: {
        default: "border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]",
        destructive:
          "border-quest-error-line bg-quest-error-bg text-destructive",
        quest:
          "border border-l-4 border-[var(--line)] border-l-[var(--wax)] bg-quest-card text-[var(--ink)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-medium", className)} {...props} />;
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("text-[13px]", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
