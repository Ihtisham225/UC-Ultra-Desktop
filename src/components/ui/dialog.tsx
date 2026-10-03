import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDialogFormKeys } from "@/components/ui/use-dialog-form-keys";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;


/**
 * Dialogs one and two sizes wider on big screens (xl 1280px+, 2xl 1536px+).
 * Every dialog picks a width that suits a laptop; on a shop's 24" monitor the
 * same box looked lost and squeezed its tables (the Cash history cut its
 * Balance column off). Steps up from whatever width the caller chose, so a
 * small confirm stays smaller than a wide report.
 *
 * ⚠️ The classes are written out in full on purpose — Tailwind only generates
 * class names it can find literally in the source.
 * ⚠️ Shared verbatim with the desktop app's `components/ui/dialog.tsx`.
 */
const GROW: Record<string, string> = {
  sm: "xl:max-w-md 2xl:max-w-lg",
  md: "xl:max-w-lg 2xl:max-w-xl",
  lg: "xl:max-w-xl 2xl:max-w-2xl",
  xl: "xl:max-w-2xl 2xl:max-w-3xl",
  "2xl": "xl:max-w-3xl 2xl:max-w-4xl",
  "3xl": "xl:max-w-4xl 2xl:max-w-5xl",
  "4xl": "xl:max-w-5xl 2xl:max-w-6xl",
  "5xl": "xl:max-w-6xl 2xl:max-w-7xl",
  "6xl": "xl:max-w-7xl 2xl:max-w-[90rem]",
};

export function growOnLargeScreens(className: string | undefined, fallback: keyof typeof GROW): string {
  // The width the caller asked for: the last plain or sm: max-w-<size> (an
  // arbitrary or "none"/"full" width is left exactly as it is).
  const picked = [...(className ?? "").matchAll(/(?:^|\s)(?:sm:)?max-w-([a-z0-9]+)(?=\s|$)/g)].map((m) => m[1]);
  if (/(?:^|\s)(?:sm:)?max-w-(?:none|full|\[)/.test(className ?? "")) return "";
  // A caller that already sizes for big screens itself keeps its own choice.
  if (/(?:^|\s)(?:xl|2xl):max-w-/.test(className ?? "")) return "";
  return GROW[picked.length ? picked[picked.length - 1] : fallback] ?? "";
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onKeyDown, ...props }, ref) => {
  // Enter moves through the form and saves at the end — every dialog gets it.
  const { setContent, onKeyDown: formKeysDown } = useDialogFormKeys(ref);
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={setContent}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        formKeysDown(e);
      }}
      className={cn(
        "fixed z-50 grid gap-4 border bg-background shadow-lg duration-200 overflow-y-auto overscroll-contain",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        // Mobile (default): full-screen sheet that slides up
        "inset-x-0 bottom-0 top-0 w-full max-w-none rounded-none p-4",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        // Desktop (sm+): centered modal — reset mobile insets, then center via left/top + transform
        "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
        // Default desktop width. Callers override with `sm:max-w-*` (same
        // variant, so tailwind-merge lets theirs win — an unprefixed
        // `max-w-*` would lose to this responsive class in the cascade).
        "sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:rounded-lg sm:p-6 md:p-8 sm:max-h-[calc(100dvh-2rem)]",
        "sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%]",
        "sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
        className,
        growOnLargeScreens(className, "2xl"),
      )}
      style={{ paddingTop: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute z-20 right-3 sm:right-4 sm:top-4 rounded-sm bg-background/80 p-1 opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        style={{ top: "max(0.75rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-dialog-footer="" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
