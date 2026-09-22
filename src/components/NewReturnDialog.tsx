import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, Receipt, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AccountPicker } from "@/components/AccountPicker";
import { formatMoney } from "@/lib/format";

export interface ReturnProductOption {
  product_id: string;
  variant_id: string | null;
  name: string;
  price: number;
  unit: string | null;
}

/** A bill offered in the form's optional "Bill" field. */
export interface ReturnBillOption {
  id: string;
  receipt_number: string | null;
  created_at: string;
  total: number;
  customer_id: string | null;
  customer_name: string | null;
}

export interface NewReturnInput {
  customerId: string | null;
  /** Optional: the bill the goods came from. Recorded, not enforced. */
  saleId: string | null;
  accountId: string | null;
  reason: string | null;
  notes: string | null;
  deduction: number | null;
  lines: { product_id: string; variant_id: string | null; product_name: string; quantity: number; unit_price: number }[];
}

interface Line {
  key: string;
  option: ReturnProductOption;
  qty: string;
  price: string;
}

const optionKey = (o: ReturnProductOption) => `${o.product_id}:${o.variant_id ?? ""}`;

/**
 * "New return" — goods coming back with no bill behind them. The counter picks
 * what came back, how many and at what price (the shelf price by default);
 * stock goes back on the shelf and the refund leaves the chosen account.
 *
 * Everything the web and the terminal do differently is passed in (products,
 * the customer picker, saving), so the two apps share this form.
 */
