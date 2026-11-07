import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PackageMinus, Plus, Trash2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DateInput } from "@/components/DateInput";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { formatMoney, formatQty } from "@/lib/format";
import { fmtDate } from "@/lib/date-format";
import { unitLabel } from "@/lib/units";
import {
  WRITE_OFF_KINDS, writeOffKindLabel, writeOffTotals,
  type WriteOffDto, type WriteOffKind, type WriteOffProductDto, type WriteOffsApi,
} from "@/lib/write-offs";

/**
 * "Used & wasted" (cafe shops): stock that left without being sold — taken for
 * the shop (cups, bags) or wasted (spilt, expired). Each comes off stock at
 * cost and reaches the P&L as its own line below gross profit.
 *
 * ⚠️ COPIED verbatim to the desktop; each app passes its own `api`.
 */

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const monthStart = () => { const d = new Date(); return localDay(new Date(d.getFullYear(), d.getMonth(), 1)); };

export function WriteOffsScreen({ api, canEdit }: { api: WriteOffsApi; canEdit: boolean }) {
  const { currentShop } = useShop();
  const cur = currentShop?.currency ?? "PKR";
  const money = (n: number) => formatMoney(n, cur);
  const { confirm, dialog: confirmDialog } = useConfirm();

  // Dates are read after mount — today isn't knowable at render time on the server.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => { setFrom(monthStart()); setTo(localDay()); }, []);

  const [rows, setRows] = useState<WriteOffDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WriteOffKind | "all">("all");

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      setRows(await api.list({ from, to }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the records");
    } finally {
      setLoading(false);
    }
  }, [api, from, to]);
  useEffect(() => { void load(); }, [load]);

  // ---- record one
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<WriteOffProductDto[] | null>(null);
  const [kind, setKind] = useState<WriteOffKind>("use");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const product = products?.find((p) => p.id === productId) ?? null;
  const kindDef = WRITE_OFF_KINDS.find((k) => k.value === kind)!;

  const openForm = async (k: WriteOffKind) => {
    setKind(k);
    setProductId("");
    setQty("");
    setReason("");
    setNotes("");
    setDate(localDay());
    setOpen(true);
    try {
      setProducts(await api.formData());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load products");
    }
  };

  const save = async () => {
    const q = parseFloat(qty);
    if (!product) return toast.error("Pick a product.");
    if (!(q > 0)) return toast.error("Enter how much.");
    setBusy(true);
    try {
      const res = await api.create({ kind, product_id: product.id, quantity: q, date, reason: reason.trim() || null, notes: notes.trim() || null });
      if (!res.ok) return toast.error(res.error ?? "Couldn't save");
      toast.success(`${writeOffKindLabel(kind)}: ${formatQty(q)} ${unitLabel(product.unit)} ${product.name}`);
      setOpen(false);
      void load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: WriteOffDto) => {
    const ok = await confirm({
      title: `Delete this record?`,
      description: `${formatQty(r.quantity)} ${unitLabel(r.unit)} ${r.product_name} goes back into stock.`,
      variant: "destructive",
    });
    if (!ok) return;
    const res = await api.remove(r.id);
    if (!res.ok) return toast.error(res.error ?? "Couldn't delete");
    toast.success("Deleted — stock put back");
    void load();
  };

  const shown = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.kind === filter)), [rows, filter]);
  const totals = writeOffTotals(rows);
  const q = parseFloat(qty) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <PackageMinus className="size-6 text-primary" /> Used &amp; wasted
          </h1>
          <p className="text-muted-foreground text-sm">
            Stock that left without being sold. It comes off stock at cost and shows on the Profit &amp; Loss.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void openForm("use")}><Plus className="size-4 me-1.5" /> Used in the shop</Button>
            <Button onClick={() => void openForm("waste")} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
              <Plus className="size-4 me-1.5" /> Wastage
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label>From</Label><DateInput value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>To</Label><DateInput value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex gap-1">
          {([["all", "All"], ["use", "Used in the shop"], ["waste", "Wasted"]] as const).map(([v, l]) => (
            <Button key={v} size="sm" variant={filter === v ? "secondary" : "ghost"} onClick={() => setFilter(v)}>{l}</Button>
          ))}
        </div>
        {/* After mount only: money formats in the browser's locale, which the server can't know. */}
        {from && (
          <div className="ms-auto text-sm text-muted-foreground">
            Used <b className="text-foreground">{money(totals.shopUse)}</b> · Wasted <b className="text-foreground">{money(totals.wastage)}</b>
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nothing recorded in these dates.</div>
        ) : (
          <ul className="divide-y">
            {shown.map((r) => (
              <li key={r.id} className="p-4 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium flex items-center gap-2">
                    {formatQty(r.quantity)} {unitLabel(r.unit)} {r.product_name}
                    <span className={`text-[10px] uppercase rounded px-1.5 py-0.5 ${r.kind === "waste" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {r.kind === "waste" ? "Wasted" : "Used"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(r.date)}{r.reason ? ` · ${r.reason}` : ""}{r.notes ? ` · ${r.notes}` : ""}
                  </div>
                </div>
                <div className="text-end shrink-0 font-semibold tabular-nums">{money(r.total_cost)}</div>
                {canEdit && (
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => void remove(r)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{kindDef.label}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {WRITE_OFF_KINDS.map((k) => (
                <button key={k.value} type="button" onClick={() => { setKind(k.value); setReason(""); }}
                  className={`rounded-md border p-2 text-start text-xs ${kind === k.value ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <span className="block font-medium text-sm text-foreground">{k.label}</span>
                  <span className="text-muted-foreground">{k.hint}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label>Product</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className={product ? "truncate" : "truncate text-muted-foreground"}>{product ? product.name : products ? "Pick a product" : "Loading…"}</span>
                    <ChevronsUpDown className="size-4 opacity-50 shrink-0 ms-2" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-64" align="start">
                  <Command>
                    <CommandInput placeholder="Search products…" />
                    <CommandList>
                      <CommandEmpty>No product by that name.</CommandEmpty>
                      <CommandGroup>
                        {(products ?? []).map((p) => (
                          <CommandItem key={p.id} value={`${p.name} ${p.id}`} onSelect={() => { setProductId(p.id); setPickerOpen(false); }}>
                            <span className="truncate">{p.name}</span>
                            <span className="ms-auto text-xs text-muted-foreground shrink-0">
                              {p.made_to_order ? "made to order" : `${formatQty(p.stock)} ${unitLabel(p.unit)}`}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {product?.made_to_order && (
                <p className="text-[11px] text-muted-foreground">Made to order — its ingredients come off stock.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>How much{product ? ` (${unitLabel(product.unit) || "pcs"})` : ""}</Label>
                <Input type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
                {/* What's on hand, and one tap to write all of it off — the
                    usual case for a finished bag of milk or a spoilt batch.
                    A made-to-order item holds no stock of its own. */}
                {product && !product.made_to_order && (
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={product.stock > 0 ? "text-muted-foreground" : "text-destructive"}>
                      In stock: <b className="tabular-nums">{formatQty(product.stock)} {unitLabel(product.unit) || "pcs"}</b>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      disabled={!(product.stock > 0)}
                      onClick={() => setQty(String(product.stock))}
                    >
                      {kind === "waste" ? "Waste all" : "Use all"}
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DateInput value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <div className="flex flex-wrap gap-1">
                {kindDef.reasons.map((r) => (
                  <Button key={r} type="button" size="sm" variant={reason === r ? "secondary" : "outline"} className="h-7" onClick={() => setReason(r)}>{r}</Button>
                ))}
              </div>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type one" />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>

            {product && q > 0 && (
              <div className="rounded-md bg-muted/40 p-2 text-xs">
                At cost: <b>{money((product.cost ?? 0) * q)}</b>
                {product.cost == null && <span className="text-muted-foreground"> — never bought through a purchase, so counted as 0</span>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={busy || !product}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
