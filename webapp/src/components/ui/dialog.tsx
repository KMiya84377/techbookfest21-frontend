import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "cn";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof DialogPrimitive.Backdrop>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Backdrop
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-[#120d09]/65 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
      "transition-opacity duration-200",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Popup> & {
  showClose?: boolean;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showClose = true, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Viewport className="fixed inset-0 z-50 pointer-events-none">
        <DialogPrimitive.Popup
          ref={ref}
          className={cn("pointer-events-auto outline-none", className)}
          {...props}
        >
          {children}
          {showClose && (
            <DialogPrimitive.Close
              type="button"
              aria-label="閉じる"
              className="absolute right-3 top-3 inline-flex size-7 items-center justify-center rounded-sm text-[var(--ink)] opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wax)]"
            >
              <XIcon className="size-4" />
              <span className="sr-only">閉じる</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  ),
);
DialogContent.displayName = "DialogContent";

const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
};
