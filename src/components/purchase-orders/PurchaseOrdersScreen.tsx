/**
 * Purchase orders — list, create/edit, print or WhatsApp to the supplier (with
 * or without prices), and "Convert to purchase" once the goods arrive. Nothing
 * here moves stock or money; the purchase made from an order does.
 *
 * Shared by both apps. Each passes its own `api` (server actions on the web,
 * RPC on the terminal) and `onConvert` (opens that app's purchase form).
 * ⚠️ COPIED verbatim to the desktop (minus "use client").
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRightLeft, Ban, ClipboardList, Loader2, Pencil, Plus, Printer, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PartySelect } from "@/components/PartySelect";
import { DateInput } from "@/components/DateInput";
import { OrderSlipDialog } from "@/components/OrderSlipDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { useAddNew } from "@/hooks/useAddNew";
import { formatMoney } from "@/lib/format";
import { fmtDate } from "@/lib/date-format";
import type { OrderSlipDto, OrderSlipShop } from "@/lib/order-slip";
import {
  PO_STATUS_LABEL,
  type PoProductOption,
  type PoSupplierOption,
  type PurchaseOrderDto,
  type PurchaseOrderStatus,
  type PurchaseOrdersApi,
} from "@/lib/purchase-orders";

interface DraftLine {
  key: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  unit: string;
  quantity: string;
  unit_cost: string;
}

interface Draft {
  id: string | null;
  supplier_id: string;
  supplier_name: string;
  supplier_phone: string;
  expected_date: string;
  notes: string;
  lines: DraftLine[];
}

/** The error of a failed result. Read loosely: the desktop compiles with
 *  strict off, where TypeScript won't narrow the ok/error union. */
const failure = (r: { ok: boolean }) => (r as { error?: string }).error ?? "Something went wrong";

