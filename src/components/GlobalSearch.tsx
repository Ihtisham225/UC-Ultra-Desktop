import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Package, Users, Receipt, Truck, Loader2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearch, SearchResult } from "@/contexts/SearchContext";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { cn } from "@/lib/utils";

type Variant = "desktop-bar" | "mobile-icon";

const iconFor = (type: SearchResult["type"]) => {
  switch (type) {
    case "product": return Package;
    case "sale": return Receipt;
    case "customer": return Users;
    case "supplier": return Truck;
  }
};

const labelFor = (type: SearchResult["type"]) => ({
  product: "Product",
  sale: "Sale",
  customer: "Customer",
  supplier: "Supplier",
}[type]);

export const GlobalSearch = ({ variant }: { variant: Variant }) => {
  const { query, setQuery, open, setOpen, results, loading } = useSearch();
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const [openSale, setOpenSale] = useState<any>(null);

  // Group results by type for nicer display
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ||= []).push(r);
    return acc;
  }, {});

  // close on route change
  useEffect(() => {
    if (!open) setQuery("");
  }, [open, setQuery]);

  const handleSelect = async (r: SearchResult) => {
    setOpen(false);
    if (r.type === "product") navigate(`/products?q=${encodeURIComponent(r.title)}`);
    else if (r.type === "customer") navigate(`/customers?q=${encodeURIComponent(r.title)}`);
    else if (r.type === "supplier") navigate(`/purchases?supplier=${r.id}`);
    else if (r.type === "sale" && currentShop) {
      const { data } = await supabase
        .from("sales")
        .select("*, sale_items(*), customers(name, phone)")
        .eq("id", r.id)
        .maybeSingle();
      if (data) {
        setOpenSale({
          ...data,
          items: (data as any).sale_items,
          customer: (data as any).customers,
          shop: currentShop,
        });
      }
    }
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
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, sales, customers, suppliers…"
              className="border-0 focus-visible:ring-0 shadow-none text-base h-11 px-0"
            />
            {loading && <Loader2 className="size-4 text-muted-foreground animate-spin" />}
            {query && !loading && (
              <Button variant="ghost" size="icon" onClick={() => setQuery("")} className="size-8 shrink-0">
                <X className="size-4" />
              </Button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {!query.trim() ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                <Search className="size-8 mx-auto mb-2 opacity-40" />
                Start typing to search across your shop
                <div className="text-xs mt-2 opacity-70">Products · Sales · Customers · Suppliers</div>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No results for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {(["product", "customer", "sale", "supplier"] as const).map((type) => {
                  const items = grouped[type];
                  if (!items?.length) return null;
                  const Icon = iconFor(type);
                  return (
                    <div key={type} className="mb-1">
                      <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                        {labelFor(type)}s
                      </div>
                      {items.map((r) => (
                        <button
                          key={`${r.type}-${r.id}`}
                          onClick={() => handleSelect(r)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60 active:bg-muted transition-colors"
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
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground">
            <span>↵ open · esc close</span>
            <span>⌘K to open anywhere</span>
          </div>
        </DialogContent>
      </Dialog>

      {openSale && <ReceiptDialog sale={openSale} onClose={() => setOpenSale(null)} />}
    </>
  );
};
