import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, Search } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface PurchaseItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseId: string | null;
  onDone?: () => void;
}

export const SupplierReturnDialog = ({ open, onClose, purchaseId, onDone }: Props) => {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const visibleItems = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.product_name.toLowerCase().includes(s));
  }, [items, search]);

  const cur = currentShop?.currency ?? "USD";

  useEffect(() => {
    if (!open || !purchaseId) return;
    (async () => {
      setLoading(true);
      setQtyMap({}); setReason(""); setNotes(""); setRefundMethod("cash");
      try {
        const ctx = await rpc<{
          reference_number: string | null;
          supplier_id: string | null;
          supplier_name: string | null;
          items: PurchaseItem[];
          alreadyReturned: Record<string, number>;
        } | null>("getSupplierReturnContextAction", purchaseId);
        setItems(ctx?.items ?? []);
        setReference(ctx?.reference_number ?? null);
        setSupplierId(ctx?.supplier_id ?? null);
        setSupplierName(ctx?.supplier_name ?? null);
        setAlreadyReturned(ctx?.alreadyReturned ?? {});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, purchaseId]);

  const totalRefund = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.unit_cost) * (qtyMap[i.id] ?? 0), 0),
    [items, qtyMap]
  );

  const setQty = (itemId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setQtyMap((m) => ({ ...m, [itemId]: clamped }));
  };

  const submit = async () => {
    if (!user || !currentShop || !purchaseId) return;
    const lines = items
      .map((i) => ({ item: i, qty: qtyMap[i.id] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) return toast.error("Pick at least one item to return");

    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("createSupplierReturnAction", {
        purchaseId,
        supplierId,
        refundMethod,
        reason: reason || null,
        notes: notes || null,
        lines: lines.map((l) => ({
          purchase_item_id: l.item.id,
          product_id: l.item.product_id,
          variant_id: l.item.variant_id,
          product_name: l.item.product_name,
          quantity: l.qty,
          unit_cost: l.item.unit_cost,
        })),
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(`Returned ${formatMoney(totalRefund, cur)} to supplier — stock reduced`);
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-primary" /> Return to supplier
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {supplierName ?? "—"}{reference ? ` · ${reference}` : ""}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading purchase items…</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="ps-9 h-9"
                placeholder="Search items in this purchase…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2.5">Item</th>
                    <th className="text-center p-2.5 w-20">Bought</th>
                    <th className="text-center p-2.5 w-20">Done</th>
                    <th className="text-center p-2.5 w-28">Return</th>
                    <th className="text-right p-2.5 w-24">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-center text-xs text-muted-foreground">No items match "{search}"</td></tr>
                  )}
                  {visibleItems.map((i) => {
                    const done = alreadyReturned[i.id] ?? 0;
                    const remaining = Number(i.quantity) - done;
                    const qty = qtyMap[i.id] ?? 0;
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="p-2.5">
                          <div className="font-medium">{i.product_name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(i.unit_cost, cur)} ea</div>
                        </td>
                        <td className="p-2.5 text-center tabular-nums">{Number(i.quantity)}</td>
                        <td className="p-2.5 text-center tabular-nums text-muted-foreground">{done || "—"}</td>
                        <td className="p-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button type="button" variant="outline" size="icon" className="size-7" disabled={remaining === 0} onClick={() => setQty(i.id, qty - 1, remaining)}>−</Button>
                            <Input
                              className="h-7 w-12 text-center px-1"
                              value={qty}
                              disabled={remaining === 0}
                              onChange={(e) => setQty(i.id, parseFloat(e.target.value), remaining)}
                            />
                            <Button type="button" variant="outline" size="icon" className="size-7" disabled={remaining === 0 || qty >= remaining} onClick={() => setQty(i.id, qty + 1, remaining)}>+</Button>
                          </div>
                          {remaining === 0 && <div className="text-[10px] text-muted-foreground text-center mt-0.5">fully returned</div>}
                        </td>
                        <td className="p-2.5 text-right tabular-nums font-medium">
                          {qty > 0 ? formatMoney(Number(i.unit_cost) * qty, cur) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Refund method</Label>
                <Select value={refundMethod} onValueChange={(v: any) => setRefundMethod(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash refund</SelectItem>
                    <SelectItem value="card">Card refund</SelectItem>
                    <SelectItem value="mobile">Mobile transfer</SelectItem>
                    <SelectItem value="other">Credit note / other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Total refund</Label>
                <div className="h-10 px-3 flex items-center text-xl font-bold text-primary tabular-nums">
                  {formatMoney(totalRefund, cur)}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong item, expired…" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock will be automatically reduced for items returned to the supplier.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || totalRefund <= 0}>
            {busy ? "Processing…" : `Return ${formatMoney(totalRefund, cur)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
