import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

/**
 * One alternate way of selling the product. `factor` is how many of the
 * product's base units this is worth — a 4-litre bottle of an oil stocked in
 * litres has factor 4.
 *
 * Held as strings while the row is being typed: a half-typed "0." or an empty
 * box is a normal state in a form, and coercing it to a number mid-keystroke
 * fights the user.
 */
export interface SaleUnitDraft {
  id?: string;
  name: string;
  factor: string;
}

interface Props {
  /** The product's base unit — what stock is counted in. */
  baseUnit: string;
  value: SaleUnitDraft[];
  onChange: (next: SaleUnitDraft[]) => void;
  /** Per-base-unit price, used only to preview what each unit will sell for. */
  basePrice?: number;
  formatMoney?: (n: number) => string;
}

export function SaleUnitsBuilder({ baseUnit, value, onChange, basePrice, formatMoney }: Props) {
  const unit = baseUnit?.trim() || "pcs";

  const add = () => onChange([...value, { name: "", factor: "" }]);
  const remove = (i: number) => onChange(value.filter((_, x) => x !== i));
  const patch = (i: number, p: Partial<SaleUnitDraft>) =>
    onChange(value.map((r, x) => (x === i ? { ...r, ...p } : r)));

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Label>Sale units</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Other ways this product leaves the counter. Stock stays in{" "}
            <b>{unit}</b> — pick a unit at the till and the quantity and price are
            worked out from it. Leave empty to sell in {unit} only.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4 me-1" /> Add unit
        </Button>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_9rem_auto] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span>Unit name</span>
            <span>{unit} in one</span>
            <span className="w-9" />
          </div>
          {value.map((r, i) => {
            const f = parseFloat(r.factor);
            const valid = Number.isFinite(f) && f > 0;
            return (
              <div key={i} className="space-y-1">
                <div className="grid grid-cols-[1fr_9rem_auto] gap-2">
                  <Input
                    value={r.name}
                    placeholder="Bottle"
                    onChange={(e) => patch(i, { name: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    inputMode="decimal"
                    value={r.factor}
                    placeholder="4"
                    onChange={(e) => patch(i, { factor: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove unit"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                {/* Shows the arithmetic so a wrong factor is obvious before saving. */}
                {valid && r.name.trim() !== "" && (
                  <p className="text-[11px] text-muted-foreground ps-1">
                    1 {r.name.trim()} = {f} {unit}
                    {basePrice != null && basePrice > 0 && (
                      <>
                        {" · sells for "}
                        {formatMoney ? formatMoney(basePrice * f) : (basePrice * f).toFixed(2)}
                      </>
                    )}
                  </p>
                )}
                {r.factor !== "" && !valid && (
                  <p className="text-[11px] text-destructive ps-1">
                    Enter how many {unit} make one {r.name.trim() || "unit"} — must be more than 0.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