export function NewReturnDialog({
  open, onClose, currency, products, renderCustomer, submit, onSaved, searchBills,
}: {
  open: boolean;
  onClose: () => void;
  currency: string;
  products: ReturnProductOption[];
  /** The shop's own customer picker, bound to the id it reports. */
  renderCustomer: (onChange: (customerId: string | null) => void) => ReactNode;
  // One loose shape rather than a union: the terminal compiles without strict
  // mode, where TypeScript won't narrow `{ok:true}|{ok:false}` on `ok`.
  submit: (input: NewReturnInput) => Promise<{ ok: boolean; error?: string; returnId?: string; totalRefund?: number }>;
  /** Called with the saved return's id — the page opens its receipt. */
  onSaved: (returnId: string) => void;
  /** Bills for the optional Bill field — latest first, or matching the search. */
  searchBills?: (query: string) => Promise<ReturnBillOption[]>;
}) {
  const [bill, setBill] = useState<ReturnBillOption | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [billQuery, setBillQuery] = useState("");
  const [bills, setBills] = useState<ReturnBillOption[]>([]);
  useEffect(() => {
    if (!billOpen || !searchBills) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchBills(billQuery).then((r) => { if (!cancelled) setBills(r); }).catch(() => {});
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [billOpen, billQuery, searchBills]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [deduction, setDeduction] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLines([]); setCustomerId(null); setDeduction(""); setReason(""); setNotes(""); setBill(null); setBillQuery("");
    // The picker is the first thing anyone needs.
    setTimeout(() => setPickerOpen(true), 150);
  }, [open]);

  const addProduct = (o: ReturnProductOption) => {
    setLines((ls) => {
      const k = optionKey(o);
      const found = ls.find((l) => l.key === k);
      if (found) return ls.map((l) => (l.key === k ? { ...l, qty: String((parseFloat(l.qty) || 0) + 1) } : l));
      return [...ls, { key: k, option: o, qty: "1", price: String(o.price) }];
    });
    setPickerOpen(false);
  };

  const itemsTotal = useMemo(
    () => lines.reduce((a, l) => a + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0),
    [lines],
  );
  const deductionNum = Math.min(Math.max(parseFloat(deduction) || 0, 0), itemsTotal);
  const refund = Math.round((itemsTotal - deductionNum) * 100) / 100;

  const save = async () => {
    const valid = lines
      .map((l) => ({ l, qty: parseFloat(l.qty), price: parseFloat(l.price) }))
      .filter((x) => x.qty > 0);
    if (valid.length === 0) return toast.error("Add at least one product being returned");
    if (valid.some((x) => !Number.isFinite(x.price) || x.price < 0)) return toast.error("Every line needs a price");
    setBusy(true);
    try {
      const res = await submit({
        customerId,
        saleId: bill?.id ?? null,
        accountId,
        reason: reason.trim() || null,
        notes: notes.trim() || null,
        deduction: deductionNum > 0 ? deductionNum : null,
        lines: valid.map(({ l, qty, price }) => ({
          product_id: l.option.product_id,
          variant_id: l.option.variant_id,
          product_name: l.option.name,
          quantity: qty,
          unit_price: price,
        })),
      });
      if (!res.ok || !res.returnId) return toast.error(res.error ?? "Couldn't save the return");
      toast.success(`Refund of ${formatMoney(res.totalRefund ?? refund, currency)} processed — stock restored`);
      onClose();
      onSaved(res.returnId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-add-new="return" className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="size-5 text-primary" /> New return
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Products being returned</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen} modal>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" aria-expanded={pickerOpen} className="w-full justify-between font-normal">
                  <span className="flex items-center gap-2 text-muted-foreground"><Plus className="size-4" /> Add a product…</span>
                  <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-72" align="start">
                <Command filter={(v, q) => (q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => v.toLowerCase().includes(w)) ? 1 : 0)}>
                  <CommandInput placeholder="Search products…" />
                  <CommandList>
                    <CommandEmpty>No product matches.</CommandEmpty>
                    <CommandGroup>
                      {products.map((o) => {
                        const k = optionKey(o);
                        const added = lines.some((l) => l.key === k);
                        return (
                          <CommandItem key={k} value={`${o.name} ${k}`} onSelect={() => addProduct(o)}>
                            <Check className={`size-4 me-2 ${added ? "opacity-100" : "opacity-0"}`} />
                            <span className="truncate flex-1">{o.name}</span>
                            <span className="ms-2 text-xs text-muted-foreground tabular-nums">{formatMoney(o.price, currency)}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {lines.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-start p-2.5">Product</th>
                    <th className="text-center p-2.5 w-24">Qty</th>
                    <th className="text-center p-2.5 w-32">Price</th>
                    <th className="text-end p-2.5 w-28">Refund</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const lineTotal = (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0);
                    return (
                      <tr key={l.key} className="border-t">
                        <td className="p-2.5 font-medium">{l.option.name}</td>
                        <td className="p-2">
                          <Input
                            type="number" inputMode="decimal" min="0" step="any" className="h-8 text-center"
                            value={l.qty}
                            onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number" inputMode="decimal" min="0" step="0.01" className="h-8 text-end"
                            value={l.price}
                            onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, price: e.target.value } : x)))}
                          />
                        </td>
                        <td className="p-2.5 text-end tabular-nums">{formatMoney(lineTotal, currency)}</td>
                        <td className="p-1">
                          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {searchBills && (
            <div className="space-y-1.5">
              <Label>Bill (optional)</Label>
              <div className="flex gap-2">
                <Popover open={billOpen} onOpenChange={setBillOpen} modal>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" role="combobox" aria-expanded={billOpen} className="flex-1 justify-between font-normal min-w-0">
                      <span className={`flex items-center gap-2 truncate ${bill ? "" : "text-muted-foreground"}`}>
                        <Receipt className="size-4 shrink-0" />
                        <span className="truncate">
                          {bill
                            ? `${bill.receipt_number ?? "Pending sync"} · ${format(new Date(bill.created_at), "dd MMM yyyy")}${bill.customer_name ? ` · ${bill.customer_name}` : ""}`
                            : "No bill — search by number, customer or phone"}
                        </span>
                      </span>
                      <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-72" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput placeholder="Bill number, customer or phone…" value={billQuery} onValueChange={setBillQuery} />
                      <CommandList>
                        <CommandEmpty>No bill matches.</CommandEmpty>
                        <CommandGroup>
                          {bills.map((b) => (
                            <CommandItem key={b.id} value={b.id} onSelect={() => { setBill(b); setBillOpen(false); }}>
                              <Check className={`size-4 me-2 shrink-0 ${bill?.id === b.id ? "opacity-100" : "opacity-0"}`} />
                              <span className="flex-1 min-w-0 truncate">
                                <span className="font-mono">{b.receipt_number ?? "Pending sync"}</span>
                                <span className="text-muted-foreground"> · {format(new Date(b.created_at), "dd MMM")}{b.customer_name ? ` · ${b.customer_name}` : ""}</span>
                              </span>
                              <span className="ms-2 text-xs tabular-nums">{formatMoney(b.total, currency)}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {bill && (
                  <Button type="button" variant="ghost" size="icon" title="No bill" onClick={() => setBill(null)}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>
              {bill?.customer_name && !customerId && (
                <p className="text-xs text-muted-foreground">The bill&apos;s customer, {bill.customer_name}, goes on the return unless you pick another below.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Customer (optional)</Label>
              {renderCustomer(setCustomerId)}
            </div>
            <div className="space-y-1.5">
              <Label>Deduction</Label>
              <Input type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00" value={deduction} onChange={(e) => setDeduction(e.target.value)} />
            </div>
          </div>

          <AccountPicker value={accountId} onChange={setAccountId} label="Refund from" />

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Items total</span><span className="tabular-nums">{formatMoney(itemsTotal, currency)}</span></div>
            {deductionNum > 0 && (
              <div className="flex justify-between text-destructive"><span>Deduction</span><span className="tabular-nums">−{formatMoney(deductionNum, currency)}</span></div>
            )}
            <div className="flex justify-between text-lg font-bold text-primary pt-1 border-t"><span>Refund to customer</span><span className="tabular-nums">{formatMoney(refund, currency)}</span></div>
          </div>

          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Defective, wrong item, customer changed mind…" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || lines.length === 0}>
            {busy ? "Processing…" : `Refund ${formatMoney(refund, currency)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
