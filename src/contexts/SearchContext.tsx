import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";

export type SearchResult =
  | { type: "product"; id: string; title: string; subtitle: string; meta?: string }
  | { type: "sale"; id: string; title: string; subtitle: string; meta?: string }
  | { type: "customer"; id: string; title: string; subtitle: string; meta?: string }
  | { type: "supplier"; id: string; title: string; subtitle: string; meta?: string };

type SearchContextType = {
  query: string;
  setQuery: (q: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  results: SearchResult[];
  loading: boolean;
};

const SearchContext = createContext<SearchContextType | null>(null);

export const SearchProvider = ({ children }: { children: ReactNode }) => {
  const { currentShop } = useShop();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Cmd/Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!currentShop || !q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const term = `%${q.trim()}%`;
    const shopId = currentShop.id;

    try {
      const [productsRes, customersRes, salesRes, suppliersRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, sku, barcode, price, stock")
          .eq("shop_id", shopId)
          .or(`name.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`)
          .limit(6),
        supabase
          .from("customers")
          .select("id, name, phone, email")
          .eq("shop_id", shopId)
          .or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
          .limit(5),
        supabase
          .from("sales")
          .select("id, receipt_number, total, payment_method, created_at")
          .eq("shop_id", shopId)
          .ilike("receipt_number", term)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("suppliers")
          .select("id, name, phone")
          .eq("shop_id", shopId)
          .or(`name.ilike.${term},phone.ilike.${term}`)
          .limit(3),
      ]);

      const cur = currentShop.currency ?? "USD";
      const out: SearchResult[] = [
        ...((productsRes.data ?? []).map((p: any) => ({
          type: "product" as const,
          id: p.id,
          title: p.name,
          subtitle: [p.sku, p.barcode].filter(Boolean).join(" · ") || "Product",
          meta: `${cur} ${Number(p.price).toFixed(2)} · ${Number(p.stock)} in stock`,
        }))),
        ...((customersRes.data ?? []).map((c: any) => ({
          type: "customer" as const,
          id: c.id,
          title: c.name,
          subtitle: c.phone || c.email || "Customer",
        }))),
        ...((salesRes.data ?? []).map((s: any) => ({
          type: "sale" as const,
          id: s.id,
          title: s.receipt_number ?? "Receipt",
          subtitle: `${s.payment_method} · ${new Date(s.created_at).toLocaleDateString()}`,
          meta: `${cur} ${Number(s.total).toFixed(2)}`,
        }))),
        ...((suppliersRes.data ?? []).map((s: any) => ({
          type: "supplier" as const,
          id: s.id,
          title: s.name,
          subtitle: s.phone || "Supplier",
        }))),
      ];
      setResults(out);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentShop]);

  // debounce query → search
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runSearch(query), 220);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  return (
    <SearchContext.Provider value={{ query, setQuery, open, setOpen, results, loading }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useSearch must be used within SearchProvider");
  return ctx;
};
