import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Boxes } from "lucide-react";
import type { BuilderVariant } from "@/components/VariantsBuilder";

interface Props {
  value: BuilderVariant[];
  onChange: (next: BuilderVariant[]) => void;
  /** Falls back to the product price when a batch has no price of its own. */
  basePrice: number;
}

/**
 * Batch list for pharmacies. Each batch is stored as a product variant — it
 * already carries its own price, stock, expiry and batch number — but the UI
 * here is a plain table instead of the attribute/combination builder, which
 * was far too abstract for shop staff.
 *
 * Stock is deliberately read-only: it moves through purchases, sales and
 * returns like any other stock, never by typing over it.
 */
export function BatchesBuilder({ value, onChange, basePrice }: Props) {
  const add = () =>
    onChange([
      ...value,
      { name: "", sku: null, barcode: null, price_override: null, stock: 0, batch_no: "", expiry_date: "", _new: true },
    ]);

  const update = (i: number, patch: Partial<BuilderVariant>) =>
    onChange(
      value.map((b, idx) => {
        if (idx !== i) return b;
        const next = { ...b, ...patch };
        // The batch number is the batch's identity, so keep the row name in
        // sync — that's what shows in the POS picker and on the receipt.
        if (patch.batch_no !== undefined) next.name = (patch.batch_no as string) || "Batch";
        return next;
      }),
    );

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Boxes className="size-4 text-primary" /> Batches
      </div>
      <p className="text-xs text-muted-foreground">
        Add a batch whenever you buy the same medicine at a different rate. Each batch keeps its own
        price and expiry, and staff pick the batch at checkout (the one expiring soonest is offered first).
      </p>

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_9rem_8rem_5rem_2.25rem] gap-2 text-xs text-muted-foreground px-1">
            <span>Batch no.</span><span>Expiry</span><span>Sale price</span><span>Stock</span><span />
          </div>
          {value.map((b, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_9rem_8rem_5rem_2.25rem] gap-2">
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Batch no.</Label>
                <Input
                  value={b.batch_no ?? ""}
                  onChange={(e) => update(i, { batch_no: e.target.value })}
                  placeholder="e.g. A-123"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Expiry</Label>
                <Input
                  type="date"
                  value={b.expiry_date ?? ""}
                  onChange={(e) => update(i, { expiry_date: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Sale price</Label>
                <Input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={b.price_override ?? ""}
                  onChange={(e) => update(i, { price_override: e.target.value === "" ? null : parseFloat(e.target.value) })}
                  placeholder={String(basePrice || 0)}
                  className="h-9 text-sm tabular-nums"
                />
              </div>
              <div className="space-y-1">
                <Label className="sm:hidden text-xs">Stock</Label>
                <div className="h-9 flex items-center px-2 text-sm tabular-nums text-muted-foreground">
                  {Number(b.stock) || 0}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 text-destructive self-end"
                onClick={() => remove(i)}
                title="Remove batch"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Stock comes from purchases — record a purchase against a batch to add units to it.
          </p>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4 mr-1" /> Add batch
      </Button>
    </div>
  );
}
