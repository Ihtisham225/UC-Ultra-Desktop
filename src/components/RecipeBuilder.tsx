import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChefHat, Plus, Trash2, ChevronsUpDown } from "lucide-react";
import { RECIPE_MODES, recipeUnitCost, type IngredientInfo, type RecipeMode } from "@/lib/recipe";
import { unitChoices, unitLabel } from "@/lib/units";

/**
 * A product's recipe (cafe shops): what it is made from and how that uses up
 * stock. ⚠️ COPIED verbatim to the desktop — it takes the ingredient list as
 * a prop, so each app supplies its own (server action / offline store).
 *
 * Quantities are held as strings while typed, like SaleUnitsBuilder: "0." and
 * an empty box are normal mid-keystroke.
 */
export interface RecipeLineDraft {
  ingredient_id: string;
  quantity: string;
  unit: string;
}

export interface RecipeDraft {
  mode: RecipeMode | null;
  /** How many of the product one recipe makes. */
  yield: string;
  lines: RecipeLineDraft[];
}

export interface RecipeIngredient {
  id: string;
  name: string;
  unit: string | null;
  /** Average landed cost per stock unit; null when never bought. */
  cost: number | null;
  is_active?: boolean;
}

/** The draft as the server wants it, or an error to show before saving. */
export function recipeForSave(d: RecipeDraft): { mode: RecipeMode | null; yield: number; lines: { ingredient_id: string; quantity: number; unit: string }[] } | { error: string } {
  if (!d.mode) return { mode: null, yield: 1, lines: [] };
  const y = parseFloat(d.yield);
  if (!(y > 0)) return { error: "Enter how many one recipe makes — more than 0." };
  const lines = d.lines
    .filter((l) => l.ingredient_id)
    .map((l) => ({ ingredient_id: l.ingredient_id, quantity: parseFloat(l.quantity), unit: l.unit }));
  if (!lines.length) return { error: "Add at least one ingredient to the recipe, or switch the recipe off." };
  if (lines.some((l) => !(l.quantity > 0))) return { error: "Every recipe ingredient needs a quantity more than 0." };
  return { mode: d.mode, yield: y, lines };
}

export const emptyRecipe = (): RecipeDraft => ({ mode: null, yield: "1", lines: [] });

/** A product's saved recipe as an editable draft. */
export function recipeDraftOf(p: { recipe_mode?: RecipeMode | null; recipe_yield?: number | null; recipe_lines?: { ingredient_id: string; quantity: number; unit: string }[] } | null | undefined): RecipeDraft {
  if (!p?.recipe_mode) return emptyRecipe();
  return {
    mode: p.recipe_mode,
    yield: String(p.recipe_yield ?? 1),
    lines: (p.recipe_lines ?? []).map((l) => ({ ingredient_id: l.ingredient_id, quantity: String(l.quantity), unit: l.unit })),
  };
}

