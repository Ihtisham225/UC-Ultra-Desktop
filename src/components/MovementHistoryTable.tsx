import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { format } from "date-fns";

type MovementType =
  | "sale" | "sale_delete"
  | "purchase" | "purchase_delete"
  | "return" | "return_delete"
  | "supplier_return" | "supplier_return_delete"
  | "adjustment" | "initial";

interface Movement {
  id: string;
  created_at: string;
  product_id: string | null;
  variant_id: string | null;
  movement_type: MovementType;
  quantity: number;
  stock_after: number | null;
  reason: string | null;
  notes: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_by: string | null;
  product_name?: string;
  variant_name?: string;
  user_name?: string;
}

const TYPE_LABEL: Record<MovementType, string> = {
  sale: "Sale",
  sale_delete: "Sale deleted",
  purchase: "Purchase",
  purchase_delete: "Purchase deleted",
  return: "Customer return",
  return_delete: "Customer return deleted",
  supplier_return: "Return to supplier",
  supplier_return_delete: "Supplier return deleted",
  adjustment: "Adjustment",
  initial: "Initial",
};

const TYPE_VARIANT: Record<MovementType, "default" | "secondary" | "destructive" | "outline"> = {
  sale: "secondary",
  sale_delete: "outline",
  purchase: "default",
  purchase_delete: "outline",
  return: "default",
  return_delete: "outline",
  supplier_return: "secondary",
  supplier_return_delete: "outline",
  adjustment: "secondary",
  initial: "outline",
};

interface Props {
  productId?: string;
  variantId?: string;
  compact?: boolean;
}

export function MovementHistoryTable({ productId, variantId, compact }: Props) {
  const { currentShop } = useShop();
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!currentShop) return;
    const load = async () => {
      setLoading(true);
      let q = supabase.from("inventory_movements" as any)
        .select("*")
        .eq("shop_id", currentShop.id)
        .order("created_at", { ascending: false })
        .limit(500);
      if (productId) q = q.eq("product_id", productId);
      if (variantId) q = q.eq("variant_id", variantId);
      if (from) q = q.gte("created_at", new Date(from).toISOString());
      if (to) {
        const end = new Date(to); end.setHours(23, 59, 59, 999);
        q = q.lte("created_at", end.toISOString());
      }
      const { data, error } = await q;
      if (error) { setLoading(false); return; }
      const movements = (data as any as Movement[]) || [];

      // Resolve names
      const productIds = Array.from(new Set(movements.map(m => m.product_id).filter(Boolean))) as string[];
      const variantIds = Array.from(new Set(movements.map(m => m.variant_id).filter(Boolean))) as string[];
      const userIds = Array.from(new Set(movements.map(m => m.created_by).filter(Boolean))) as string[];

      const [{ data: prods }, { data: vars }, { data: profs }] = await Promise.all([
        productIds.length ? supabase.from("products").select("id,name").in("id", productIds) : Promise.resolve({ data: [] as any }),
        variantIds.length ? supabase.from("product_variants").select("id,name").in("id", variantIds) : Promise.resolve({ data: [] as any }),
        userIds.length ? supabase.from("profiles").select("user_id,display_name").in("user_id", userIds) : Promise.resolve({ data: [] as any }),
      ]);
      const pMap = new Map<string, string>((prods || []).map((p: any) => [p.id, p.name as string]));
      const vMap = new Map<string, string>((vars || []).map((v: any) => [v.id, v.name as string]));
      const uMap = new Map<string, string>((profs || []).map((u: any) => [u.user_id, (u.display_name as string) || ""]));

      setRows(movements.map(m => ({
        ...m,
        product_name: m.product_id ? pMap.get(m.product_id) : undefined,
        variant_name: m.variant_id ? vMap.get(m.variant_id) : undefined,
        user_name: m.created_by ? uMap.get(m.created_by) : undefined,
      })));
      setLoading(false);
    };
    load();
  }, [currentShop, productId, variantId, from, to]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (typeFilter !== "all" && r.movement_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${r.product_name || ""} ${r.variant_name || ""} ${r.notes || ""} ${r.reason || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter]);

  const exportCsv = () => {
    downloadCsv(`inventory-movements-${format(new Date(), "yyyy-MM-dd")}`, filtered, [
      { header: "Date", value: (r) => format(new Date(r.created_at), "yyyy-MM-dd HH:mm") },
      { header: "Product", value: (r) => r.product_name || "" },
      { header: "Variant", value: (r) => r.variant_name || "" },
      { header: "Type", value: (r) => TYPE_LABEL[r.movement_type] },
      { header: "Quantity", value: (r) => r.quantity },
      { header: "Stock After", value: (r) => r.stock_after ?? "" },
      { header: "Reason", value: (r) => r.reason || "" },
      { header: "Notes", value: (r) => r.notes || "" },
      { header: "User", value: (r) => r.user_name || "" },
    ]);
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="ps-9 h-9" placeholder="Search product, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(TYPE_LABEL) as MovementType[]).map(t => (
                <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[140px]" />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[140px]" />
          </label>
          <Button variant="outline" size="sm" onClick={exportCsv} className="h-9">
            <Download className="size-4 me-1" /> CSV
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {!productId && <TableHead>Product</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead className="text-end">Qty</TableHead>
              <TableHead className="text-end">Stock After</TableHead>
              <TableHead>Reason / Notes</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No movements yet.</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                {!productId && (
                  <TableCell>
                    <div className="font-medium text-sm">{r.product_name || "—"}</div>
                    {r.variant_name && <div className="text-xs text-muted-foreground">{r.variant_name}</div>}
                  </TableCell>
                )}
                <TableCell><Badge variant={TYPE_VARIANT[r.movement_type]}>{TYPE_LABEL[r.movement_type]}</Badge></TableCell>
                <TableCell className={`text-end font-semibold tabular-nums ${Number(r.quantity) >= 0 ? "text-success" : "text-destructive"}`}>
                  {Number(r.quantity) >= 0 ? "+" : ""}{r.quantity}
                </TableCell>
                <TableCell className="text-end tabular-nums">{r.stock_after ?? "—"}</TableCell>
                <TableCell className="text-xs max-w-[260px]">
                  {r.reason && <div className="font-medium capitalize">{r.reason}</div>}
                  {r.notes && <div className="text-muted-foreground truncate">{r.notes}</div>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.user_name || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
