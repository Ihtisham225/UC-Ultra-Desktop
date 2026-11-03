import { useEffect, useMemo, useState } from "react";
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

/** Today's notifications per shop, so the books are asked at most once a day. */
const DAILY_KEY = "ucu.notifications.daily";
interface DailyCache { date: string; items: AppNotification[] }

/** The browser's local calendar day — the day the shop is working in. */
function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readDaily(shopId: string): DailyCache | null {
  try {
    const raw = localStorage.getItem(`${DAILY_KEY}.${shopId}`);
    const parsed = raw ? (JSON.parse(raw) as DailyCache) : null;
    return parsed && typeof parsed.date === "string" && Array.isArray(parsed.items) ? parsed : null;
  } catch {
    return null;
  }
}

function writeDaily(shopId: string, cache: DailyCache) {
  try {
    localStorage.setItem(`${DAILY_KEY}.${shopId}`, JSON.stringify(cache));
  } catch {
    /* private window — we'll just ask again next time the app opens */
  }
}

/**
 * The bell in the header: low stock, cheques falling due, khata due dates.
 *
 * Refreshed ONCE A DAY per shop — the first time the app is opened each
 * morning — and cached in localStorage with the day it was fetched. It used
 * to poll every five minutes and on every focus and open, which kept the Neon
 * database from ever suspending (it sleeps after 5 idle minutes) and so raised
 * the bill. None of these items is urgent: yesterday's low stock or cheques
 * can stand until the next morning. A window left open overnight checks again
 * when it is next focused or shown on a new day — never on a timer.
 *
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

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    // The day a fetch was last started for, so a focus during it doesn't start another.
    let askedFor: string | null = null;

    // localStorage is read here, after mount, never in a useState initializer
    // (the server render can't see it, and the mismatch breaks hydration).
    const check = async () => {
      const day = localDay();
      const cached = readDaily(shopId);
      if (!cancelled) {
        // Yesterday's list stays on show until today's arrives (or if we're offline).
        setItems(cached?.items ?? []);
        setSeen(readSeen(shopId));
      }
      if (cached?.date === day || askedFor === day || !loader) return;
      askedFor = day;
      try {
        const fresh = await loader();
        writeDaily(shopId, { date: day, items: fresh });
        if (!cancelled) setItems(fresh);
      } catch {
        askedFor = null; // offline — try again the next time the window comes back
      }
    };

    // Deferred a tick so the effect itself sets no state synchronously.
    const first = setTimeout(() => void check(), 0);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(first);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [shopId]);

  const unseen = items.filter((i) => !seen.has(i.id)).length;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && shopId) {
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
