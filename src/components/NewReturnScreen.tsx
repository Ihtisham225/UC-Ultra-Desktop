/**
 * New return — a full page laid out like the till, not a pop-up:
 *
 *   products (search + list) · who & why · what comes back and the money
 *
 * The keyboard path is the till's: search → Enter adds the first match and
 * lands on its quantity → Enter → price → Enter → back to search. Then the
 * right-hand side walks customer → bill → deduction → account → reason →
 * notes, every dropdown taking ONE Enter, and Enter on the notes (or Ctrl/Cmd
 * +Enter anywhere) saves.
 *
 * Everything the web and the terminal do differently comes in as props
 * (products, the customer/supplier pickers, saving, the bill search), so the
 * two apps share this file. ⚠️ COPIED verbatim to the desktop app.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowLeft, Check, ChevronsUpDown, Layers, Receipt, Search, Trash2, Truck, Undo2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountPicker } from "@/components/AccountPicker";
import {
  RefundToToggle,
  type NewReturnInput,
  type NewSupplierReturnInput,
  type ReturnBillOption,
  type ReturnProductOption,
} from "@/components/NewReturnDialog";
import { advanceFrom, focusSoon, focusStep, stepsIn } from "@/lib/checkout-keys";
import { formatMoney } from "@/lib/format";
import { fmtDate } from "@/lib/date-format";

type ReturnKind = "customer" | "supplier";

/** Where each field sits in the right-hand Enter chain. */
const RSTEP = { party: 1, bill: 2, deduction: 3, account: 4, reason: 5, notes: 6 } as const;

/** What a picker needs to take part in the chain. */
export interface ChainProps {
  step: number;
  /** Call once a choice is made and the picker has closed. */
  onPicked: () => void;
}

interface Line {
  key: string;
  option: ReturnProductOption;
  qty: string;
  price: string;
}

const optionKey = (o: ReturnProductOption) => `${o.product_id}:${o.variant_id ?? ""}`;
const SEARCH = '[data-ret="search"]';
const qtySel = (key: string) => `[data-ret-qty="${CSS.escape(key)}"]`;
const priceSel = (key: string) => `[data-ret-price="${CSS.escape(key)}"]`;
const plainEnter = (e: React.KeyboardEvent) =>
  e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing;

