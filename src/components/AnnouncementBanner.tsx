import { useEffect, useState } from "react";
import { rpc } from "@/lib/apiClient";
import type { ShopAnnouncementDto } from "@/lib/adminTypes";
import { Button } from "@/components/ui/button";
import { X, Megaphone, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Platform notices, shown at the top of the app.
 *
 * ⚠️ Loaded after mount, never during render: this sits in the shell on every
 * page, and the notices a person has dismissed are per-user state that the
 * server and the client cannot agree on at first paint.
 *
 * Only ONE is shown at a time — the newest. A stack of banners pushes the
 * till off the screen, and the shop is here to sell, not to read.
 */
export function AnnouncementBanner() {
  const [items, setItems] = useState<ShopAnnouncementDto[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Offline the terminal simply shows nothing — a notice is not worth a
    // failed request every time the shell mounts.
    if (!navigator.onLine) return;
    rpc<ShopAnnouncementDto[]>("listMyAnnouncementsAction").then(setItems).catch(() => {});
  }, []);

  const current = items[0];
  if (!current) return null;

  const dismiss = async () => {
    setBusy(true);
    // Dropped from the list first so it disappears at once; the write is
    // idempotent, so a failure here simply means it returns on the next load.
    setItems((xs) => xs.slice(1));
    try { await rpc("dismissAnnouncementAction", current.id); } catch { /* it will come back */ }
    setBusy(false);
  };

  const Icon = current.severity === "critical" || current.severity === "warning"
    ? AlertTriangle
    : current.severity === "notice" ? Megaphone : Info;

  return (
    <div
      className={cn(
        "border-b px-4 py-2.5 text-sm",
        current.severity === "critical" && "bg-destructive/10 border-destructive/30 text-destructive",
        current.severity === "warning" && "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
        current.severity === "notice" && "bg-primary/10 border-primary/30 text-primary",
        current.severity === "info" && "bg-muted border-border text-foreground",
      )}
      role="status"
    >
      <div className="flex items-start gap-2.5 max-w-5xl mx-auto">
        <Icon className="size-4 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{current.title}</div>
          <div className="opacity-90 whitespace-pre-wrap">{current.body}</div>
          {items.length > 1 && (
            <div className="text-xs opacity-70 mt-1">
              {items.length - 1} more notice{items.length - 1 === 1 ? "" : "s"}
            </div>
          )}
        </div>
        {current.dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 hover:bg-black/5 dark:hover:bg-white/10"
            onClick={dismiss}
            disabled={busy}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
