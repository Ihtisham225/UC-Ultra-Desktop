import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { CustomerPicker, type CustomerLite } from "@/components/CustomerPicker";

export interface ManualSaleProduct {
  id: string;
  name: string;
  price: number;
  barcode?: string | null;
  variants?: Array<{ id: string; name: string; price_override: number | null }> | null;
}

export interface ManualSaleApi {
  products: () => Promise<ManualSaleProduct[]>;
  accounts: () => Promise<Array<{ id: string; name: string; type: string }>>;
  submit: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
}

interface Line {
  key: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  unit_price: string;
  quantity: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const todayLocal = () => {
  // Local calendar date — toISOString would roll back a day east of UTC.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Record a sale that happened away from the till — yesterday's cash sale, a
 * WhatsApp order, a day the app was offline. Goes through the same checkout
 * path as POS, so stock, debt and account balances all move the usual way;
 * only the date differs.
 */
export function ManualSaleDialog({
  open, onClose, onSaved, api,
}: { open: boolean; onClose: () => void; onSaved: () => void; api: ManualSaleApi }) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";

  const [products, setProducts] = useState<ManualSaleProduct[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [date, setDate] = useState(todayLocal());
  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<CustomerLite | null>(null);
  const [tenders, setTenders] = useState<Array<{ key: string; account_id: string; amount: string }>>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayLocal());
    setLines([]);
    setCustomer(null);
    setQuery("");
    api.products().then(setProducts).catch(() => {});
    api.accounts().then((list) => {
      setAccounts(list);
      const cash = list.find((a) => a.type === "cash") ?? list[0];
      setTenders(cash ? [{ key: "m0", account_id: cash.id, amount: "" }] : []);
    }).catch(() => {});
  }, [open, api]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [products, query]);

  const total = useMemo(
    () => round2(lines.reduce((a, l) => a + (parseFloat(l.unit_price) || 0) * (parseFloat(l.quantity) || 0), 0)),
    [lines],
  );
  const tendered = round2(tenders.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0));
  const owed = round2(Math.max(0, total - tendered));

  const addProduct = (p: ManualSaleProduct) => {
    setLines((prev) => [...prev, {
      key: `l${Date.now()}${prev.length}`,
      product_id: p.id,
      variant_id: null,
      product_name: p.name,
      unit_price: String(p.price ?? 0),
      quantity: "1",
    }]);
    setQuery("");
  };

  const save = async () => {
    if (lines.length === 0) return toast.error("Add at least one product");
    if (!date) return toast.error("Pick a date");
    if (owed > 0 && !customer) {
      return toast.error("Part of this sale is unpaid — pick a customer so the balance is recorded");
    }
    const payments = tenders
      .filter((t) => (parseFloat(t.amount) || 0) > 0)
      .map((t) => ({ account_id: t.account_id, amount: parseFloat(t.amount) }));

    setBusy(true);
    const res = await api.submit({
      items: lines.map((l) => ({
        product_id: l.product_id,
        variant_id: l.variant_id,
        product_name: l.product_name,
        unit_price: parseFloat(l.unit_price) || 0,
        quantity: parseFloat(l.quantity) || 0,
      })),
      customer_id: customer?.id ?? null,
      patient_id: null,
      payment_method: "cash",
      discount: 0,
      amount_paid: Math.min(tendered, total),
      change_due: round2(Math.max(0, tendered - total)),
      is_credit: owed > 0,
      payments,
      // Midday keeps the sale on the chosen calendar day in either direction
      // once the server stores it as UTC.
      occurred_at: new Date(`${date}T12:00:00`).toISOString(),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error ?? "Failed to record the sale");
    toast.success("Sale recorded");
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a sale</DialogTitle>
          <p className="text-sm text-muted-foreground">
            For a sale made away from the till. Stock and balances move exactly as they would at POS.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date of sale</Label>
              <Input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Customer {owed > 0 && <span className="text-warning">(required — part unpaid)</span>}</Label>
              <CustomerPicker value={customer} onChange={setCustomer} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Add products</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                className="ps-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or barcode…"
              />
            </div>
            {matches.length > 0 && (
              <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-accent"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-muted-foreground shrink-0">{formatMoney(p.price, cur)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {lines.length > 0 && (
            <div className="border rounded-lg divide-y">
              {lines.map((l) => (
                <div key={l.key} className="flex items-center gap-2 p-2">
                  <span className="flex-1 min-w-0 truncate text-sm">{l.product_name}</span>
                  <Input
                    type="number" step="0.01" className="w-24 tabular-nums" placeholder="Price"
                    value={l.unit_price}
                    onChange={(e) => setLines((prev) => prev.map((x) => x.key === l.key ? { ...x, unit_price: e.target.value } : x))}
                  />
                  <span className="text-muted-foreground text-xs">×</span>
                  <Input
                    type="number" step="1" className="w-20 tabular-nums" placeholder="Qty"
                    value={l.quantity}
                    onChange={(e) => setLines((prev) => prev.map((x) => x.key === l.key ? { ...x, quantity: e.target.value } : x))}
                  />
                  <Button size="icon" variant="ghost" className="size-8 shrink-0"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total</span>
            <span className="tabular-nums text-primary">{formatMoney(total, cur)}</span>
          </div>

          <div className="space-y-2">
            <Label>Paid into</Label>
            {tenders.map((tRow) => (
              <div key={tRow.key} className="flex items-center gap-2">
                <Select
                  value={tRow.account_id}
                  onValueChange={(v) => setTenders((prev) => prev.map((x) => x.key === tRow.key ? { ...x, account_id: v } : x))}
                >
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="number" step="0.01" className="w-28 tabular-nums" placeholder="0.00"
                  value={tRow.amount}
                  onChange={(e) => setTenders((prev) => prev.map((x) => x.key === tRow.key ? { ...x, amount: e.target.value } : x))}
                />
                {tenders.length > 1 && (
                  <Button size="icon" variant="ghost" className="size-8 shrink-0"
                    onClick={() => setTenders((prev) => prev.filter((x) => x.key !== tRow.key))}>
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            {accounts.length > 1 && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => {
                const used = new Set(tenders.map((t) => t.account_id));
                const next = accounts.find((a) => !used.has(a.id)) ?? accounts[0];
                if (next) setTenders((prev) => [...prev, { key: `m${Date.now()}`, account_id: next.id, amount: owed > 0 ? String(owed) : "" }]);
              }}>
                <Plus className="size-3.5 me-1" /> Split across another account
              </Button>
            )}
            {owed > 0 && (
              <div className="text-sm flex justify-between bg-warning/10 text-warning px-3 py-2 rounded-lg font-medium">
                <span>To be paid later</span>
                <span className="tabular-nums">{formatMoney(owed, cur)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || lines.length === 0}>
            {busy ? "Saving…" : "Record sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
