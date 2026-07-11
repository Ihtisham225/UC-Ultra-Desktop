import { useEffect, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ProductOption {
  id: string;
  name: string;
  stock: number;
  variants: { id: string; name: string; stock: number }[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialProductId?: string;
  onDone?: () => void;
}

const REASONS = ["damage", "recount", "transfer", "expired", "theft", "other"];

export function StockAdjustmentDialog({ open, onOpenChange, initialProductId, onDone }: Props) {
  const { currentShop } = useShop();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState<string>(initialProductId || "");
  const [variantId, setVariantId] = useState<string>("");
  const [delta, setDelta] = useState<string>("");
  const [reason, setReason] = useState<string>("recount");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !currentShop) return;
    (async () => {
      try {
        const data = await rpc<{ id: string; name: string; stock: number; product_variants: { id: string; name: string; stock: number }[] }[]>(
          "listAdjustableProductsAction",
        );
        setProducts((data ?? []).map((p) => ({ id: p.id, name: p.name, stock: p.stock, variants: p.product_variants })));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [open, currentShop]);

  useEffect(() => {
    if (open) {
      setProductId(initialProductId || "");
      setVariantId("");
      setDelta("");
      setReason("recount");
      setNotes("");
    }
  }, [open, initialProductId]);

  const selectedProduct = products.find(p => p.id === productId);
  const hasVariants = selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0;

  const submit = async () => {
    const d = Number(delta);
    if (!productId) return toast.error("Pick a product");
    if (hasVariants && !variantId) return toast.error("Pick a variant");
    if (!d || isNaN(d)) return toast.error("Enter a non-zero quantity");
    setSaving(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adjustStockAction", {
        productId,
        variantId: variantId || null,
        delta: d,
        reason,
        notes: notes || null,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
    toast.success("Stock adjusted");
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Stock Adjustment</DialogTitle>
          <DialogDescription>Manually add or remove stock. The change is recorded in the inventory ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={(v) => { setProductId(v); setVariantId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select product…" /></SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasVariants && (
            <div>
              <Label>Variant</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger><SelectValue placeholder="Select variant…" /></SelectTrigger>
                <SelectContent>
                  {selectedProduct!.variants.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name} (stock: {v.stock})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Quantity change (use negative to remove)</Label>
            <Input type="number" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. -2 or 10" />
            {selectedProduct && !hasVariants && (
              <p className="text-xs text-muted-foreground mt-1">Current stock: {selectedProduct.stock}</p>
            )}
          </div>

          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Adjustment"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
