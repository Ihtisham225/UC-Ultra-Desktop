import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PosShortcutsGuide } from "@/components/PosShortcutsGuide";
import { AppShortcutsGuide } from "./AppShortcutsGuide";

/** Ctrl/Cmd+/ — every shortcut, with the till's own when you're on it. */
export function ShortcutsSheet({
  open, onOpenChange, onPos, platform,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPos: boolean;
  platform: "web" | "desktop";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-enter-chain="off" data-app-popup="" className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Also under Settings → Shortcuts.</DialogDescription>
        </DialogHeader>
        {onPos && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Point of sale</h2>
            <PosShortcutsGuide platform={platform} />
          </div>
        )}
        <div className="space-y-2">
          {onPos && <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground pt-2">Everywhere else</h2>}
          <AppShortcutsGuide />
        </div>
      </DialogContent>
    </Dialog>
  );
}
