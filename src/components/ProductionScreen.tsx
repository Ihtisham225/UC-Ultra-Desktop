import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChefHat, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DateInput } from "@/components/DateInput";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { formatMoney, formatQty } from "@/lib/format";
import { fmtDate } from "@/lib/date-format";
import { recipeUsage, type IngredientInfo } from "@/lib/recipe";
import { convertQty, unitLabel } from "@/lib/units";
import type { BatchProductDto, ProductionApi, ProductionIngredientDto, ProductionRunDto } from "@/lib/production";

/**
 * Production (cafe shops): batches made ahead — mix milk, kheer, cake. Making
 * one takes the ingredients off stock and adds the batch to the product's.
 * A product with no recipe (a no-recipe cafe's "prepared ahead") is costed at
 * a typed cost per item — or, when the batch lists what went into it (2 kg cow
 * + 5 kg buffalo for 7 kg mix milk), from those, which also come off stock.
 *
 * ⚠️ COPIED verbatim to the desktop; each app passes its own `api`.
 */

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthStart = () => { const d = new Date(); return localDay(new Date(d.getFullYear(), d.getMonth(), 1)); };

interface LineDraft { product_id: string; quantity: string }

export function ProductionScreen({ api, canEdit }: { api: ProductionApi; canEdit: boolean }) {
  const { currentShop } = useShop();
  const cur = currentShop?.currency ?? "PKR";
  const money = (n: number) => formatMoney(n, cur);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Dates are read after mount — today isn't knowable at render time on the server.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => { setFrom(monthStart()); setTo(localDay()); }, []);

  const [runs, setRuns] = useState<ProductionRunDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ products: BatchProductDto[]; ingredients: ProductionIngredientDto[] } | null>(null);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      setRuns(await api.list({ from, to }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load batches");
    } finally {
      setLoading(false);
    }
  }, [api, from, to]);
  useEffect(() => { void load(); }, [load]);

  // ---- make a batch
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [runDate, setRunDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  /** Cost per item for a product with no recipe (a no-recipe cafe's "prepared ahead"). */
  const [unitCost, setUnitCost] = useState("");
  const [busy, setBusy] = useState(false);

  const ingById = useMemo(() => new Map((form?.ingredients ?? []).map((i) => [i.id, i])), [form]);
  const product = form?.products.find((p) => p.id === productId) ?? null;

  /** The recipe scaled to `made`, in each ingredient's stock unit. */
  const prefill = (p: BatchProductDto, made: number): LineDraft[] => {
    const info = new Map<string, IngredientInfo>((form?.ingredients ?? []).map((i) => [i.id, { name: i.name, unit: i.unit }]));
    return recipeUsage(p.recipe_lines, info, p.recipe_yield, made).uses.map((u) => ({
      product_id: u.ingredient_id,
      quantity: String(u.quantity),
    }));
  };

  const openForm = async () => {
    setOpen(true);
    setRunDate(localDay());
    setNotes("");
    try {
      const data = await api.formData();
      setForm(data);
      if (data.products.length === 1) pick(data.products[0]!, data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the recipes");
    }
  };

  const pick = (p: BatchProductDto, data = form) => {
    setProductId(p.id);
    setQty(String(p.recipe_yield));
    setUnitCost(p.current_cost != null ? String(p.current_cost) : "");
    if (!data) return;
    const info = new Map<string, IngredientInfo>(data.ingredients.map((i) => [i.id, { name: i.name, unit: i.unit }]));
    setLines(recipeUsage(p.recipe_lines, info, p.recipe_yield, p.recipe_yield).uses.map((u) => ({
      product_id: u.ingredient_id, quantity: String(u.quantity),
    })));
  };

  /** Changing how much is made rescales what it uses — the kitchen can still override each line. */
  const changeQty = (raw: string) => {
    setQty(raw);
    const n = parseFloat(raw);
    // Only a recipe rescales; lines typed for a no-recipe batch are the kitchen's own.
    if (product && n > 0 && product.recipe_lines.length > 0) setLines(prefill(product, n));
  };

  const made = parseFloat(qty) || 0;
  // No recipe: the batch is costed per item — unless it lists what went into
  // it, in which case those come off stock and price it, exactly like a recipe.
  const noRecipe = !!product && product.recipe_lines.length === 0;
  const byUnitCost = noRecipe && lines.length === 0;
  const cost = byUnitCost
    ? made * (parseFloat(unitCost) || 0)
    : lines.reduce((a, l) => a + (parseFloat(l.quantity) || 0) * (ingById.get(l.product_id)?.cost ?? 0), 0);

  // ---- add an item used (any stocked product the batch isn't already using)
  const [addOpen, setAddOpen] = useState(false);
  const addable = useMemo(
    () => (form?.ingredients ?? []).filter((i) => i.is_active && i.id !== productId && !lines.some((l) => l.product_id === i.id)),
    [form, productId, lines],
  );
  const addLine = (id: string) => {
    setLines((prev) => [...prev, { product_id: id, quantity: "" }]);
    setAddOpen(false);
  };

  /**
   * Change what went in, and let "Made" follow: when every item is measured in
   * something the product's unit converts to (2 kg cow + 5 kg buffalo → 7 kg
   * mix milk), the batch is their total. Otherwise (milk in litres making
   * cups of kheer) the count is the kitchen's, and Made is left alone.
   */
  const updateLines = (next: LineDraft[]) => {
    setLines(next);
    if (!product || next.length === 0) return;
    let total = 0;
    for (const l of next) {
      const inUnit = convertQty(parseFloat(l.quantity) || 0, ingById.get(l.product_id)?.unit, product.unit);
      if (inUnit === null) return;
      total += inUnit;
    }
    if (total > 0) setQty(String(Math.round(total * 1000) / 1000));
  };
  /** Everything of an item that's on the shelf — "use all the buffalo milk". */
  const stockOf = (id: string) => Math.max(0, ingById.get(id)?.stock ?? 0);
  const useAll = (i: number) =>
    updateLines(lines.map((x, k) => (k === i ? { ...x, quantity: String(stockOf(x.product_id)) } : x)));
  const useAllOfEach = () => updateLines(lines.map((x) => ({ ...x, quantity: String(stockOf(x.product_id)) })));

  const save = async () => {
    if (!product) return toast.error("Pick what you made.");
    if (!(made > 0)) return toast.error("Enter how much was made.");
    const items = lines
      .map((l) => ({ product_id: l.product_id, quantity: parseFloat(l.quantity) }))
      .filter((l) => l.product_id && l.quantity > 0);
    const perItem = parseFloat(unitCost);
    if (byUnitCost && !(perItem > 0)) return toast.error("Enter what one costs to make, or add what went into it.");
    if (!byUnitCost && !items.length) return toast.error("Enter how much of each item went into it.");
    setBusy(true);
    try {
      const res = await api.create({
        product_id: product.id, quantity: made, run_date: runDate, notes: notes.trim() || null,
        items: byUnitCost ? [] : items,
        ...(byUnitCost ? { unit_cost: perItem } : {}),
      });
      if (!res.ok) return toast.error(res.error ?? "Couldn't save the batch");
      toast.success(`Made ${formatQty(made)} ${unitLabel(product.unit)} of ${product.name}`);
      setOpen(false);
      setProductId("");
      setLines([]);
      void load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: ProductionRunDto) => {
    const ok = await confirm({
      title: `Delete this batch of ${r.product_name}?`,
      description: "Its ingredients go back on the shelf and the batch comes off the product's stock.",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await api.remove(r.id);
    if (!res.ok) return toast.error(res.error ?? "Couldn't delete the batch");
    toast.success("Batch deleted");
    void load();
  };

  const totalCost = runs.reduce((a, r) => a + r.total_cost, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <ChefHat className="size-6 text-primary" /> Production
          </h1>
          <p className="text-muted-foreground text-sm">
            Batches made ahead — the ingredients come off the shelf and the batch goes onto the product&apos;s stock.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => void openForm()} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1.5" /> Make a batch
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label>From</Label><DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>To</Label><DateInput value={to} onChange={(e) => setTo(e.target.value)} /></div>
        {/* After mount only: money formats in the browser's locale, which the server can't know. */}
        {from && (
          <div className="ms-auto text-sm text-muted-foreground">
            {runs.length} batch{runs.length === 1 ? "" : "es"} · costing <b className="text-foreground">{money(totalCost)}</b>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No batches in these dates. Products made in batches are set up on the product form (Recipe → Made in batches, or Prepared ahead).
          </div>
        ) : (
          <ul className="divide-y">
            {runs.map((r) => (
              <li key={r.id} className="p-4 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {formatQty(r.quantity)} {unitLabel(r.unit)} {r.product_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(r.run_date)} · {r.items.length
                      ? `used ${r.items.map((i) => `${formatQty(i.quantity)} ${unitLabel(i.unit)} ${i.product_name}`).join(", ")}`
                      : "added to stock"}
                  </div>
                  {r.notes && <div className="text-xs text-muted-foreground mt-0.5">{r.notes}</div>}
                </div>
                <div className="text-end shrink-0">
                  <div className="font-semibold tabular-nums">{money(r.total_cost)}</div>
                  <div className="text-[11px] text-muted-foreground">{money(r.unit_cost)} per {unitLabel(r.unit) || "unit"}</div>
                </div>
                {canEdit && (
                  <Button variant="ghost" size="icon" title="Delete batch" onClick={() => void remove(r)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Make a batch</DialogTitle></DialogHeader>
          {!form ? (
            <div className="p-6 text-center text-muted-foreground">Loading…</div>
          ) : form.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing is set up as made in batches yet. Open a product and choose <b>Prepared ahead</b>
              (or, with recipes, <b>Made in batches</b> and its ingredients).
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>What did you make?</Label>
                  <Select value={productId} onValueChange={(v) => { const p = form.products.find((x) => x.id === v); if (p) pick(p); }}>
                    <SelectTrigger><SelectValue placeholder="Pick a product" /></SelectTrigger>
                    <SelectContent>
                      {form.products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <DateInput value={runDate} onChange={(e) => setRunDate(e.target.value)} />
                </div>
              </div>

              {product && (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Made</span>
                    <Input type="number" min="0" step="any" inputMode="decimal" className="w-28"
                      value={qty} onChange={(e) => changeQty(e.target.value)} />
                    <span>{unitLabel(product.unit) || "pcs"}</span>
                    <span className="text-xs text-muted-foreground">
                      (now {formatQty(product.stock)} in stock)
                    </span>
                  </div>

                  {byUnitCost && (
                    <div className="space-y-1.5 sm:max-w-xs">
                      <Label>Cost per {unitLabel(product.unit) || "item"}</Label>
                      <Input type="number" min="0" step="0.01" inputMode="decimal"
                        value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="What one costs to make" />
                      <p className="text-xs text-muted-foreground">
                        From the product; change it if this batch cost more or less. Nothing else comes off stock.
                      </p>
                    </div>
                  )}
                  {!byUnitCost && (
                  <div className="space-y-2">
                    <Label>{noRecipe ? "What went into it" : "Ingredients used"}</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      {noRecipe
                        ? "These come off stock, and the batch is costed from what you paid for them."
                        : "Filled in from the recipe — change any line to what was actually used."}
                    </p>
                    {lines.length > 1 && (
                      <Button type="button" variant="outline" size="sm" className="h-7" onClick={useAllOfEach}
                        title="Put everything on the shelf of each item into this batch">
                        Use all of each
                      </Button>
                    )}
                    {lines.map((l, i) => {
                      const ing = ingById.get(l.product_id);
                      const q = parseFloat(l.quantity) || 0;
                      const short = ing && q > ing.stock;
                      return (
                        <div key={l.product_id} className="grid grid-cols-[1fr_auto_7rem_auto] items-center gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate">{ing?.name ?? "—"}</div>
                            <div className={`text-[11px] ${short ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatQty(ing?.stock ?? 0)} {unitLabel(ing?.unit)} in stock
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs"
                            disabled={!ing || ing.stock <= 0}
                            title={`Use all ${formatQty(ing?.stock ?? 0)} ${unitLabel(ing?.unit)}`}
                            onClick={() => useAll(i)}>
                            Use all
                          </Button>
                          <div className="flex items-center gap-1">
                            <Input type="number" min="0" step="any" inputMode="decimal" className="h-9"
                              value={l.quantity}
                              onChange={(e) => updateLines(lines.map((x, k) => (k === i ? { ...x, quantity: e.target.value } : x)))} />
                            <span className="text-xs text-muted-foreground w-8">{unitLabel(ing?.unit)}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label="Remove ingredient"
                            onClick={() => updateLines(lines.filter((_, k) => k !== i))}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  )}

                  <div className="space-y-1">
                    <Popover open={addOpen} onOpenChange={setAddOpen} modal>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" disabled={addable.length === 0}>
                          <Plus className="size-4 me-1.5" />
                          {noRecipe && !lines.length ? "Add what went into it" : "Add another item"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="start">
                        {/* Name-only matching — the ids in the item values would match too. */}
                        <Command filter={(_v, search, keywords) => {
                          const hay = (keywords ?? []).join(" ").toLowerCase();
                          return search.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w)) ? 1 : 0;
                        }}>
                          <CommandInput placeholder="Search stocked products…" />
                          <CommandList>
                            <CommandEmpty>No match.</CommandEmpty>
                            <CommandGroup>
                              {addable.map((i) => (
                                <CommandItem key={i.id} value={`${i.name} ${i.id}`} keywords={[i.name]} onSelect={() => addLine(i.id)}>
                                  <span className="truncate">{i.name}</span>
                                  <span className="ms-auto text-[11px] text-muted-foreground shrink-0">
                                    {formatQty(i.stock)} {unitLabel(i.unit)}
                                  </span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {noRecipe && !lines.length && (
                      <p className="text-xs text-muted-foreground">
                        Made it from stock you bought — say cow and buffalo milk for mix milk? Add them here instead of typing a cost.
                      </p>
                    )}
                  </div>

                  <div className="rounded-md bg-muted/40 p-2 text-xs">
                    {byUnitCost ? "Batch cost" : "Ingredient cost"}: <b>{money(cost)}</b>
                    {made > 0 && <> · {money(cost / made)} per {unitLabel(product.unit) || "unit"}</>}
                    {!byUnitCost && lines.some((l) => !(ingById.get(l.product_id)?.cost)) && (
                      <span className="text-muted-foreground"> · ingredients never bought through a purchase count as 0</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy || !product}>Save batch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
