import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { BookOpen, Plus, Trash2, Edit2, Download, HandCoins, X, Paperclip, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { downloadCsv } from "@/lib/csv";
import { AttachmentsField, AttachmentsDialog, uploadPendingAttachments } from "@/components/AttachmentsField";
import { PartyStatementPrintDialog } from "@/components/PartyStatementPrintDialog";
import { isMaterialSupplier } from "@/lib/handicraft";
import { rpc } from "@/lib/apiClient";
import type {
  PartyOption,
  MaterialPurchaseDto,
  PartyPaymentDto,
  LedgerResult,
  LedgerRow,
} from "@/lib/handicraftTypes";

const ALL = "all";

type ItemDraft = {
  colour: string;
  act: string;
  bags: string;
  pounds: string;
  rate: string;
  amount: string;
  /** Typed over by hand, so pounds × rate stops overwriting it. */
  amountEdited: boolean;
};

type PurchaseDraft = {
  id: string | null;
  supplier_id: string;
  date: string;
  book_number: string;
  city: string;
  bilty_number: string;
  received_by: string;
  notes: string;
  items: ItemDraft[];
};

type PaymentDraft = {
  id: string | null;
  supplier_id: string;
  date: string;
  amount: string;
  method: string;
  reference: string;
  note: string;
};

const emptyItem = (): ItemDraft => ({ colour: "", act: "", bags: "", pounds: "", rate: "", amount: "", amountEdited: false });

const num = (s: string) => (s.trim() === "" ? 0 : Number(s)) || 0;

const emptyLedger: LedgerResult = {
  rows: [], opening: 0, debit_total: 0, purchase_total: 0, job_work_total: 0, credit_total: 0, closing: 0,
};

export default function MaterialPurchases() {
  const [searchParams] = useSearchParams();
  const { currentShop } = useShop();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canManage = perms.canManagePurchases;
  const currency = currentShop?.currency ?? "PKR";

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [ledger, setLedger] = useState<LedgerResult>(emptyLedger);
  const [purchases, setPurchases] = useState<MaterialPurchaseDto[]>([]);
  const [payments, setPayments] = useState<PartyPaymentDto[]>([]);
  const [loading, setLoading] = useState(true);

  // ?party=… comes from the Parties page, so "open register" lands on that
  // party's own statement.
  const [party, setParty] = useState<string>(searchParams.get("party") ?? ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [purchaseDraft, setPurchaseDraft] = useState<PurchaseDraft | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  // Photos chosen before the record exists, uploaded once it has an id.
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [viewing, setViewing] = useState<
    { type: "material_purchase" | "party_payment"; id: string; title: string } | null
  >(null);
  const [printing, setPrinting] = useState(false);

  // Today is read after mount: a date in a useState initializer renders
  // differently on the server and hydrates with a mismatch.
  const [today, setToday] = useState("");
  useEffect(() => { setToday(format(new Date(), "yyyy-MM-dd")); }, []);

  const filters = useMemo(
    () => ({ from: from || null, to: to || null, supplier_id: party === ALL ? null : party }),
    [from, to, party],
  );

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [p, l, pur, pay] = await Promise.all([
        rpc<PartyOption[]>("listPartyOptionsAction"),
        rpc<LedgerResult>("loadRegisterAction", filters),
        rpc<MaterialPurchaseDto[]>("listMaterialPurchasesAction", filters),
        rpc<PartyPaymentDto[]>("listPartyPaymentsAction", filters),
      ]);
      setParties(p);
      setLedger(l);
      setPurchases(pur);
      setPayments(pay);
      const [purchasePhotos, paymentPhotos] = await Promise.all([
        rpc<Record<string, number>>("countAttachmentsAction", "material_purchase", pur.map((x) => x.id)),
        rpc<Record<string, number>>("countAttachmentsAction", "party_payment", pay.map((x) => x.id)),
      ]);
      setPhotoCounts({ ...purchasePhotos, ...paymentPhotos });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load the register");
    }
    setLoading(false);
  }, [currentShop, filters]);

  useEffect(() => { load(); }, [load]);

  const partyName = (id: string | null) => parties.find((p) => p.id === id)?.name ?? "—";
  // Material comes from suppliers; a pure processing company never sells yarn,
  // so it stays out of the purchase form. Payments still list everyone.
  const materialSuppliers = parties.filter(isMaterialSupplier);

  const registerPages = usePagination(ledger.rows, {
    key: "material-register",
    defaultSize: 50,
    resetDeps: [party, from, to, ledger.rows.length],
  });
  const purchasePages = usePagination(purchases, {
    key: "material-purchases",
    defaultSize: 20,
    resetDeps: [party, from, to, purchases.length],
  });
  const paymentPages = usePagination(payments, {
    key: "party-payments",
    defaultSize: 20,
    resetDeps: [party, from, to, payments.length],
  });

  // ---------------------------------------------------------- purchases

  const newPurchase = () => {
    setPendingPhotos([]);
    setPurchaseDraft({
      id: null,
      supplier_id: party === ALL ? "" : party,
      date: today,
      book_number: "",
      city: "",
      bilty_number: "",
      received_by: "",
      notes: "",
      items: [emptyItem()],
    });
  };

  const editPurchase = (p: MaterialPurchaseDto) => {
    setPendingPhotos([]);
    setPurchaseDraft({
      id: p.id,
      supplier_id: p.supplier_id ?? "",
      date: p.date,
      book_number: p.book_number ?? "",
      city: p.city ?? "",
      bilty_number: p.bilty_number ?? "",
      received_by: p.received_by ?? "",
      notes: p.notes ?? "",
      items: p.items.length
        ? p.items.map((it) => ({
            colour: it.colour ?? "",
            act: it.act ?? "",
            bags: String(it.bags || ""),
            pounds: String(it.pounds || ""),
            rate: String(it.rate || ""),
            amount: String(it.amount || ""),
            amountEdited: true,
          }))
        : [emptyItem()],
    });
  };

  /** Amount follows pounds × rate until someone types over it. */
  const setItem = (index: number, patch: Partial<ItemDraft>) => {
    setPurchaseDraft((d) => {
      if (!d) return d;
      const items = d.items.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        const touchedMaths = patch.pounds !== undefined || patch.rate !== undefined;
        if (patch.amount !== undefined) next.amountEdited = true;
        if (touchedMaths) {
          next.amount = String(Number((num(next.pounds) * num(next.rate)).toFixed(2)) || "");
          next.amountEdited = false;
        }
        return next;
      });
      return { ...d, items };
    });
  };

  const purchaseTotal = purchaseDraft?.items.reduce((s, it) => s + num(it.amount), 0) ?? 0;

  const savePurchase = async () => {
    if (!purchaseDraft) return;
    if (!purchaseDraft.supplier_id) return toast.error("Choose the party this was bought from.");
    if (!purchaseDraft.date) return toast.error("Pick a date.");
    const items = purchaseDraft.items.filter(
      (it) => it.colour.trim() || it.act.trim() || num(it.pounds) || num(it.bags) || num(it.amount),
    );
    if (items.length === 0) return toast.error("Add at least one goods line.");

    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string; id?: string; number?: number }>(
      "saveMaterialPurchaseAction",
      purchaseDraft.id,
      {
      supplier_id: purchaseDraft.supplier_id,
      date: purchaseDraft.date,
      book_number: purchaseDraft.book_number || null,
      city: purchaseDraft.city || null,
      bilty_number: purchaseDraft.bilty_number || null,
      received_by: purchaseDraft.received_by || null,
      notes: purchaseDraft.notes || null,
      items: items.map((it) => ({
        colour: it.colour || null,
        act: it.act || null,
        bags: num(it.bags),
        pounds: num(it.pounds),
        rate: num(it.rate),
        amount: num(it.amount),
      })),
      },
    );
    if (result.ok && pendingPhotos.length > 0) {
      try {
        await uploadPendingAttachments("material_purchase", result.id, pendingPhotos);
      } catch (e) {
        // The purchase itself is saved — say what didn't make it, don't lose it.
        toast.error(e instanceof Error ? e.message : "Photos could not be attached");
      }
    }
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success(purchaseDraft.id ? "Purchase updated" : `Purchase #${result.number} saved`);
    setPendingPhotos([]);
    setPurchaseDraft(null);
    load();
  };

  const removePurchase = async (p: MaterialPurchaseDto) => {
    const ok = await confirm({
      title: `Delete purchase #${p.number}?`,
      description: `${p.supplier_name} · ${formatMoney(p.total, currency)}. This also removes it from the party's balance.`,
      variant: "destructive",
    });
    if (!ok) return;
    const result = await rpc<{ ok: boolean; error?: string }>("deleteMaterialPurchaseAction", p.id);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success("Purchase deleted");
    load();
  };

  // ----------------------------------------------------------- payments

  const newPayment = () => {
    setPendingPhotos([]);
    setPaymentDraft({
      id: null,
      supplier_id: party === ALL ? "" : party,
      date: today,
      amount: "",
      method: "Cash",
      reference: "",
      note: "",
    });
  };

  const editPayment = (p: PartyPaymentDto) => {
    setPendingPhotos([]);
    setPaymentDraft({
      id: p.id,
      supplier_id: p.supplier_id,
      date: p.date,
      amount: String(p.amount),
      method: p.method,
      reference: p.reference ?? "",
      note: p.note ?? "",
    });
  };

  const savePayment = async () => {
    if (!paymentDraft) return;
    if (!paymentDraft.supplier_id) return toast.error("Choose the party you paid.");
    if (num(paymentDraft.amount) <= 0) return toast.error("Enter the amount paid.");

    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string; id?: string }>(
      "savePartyPaymentAction",
      paymentDraft.id,
      {
      supplier_id: paymentDraft.supplier_id,
      date: paymentDraft.date,
      amount: num(paymentDraft.amount),
      method: paymentDraft.method.trim() || "Cash",
      reference: paymentDraft.reference || null,
      note: paymentDraft.note || null,
      },
    );
    if (result.ok && pendingPhotos.length > 0) {
      try {
        await uploadPendingAttachments("party_payment", result.id, pendingPhotos);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Photos could not be attached");
      }
    }
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success(paymentDraft.id ? "Payment updated" : "Payment recorded");
    setPendingPhotos([]);
    setPaymentDraft(null);
    load();
  };

  const removePayment = async (p: PartyPaymentDto) => {
    const ok = await confirm({
      title: "Delete this payment?",
      description: `${p.supplier_name} · ${formatMoney(p.amount, currency)} on ${p.date}.`,
      variant: "destructive",
    });
    if (!ok) return;
    const result = await rpc<{ ok: boolean; error?: string }>("deletePartyPaymentAction", p.id);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success("Payment deleted");
    load();
  };

  const addParty = async (target: "purchase" | "payment") => {
    const name = newPartyName.trim();
    if (!name) return;
    const result = await rpc<{ ok: boolean; error?: string; party?: PartyOption }>("quickAddPartyAction", name);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    setParties((prev) => [...prev, result.party].sort((a, b) => a.name.localeCompare(b.name)));
    if (target === "purchase") setPurchaseDraft((d) => (d ? { ...d, supplier_id: result.party.id } : d));
    else setPaymentDraft((d) => (d ? { ...d, supplier_id: result.party.id } : d));
    setNewPartyName("");
    toast.success(`${result.party.name} added`);
  };

  const exportRegister = () => {
    if (ledger.rows.length === 0) return toast.error("Nothing to export.");
    downloadCsv(`register-${format(new Date(), "yyyy-MM-dd")}`, ledger.rows, [
      { header: "Date", value: (r: LedgerRow) => r.date },
      { header: "Name", value: (r: LedgerRow) => r.supplier_name },
      { header: "City", value: (r: LedgerRow) => r.city ?? "" },
      { header: "Bilty", value: (r: LedgerRow) => r.bilty_number ?? r.reference ?? "" },
      { header: "Detail", value: (r: LedgerRow) => r.label ?? "" },
      { header: "Colour", value: (r: LedgerRow) => r.colour ?? "" },
      { header: "Act", value: (r: LedgerRow) => r.act ?? "" },
      { header: "Bags", value: (r: LedgerRow) => (r.bags ? String(r.bags) : "") },
      { header: "Pounds", value: (r: LedgerRow) => (r.pounds ? String(r.pounds) : "") },
      { header: "Rate", value: (r: LedgerRow) => (r.rate ? String(r.rate) : "") },
      { header: "Amount", value: (r: LedgerRow) => (r.debit ? String(r.debit) : "") },
      { header: "Received", value: (r: LedgerRow) => (r.credit ? String(r.credit) : "") },
      { header: "Balance", value: (r: LedgerRow) => String(r.balance) },
    ]);
    toast.success(`Exported ${ledger.rows.length} rows`);
  };

  const openLedgerRow = (r: LedgerRow) => {
    if (!canManage) return;
    if (r.kind === "purchase") {
      const p = purchases.find((x) => x.id === r.id);
      if (p) editPurchase(p);
    } else if (r.kind === "payment") {
      const p = payments.find((x) => x.id === r.id);
      if (p) editPayment(p);
    }
  };

  const partyLabel = party === ALL ? "All parties" : partyName(party);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="size-7 text-primary" /> Purchase register
          </h1>
          <p className="text-muted-foreground mt-1">
            Material bought and money paid, with the balance running down the page — {partyLabel}.
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={newPayment}>
              <HandCoins className="size-4 mr-2" /> Record payment
            </Button>
            <Button onClick={newPurchase} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Plus className="size-4 mr-2" /> Add purchase
            </Button>
          </div>
        )}
      </header>

      <Card className="shadow-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Party</Label>
            <Select value={party} onValueChange={setParty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All parties</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.city ? ` — ${p.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            {(from || to || party !== ALL) && (
              <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setParty(ALL); }}>
                <X className="size-4 mr-1.5" /> Clear
              </Button>
            )}
            <Button variant="outline" onClick={() => setPrinting(true)} className="ms-auto">
              <Printer className="size-4 mr-1.5" /> Print
            </Button>
            <Button variant="outline" onClick={exportRegister}>
              <Download className="size-4 mr-1.5" /> CSV
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Opening balance", value: ledger.opening, hint: "سابقہ رقم — carried in" },
          { label: "Purchases", value: ledger.purchase_total, hint: `${purchases.length} bill${purchases.length === 1 ? "" : "s"}` },
          { label: "Job work", value: ledger.job_work_total, hint: "Billed by the factories" },
          { label: "Paid", value: ledger.credit_total, hint: `${payments.length} payment${payments.length === 1 ? "" : "s"}` },
          { label: "Balance", value: ledger.closing, hint: "Owed to the parties", strong: true },
        ].map((c) => (
          <Card key={c.label} className={`shadow-card p-4 ${c.strong ? "border-primary/40" : ""}`}>
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className={`text-xl font-bold mt-1 ${c.strong ? "text-primary" : ""}`}>{formatMoney(c.value, currency)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="register" className="space-y-4">
        <TabsList>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>

        {/* The sheet, reproduced: goods lines and payments in one running column. */}
        <TabsContent value="register">
          <Card className="shadow-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">Loading…</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">SR</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Bilty</TableHead>
                        <TableHead>Colour</TableHead>
                        <TableHead>Act</TableHead>
                        <TableHead className="text-end">Bags</TableHead>
                        <TableHead className="text-end">Pounds</TableHead>
                        <TableHead className="text-end">Rate</TableHead>
                        <TableHead className="text-end">Amount</TableHead>
                        <TableHead className="text-end">Received</TableHead>
                        <TableHead className="text-end">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="bg-muted/40">
                        <TableCell />
                        <TableCell colSpan={9} className="font-medium">
                          Opening balance <span className="text-muted-foreground" dir="rtl">سابقہ رقم</span>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell className="text-end font-semibold">{formatMoney(ledger.opening, currency)}</TableCell>
                      </TableRow>

                      {ledger.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center text-muted-foreground py-10">
                            Nothing recorded yet. Add a purchase to start the register.
                          </TableCell>
                        </TableRow>
                      ) : (
                        registerPages.visible.map((r, i) => (
                          <TableRow
                            key={`${r.kind}-${r.id}-${r.itemId ?? i}`}
                            className={`${r.kind === "payment" ? "bg-success/5" : r.kind === "job_work" ? "bg-amber-500/5" : ""} ${canManage && r.kind !== "job_work" ? "cursor-pointer" : ""}`}
                            onClick={() => openLedgerRow(r)}
                          >
                            <TableCell className="text-muted-foreground text-xs">
                              {(registerPages.page - 1) * registerPages.pageSize + i + 1}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                            <TableCell className="font-medium">{r.supplier_name}</TableCell>
                            {r.kind !== "purchase" ? (
                              /* Their sheet writes the bank, the TID and the
                                 account across the goods columns — same here,
                                 and job-work bills read the same way. */
                              <TableCell colSpan={7} className="text-muted-foreground">
                                {[r.label, r.method, r.reference, r.note].filter(Boolean).join(" · ")}
                              </TableCell>
                            ) : (
                              <>
                                <TableCell>{r.city ?? ""}</TableCell>
                                <TableCell>{r.bilty_number ?? ""}</TableCell>
                                <TableCell>{r.colour ?? ""}</TableCell>
                                <TableCell>{r.act ?? ""}</TableCell>
                                <TableCell className="text-end">{r.bags || ""}</TableCell>
                                <TableCell className="text-end">{r.pounds || ""}</TableCell>
                                <TableCell className="text-end">{r.rate || ""}</TableCell>
                              </>
                            )}
                            <TableCell className="text-end">{r.debit ? formatMoney(r.debit, currency) : ""}</TableCell>
                            <TableCell className="text-end text-success font-medium">
                              {r.credit ? formatMoney(r.credit, currency) : ""}
                            </TableCell>
                            <TableCell className="text-end font-semibold">{formatMoney(r.balance, currency)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  page={registerPages.page}
                  pageSize={registerPages.pageSize}
                  totalItems={registerPages.totalItems}
                  onPageChange={registerPages.setPage}
                  onPageSizeChange={registerPages.setPageSize}
                />
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Bilty</TableHead>
                    <TableHead>Book no.</TableHead>
                    <TableHead className="text-end">Lines</TableHead>
                    <TableHead className="text-end">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">No purchases in this range.</TableCell></TableRow>
                  ) : (
                    purchasePages.visible.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-muted-foreground">{p.number}</TableCell>
                        <TableCell className="whitespace-nowrap">{p.date}</TableCell>
                        <TableCell className="font-medium">{p.supplier_name}</TableCell>
                        <TableCell>{p.city ?? ""}</TableCell>
                        <TableCell>{p.bilty_number ?? ""}</TableCell>
                        <TableCell>{p.book_number ?? ""}</TableCell>
                        <TableCell className="text-end">{p.items.length}</TableCell>
                        <TableCell className="text-end font-semibold">{formatMoney(p.total, currency)}</TableCell>
                        <TableCell className="text-end whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={photoCounts[p.id] ? `${photoCounts[p.id]} photo(s)` : "Attach the paper bill"}
                            onClick={() => setViewing({ type: "material_purchase", id: p.id, title: `Purchase #${p.number} — ${p.supplier_name}` })}
                          >
                            <Paperclip className={`size-4 ${photoCounts[p.id] ? "text-primary" : "text-muted-foreground/50"}`} />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" title="Edit" onClick={() => editPurchase(p)}><Edit2 className="size-4" /></Button>
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => removePurchase(p)}><Trash2 className="size-4 text-destructive" /></Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={purchasePages.page}
              pageSize={purchasePages.pageSize}
              totalItems={purchasePages.totalItems}
              onPageChange={purchasePages.setPage}
              onPageSizeChange={purchasePages.setPageSize}
            />
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">No payments in this range.</TableCell></TableRow>
                  ) : (
                    paymentPages.visible.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-nowrap">{p.date}</TableCell>
                        <TableCell className="font-medium">{p.supplier_name}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell>{p.reference ?? ""}</TableCell>
                        <TableCell className="text-muted-foreground">{p.note ?? ""}</TableCell>
                        <TableCell className="text-end font-semibold text-success">{formatMoney(p.amount, currency)}</TableCell>
                        <TableCell className="text-end whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={photoCounts[p.id] ? `${photoCounts[p.id]} photo(s)` : "Attach the slip"}
                            onClick={() => setViewing({ type: "party_payment", id: p.id, title: `Payment — ${p.supplier_name} · ${p.date}` })}
                          >
                            <Paperclip className={`size-4 ${photoCounts[p.id] ? "text-primary" : "text-muted-foreground/50"}`} />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" title="Edit" onClick={() => editPayment(p)}><Edit2 className="size-4" /></Button>
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => removePayment(p)}><Trash2 className="size-4 text-destructive" /></Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={paymentPages.page}
              pageSize={paymentPages.pageSize}
              totalItems={paymentPages.totalItems}
              onPageChange={paymentPages.setPage}
              onPageSizeChange={paymentPages.setPageSize}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {/* ------------------------------------------------ purchase dialog */}
      <Dialog open={!!purchaseDraft} onOpenChange={(o) => !o && setPurchaseDraft(null)}>
        <DialogContent className="w-[96vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{purchaseDraft?.id ? "Edit purchase" : "New purchase"}</DialogTitle>
          </DialogHeader>
          {purchaseDraft && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Party *</Label>
                  <Select
                    value={purchaseDraft.supplier_id}
                    onValueChange={(v) => {
                      const p = parties.find((x) => x.id === v);
                      setPurchaseDraft({
                        ...purchaseDraft,
                        supplier_id: v,
                        city: purchaseDraft.city || p?.city || "",
                      });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose a party" /></SelectTrigger>
                    <SelectContent>
                      {materialSuppliers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-1.5 pt-1">
                    <Input
                      value={newPartyName}
                      onChange={(e) => setNewPartyName(e.target.value)}
                      placeholder="Or type a new party name"
                      className="h-8 text-xs"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParty("purchase"); } }}
                    />
                    <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => addParty("purchase")}>Add</Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={purchaseDraft.date} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Book no.</Label>
                  <Input
                    value={purchaseDraft.book_number}
                    onChange={(e) => setPurchaseDraft({ ...purchaseDraft, book_number: e.target.value })}
                    placeholder="Number printed on the paper bill"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>City</Label>
                  <Input value={purchaseDraft.city} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, city: e.target.value })} placeholder="Where it was delivered" />
                </div>
                <div className="space-y-1.5">
                  <Label>Bilty no.</Label>
                  <Input value={purchaseDraft.bilty_number} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, bilty_number: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Received by</Label>
                  <Input
                    value={purchaseDraft.received_by}
                    onChange={(e) => setPurchaseDraft({ ...purchaseDraft, received_by: e.target.value })}
                    placeholder="Who took delivery"
                    list="material-received-by"
                  />
                  <datalist id="material-received-by">
                    {Array.from(new Set(purchases.map((x) => x.received_by).filter(Boolean))).map((n) => (
                      <option key={n as string} value={n as string} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label>Notes</Label>
                  <Input value={purchaseDraft.notes} onChange={(e) => setPurchaseDraft({ ...purchaseDraft, notes: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Goods</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPurchaseDraft({ ...purchaseDraft, items: [...purchaseDraft.items, emptyItem()] })}>
                    <Plus className="size-3.5 mr-1.5" /> Add line
                  </Button>
                </div>
                <div className="space-y-2">
                  {purchaseDraft.items.map((it, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[140px] space-y-1">
                          <Label className="text-xs">Colour</Label>
                          <Input className="h-9" value={it.colour} onChange={(e) => setItem(i, { colour: e.target.value })} placeholder="RW / BLACK" />
                        </div>
                        <div className="w-[84px] space-y-1">
                          <Label className="text-xs">Act</Label>
                          <Input className="h-9" value={it.act} onChange={(e) => setItem(i, { act: e.target.value })} placeholder="48/2" />
                        </div>
                        <div className="w-[84px] space-y-1">
                          <Label className="text-xs">Bags</Label>
                          <Input className="h-9" type="number" step="0.01" value={it.bags} onChange={(e) => setItem(i, { bags: e.target.value })} />
                        </div>
                        <div className="w-[100px] space-y-1">
                          <Label className="text-xs">Pounds</Label>
                          <Input className="h-9" type="number" step="0.01" value={it.pounds} onChange={(e) => setItem(i, { pounds: e.target.value })} />
                        </div>
                        <div className="w-[100px] space-y-1">
                          <Label className="text-xs">Rate</Label>
                          <Input className="h-9" type="number" step="0.01" value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} />
                        </div>
                        <div className="w-[120px] space-y-1">
                          <Label className="text-xs">Amount</Label>
                          <Input
                            className={`h-9 ${it.amountEdited ? "border-primary" : ""}`}
                            type="number"
                            step="0.01"
                            value={it.amount}
                            onChange={(e) => setItem(i, { amount: e.target.value })}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0"
                          disabled={purchaseDraft.items.length === 1}
                          onClick={() => setPurchaseDraft({ ...purchaseDraft, items: purchaseDraft.items.filter((_, x) => x !== i) })}
                          title="Remove line"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Amount fills in as pounds × rate. Type over it when the paper says something else —
                  the line turns blue to show it was set by hand.
                </p>
              </div>

              <div className="border-t pt-3">
                <AttachmentsField
                  entityType="material_purchase"
                  entityId={purchaseDraft.id}
                  canEdit={canManage}
                  pending={pendingPhotos}
                  onPendingChange={setPendingPhotos}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold">{formatMoney(purchaseTotal, currency)}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={savePurchase} className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- payment dialog */}
      <Dialog open={!!paymentDraft} onOpenChange={(o) => !o && setPaymentDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{paymentDraft?.id ? "Edit payment" : "Record payment"}</DialogTitle></DialogHeader>
          {paymentDraft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Party *</Label>
                <Select value={paymentDraft.supplier_id} onValueChange={(v) => setPaymentDraft({ ...paymentDraft, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a party" /></SelectTrigger>
                  <SelectContent>
                    {parties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={paymentDraft.date} onChange={(e) => setPaymentDraft({ ...paymentDraft, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" value={paymentDraft.amount} onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Input
                    value={paymentDraft.method}
                    onChange={(e) => setPaymentDraft({ ...paymentDraft, method: e.target.value })}
                    placeholder="Cash / Meezan Bank"
                    list="party-payment-methods"
                  />
                  <datalist id="party-payment-methods">
                    {Array.from(new Set(payments.map((p) => p.method))).map((m) => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Reference</Label>
                  <Input value={paymentDraft.reference} onChange={(e) => setPaymentDraft({ ...paymentDraft, reference: e.target.value })} placeholder="TID 922452" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Textarea rows={2} value={paymentDraft.note} onChange={(e) => setPaymentDraft({ ...paymentDraft, note: e.target.value })} placeholder="Account it went to, e.g. Imran Traders A/C" />
              </div>
              <div className="border-t pt-3">
                <AttachmentsField
                  entityType="party_payment"
                  entityId={paymentDraft.id}
                  canEdit={canManage}
                  pending={pendingPhotos}
                  onPendingChange={setPendingPhotos}
                  compact
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={savePayment} className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PartyStatementPrintDialog
        open={printing}
        onClose={() => setPrinting(false)}
        ledger={ledger}
        partyName={partyLabel}
        from={from}
        to={to}
      />

      <AttachmentsDialog
        open={!!viewing}
        onClose={() => { setViewing(null); load(); }}
        title={viewing?.title ?? ""}
        entityType={viewing?.type ?? "material_purchase"}
        entityId={viewing?.id ?? null}
        canEdit={canManage}
      />

      {confirmDialog}
    </div>
  );
}
