import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Command } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * The shell the Go to and Add new popups share: a keyboard list in a dialog
 * pinned near the top, styled like global search so the three read as one family.
 *
 * Its children only exist while the popup is open (Radix unmounts closed
 * content), so state kept in them — what was typed — starts fresh every time.
 */
export function CommandPopup({
  open, onOpenChange, title, description, children, footer, onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  onCloseAutoFocus?: (e: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-enter-chain="off"
        data-app-popup=""
        onCloseAutoFocus={onCloseAutoFocus}
        className="p-0 sm:p-0 md:p-0 gap-0 overflow-hidden sm:max-w-xl sm:top-[12%] sm:translate-y-0 sm:data-[state=open]:slide-in-from-top-[10%] sm:data-[state=closed]:slide-out-to-top-[10%]"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
        <div className="hidden sm:flex items-center justify-between gap-3 px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The list inside a CommandPopup. */
export const PopupCommand = (props: ComponentPropsWithoutRef<typeof Command>) => (
  <Command
    loop
    {...props}
    className="rounded-none bg-background [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:font-bold [&_[cmdk-input]]:h-12 [&_[cmdk-input]]:text-base [&_[cmdk-input-wrapper]]:pe-10 [&_[cmdk-item][data-selected=true]]:bg-primary/10 [&_[cmdk-item][data-selected=true]]:text-foreground"
  />
);

export const Kbd = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <kbd className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded border bg-muted font-mono text-[10px] font-medium text-muted-foreground ${className}`}>
    {children}
  </kbd>
);
