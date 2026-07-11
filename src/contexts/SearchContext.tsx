import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { rpc } from "@/lib/apiClient";
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
    try {
      const out = await rpc<SearchResult[]>("globalSearchAction", q.trim());
      setResults(out ?? []);
    } catch {
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
