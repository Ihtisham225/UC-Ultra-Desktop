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
import { Undo2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

interface SaleItem {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  saleId: string | null;
  onDone?: () => void;
}

export const ReturnDialog = ({ open, onClose, saleId, onDone }: Props) => {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [alreadyReturned, setAlreadyReturned] = useState<Record<string, number>>({});
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [deduction, setDeduction] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "card" | "mobile" | "other">("cash");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<string | null>(null);

  const cur = currentShop?.currency ?? "USD";

  useEffect(() => {
    if (!open || !saleId) return;
    (async () => {
      setLoading(true);
      setQtyMap({}); setReason(""); setNotes(""); setDeduction(""); setRefundMethod("cash");
      try {
        const ctx = await rpc<{ receipt_number: string | null; items: SaleItem[]; alreadyReturned: Record<string, number> } | null>(
          "getReturnContextAction",
          saleId,
        );
        setItems(ctx?.items ?? []);
        setReceipt(ctx?.receipt_number ?? null);
        setAlreadyReturned(ctx?.alreadyReturned ?? {});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, saleId]);

  const itemsTotal = useMemo(
    () => items.reduce((sum, i) => sum + Number(i.unit_price) * (qtyMap[i.id] ?? 0), 0),
    [items, qtyMap]
  );
  const deductionNum = Math.min(Math.max(parseFloat(deduction) || 0, 0), itemsTotal);
  const totalRefund = itemsTotal - deductionNum;

  const setQty = (itemId: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setQtyMap((m) => ({ ...m, [itemId]: clamped }));
  };

  const submit = async () => {
    if (!user || !currentShop || !saleId) return;
    const lines = items
      .map((i) => ({ item: i, qty: qtyMap[i.id] ?? 0 }))
      .filter((l) => l.qty > 0);
    if (lines.length === 0) return toast.error("Pick at least one item to return");

    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("createReturnAction", {
        saleId,
        refundMethod,
        reason: reason || null,
        notes: notes || null,
        deduction: deductionNum > 0 ? deductionNum : null,
        lines: lines.map((l) => ({
          sale_item_id: l.item.id,
          product_id: l.item.product_id,
          variant_id: l.item.variant_id,
          product_name: l.item.product_name,
          quantity: l.qty,
          unit_price: l.item.unit_price,
        })),
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(`Refund of ${formatMoney(totalRefund, cur)} processed — stock restored`);
    onDone?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="size-5 text-primary" /> Process return
          </DialogTitle>
          {receipt && <p className="text-sm text-muted-foreground font-mono">{receipt}</p>}
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading sale items…</div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-2.5">Item</th>
                    <th className="text-center p-2.5 w-20">Sold</th>
                    <th className="text-center p-2.5 w-20">Done</th>
                    <th className="text-center p-2.5 w-28">Return</th>
                    <th className="text-right p-2.5 w-24">Refund</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const done = alreadyReturned[i.id] ?? 0;
                    const remaining = Number(i.quantity) - done;
                    const qty = qtyMap[i.id] ?? 0;
                    return (
                      <tr key={i.id} className="border-t">
                        <td className="p-2.5">
                          <div className="font-medium">{i.product_name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(i.unit_price, cur)} ea</div>
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
                          {qty > 0 ? formatMoney(Number(i.unit_price) * qty, cur) : "—"}
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
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="other">Store credit / other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Deduction</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={deduction}
                  onChange={(e) => setDeduction(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Items total</span>
                <span className="tabular-nums">{formatMoney(itemsTotal, cur)}</span>
              </div>
              {deductionNum > 0 && (
                <div className="flex justify-between gap-4 text-destructive">
                  <span>Deduction</span>
                  <span className="tabular-nums">−{formatMoney(deductionNum, cur)}</span>
                </div>
              )}
              <div className="flex justify-between gap-4 text-lg font-bold text-primary pt-1 border-t">
                <span>Refund to customer</span>
                <span className="tabular-nums">{formatMoney(totalRefund, cur)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Defective, wrong item, customer changed mind…" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Stock will be automatically restored for returned items.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy || itemsTotal <= 0}>
            {busy ? "Processing…" : `Refund ${formatMoney(totalRefund, cur)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
