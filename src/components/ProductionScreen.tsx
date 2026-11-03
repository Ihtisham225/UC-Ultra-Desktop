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
import { DateInput } from "@/components/DateInput";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { formatMoney, formatQty } from "@/lib/format";
import { fmtDate } from "@/lib/date-format";
import { recipeUsage, type IngredientInfo } from "@/lib/recipe";
import { unitLabel } from "@/lib/units";
import type { BatchProductDto, ProductionApi, ProductionIngredientDto, ProductionRunDto } from "@/lib/production";

/**
 * Production (cafe shops): batches made ahead — mix milk, kheer, cake. Making
 * one takes the ingredients off stock and adds the batch to the product's.
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
    if (product && n > 0) setLines(prefill(product, n));
  };

  const cost = lines.reduce((a, l) => a + (parseFloat(l.quantity) || 0) * (ingById.get(l.product_id)?.cost ?? 0), 0);
  const made = parseFloat(qty) || 0;

  const save = async () => {
    if (!product) return toast.error("Pick what you made.");
    if (!(made > 0)) return toast.error("Enter how much was made.");
    const items = lines
      .map((l) => ({ product_id: l.product_id, quantity: parseFloat(l.quantity) }))
      .filter((l) => l.product_id && l.quantity > 0);
    if (!items.length) return toast.error("A batch needs at least one ingredient.");
    setBusy(true);
    try {
      const res = await api.create({ product_id: product.id, quantity: made, run_date: runDate, notes: notes.trim() || null, items });
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
            {runs.length} batch{runs.length === 1 ? "" : "es"} · ingredients worth <b className="text-foreground">{money(totalCost)}</b>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No batches in these dates. Products made in batches are set up on the product form (Recipe → Made in batches).
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
                    {fmtDate(r.run_date)} · used {r.items.map((i) => `${formatQty(i.quantity)} ${unitLabel(i.unit)} ${i.product_name}`).join(", ")}
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
              Nothing is set up as made in batches yet. Open a product, and under <b>Recipe</b> choose
              <b> Made in batches</b> and add its ingredients.
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

                  <div className="space-y-2">
                    <Label>Ingredients used</Label>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Filled in from the recipe — change any line to what was actually used.
                    </p>
                    {lines.map((l, i) => {
                      const ing = ingById.get(l.product_id);
                      const q = parseFloat(l.quantity) || 0;
                      const short = ing && q > ing.stock;
                      return (
                        <div key={l.product_id} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2">
                          <div className="min-w-0">
                            <div className="text-sm truncate">{ing?.name ?? "—"}</div>
                            <div className={`text-[11px] ${short ? "text-destructive" : "text-muted-foreground"}`}>
                              {formatQty(ing?.stock ?? 0)} {unitLabel(ing?.unit)} in stock
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Input type="number" min="0" step="any" inputMode="decimal" className="h-9"
                              value={l.quantity}
                              onChange={(e) => setLines((prev) => prev.map((x, k) => (k === i ? { ...x, quantity: e.target.value } : x)))} />
                            <span className="text-xs text-muted-foreground w-8">{unitLabel(ing?.unit)}</span>
                          </div>
                          <Button type="button" variant="ghost" size="icon" aria-label="Remove ingredient"
                            onClick={() => setLines((prev) => prev.filter((_, k) => k !== i))}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-md bg-muted/40 p-2 text-xs">
                    Ingredient cost: <b>{money(cost)}</b>
                    {made > 0 && <> · {money(cost / made)} per {unitLabel(product.unit) || "unit"}</>}
                    {lines.some((l) => !(ingById.get(l.product_id)?.cost)) && (
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
