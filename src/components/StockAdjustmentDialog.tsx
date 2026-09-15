import { useEffect, useState } from "react";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
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
  const [productOpen, setProductOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);

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
  const selectedVariant = selectedProduct?.variants.find((v) => v.id === variantId);

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
      <DialogContent data-add-new="stock-adjustment">
        <DialogHeader>
          <DialogTitle>New Stock Adjustment</DialogTitle>
          <DialogDescription>Manually add or remove stock. The change is recorded in the inventory ledger.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product</Label>
            {/* Searchable: a shop carries hundreds of lines (one oil shop has
                405), and scrolling a plain dropdown to find one is unusable.
                Same pattern as the variant picker below. */}
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className={`truncate ${selectedProduct ? "" : "text-muted-foreground"}`}>
                    {selectedProduct ? selectedProduct.name : "Select product…"}
                  </span>
                  <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                <Command>
                  <CommandInput placeholder="Search product…" />
                  <CommandList>
                    <CommandEmpty>No product found.</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem
                          key={p.id}
                          // cmdk filters on `value`, so it has to be the name —
                          // keying it by id would make the box match nothing.
                          value={p.name}
                          onSelect={() => { setProductId(p.id); setVariantId(""); setProductOpen(false); }}
                        >
                          <Check className={`size-4 me-2 shrink-0 ${productId === p.id ? "opacity-100" : "opacity-0"}`} />
                          <span className="flex-1 truncate">{p.name}</span>
                          {!p.variants?.length && (
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">stock: {p.stock}</span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {hasVariants && (
            <div>
              <Label>Variant</Label>
              {/* Searchable: a pharmacy can carry dozens of batches of one
                  medicine, and scrolling a plain dropdown to find one is slow. */}
              <Popover open={variantOpen} onOpenChange={setVariantOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className={selectedVariant ? "" : "text-muted-foreground"}>
                      {selectedVariant
                        ? `${selectedVariant.name} (stock: ${selectedVariant.stock})`
                        : "Select variant…"}
                    </span>
                    <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Search variant…" />
                    <CommandList>
                      <CommandEmpty>No variant found.</CommandEmpty>
                      <CommandGroup>
                        {selectedProduct!.variants.map((v) => (
                          <CommandItem
                            key={v.id}
                            value={v.name}
                            onSelect={() => { setVariantId(v.id); setVariantOpen(false); }}
                          >
                            <Check className={`size-4 me-2 ${variantId === v.id ? "opacity-100" : "opacity-0"}`} />
                            <span className="flex-1 truncate">{v.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">stock: {v.stock}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