const EMPTY: Draft = { id: null, supplier_id: "", supplier_name: "", supplier_phone: "", expected_date: "", notes: "", lines: [] };
const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export function PurchaseOrdersScreen({
  api,
  shop,
  canDelete,
  onConvert,
}: {
  api: PurchaseOrdersApi;
  shop: OrderSlipShop;
  canDelete: boolean;
  /** Open this app's purchase form filled from the order. */
  onConvert: (order: PurchaseOrderDto) => void;
}) {
  const cur = shop.currency;
  const [filter, setFilter] = useState<PurchaseOrderStatus | "all">("open");
  const [orders, setOrders] = useState<PurchaseOrderDto[] | null>(null);
  const [suppliers, setSuppliers] = useState<PoSupplierOption[]>([]);
  const [products, setProducts] = useState<PoProductOption[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [slip, setSlip] = useState<OrderSlipDto | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      setOrders(await api.list(filter));
    } catch (e) {
      setOrders([]);
      toast.error(e instanceof Error ? e.message : "Could not load purchase orders");
    }
  }, [api, filter]);
  useEffect(() => { void load(); }, [load]);

  const loadForm = useCallback(async () => {
    try {
      const d = await api.formData();
      setSuppliers(d.suppliers);
      setProducts(d.products);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load suppliers and products");
    }
  }, [api]);

  const openNew = () => { setDraft({ ...EMPTY }); void loadForm(); };
  useAddNew({ "purchase-order": openNew });

  const openEdit = (o: PurchaseOrderDto) => {
    setDraft({
      id: o.id,
      supplier_id: o.supplier_id ?? "",
      supplier_name: o.supplier_id ? "" : o.supplier_name,
      supplier_phone: o.supplier_id ? "" : o.supplier_phone ?? "",
      expected_date: o.expected_date ?? "",
      notes: o.notes ?? "",
      lines: o.items.map((i) => ({
        key: i.id,
        product_id: i.product_id,
        variant_id: i.variant_id,
        product_name: i.product_name,
        unit: i.unit ?? "",
        quantity: String(i.quantity),
        unit_cost: i.unit_cost ? String(i.unit_cost) : "",
      })),
    });
    void loadForm();
  };

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchLine = (key: string, p: Partial<DraftLine>) =>
    setDraft((d) => (d ? { ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...p } : l)) } : d));

  const addProduct = (p: PoProductOption) => {
    setDraft((d) => {
      if (!d) return d;
      // The same product twice is one line with more on it.
      const existing = d.lines.find((l) => l.product_id === p.product_id && l.variant_id === p.variant_id);
      if (existing) return { ...d, lines: d.lines.map((l) => (l === existing ? { ...l, quantity: String(num(l.quantity) + 1) } : l)) };
      return { ...d, lines: [...d.lines, { key: `${p.key}:${Date.now()}`, product_id: p.product_id, variant_id: p.variant_id, product_name: p.name, unit: p.unit ?? "", quantity: "1", unit_cost: "" }] };
    });
    setPickerOpen(false);
    setSearch("");
  };
  const addTyped = () => {
    const name = search.trim();
    if (!name) return;
    setDraft((d) => (d ? { ...d, lines: [...d.lines, { key: `new:${Date.now()}`, product_id: null, variant_id: null, product_name: name, unit: "", quantity: "1", unit_cost: "" }] } : d));
    setPickerOpen(false);
    setSearch("");
  };

  const draftTotal = useMemo(
    () => (draft ? draft.lines.reduce((a, l) => a + num(l.quantity) * num(l.unit_cost), 0) : 0),
    [draft],
  );

  const save = async () => {
    if (!draft) return;
    if (!draft.supplier_id && !draft.supplier_name.trim()) return toast.error("Choose a supplier, or type their name");
    if (draft.lines.length === 0) return toast.error("Add at least one product");
    if (draft.lines.some((l) => num(l.quantity) <= 0)) return toast.error("Every line needs a quantity");
    setSaving(true);
    try {
      const res = await api.save(draft.id, {
        supplier_id: draft.supplier_id || null,
        supplier_name: draft.supplier_id ? null : draft.supplier_name.trim(),
        supplier_phone: draft.supplier_id ? null : draft.supplier_phone.trim() || null,
        expected_date: draft.expected_date || null,
        notes: draft.notes.trim() || null,
        items: draft.lines.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          product_name: l.product_name,
          unit: l.unit.trim() || null,
          quantity: num(l.quantity),
          unit_cost: num(l.unit_cost),
        })),
      });
      if (!res.ok) return toast.error(failure(res));
      toast.success(draft.id ? `${res.order.number} updated` : `${res.order.number} created`);
      setDraft(null);
      void load();
      // Straight to the slip: the point of making it is to send it.
      const s = await api.slip(res.order.id);
      if (s) setSlip(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the purchase order");
    } finally {
      setSaving(false);
    }
  };

  const showSlip = async (o: PurchaseOrderDto) => {
    try {
      const s = await api.slip(o.id);
      if (s) setSlip(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the order");
    }
  };

  const setStatus = async (o: PurchaseOrderDto, status: "open" | "cancelled") => {
    if (status === "cancelled") {
      const ok = await confirm({ title: `Cancel ${o.number}?`, description: "The supplier isn't told — send them a message if they already have it.", confirmLabel: "Cancel order", variant: "destructive" });
      if (!ok) return;
    }
    const res = await api.setStatus(o.id, status);
    if (!res.ok) return toast.error(failure(res));
    toast.success(status === "cancelled" ? `${o.number} cancelled` : `${o.number} reopened`);
    void load();
  };

  const remove = async (o: PurchaseOrderDto) => {
    const ok = await confirm({
      title: `Delete ${o.number}?`,
      description: o.purchase_id ? "Only the order is deleted — the purchase made from it stays as it is." : "This can't be undone.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await api.remove(o.id);
    if (!res.ok) return toast.error(failure(res));
    toast.success(`${o.number} deleted`);
    void load();
  };

  const statusTone = (s: PurchaseOrderStatus) =>
    s === "open" ? "bg-primary/10 text-primary" : s === "received" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground";

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="size-6 text-primary" /> Purchase orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Order goods from a supplier — print it or send it on WhatsApp, with or without prices. When the goods
            arrive, convert it into a purchase.
          </p>
        </div>
        <Button onClick={openNew} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
          <Plus className="size-4 mr-1.5" /> New purchase order
        </Button>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {(["open", "received", "cancelled", "all"] as const).map((k) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "ghost"} onClick={() => setFilter(k)} className="h-7 px-3 text-xs">
            {k === "all" ? "All" : PO_STATUS_LABEL[k]}
          </Button>
        ))}
      </div>

      <Card className="shadow-card overflow-hidden">
        {orders === null ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="size-5 animate-spin inline" /></div>
        ) : orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {filter === "open" ? "No open purchase orders. Make one to send to a supplier." : "Nothing here."}
          </div>
        ) : (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{o.number}</span>
                    <Badge variant="outline" className={`border-0 ${statusTone(o.status)}`}>{PO_STATUS_LABEL[o.status]}</Badge>
                    <span className="font-medium truncate">{o.supplier_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmtDate(o.created_at)} · {o.items.length} item{o.items.length === 1 ? "" : "s"}
                    {o.expected_date ? ` · needed by ${fmtDate(o.expected_date)}` : ""}
                    {o.received_at ? ` · received ${fmtDate(o.received_at)}` : ""}
                  </div>
                </div>
                <div className="text-right tabular-nums font-semibold">{o.total ? formatMoney(o.total, cur) : "—"}</div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" title="Print / WhatsApp" onClick={() => void showSlip(o)}><Printer className="size-4" /></Button>
                  {o.status === "open" && (
                    <>
                      <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(o)}><Pencil className="size-4" /></Button>
                      <Button variant="outline" size="sm" title="The goods arrived — make the purchase" onClick={() => onConvert(o)}>
                        <ArrowRightLeft className="size-3.5 mr-1.5" /> Convert to purchase
                      </Button>
                      <Button variant="ghost" size="icon" title="Cancel order" onClick={() => void setStatus(o, "cancelled")}><Ban className="size-4 text-warning" /></Button>
                    </>
                  )}
                  {o.status === "cancelled" && (
                    <Button variant="ghost" size="icon" title="Reopen" onClick={() => void setStatus(o, "open")}><RotateCcw className="size-4" /></Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" title="Delete" onClick={() => void remove(o)}><Trash2 className="size-4 text-destructive" /></Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => { if (!o && !saving) setDraft(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit purchase order" : "New purchase order"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  <PartySelect
                    value={draft.supplier_id}
                    onChange={(id) => patch({ supplier_id: id })}
                    options={suppliers}
                    placeholder="Choose a supplier"
                    emptyLabel="Not on the list — type below"
                    className="w-full"
                  />
                  {!draft.supplier_id && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Supplier name" value={draft.supplier_name} onChange={(e) => patch({ supplier_name: e.target.value })} />
                      <Input placeholder="Phone (for WhatsApp)" value={draft.supplier_phone} onChange={(e) => patch({ supplier_phone: e.target.value })} />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Needed by (optional)</Label>
                  <DateInput value={draft.expected_date} onChange={(e) => patch({ expected_date: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Products</Label>
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal">
                      <Search className="size-4 mr-2" /> Add a product…
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                    <Command>
                      <CommandInput placeholder="Search products" value={search} onValueChange={setSearch} autoFocus />
                      <CommandList>
                        <CommandEmpty>
                          {search.trim() ? (
                            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={addTyped}>
                              Add &ldquo;{search.trim()}&rdquo; as a new item
                            </button>
                          ) : "No products"}
                        </CommandEmpty>
                        <CommandGroup>
                          {products.map((p) => (
                            <CommandItem key={p.key} value={`${p.name} ${p.key}`} onSelect={() => addProduct(p)}>
                              <span className="truncate">{p.name}</span>
                              {p.unit && <span className="ml-auto text-xs text-muted-foreground">{p.unit}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {draft.lines.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No products yet.</div>
                ) : (
                  <div className="rounded-lg border divide-y">
                    <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_90px_80px_110px_100px_36px] gap-2 px-3 py-2 text-xs text-muted-foreground">
                      <span>Product</span><span className="text-right">Qty</span><span>Unit</span><span className="text-right">Rate (optional)</span><span className="text-right">Amount</span><span />
                    </div>
                    {draft.lines.map((l) => (
                      <div key={l.key} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_90px_80px_110px_100px_36px] gap-2 px-3 py-2 items-center">
                        <span className="col-span-2 sm:col-span-1 text-sm font-medium break-words">{l.product_name}</span>
                        <Input type="number" min="0" step="any" inputMode="decimal" className="h-8 text-right" value={l.quantity} onChange={(e) => patchLine(l.key, { quantity: e.target.value })} aria-label="Quantity" />
                        <Input className="h-8" placeholder="pcs" value={l.unit} onChange={(e) => patchLine(l.key, { unit: e.target.value })} aria-label="Unit" />
                        <Input type="number" min="0" step="any" inputMode="decimal" className="h-8 text-right" placeholder="0" value={l.unit_cost} onChange={(e) => patchLine(l.key, { unit_cost: e.target.value })} aria-label="Rate" />
                        <span className="text-right text-sm tabular-nums">{num(l.unit_cost) ? formatMoney(num(l.quantity) * num(l.unit_cost), cur) : "—"}</span>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setDraft((d) => (d ? { ...d, lines: d.lines.filter((x) => x.key !== l.key) } : d))} aria-label="Remove">
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2 text-sm font-semibold">
                      <span>{draft.lines.length} item{draft.lines.length === 1 ? "" : "s"}</span>
                      <span className="tabular-nums">{draftTotal ? formatMoney(draftTotal, cur) : "No rates — prices can be left out"}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Note for the supplier (optional)</Label>
                <Textarea rows={2} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} placeholder="e.g. Deliver to the back gate, call before coming" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />} Save &amp; open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OrderSlipDialog slip={slip} shop={shop} onClose={() => setSlip(null)} />
      {confirmDialog}
    </div>
  );
}