export function NewReturnScreen({
  currency, products, renderCustomer, submit, onSaved, searchBills,
  renderSupplier, submitSupplier, onSupplierSaved, onBack, mode = "inline",
}: {
  currency: string;
  products: ReturnProductOption[];
  /** The shop's own customer picker, bound to the id it reports. */
  renderCustomer: (onChange: (customerId: string | null) => void, chain: ChainProps) => ReactNode;
  // One loose shape rather than a union: the terminal compiles without strict
  // mode, where TypeScript won't narrow `{ok:true}|{ok:false}` on `ok`.
  submit: (input: NewReturnInput) => Promise<{ ok: boolean; error?: string; returnId?: string; totalRefund?: number }>;
  /** Called with the saved return's id — the page opens its receipt. */
  onSaved: (returnId: string) => void;
  /** Bills for the optional Bill field — latest first, or matching the search. */
  searchBills?: (query: string) => Promise<ReturnBillOption[]>;
  /** The shop's supplier picker. With `submitSupplier`, turns on the Supplier choice. */
  renderSupplier?: (onChange: (supplierId: string | null) => void, chain: ChainProps) => ReactNode;
  submitSupplier?: (input: NewSupplierReturnInput) => Promise<{ ok: boolean; error?: string; returnId?: string; totalRefund?: number }>;
  onSupplierSaved?: (returnId: string) => void;
  /** Back to the returns list. */
  onBack: () => void;
  /**
   * Per person (Settings → Appearance → Return checkout): the customer and
   * the money on the screen beside the lines, or in a pop-up behind a
   * Checkout button — the same fields and keys either way.
   */
  mode?: "inline" | "popup";
}) {
  const popup = mode === "popup";
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const supplierEnabled = !!renderSupplier && !!submitSupplier;
  const [kind, setKind] = useState<ReturnKind>("customer");
  const toSupplier = kind === "supplier";
  /** Bumped after a save: remounts the pickers so the next return starts clean. */
  const [round, setRound] = useState(0);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toLedger, setToLedger] = useState(false);
  const [deduction, setDeduction] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  /** Customers get back what they paid; a supplier takes goods back at cost. */
  const defaultPrice = (o: ReturnProductOption, k: ReturnKind) =>
    k === "supplier" && o.cost != null ? o.cost : o.price;

  // ─── The optional bill ────────────────────────────────────────────────────
  const [bill, setBill] = useState<ReturnBillOption | null>(null);
  const [billOpen, setBillOpen] = useState(false);
  const [billQuery, setBillQuery] = useState("");
  const [bills, setBills] = useState<ReturnBillOption[]>([]);
  const billPickedRef = useRef(false);
  useEffect(() => {
    if (!billOpen || !searchBills) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchBills(billQuery).then((r) => { if (!cancelled) setBills(r); }).catch(() => {});
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [billOpen, billQuery, searchBills]);
  const chooseBill = (b: ReturnBillOption | null) => {
    setBill(b);
    billPickedRef.current = true;
    setBillOpen(false);
  };

  // ─── The Enter chain on the right-hand side ───────────────────────────────
  const rightRef = useRef<HTMLDivElement>(null);
  const advance = (from: Element) => {
    if (!advanceFrom(from, rightRef.current ?? document)) void save();
  };
  const advanceFromStep = (step: number) =>
    requestAnimationFrame(() => {
      const el = rightRef.current?.querySelector(`[data-checkout-step="${step}"]`);
      if (el) advance(el);
    });
  const enterAdvances = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!plainEnter(e)) return;
    e.preventDefault();
    advance(e.currentTarget);
  };
  const chain = (step: number): ChainProps => ({ step, onPicked: () => advanceFromStep(step) });

  // ─── Products ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return products;
    return products.filter((o) => {
      const hay = `${o.name} ${o.barcode ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [products, search]);

  const addProduct = (o: ReturnProductOption) => {
    const k = optionKey(o);
    setLines((ls) => {
      const found = ls.find((l) => l.key === k);
      if (found) return ls.map((l) => (l.key === k ? { ...l, qty: String((parseFloat(l.qty) || 0) + 1) } : l));
      return [...ls, { key: k, option: o, qty: "1", price: String(defaultPrice(o, kind)) }];
    });
    setSearch("");
    // Straight to how many, so the counter never reaches for the mouse.
    focusSoon(qtySel(k));
  };

  const setLine = (key: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) => {
    setLines((ls) => ls.filter((l) => l.key !== key));
    focusSoon(SEARCH);
  };

  /** Switching sides re-prices the lines: sale price for a customer, cost for a supplier. */
  const switchKind = (k: ReturnKind) => {
    if (k === kind) return;
    setKind(k);
    setToLedger(false);
    setLines((ls) => ls.map((l) => ({ ...l, price: String(defaultPrice(l.option, k)) })));
  };

  // The ledger option needs someone's ledger: a picked customer, or the bill's
  // — or, going back to a supplier, that supplier.
  const canLedger = toSupplier ? !!supplierId : !!customerId || !!bill?.customer_id;
  /** The ledger choice only counts while there is a ledger to put it on. */
  const ledgerOn = toLedger && canLedger;

  const itemsTotal = useMemo(
    () => lines.reduce((a, l) => a + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0),
    [lines],
  );
  const deductionNum = toSupplier ? 0 : Math.min(Math.max(parseFloat(deduction) || 0, 0), itemsTotal);
  const refund = Math.round((itemsTotal - deductionNum) * 100) / 100;

  const reset = () => {
    setLines([]); setCustomerId(null); setSupplierId(null); setDeduction(""); setReason(""); setNotes("");
    setBill(null); setBillQuery(""); setToLedger(false); setSearch("");
    setRound((r) => r + 1);
    setCheckoutOpen(false);
    focusSoon(SEARCH);
  };

  const save = async () => {
    if (busyRef.current) return;
    const valid = lines
      .map((l) => ({ l, qty: parseFloat(l.qty), price: parseFloat(l.price) }))
      .filter((x) => x.qty > 0);
    if (valid.length === 0) {
      toast.error("Add at least one product being returned");
      return focusSoon(SEARCH);
    }
    if (valid.some((x) => !Number.isFinite(x.price) || x.price < 0)) return toast.error("Every line needs a price");
    if (toSupplier && (!supplierId || !submitSupplier)) return toast.error("Choose the supplier the goods are going back to");
    if (!toSupplier && ledgerOn && !customerId && !bill?.customer_id) {
      return toast.error("Choose the customer (or a bill with a customer) whose ledger gets the refund");
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (toSupplier) {
        const res = await submitSupplier!({
          supplierId: supplierId!,
          toLedger: ledgerOn,
          accountId,
          reason: reason.trim() || null,
          notes: notes.trim() || null,
          lines: valid.map(({ l, qty, price }) => ({
            product_id: l.option.product_id,
            variant_id: l.option.variant_id,
            product_name: l.option.name,
            quantity: qty,
            unit_cost: price,
          })),
        });
        if (!res.ok || !res.returnId) return toast.error(res.error ?? "Couldn't save the return");
        toast.success(
          ledgerOn
            ? `${formatMoney(res.totalRefund ?? refund, currency)} taken off the supplier's ledger — stock reduced`
            : `Returned to supplier — ${formatMoney(res.totalRefund ?? refund, currency)} refund recorded, stock reduced`,
        );
        reset();
        onSupplierSaved?.(res.returnId);
        return;
      }
      const res = await submit({
        toLedger: ledgerOn,
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
      reset();
      onSaved(res.returnId);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** Ctrl/Cmd+Enter saves from anywhere — but never from inside an open list. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || e.isComposing) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("[cmdk-root], [role='listbox']")) return;
      // Inside a dialog only when it is the checkout pop-up itself.
      const dialog = target?.closest?.("[role='dialog']");
      if (dialog && dialog !== rightRef.current) return;
      e.preventDefault();
      if (popup && !checkoutOpen) {
        if (lines.length > 0) setCheckoutOpen(true);
        return;
      }
      void save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const saveLabel = busy
    ? "Processing…"
    : toSupplier
      ? `Return to supplier · ${formatMoney(refund, currency)}`
      : `Refund ${formatMoney(refund, currency)}`;

  // ─── The pieces, built once and placed by either layout ───────────────────
  const productsColumn = (
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-2 mb-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={onBack} title="Back to returns">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="font-semibold flex items-center gap-2 min-w-0">
            <Undo2 className="size-4 text-primary shrink-0" /> <span className="truncate">New return</span>
          </div>
        </div>
        <div className="mb-3">
          <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            data-ret="search"
            placeholder="Search or scan a product"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (!plainEnter(e)) return;
              e.preventDefault();
              const code = search.trim();
              // Nothing typed: the products are in — on to the customer.
              if (!code) {
                if (popup) {
                  if (lines.length > 0) setCheckoutOpen(true);
                  return;
                }
                const first = rightRef.current ? stepsIn(rightRef.current)[0] : null;
                if (first) focusStep(first);
                return;
              }
              const exact = products.find((o) => o.barcode && o.barcode === code);
              const pick = exact ?? filtered[0];
              if (pick) addProduct(pick);
            }}
            className="ps-9 h-11"
          />
          </div>
          <p className="mt-1 px-1 text-[11px] text-muted-foreground">Enter on an empty search → {popup ? "checkout" : "customer"}</p>
        </div>
        <div className="md:flex-1 md:overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No product matches.</Card>
          ) : (
            // Cards, like the till's product grid — as many across as fit at a
            // readable width, so names wrap inside the card instead of escaping it.
            <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
              {filtered.map((o, i) => {
                const added = lines.some((l) => l.key === optionKey(o));
                const next = !!search && i === 0;
                return (
                  <button
                    key={optionKey(o)}
                    type="button"
                    onClick={() => addProduct(o)}
                    className={`min-w-0 text-start p-3 rounded-xl border bg-card hover:border-primary hover:shadow-card transition-all group relative ${next ? "border-primary ring-1 ring-primary/40" : ""}`}
                  >
                    {(o.variant_id || added || next) && (
                      <span className="absolute top-2 end-2 inline-flex items-center gap-1">
                        {next && <kbd className="rounded border bg-card px-1 text-[10px] text-muted-foreground">Enter</kbd>}
                        {o.variant_id && <Layers className="size-3.5 text-primary" />}
                        {added && <Check className="size-3.5 text-success" />}
                      </span>
                    )}
                    <div className={`font-semibold text-sm leading-snug [overflow-wrap:anywhere] group-hover:text-primary ${o.variant_id || added || next ? "pe-10" : ""}`}>{o.name}</div>
                    <div className="text-lg font-bold mt-2 tabular-nums break-words">{formatMoney(defaultPrice(o, kind), currency)}</div>
                    {toSupplier && (
                      <div className="text-xs mt-0.5 text-muted-foreground">{o.cost != null ? "Cost" : "Price (no cost yet)"}</div>
                    )}
                    {o.unit && !toSupplier && <div className="text-xs mt-0.5 text-muted-foreground">per {o.unit}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );

  /** Who it's from, the bill, and why — the right-hand chain's first steps. */
  const whoSection = (
    <>
            {supplierEnabled && (
              <div className="grid grid-cols-2 gap-2">
                {(["customer", "supplier"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => switchKind(k)}
                    className={`rounded-md border px-2 py-2 text-xs leading-tight transition-colors ${kind === k ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted/50"}`}
                  >
                    {k === "customer" ? "From a customer" : "To a supplier"}
                    <span className="block text-[10px] font-normal text-muted-foreground">
                      {k === "customer" ? "goods come back in" : "goods go back out"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Fragment key={`${kind}-${round}`}>
              {toSupplier ? (
                <div className="space-y-1.5">
                  <Label>Supplier</Label>
                  {renderSupplier?.(setSupplierId, chain(RSTEP.party))}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Customer (optional)</Label>
                  {renderCustomer(setCustomerId, chain(RSTEP.party))}
                </div>
              )}
            </Fragment>

            {searchBills && !toSupplier && (
              <div className="space-y-1.5">
                <Label>Bill (optional)</Label>
                <div className="flex gap-2">
                  <Popover open={billOpen} onOpenChange={(o) => { setBillOpen(o); if (o) setBillQuery(""); }}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={billOpen}
                        data-checkout-step={RSTEP.bill}
                        data-checkout-picker=""
                        className="flex-1 justify-between font-normal min-w-0"
                      >
                        <span className={`flex items-center gap-2 truncate ${bill ? "" : "text-muted-foreground"}`}>
                          <Receipt className="size-4 shrink-0" />
                          <span className="truncate">
                            {bill
                              ? `${bill.receipt_number ?? "Pending sync"} · ${fmtDate(bill.created_at)}`
                              : "No bill"}
                          </span>
                        </span>
                        <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="p-0 w-[--radix-popover-trigger-width] min-w-72"
                      align="start"
                      onCloseAutoFocus={(e) => {
                        if (!billPickedRef.current) return;
                        billPickedRef.current = false;
                        e.preventDefault();
                        advanceFromStep(RSTEP.bill);
                      }}
                    >
                      {/* Highlight starts on the current choice ("No bill" by
                          default), so Enter past the field keeps it. */}
                      <Command shouldFilter={false} defaultValue={bill?.id ?? "__none"}>
                        <CommandInput placeholder="Bill number, customer or phone…" value={billQuery} onValueChange={setBillQuery} />
                        <CommandList>
                          <CommandEmpty>No bill matches.</CommandEmpty>
                          <CommandGroup>
                            {!billQuery.trim() && (
                              <CommandItem value="__none" onSelect={() => chooseBill(null)}>
                                <Check className={`size-4 me-2 shrink-0 ${bill ? "opacity-0" : "opacity-100"}`} />
                                <span className="text-muted-foreground">No bill</span>
                              </CommandItem>
                            )}
                            {bills.map((b) => (
                              <CommandItem key={b.id} value={b.id} onSelect={() => chooseBill(b)}>
                                <Check className={`size-4 me-2 shrink-0 ${bill?.id === b.id ? "opacity-100" : "opacity-0"}`} />
                                <span className="flex-1 min-w-0 truncate">
                                  <span className="font-mono">{b.receipt_number ?? "Pending sync"}</span>
                                  <span className="text-muted-foreground"> · {fmtDate(b.created_at)}{b.customer_name ? ` · ${b.customer_name}` : ""}</span>
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
                  <p className="text-xs text-muted-foreground">The bill&apos;s customer, {bill.customer_name}, goes on the return unless you pick another above.</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                data-checkout-step={RSTEP.reason}
                onKeyDown={enterAdvances}
                placeholder={toSupplier ? "Defective, expired, wrong item sent…" : "Defective, wrong item, changed mind…"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-checkout-step={RSTEP.notes}
                // The end of the chain: Enter here saves the return.
                onKeyDown={(e) => {
                  if (!plainEnter(e)) return;
                  e.preventDefault();
                  void save();
                }}
              />
            </div>
    </>
  );

  const linesList = (
    <>
            {lines.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
                Search or scan the products being returned.
              </div>
            ) : (
              <ul className="space-y-1">
                {lines.map((l) => {
                  const lineTotal = (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0);
                  return (
                    <li key={l.key} className="p-3 rounded-lg hover:bg-muted/40">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm min-w-0 flex-1 break-words">{l.option.name}</div>
                        <div className="font-semibold tabular-nums">{formatMoney(lineTotal, currency)}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-muted-foreground">Qty</span>
                        <Input
                          type="number" inputMode="decimal" min="0" step="any"
                          aria-label={`Quantity of ${l.option.name}`}
                          data-ret-qty={l.key}
                          value={l.qty}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setLine(l.key, { qty: e.target.value })}
                          onKeyDown={(e) => {
                            if (!plainEnter(e)) return;
                            e.preventDefault();
                            focusSoon(priceSel(l.key));
                          }}
                          className="h-8 w-20 text-center tabular-nums"
                        />
                        {l.option.unit && <span className="text-[11px] text-muted-foreground">{l.option.unit}</span>}
                        <span className="ms-auto text-[10px] text-muted-foreground">{toSupplier ? "Cost" : "Price"}</span>
                        <Input
                          type="number" inputMode="decimal" min="0" step="0.01"
                          aria-label={`Price of ${l.option.name}`}
                          data-ret-price={l.key}
                          value={l.price}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setLine(l.key, { price: e.target.value })}
                          onKeyDown={(e) => {
                            if (!plainEnter(e)) return;
                            e.preventDefault();
                            focusSoon(SEARCH);
                          }}
                          className="h-8 w-24 text-end tabular-nums"
                        />
                        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => removeLine(l.key)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
    </>
  );

  /** Deduction, where the refund goes, and the totals. */
  const moneySection = (
    <>
            {!toSupplier && (
              <div className="flex items-center gap-2">
                <Label className="shrink-0 w-24">Deduction</Label>
                <Input
                  type="number" inputMode="decimal" min="0" step="0.01" placeholder="0.00"
                  value={deduction}
                  onChange={(e) => setDeduction(e.target.value)}
                  data-checkout-step={RSTEP.deduction}
                  onKeyDown={enterAdvances}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9"
                />
              </div>
            )}

            <RefundToToggle
              toLedger={ledgerOn}
              onChange={setToLedger}
              label={toSupplier ? "Supplier settles by" : "Refund to"}
              ledgerLabel={toSupplier ? "Supplier's ledger" : "Customer's ledger"}
              ledgerDisabledReason={canLedger ? null : toSupplier
                ? "Choose the supplier to take it off their ledger."
                : "Choose a customer (or a bill with a customer) to put the refund on their ledger."}
            />
            {ledgerOn ? (
              <p className="text-xs text-muted-foreground">
                {toSupplier
                  ? "No money changes hands: the amount comes off what the shop owes this supplier, and anything beyond that is a balance they owe the shop."
                  : "Nothing leaves the till: the amount comes off what the customer owes, and anything beyond that is a balance the shop owes them."}
              </p>
            ) : (
              <AccountPicker
                value={accountId}
                onChange={setAccountId}
                label={toSupplier ? "Refund into" : "Refund from"}
                step={RSTEP.account}
                onAdvance={() => advanceFromStep(RSTEP.account)}
              />
            )}

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Items total</span><span className="tabular-nums">{formatMoney(itemsTotal, currency)}</span></div>
              {deductionNum > 0 && (
                <div className="flex justify-between text-destructive"><span>Deduction</span><span className="tabular-nums">−{formatMoney(deductionNum, currency)}</span></div>
              )}
              <div className="flex justify-between text-lg font-bold pt-1 border-t">
                <span>{toSupplier ? (ledgerOn ? "Off their ledger" : "Supplier refunds you") : "Refund to customer"}</span>
                <span className="tabular-nums text-primary">{formatMoney(refund, currency)}</span>
              </div>
            </div>
    </>
  );

  const saveButton = (
            <Button
              disabled={busy || lines.length === 0}
              onClick={() => void save()}
              size="lg"
              className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground h-14 text-base font-semibold shadow-glow"
            >
              {saveLabel}
              {!busy && (
                <kbd className="ms-2 rounded border border-white/40 px-1 text-[10px] font-medium text-white/80">Ctrl+Enter</kbd>
              )}
            </Button>
  );

  if (popup) {
    return (
      <div className="mx-auto grid gap-4 md:grid-cols-[minmax(0,1fr)_400px] lg:grid-cols-[minmax(0,1fr)_440px] md:h-[calc(100vh-9rem)] md:min-h-[620px]">
        <h1 className="sr-only">New return</h1>
        {productsColumn}

        <Card className="flex flex-col min-h-0 overflow-hidden shadow-elevated">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <Undo2 className="size-4" /> {toSupplier ? "Going back" : "Coming back"}
            </div>
            {lines.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setLines([]); focusSoon(SEARCH); }}>
                <Trash2 className="size-4 me-1" /> Clear
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 min-h-[160px]">
            {linesList}
          </div>
          <div className="border-t p-4 space-y-1 text-sm shrink-0">
            <div className="flex justify-between text-lg font-bold">
              <span>{toSupplier ? "Value going back" : "Refund"}</span>
              <span className="tabular-nums text-primary">{formatMoney(refund, currency)}</span>
            </div>
          </div>
          <div className="p-4 pt-3 shrink-0 border-t bg-card">
            <Button
              disabled={lines.length === 0 || busy}
              onClick={() => setCheckoutOpen(true)}
              size="lg"
              className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground h-14 text-base font-semibold shadow-glow"
            >
              Checkout
              <kbd className="ms-2 rounded border border-white/40 px-1 text-[10px] font-medium text-white/80">Ctrl+Enter</kbd>
            </Button>
          </div>
        </Card>

        <Dialog open={checkoutOpen} onOpenChange={(o) => { if (!busy) setCheckoutOpen(o); }}>
          <DialogContent
            ref={rightRef}
            // Its own numbered Enter chain (lib/checkout-keys), like the till's.
            data-enter-chain="off"
            className="sm:max-w-3xl max-h-[92vh] overflow-y-auto"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              requestAnimationFrame(() => {
                const first = rightRef.current ? stepsIn(rightRef.current)[0] : null;
                if (first) focusStep(first);
              });
            }}
            onCloseAutoFocus={(e) => { e.preventDefault(); focusSoon(SEARCH); }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-baseline justify-between gap-4 pe-6">
                <span>{toSupplier ? "Return to supplier" : "Refund"}</span>
                <span className="tabular-nums text-primary">{formatMoney(refund, currency)}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 items-start">
              <div className="space-y-4 min-w-0">{whoSection}</div>
              <div className="space-y-3 min-w-0">{moneySection}</div>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setCheckoutOpen(false)} disabled={busy}>Cancel</Button>
              <Button
                disabled={busy || lines.length === 0}
                onClick={() => void save()}
                className="bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold"
              >
                {saveLabel}
                {!busy && (
                  <kbd className="ms-2 rounded border border-white/40 px-1 text-[10px] font-medium text-white/80">Ctrl+Enter</kbd>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="mx-auto grid gap-4 md:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[250px_320px_minmax(0,1fr)] 2xl:grid-cols-[300px_380px_minmax(0,1fr)] md:h-[calc(100vh-9rem)] md:min-h-[620px]">
      <h1 className="sr-only">New return</h1>

      {/* 1 · Products */}
      {productsColumn}

      {/* 2 + 3 share one scope for the Enter chain, and stack below xl. */}
      <div ref={rightRef} className="grid gap-4 min-h-0 content-start md:overflow-y-auto xl:contents">
        {/* 2 · Who it's from, and why */}
        <Card className="flex flex-col min-h-0 overflow-hidden">
          <div className="p-4 border-b bg-muted/30 font-semibold flex items-center gap-2">
            {toSupplier ? <Truck className="size-4" /> : <UserRound className="size-4" />}
            {toSupplier ? "Supplier" : "Customer"} &amp; reason
          </div>
          <div className="p-4 space-y-4 xl:overflow-y-auto xl:flex-1">
            {whoSection}
          </div>
        </Card>

        {/* 3 · What comes back, and the money */}
        <Card className="flex flex-col min-h-0 xl:overflow-hidden shadow-elevated">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2">
              <Undo2 className="size-4" /> {toSupplier ? "Going back" : "Coming back"}
            </div>
            {lines.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setLines([]); focusSoon(SEARCH); }}>
                <Trash2 className="size-4 me-1" /> Clear
              </Button>
            )}
          </div>

          <div className="xl:flex-1 overflow-y-auto p-2 min-h-[140px] max-h-[45vh] xl:max-h-none">
            {linesList}
          </div>

          <div className="border-t p-4 space-y-3 shrink-0 xl:max-h-[60%] xl:overflow-y-auto">
            {moneySection}
          </div>

          <div className="p-4 pt-3 shrink-0 border-t bg-card rounded-b-lg sticky bottom-0 z-10 xl:static">
            {saveButton}
          </div>
        </Card>
      </div>
    </div>
  );
}