function IngredientPicker({ value, options, onPick }: {
  value: string;
  options: RecipeIngredient[];
  onPick: (ing: RecipeIngredient) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  // Archived ingredients stay on a recipe that already uses them, but aren't offered.
  const listed = options.filter((o) => o.is_active !== false || o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="justify-between font-normal w-full min-w-0">
          <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected ? selected.name : "Pick an ingredient"}</span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-64" align="start">
        <Command>
          <CommandInput placeholder="Search products…" />
          <CommandList>
            <CommandEmpty>No product by that name.</CommandEmpty>
            <CommandGroup>
              {listed.map((o) => (
                <CommandItem key={o.id} value={`${o.name} ${o.id}`} onSelect={() => { onPick(o); setOpen(false); }}>
                  <span className="truncate">{o.name}</span>
                  <span className="ms-auto text-xs text-muted-foreground shrink-0">{unitLabel(o.unit) || "pcs"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  value: RecipeDraft;
  onChange: (next: RecipeDraft) => void;
  /** Products that can go into the recipe (stocked items, with their average cost). */
  ingredients: RecipeIngredient[];
  /** The product being edited — left out of its own ingredient list. */
  productId?: string | null;
  /** The product's own unit, for "one recipe makes 50 L". */
  productUnit?: string | null;
  /** Selling price, to show the margin next to the ingredient cost. */
  price?: number;
  formatMoney: (n: number) => string;
}

export function RecipeBuilder({ value, onChange, ingredients, productId, productUnit, price, formatMoney }: Props) {
  const options = useMemo(() => ingredients.filter((i) => i.id !== productId), [ingredients, productId]);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const unit = unitLabel(productUnit) || "pcs";

  const set = (patch: Partial<RecipeDraft>) => onChange({ ...value, ...patch });
  const patchLine = (i: number, p: Partial<RecipeLineDraft>) =>
    set({ lines: value.lines.map((l, x) => (x === i ? { ...l, ...p } : l)) });

  const cost = useMemo(() => {
    const info = new Map<string, IngredientInfo>(ingredients.map((i) => [i.id, { name: i.name, unit: i.unit, cost: i.cost }]));
    const lines = value.lines
      .filter((l) => l.ingredient_id && parseFloat(l.quantity) > 0)
      .map((l) => ({ ingredient_id: l.ingredient_id, quantity: parseFloat(l.quantity), unit: l.unit }));
    return lines.length ? recipeUnitCost(lines, info, parseFloat(value.yield)) : null;
  }, [value, ingredients]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="flex items-center gap-2"><ChefHat className="size-4 text-primary" /> Recipe or deal</Label>
          <p className="text-xs text-muted-foreground mt-1">
            What this is made from — or, for a deal, what comes in it. Leave off for things you buy and sell as they are.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[{ value: null, label: "No recipe", hint: "Bought and sold as it is." }, ...RECIPE_MODES].map((m) => (
          <button
            key={m.label}
            type="button"
            onClick={() => set({
              mode: m.value,
              // A deal is one combo: its contents are per deal, so its yield is always 1.
              ...(m.value === "deal" ? { yield: "1" } : {}),
              lines: m.value && !value.lines.length ? [{ ingredient_id: "", quantity: "", unit: "" }] : value.lines,
            })}
            className={`rounded-md border p-2 text-start text-xs transition-colors ${value.mode === m.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
          >
            <span className="block font-medium text-sm text-foreground">{m.label}</span>
            <span className="text-muted-foreground">{m.hint}</span>
          </button>
        ))}
      </div>

      {value.mode && (
        <>
          {value.mode === "deal" ? (
            <p className="text-sm">In one deal — the price above is what the whole deal sells for:</p>
          ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>One recipe makes</span>
            <Input
              type="number" min="0" step="0.001" inputMode="decimal"
              className="w-24"
              value={value.yield}
              onChange={(e) => set({ yield: e.target.value })}
            />
            <span>{unit}</span>
            <span className="text-xs text-muted-foreground">— the quantities below are for this much.</span>
          </div>
          )}

          <div className="space-y-2">
            {value.lines.map((l, i) => {
              const ing = byId.get(l.ingredient_id);
              const choices = unitChoices(ing?.unit);
              return (
                <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2">
                  <IngredientPicker
                    value={l.ingredient_id}
                    options={options}
                    onPick={(o) => patchLine(i, { ingredient_id: o.id, unit: unitChoices(o.unit)[0]! })}
                  />
                  <Input
                    type="number" min="0" step="0.001" inputMode="decimal" placeholder="Qty"
                    value={l.quantity}
                    onChange={(e) => patchLine(i, { quantity: e.target.value })}
                  />
                  <select
                    className="h-10 rounded-md border bg-background px-2 text-sm"
                    value={l.unit || choices[0]}
                    disabled={!ing}
                    onChange={(e) => patchLine(i, { unit: e.target.value })}
                    aria-label="Unit"
                  >
                    {choices.map((c) => <option key={c} value={c}>{unitLabel(c)}</option>)}
                  </select>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove ingredient"
                    onClick={() => set({ lines: value.lines.filter((_, x) => x !== i) })}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm"
              onClick={() => set({ lines: [...value.lines, { ingredient_id: "", quantity: "", unit: "" }] })}>
              <Plus className="size-4 me-1" /> {value.mode === "deal" ? "Add product" : "Add ingredient"}
            </Button>
          </div>

          {cost && (
            <div className="rounded-md bg-muted/40 p-2 text-xs space-y-0.5">
              <p>
                {value.mode === "deal" ? "Cost of what's in it" : "Ingredient cost"}: <b>{formatMoney(cost.cost)}</b> per {value.mode === "deal" ? "deal" : unit}
                {price != null && price > 0 && cost.cost > 0 && (
                  <> · sells for {formatMoney(price)} · margin <b>{formatMoney(price - cost.cost)}</b></>
                )}
              </p>
              {cost.uncosted.length > 0 && (
                <p className="text-muted-foreground">
                  Not counted (never bought through a purchase): {cost.uncosted.join(", ")}.
                </p>
              )}
              {cost.unconvertible.length > 0 && (
                <p className="text-destructive">
                  The unit doesn&apos;t match the stock unit of: {cost.unconvertible.join(", ")}.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
