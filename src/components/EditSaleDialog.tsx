import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useShop } from "@/contexts/ShopContext";
import { soldAs, formatUnitQty } from "@/lib/sale-units";
import { CustomerPicker, type CustomerLite } from "@/components/CustomerPicker";
import { AccountPicker } from "@/components/AccountPicker";
import { VehicleFields, blankVehicle, vehicleDraftToInput, type VehicleDraft } from "@/components/VehicleFields";
import { isOil } from "@/lib/oil";
import { rpc } from "@/lib/apiClient";

export interface EditableProduct {
  id: string;
  name: string;
  price: number;
  unit: string | null;
  units: { id: string; name: string; factor: number }[];
  is_service?: boolean;
  variants?: { id: string; name: string; price_override: number | null }[];
}

/**
 * One line as the counter reads it: quantity and price in whatever unit it was
 * billed in, not the base units the row is stored as. Held as strings while
 * they're being typed — a half-typed "1." is a normal state in a form.
 */
interface Line {
  key: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  quantity: string;
  unit_price: string;
  /** The unit billed in; null means the product's own. */
  unit_label: string | null;
  /** Base units per billed unit; 1 when it IS the base unit. */
  unit_factor: number;
  imei1?: string | null;
  imei2?: string | null;
}

export interface EditableSale {
  id: string;
  receipt_number: string | null;
  discount: number;
  amount_paid: number;
  payment_method: string;
  customer_id: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  account_id?: string | null;
  notes?: string | null;
  items: Array<{
    product_id: string | null;
    variant_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    unit_label?: string | null;
    unit_factor?: number | null;
    imei1?: string | null;
    imei2?: string | null;
  }>;
}

interface Props {
  sale: EditableSale | null;
  products: EditableProduct[];
  onClose: () => void;
  onSaved: () => void;
  submit: (saleId: string, input: unknown) => Promise<{ ok: boolean; error?: string }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function EditSaleDialog({ sale, products, onClose, onSaved, submit }: Props) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("0");
  const [paid, setPaid] = useState("0");
  // The account picker already says how the money moved, so the sale edit no
  // longer asks for a method as well — the sale's stored value rides along
  // unchanged rather than being reset to a guess.
  const [method, setMethod] = useState("cash");
  // Who the bill is for and where the money went — both editable, because a
  // mistyped order usually means the wrong one of these too.
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  // The free oil change is why the car came in, so correcting the bill has to
  // be able to correct the visit recorded beside it.
  const oilShop = isOil(currentShop);
  const [oil, setOil] = useState<VehicleDraft>(blankVehicle);
  const [oilId, setOilId] = useState<string | null>(null);
  const [oilLoaded, setOilLoaded] = useState(false);

