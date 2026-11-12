import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Package, Users, Receipt, Truck, Loader2, X, FolderTree, Tag, CarFront, Droplet,
  ShoppingCart, Undo2, Wallet, BookOpen, HeartPulse, CornerDownLeft, type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearch, SearchResult } from "@/contexts/SearchContext";
import { useAppNav } from "@/hooks/useAppNav";
import { cn } from "@/lib/utils";
import { getById, getAll } from "@/lib/localDb";
import { useShop } from "@/contexts/ShopContext";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { GROUP_ORDER, matchPages, searchTarget, type SearchHit } from "@/lib/global-search";

type Variant = "desktop-bar" | "mobile-icon";

const ICONS: Record<SearchHit["type"], LucideIcon> = {
  page: CornerDownLeft,
  product: Package,
  category: FolderTree,
  brand: Tag,
  sale: Receipt,
  customer: Users,
  supplier: Truck,
  vehicle: CarFront,
  oil_change: Droplet,
  purchase: ShoppingCart,
  return: Undo2,
  expense: Wallet,
  ledger: BookOpen,
  patient: HeartPulse,
};

const GROUP_LABELS: Record<SearchHit["type"], string> = {
  page: "Pages",
  product: "Products",
  category: "Categories",
  brand: "Brands",
  sale: "Sales",
  customer: "Customers",
  supplier: "Suppliers",
  vehicle: "Vehicles",
  oil_change: "Oil changes",
  purchase: "Purchases",
  return: "Returns",
  expense: "Expenses",
  ledger: "Ledger",
  patient: "Patients",
};

export const GlobalSearch = ({ variant }: { variant: Variant }) => {
  const { query, setQuery, open, setOpen, results, loading } = useSearch();
  const navigate = useNavigate();
  const { currentShop } = useShop();
  const [openSale, setOpenSale] = useState<any>(null);
  const { pages } = useAppNav();
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Pages come from the sidebar the user can actually see, matched here —
  // instantly, without a round trip.
  const pageHits = useMemo(() => matchPages(pages, query), [pages, query]);

  // Grouped, in a fixed order, and flattened for the arrow keys.
  const groups = useMemo(() => {
    const all: SearchHit[] = [...pageHits, ...(results as SearchResult[])];
    return GROUP_ORDER
      .map((type) => ({ type, items: all.filter((r) => r.type === type) }))
      .filter((g) => g.items.length > 0);
  }, [pageHits, results]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  // Where each group starts in `flat`, so a row knows its own arrow-key index.
  const starts = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const g of groups) { out.push(n); n += g.items.length; }
    return out;
  }, [groups]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open, setQuery]);
  // Typing starts the highlight on the first hit again; a list that shrank
  // under it (results arriving) keeps it in range.
  const current = Math.min(active, Math.max(0, flat.length - 1));
  useEffect(() => {
    listRef.current?.querySelector(`[data-hit="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const handleSelect = async (r: SearchHit) => {
    setOpen(false);
    if (r.type === "sale" && currentShop) {
      // Sales + items + customers are synced locally, so read the receipt from
      // the offline store (works with no connection).
      const sale = await getById<any>("sales", r.id);
      if (sale) {
        const allItems = await getAll<any>("sale_items", currentShop.id);
        const items = allItems.filter((i) => i.sale_id === r.id);
        const customer = sale.customer_id
          ? (await getById<any>("suppliers", sale.customer_id)) ?? (await getById<any>("customers", sale.customer_id))
          : null;
        setOpenSale({ ...sale, items, customer, shop: currentShop });
        return;
      }
    }
    navigate(searchTarget(r));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || flat.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((current + 1) % flat.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((current - 1 + flat.length) % flat.length); }
    else if (e.key === "Enter") { e.preventDefault(); const hit = flat[current]; if (hit) void handleSelect(hit); }
  };

  const trigger = variant === "desktop-bar" ? (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-2 w-full max-w-xl h-10 px-4 rounded-lg border border-input bg-background/60 hover:bg-background hover:border-primary/40 transition-colors text-sm text-muted-foreground"
    >
      <Search className="size-4 shrink-0" />
      <span className="flex-1 text-left">Search products, sales, customers…</span>
      <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 h-5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  ) : (
    <button
      onClick={() => setOpen(true)}
      className="flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Search className="size-5" />
      <span className="text-[10px] font-medium">Search</span>
    </button>
  );

  return (
    <>
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-2xl gap-0 top-[10%] translate-y-0 overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b">
            <Search className="size-5 text-muted-foreground shrink-0 ml-1" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onKeyDown}
              placeholder="Search anything — products, bills, people, vehicles, pages…"
              className="border-0 focus-visible:ring-0 shadow-none text-base h-11 px-0"
            />
            {loading && <Loader2 className="size-4 text-muted-foreground animate-spin" />}
            {query && !loading && (
              <Button variant="ghost" size="icon" onClick={() => setQuery("")} className="size-8 shrink-0">
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {!query.trim() ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Search className="size-8 mx-auto mb-2 opacity-40" />
                Start typing to search across your shop
                <div className="text-xs mt-2 opacity-70">
                  Pages · Products · Sales · Customers · Suppliers · Ledger · Purchases · Returns · Expenses
                </div>
              </div>
            ) : flat.length === 0 && !loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No results for &quot;{query}&quot;
              </div>
            ) : (
              <div className="py-2">
                {groups.map(({ type, items }, gi) => {
                  const Icon = ICONS[type];
                  return (
                    <div key={type} className="mb-1">
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        {GROUP_LABELS[type]}
                      </div>
                      {items.map((r, k) => {
                        const i = starts[gi] + k;
                        return (
                          <button
                            key={`${r.type}-${r.id}`}
                            data-hit={i}
                            onClick={() => handleSelect(r)}
                            onMouseMove={() => setActive(i)}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                              i === current ? "bg-muted" : "hover:bg-muted/60",
                            )}
                          >
                            <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              <Icon className="size-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">{r.title}</div>
                              <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>
                            </div>
                            {r.meta && (
                              <div className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 hidden sm:block">
                                {r.meta}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
            <span>↑↓ move · ↵ open · esc close</span>
            <span>⌘K to open anywhere</span>
          </div>
        </DialogContent>
      </Dialog>

      {openSale && <ReceiptDialog sale={openSale} onClose={() => setOpenSale(null)} />}
    </>
  );
};
