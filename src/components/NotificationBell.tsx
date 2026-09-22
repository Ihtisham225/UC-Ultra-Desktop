import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, FileCheck2, HandCoins, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markSeen, readSeen, type AppNotification } from "@/lib/notifications";

/** Loader is injected so the same bell works on web (action) and desktop (rpc). */
let loader: (() => Promise<AppNotification[]>) | null = null;
export function setNotificationsLoader(fn: () => Promise<AppNotification[]>) {
  loader = fn;
}

const ICON = { low_stock: PackageX, cheque: FileCheck2, debt_due: HandCoins } as const;
const TONE = {
  info: "text-primary",
  warning: "text-warning",
  critical: "text-destructive",
} as const;
const SECTION: Record<AppNotification["kind"], string> = {
  cheque: "Cheques",
  low_stock: "Low stock",
  debt_due: "Ledger due dates",
};

/**
 * The bell in the header: low stock, cheques falling due, khata due dates.
 * Refreshed on open, when the window regains focus, and every five minutes.
 * The badge counts what hasn't been looked at yet; opening the list marks it
 * seen (per browser — the items themselves stay until their cause is gone).
 */
export function NotificationBell({
  shopId, navigate,
}: {
  shopId: string | null | undefined;
  /** How to open a page — next/link on the web, the router on the terminal. */
  navigate: (href: string) => void;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!loader || !shopId) return;
    try { setItems(await loader()); } catch { /* offline — keep what we had */ }
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    setSeen(readSeen(shopId));
    void load();
    const timer = setInterval(() => void load(), 5 * 60_000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [shopId, load]);

  const unseen = items.filter((i) => !seen.has(i.id)).length;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load();
    else if (shopId) {
      // Closing the list is when it has been read.
      const ids = items.map((i) => i.id);
      markSeen(shopId, ids);
      setSeen(new Set(ids));
    }
  };

  const groups = useMemo(() => {
    const order: AppNotification["kind"][] = ["cheque", "low_stock", "debt_due"];
    return order
      .map((k) => ({ kind: k, rows: items.filter((i) => i.kind === k) }))
      .filter((g) => g.rows.length > 0);
  }, [items]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unseen ? ` (${unseen} new)` : ""}`} title="Notifications">
          <Bell className="size-5" />
          {unseen > 0 && (
            <span className="absolute -top-0.5 -end-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold leading-4 text-center">
              {unseen > 99 ? "99+" : unseen}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold text-sm">Notifications</span>
          <span className="text-xs text-muted-foreground">{items.length ? `${items.length} item${items.length === 1 ? "" : "s"}` : ""}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {groups.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>
          ) : (
            groups.map((g) => (
              <div key={g.kind}>
                <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {SECTION[g.kind]} ({g.rows.length})
                </div>
                {g.rows.map((n) => {
                  const Icon = n.severity === "critical" && n.kind !== "low_stock" ? AlertTriangle : ICON[n.kind];
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => { onOpenChange(false); navigate(n.href); }}
                      className={`w-full text-start px-4 py-2.5 flex gap-3 hover:bg-muted/60 ${seen.has(n.id) ? "" : "bg-primary/5"}`}
                    >
                      <Icon className={`size-4 mt-0.5 shrink-0 ${TONE[n.severity]}`} />
                      <span className="min-w-0">
                        <span className="block text-sm leading-snug">{n.title}</span>
                        {n.detail && <span className="block text-xs text-muted-foreground mt-0.5">{n.detail}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