  useEffect(() => {
    if (!sale) return;
    setLines(
      sale.items.map((it, i) => {
        // Show what was rung up — 2 bottles, not the 8 litres it's stored as.
        const s = soldAs(it);
        return {
          key: `${i}`,
          product_id: it.product_id ?? "",
          variant_id: it.variant_id,
          product_name: it.product_name,
          quantity: formatUnitQty(s.quantity),
          unit_price: String(round2(s.unitPrice)),
          unit_label: it.unit_label ?? null,
          unit_factor: s.converted ? Number(it.unit_factor) : 1,
          imei1: it.imei1,
          imei2: it.imei2,
        };
      }),
    );
    setDiscount(String(sale.discount ?? 0));
    setPaid(String(sale.amount_paid ?? 0));
    setMethod(sale.payment_method || "cash");
    setCustomer(
      sale.customer_id
        ? { id: sale.customer_id, name: sale.customer_name ?? "Customer", phone: sale.customer_phone ?? null }
        : null,
    );
    setAccountId(sale.account_id ?? null);
    setSearch("");

    setOil(blankVehicle);
    setOilId(null);
    setOilLoaded(false);
    if (!oilShop) return;
    let live = true;
    void rpc<{
      id: string; vehicle_number: string; make: string | null; model_number: string | null;
      current_km: number | null; next_km: number | null; oil_changer: string | null;
      visitor_name: string | null; phone: string | null; notes: string | null;
    } | null>("oilChangeForSaleAction", [sale.id])
      .then((rec) => {
        if (!live) return;
        if (rec) {
          setOilId(rec.id);
          setOil({
            vehicle_number: rec.vehicle_number ?? "",
            make: rec.make ?? "",
            model_number: rec.model_number ?? "",
            current_km: rec.current_km == null ? "" : String(rec.current_km),
            next_km: rec.next_km == null ? "" : String(rec.next_km),
            oil_changer: rec.oil_changer ?? "",
            visitor_name: rec.visitor_name ?? "",
            phone: rec.phone ?? "",
            notes: rec.notes ?? "",
          });
        }
        setOilLoaded(true);
      })
      .catch(() => { if (live) setOilLoaded(true); });
    return () => { live = false; };
  }, [sale, oilShop]);

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const subtotal = useMemo(
    () => round2(lines.reduce((a, l) => a + num(l.quantity) * num(l.unit_price), 0)),
    [lines],
  );
  const discountValue = Math.min(round2(num(discount)), subtotal);
  const total = round2(subtotal - discountValue);
  const owed = round2(Math.max(0, total - Math.min(round2(num(paid)), total)));

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [products, search]);

  const addProduct = (p: EditableProduct) => {
    setLines((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        product_id: p.id,
        variant_id: null,
        product_name: p.name,
        quantity: "1",
        unit_price: String(p.price),
        unit_label: p.unit ?? null,
        unit_factor: 1,
      },
    ]);
    setSearch("");
  };

  const patch = (key: string, p: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));

  /** Re-price a line when its unit changes, exactly as the till does. */
  const setLineUnit = (key: string, unitId: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const p = products.find((x) => x.id === l.product_id);
        const u = unitId === "__base" ? null : p?.units.find((x) => x.id === unitId);
        const factor = u ? u.factor : 1;
        const basePrice = num(l.unit_price) / l.unit_factor;
        return {
          ...l,
          unit_label: u ? u.name : (p?.unit ?? null),
          unit_factor: factor,
          unit_price: String(round2(basePrice * factor)),
        };
      }),
    );
  };

  const save = async () => {
    if (!sale) return;
    const usable = lines.filter((l) => l.product_id && num(l.quantity) > 0);
    if (usable.length === 0) return toast.error("A bill needs at least one line.");
    setBusy(true);
    try {
      const result = await submit(sale.id, {
        // Back to base units on the way out — the server, the stock ledger and
        // every report only ever deal in those.
        items: usable.map((l) => ({
          product_id: l.product_id,
          variant_id: l.variant_id,
          product_name: l.product_name,
          quantity: num(l.quantity) * l.unit_factor,
          unit_price: num(l.unit_price) / l.unit_factor,
          unit_label: l.unit_label,
          unit_factor: l.unit_factor > 1 ? l.unit_factor : null,
          imei1: l.imei1 ?? null,
          imei2: l.imei2 ?? null,
        })),
        discount: discountValue,
        amount_paid: Math.min(round2(num(paid)), total),
        payment_method: method,
        customer_id: customer?.id ?? null,
        account_id: accountId,
        notes: sale.notes ?? null,
      });
      if (!result.ok) return toast.error(result.error ?? "Could not update this bill");

      // The visit is saved after the bill, so a rejected bill never leaves a
      // corrected oil change behind it. A failure here is reported but does
      // not undo the bill — the counter is told which half needs another go.
      if (oilShop && oil.vehicle_number.trim()) {
        const res = await rpc<{ ok: boolean; error?: string }>("saveOilChangeAction", [{
          ...vehicleDraftToInput(oil),
          ...(oilId ? { id: oilId } : {}),
          sale_id: sale.id,
        }]);
        if (!res.ok) {
          toast.error(`Bill saved, but the oil change was not: ${res.error ?? "please try again"}`);
          onSaved();
          onClose();
          return;
        }
      }

      toast.success("Bill updated");
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit bill {sale?.receipt_number ?? ""}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Stock, any investor holding and the customer&apos;s balance are all corrected to match
          the new lines. The receipt number and date stay as they are.
        </p>

        <div className="space-y-2">
          {lines.map((l) => {
            const p = products.find((x) => x.id === l.product_id);
            const alternates = p?.units ?? [];
            return (
              <div key={l.key} className="rounded-lg border p-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{l.product_name}</span>
                  <Button
                    size="icon" variant="ghost" className="size-7 shrink-0"
                    aria-label="Remove line"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Qty</Label>
                    <Input
                      type="number" step="0.01" min="0" inputMode="decimal" className="h-8"
                      value={l.quantity}
                      onChange={(e) => patch(l.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Unit</Label>
                    {alternates.length > 0 ? (
                      <Select
                        value={
                          l.unit_factor > 1
                            ? (alternates.find((u) => u.name === l.unit_label)?.id ?? "__base")
                            : "__base"
                        }
                        onValueChange={(v) => setLineUnit(l.key, v)}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__base">{p?.unit || "pcs"}</SelectItem>
                          {alternates.map((u) => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-8 flex items-center text-xs text-muted-foreground">
                        {l.unit_label || p?.unit || "—"}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Rate</Label>
                    <Input
                      type="number" step="0.01" min="0" inputMode="decimal" className="h-8"
                      value={l.unit_price}
                      onChange={(e) => patch(l.key, { unit_price: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Amount</Label>
                    <div className="h-8 flex items-center justify-end text-sm font-semibold tabular-nums">
                      {formatMoney(round2(num(l.quantity) * num(l.unit_price)), cur)}
                    </div>
                  </div>
                </div>
                {l.unit_factor > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    = {formatUnitQty(num(l.quantity) * l.unit_factor)} {p?.unit || "pcs"} off stock
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Add a line</Label>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="ps-9 h-9"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {matches.length > 0 && (
            <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="w-full text-start px-3 py-2 hover:bg-muted/50 flex items-center justify-between gap-2"
                >
                  <span className="text-sm">{p.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    {formatMoney(p.price, cur)} <Plus className="size-3" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Discount</Label>
            <Input
              type="number" step="0.01" min="0" inputMode="decimal" className="h-9"
              value={discount} onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount paid</Label>
            <Input
              type="number" step="0.01" min="0" inputMode="decimal" className="h-9"
              value={paid} onChange={(e) => setPaid(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Customer</Label>
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
          <div className="space-y-1">
            <AccountPicker value={accountId} onChange={setAccountId} label="Paid into" />
          </div>
        </div>

        {oilShop && oilLoaded && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs font-semibold">Oil change</Label>
              {!oilId && (
                <span className="text-[11px] text-muted-foreground">
                  No visit recorded against this bill — fill the plate in to add one.
                </span>
              )}
            </div>
            <VehicleFields value={oil} onChange={setOil} compact />
          </div>
        )}

        <div className="rounded-lg border p-3 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatMoney(subtotal, cur)}</span></div>
          {discountValue > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{formatMoney(discountValue, cur)}</span></div>
          )}
          <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular-nums">{formatMoney(total, cur)}</span></div>
          {owed > 0 && (
            <div className="flex justify-between text-warning">
              <span>Balance owed</span><span className="tabular-nums">{formatMoney(owed, cur)}</span>
            </div>
          )}
        </div>

        {owed > 0 && !sale?.customer_id && (
          <p className="text-xs text-destructive">
            This bill would be left part-unpaid, so it needs a customer to record the balance
            against. Set one on the sale first, or mark it fully paid.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || lines.length === 0}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
