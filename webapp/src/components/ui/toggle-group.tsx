import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "cn";

const ToggleGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof ToggleGroupPrimitive>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive
    ref={ref}
    className={cn("flex items-center gap-1", className)}
    {...props}
  />
));
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof TogglePrimitive>
>(({ className, ...props }, ref) => (
  <TogglePrimitive
    ref={ref}
    className={cn(
      "inline-flex h-7 items-center justify-center rounded-[min(var(--radius-md),12px)] border border-transparent px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-[var(--ink)] outline-none transition-all focus-visible:border-[var(--wax)] focus-visible:ring-3 focus-visible:ring-[var(--wax)]/35 disabled:pointer-events-none disabled:opacity-50 data-[pressed=true]:border-[var(--wax)] data-[pressed=true]:bg-[var(--paper)] data-[pressed=true]:shadow-[1px_2px_4px_var(--shadow)] hover:bg-[var(--paper-2)]",
      className,
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
