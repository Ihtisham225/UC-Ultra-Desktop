import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Truck, Plus, Trash2, Edit2, PackageCheck, X, ChevronDown, ChevronRight, Lock, LockOpen, Paperclip, Printer, Check, Eye, HandCoins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { isMaker, isProcessor, CHALLAN_KIND, type ChallanKindValue } from "@/lib/handicraft";
import { AttachmentsField, AttachmentsDialog, uploadPendingAttachments } from "@/components/AttachmentsField";
import { rpc } from "@/lib/apiClient";
import type {
  JobProcessDto, ChallanDto, ReceiptDto, PartyOption, PartyPaymentDto,
} from "@/lib/handicraftTypes";
import {
  PartyPaymentDialog, emptyPaymentDraft, paymentToDraft, type PaymentDraft,
} from "@/components/PartyPaymentDialog";
import { ReceiveGoodsDialog } from "@/components/ReceiveGoodsDialog";
import { ChallanPrintDialog } from "@/components/ChallanPrintDialog";
import { RecordDetailsDialog } from "@/components/RecordDetailsDialog";
import { JobWorkBillPrintDialog } from "@/components/JobWorkBillPrintDialog";

const ALL = "all";

type ItemDraft = {
  description: string;
  bundles: string;
  pieces_per_bundle: string;
  quantity: string;
  /** Making challans go out by the box and weigh them. */
  per_piece_weight: string;
  /** Set by hand, so bundles × pieces stops filling it in. */
  quantityEdited: boolean;
  process_ids: string[];
};

type ChallanDraft = {
  id: string | null;
  supplier_id: string;
  date: string;
  book_number: string;
  sent_via: string;
  sent_by: string;
  counted_by: string;
  total_bundles: string;
  notes: string;
  items: ItemDraft[];
};

const num = (s: string) => (s.trim() === "" ? 0 : Number(s)) || 0;

const emptyItem = (): ItemDraft => ({
  description: "", bundles: "", pieces_per_bundle: "", quantity: "", per_piece_weight: "",
  quantityEdited: false, process_ids: [],
});

export default function JobWorkScreen({ kind }: { kind: ChallanKindValue }) {
  const copy = CHALLAN_KIND[kind];
  const making = kind === "making";
  const { currentShop } = useShop();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canManage = perms.canManagePurchases;
  const currency = currentShop?.currency ?? "PKR";

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [processes, setProcesses] = useState<JobProcessDto[]>([]);
  const [challans, setChallans] = useState<ChallanDto[]>([]);
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [payments, setPayments] = useState<PartyPaymentDto[]>([]);
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null);
  const [loading, setLoading] = useState(true);

  const [party, setParty] = useState(ALL);
  const [status, setStatus] = useState<"all" | "open" | "closed">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [draft, setDraft] = useState<ChallanDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiveFor, setReceiveFor] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<ReceiptDto | null>(null);
  // Photos chosen on a challan that doesn't exist yet.
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [viewing, setViewing] = useState<
    { type: "job_work_challan" | "job_work_receipt"; id: string; title: string } | null
  >(null);
  const [viewingChallan, setViewingChallan] = useState<ChallanDto | null>(null);
  const [viewingBill, setViewingBill] = useState<ReceiptDto | null>(null);
  const [printingChallan, setPrintingChallan] = useState<ChallanDto | null>(null);
  const [printingBill, setPrintingBill] = useState<ReceiptDto | null>(null);
  // "Goods received" starts from a challan, so the button opens a picker of
  // everything still out — not just what the current filters happen to show.
  const [pickingChallan, setPickingChallan] = useState(false);
  const [receivableChallans, setReceivableChallans] = useState<ChallanDto[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [today, setToday] = useState("");
  useEffect(() => { setToday(format(new Date(), "yyyy-MM-dd")); }, []);

  const filters = useMemo(
    () => ({
      from: from || null,
      to: to || null,
      supplier_id: party === ALL ? null : party,
      status: status === "all" ? null : status,
      kind,
    }),
    [from, to, party, status, kind],
  );

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const [p, proc, ch, rc, pay] = await Promise.all([
        rpc<PartyOption[]>("listPartyOptionsAction"),
        rpc<JobProcessDto[]>("listJobProcessesAction"),
        rpc<ChallanDto[]>("listChallansAction", filters),
        rpc<ReceiptDto[]>("listReceiptsAction", { from: filters.from, to: filters.to, supplier_id: filters.supplier_id, kind }),
        // This stage's payments only; the party's khata still totals them all.
        rpc<PartyPaymentDto[]>("listPartyPaymentsAction", { from: filters.from, to: filters.to, supplier_id: filters.supplier_id, kind }),
      ]);
      setParties(p);
      setProcesses(proc);
      setChallans(ch);
      setReceipts(rc);
      setPayments(pay);
      const [challanPhotos, billPhotos] = await Promise.all([
        rpc<Record<string, number>>("countAttachmentsAction", "job_work_challan", ch.map((x) => x.id)),
        rpc<Record<string, number>>("countAttachmentsAction", "job_work_receipt", rc.map((x) => x.id)),
      ]);
      setPhotoCounts({ ...challanPhotos, ...billPhotos });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load job work");
    }
    setLoading(false);
  }, [currentShop, filters]);

  useEffect(() => { load(); }, [load]);

  const openReceivePicker = async () => {
    setPickingChallan(true);
    setPickerLoading(true);
    try {
      const rows = await rpc<ChallanDto[]>("listChallansAction", { status: "open", kind });
      // Making has no pending arithmetic — any open challan can take a bill.
      setReceivableChallans(rows.filter((c) => making || c.total_pending > 0));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load challans");
    }
    setPickerLoading(false);
  };

  // Each stage offers only the parties that do that stage's work.
  const processors = parties.filter(making ? isMaker : isProcessor);

  const challanPages = usePagination(challans, {
    key: "job-work-challans",
    defaultSize: 20,
    resetDeps: [party, status, from, to, challans.length],
  });
  const receiptPages = usePagination(receipts, {
    key: "job-work-receipts",
    defaultSize: 20,
    resetDeps: [party, from, to, receipts.length],
  });
  const paymentPages = usePagination(payments, {
    key: `job-work-payments-${kind}`,
    defaultSize: 20,
    resetDeps: [party, from, to, payments.length],
  });

  const pendingPieces = challans.reduce((s, c) => s + c.total_pending, 0);
  const weightSent = challans.reduce((s, c) => s + c.sent_weight, 0);
  const weightBack = challans.reduce((s, c) => s + c.received_weight, 0);
  const weightOut = challans.reduce((s, c) => s + c.pending_weight, 0);
  const wt = (n: number) => Number(n.toFixed(3)).toLocaleString();
  const openMaking = challans.filter((c) => c.status === "open").length;
  const openChallans = challans.filter((c) => c.status === "open").length;
  const billedTotal = receipts.reduce((s, r) => s + r.total, 0);
  const paidTotal = payments.reduce((s, p) => s + p.amount, 0);

  // ---------------------------------------------------------- challans

  const newChallan = () => {
    setPendingPhotos([]);
    setDraft({
      id: null,
      supplier_id: party === ALL ? "" : party,
      date: today,
      book_number: "",
      sent_via: "",
      sent_by: "",
      counted_by: "",
      total_bundles: "",
      notes: "",
      items: [emptyItem()],
    });
  };

  const editChallan = (c: ChallanDto) => {
    setPendingPhotos([]);
    setDraft({
      id: c.id,
      supplier_id: c.supplier_id,
      date: c.date,
      book_number: c.book_number ?? "",
      sent_via: c.sent_via ?? "",
      sent_by: c.sent_by ?? "",
      counted_by: c.counted_by ?? "",
      total_bundles: c.total_bundles === null ? "" : String(c.total_bundles),
      notes: c.notes ?? "",
      items: c.items.map((it) => ({
        description: it.description,
        bundles: it.bundles === null ? "" : String(it.bundles),
        pieces_per_bundle: it.pieces_per_bundle === null ? "" : String(it.pieces_per_bundle),
        quantity: String(it.quantity),
        per_piece_weight: it.per_piece_weight === null ? "" : String(it.per_piece_weight),
        quantityEdited: true,
        process_ids: it.process_ids,
      })),
    });
  };

  /** Pieces follow bundles × pieces-per-bundle — their own footer sum. */
  const setItem = (index: number, patch: Partial<ItemDraft>) => {
    setDraft((d) => {
      if (!d) return d;
      const items = d.items.map((it, i) => {
        if (i !== index) return it;
        const next = { ...it, ...patch };
        if (patch.quantity !== undefined) next.quantityEdited = true;
        if (!making && (patch.bundles !== undefined || patch.pieces_per_bundle !== undefined)) {
          const computed = num(next.bundles) * num(next.pieces_per_bundle);
          if (computed > 0) {
            next.quantity = String(computed);
            next.quantityEdited = false;
          }
        }
        return next;
      });
      return { ...d, items };
    });
  };

  const toggleProcess = (index: number, processId: string) => {
    setDraft((d) => {
      if (!d) return d;
      const items = d.items.map((it, i) => {
        if (i !== index) return it;
        const has = it.process_ids.includes(processId);
        return {
          ...it,
          process_ids: has ? it.process_ids.filter((x) => x !== processId) : [...it.process_ids, processId],
        };
      });
      return { ...d, items };
    });
  };

  const draftPieces = draft?.items.reduce((s, it) => s + num(it.quantity), 0) ?? 0;
  const draftBundles = draft?.items.reduce((s, it) => s + num(it.bundles), 0) ?? 0;
  const draftWeight =
    draft?.items.reduce((s, it) => s + num(it.quantity) * num(it.per_piece_weight), 0) ?? 0;

  const saveChallan = async () => {
    if (!draft) return;
    if (!draft.supplier_id) return toast.error("Choose the company the goods went to.");
    const items = draft.items.filter((it) => it.description.trim() && num(it.quantity) > 0);
    if (items.length === 0) return toast.error("Add at least one line with a description and quantity.");

    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string; id?: string; number?: number }>(
      "saveChallanAction",
      draft.id,
      {
      kind,
      supplier_id: draft.supplier_id,
      date: draft.date,
      book_number: draft.book_number || null,
      sent_via: draft.sent_via || null,
      sent_by: draft.sent_by || null,
      counted_by: draft.counted_by || null,
      total_bundles: draft.total_bundles === "" ? null : num(draft.total_bundles),
      notes: draft.notes || null,
      items: items.map((it) => ({
        description: it.description.trim(),
        quantity: num(it.quantity),
        bundles: it.bundles === "" ? null : num(it.bundles),
        pieces_per_bundle: it.pieces_per_bundle === "" ? null : num(it.pieces_per_bundle),
        per_piece_weight: it.per_piece_weight === "" ? null : num(it.per_piece_weight),
        process_ids: it.process_ids,
      })),
      },
    );
    if (result.ok && pendingPhotos.length > 0) {
      try {
        await uploadPendingAttachments("job_work_challan", result.id, pendingPhotos);
      } catch (e) {
        // The challan is saved either way — report only what failed.
        toast.error(e instanceof Error ? e.message : "Photos could not be attached");
      }
    }
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success(draft.id ? "Challan updated" : `Challan #${result.number} saved`);
    setPendingPhotos([]);
    setDraft(null);
    load();
  };

  const removeChallan = async (c: ChallanDto) => {
    const ok = await confirm({
      title: `Delete challan #${c.number}?`,
      description: `${c.supplier_name} · ${c.total_qty} pieces. This can't be undone.`,
      variant: "destructive",
    });
    if (!ok) return;
    const result = await rpc<{ ok: boolean; error?: string }>("deleteChallanAction", c.id);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success("Challan deleted");
    load();
  };

  const toggleStatus = async (c: ChallanDto) => {
    const closing = c.status === "open";
    if (closing && !making && c.total_pending > 0) {
      const ok = await confirm({
        title: "Close with pieces outstanding?",
        description: `${c.total_pending} pieces are still shown as lying at ${c.supplier_name}. Closing hides this challan from the pending list.`,
        confirmLabel: "Close anyway",
      });
      if (!ok) return;
    }
    const result = await rpc<{ ok: boolean; error?: string }>("setChallanStatusAction", c.id, closing ? "closed" : "open");
    if (!result.ok) return toast.error(result.error ?? "Failed");
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

  const removeReceipt = async (r: ReceiptDto) => {
    const ok = await confirm({
      title: `Delete bill #${r.number}?`,
      description: `${r.supplier_name} · ${formatMoney(r.total, currency)}. Those pieces go back to being owed by the company, and the bill comes off their balance.`,
      variant: "destructive",
    });
    if (!ok) return;
    const result = await rpc<{ ok: boolean; error?: string }>("deleteReceiptAction", r.id);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success("Bill deleted");
    load();
  };

  const processLabel = (id: string) => processes.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="size-7 text-primary" /> {copy.title}
          </h1>
          <p className="text-muted-foreground mt-1">{copy.blurb}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setPaymentDraft(emptyPaymentDraft(today, party === ALL ? "" : party))}
            >
              <HandCoins className="size-4 mr-2" /> Record payment
            </Button>
            <Button variant="outline" onClick={openReceivePicker}>
              <PackageCheck className="size-4 mr-2" /> Goods received
            </Button>
            <Button onClick={newChallan} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              <Plus className="size-4 mr-2" /> New challan
            </Button>
          </div>
        )}
      </header>

      <Card className="shadow-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">{copy.party}</Label>
            <Select value={party} onValueChange={setParty}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All {copy.partyPlural.toLowerCase()}</SelectItem>
                {parties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All challans</SelectItem>
                <SelectItem value="open">Still out</SelectItem>
                <SelectItem value="closed">Finished</SelectItem>
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
          <div className="flex items-end">
            {(from || to || party !== ALL || status !== "all") && (
              <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); setParty(ALL); setStatus("all"); }}>
                <X className="size-4 mr-1.5" /> Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card p-4 border-primary/40">
          <div className="text-xs text-muted-foreground">
            {making ? "Weight still with the makers" : "At the companies"}
          </div>
          <div className="text-xl font-bold mt-1 text-primary">
            {making ? wt(weightOut) : pendingPieces}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {making ? `${wt(weightSent)} sent · ${wt(weightBack)} back` : "pieces not back yet"}
          </div>
        </Card>
        <Card className="shadow-card p-4">
          <div className="text-xs text-muted-foreground">{making ? "Jobs running" : "Open challans"}</div>
          <div className="text-xl font-bold mt-1">{making ? openMaking : openChallans}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">of {challans.length} in this range</div>
        </Card>
        <Card className="shadow-card p-4">
          <div className="text-xs text-muted-foreground">Billed for work</div>
          <div className="text-xl font-bold mt-1">{formatMoney(billedTotal, currency)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{receipts.length} bill{receipts.length === 1 ? "" : "s"}, net of deductions</div>
        </Card>
        <Card className="shadow-card p-4">
          <div className="text-xs text-muted-foreground">Paid</div>
          <div className="text-xl font-bold mt-1 text-success">{formatMoney(paidTotal, currency)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {payments.length} payment{payments.length === 1 ? "" : "s"} for {copy.title.toLowerCase()}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="challans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="challans">Sent challans ({challans.length})</TabsTrigger>
          <TabsTrigger value="bills">Received bills ({receipts.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="challans">
          <Card className="shadow-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground">Loading…</div>
            ) : challans.length === 0 ? (
              <div className="p-16 text-center">
                <Truck className="size-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground">No challans yet. Create one when {making ? "material" : "goods"} go out.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>#</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>{copy.party}</TableHead>
                        <TableHead>Book no.</TableHead>
                        <TableHead className="text-end">{making ? "Boxes" : "Pieces"}</TableHead>
                        {!making && <TableHead className="text-end">Pending</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {challanPages.visible.map((c) => (
                        <Fragment key={c.id}>
                          <TableRow>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="size-7" onClick={() => setExpanded((e) => ({ ...e, [c.id]: !e[c.id] }))}>
                                {expanded[c.id] ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              </Button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{c.number}</TableCell>
                            <TableCell className="whitespace-nowrap">{c.date}</TableCell>
                            <TableCell className="font-medium">{c.supplier_name}</TableCell>
                            <TableCell>{c.book_number ?? ""}</TableCell>
                            <TableCell className="text-end">{c.total_qty}</TableCell>
                            {!making && (
                              <TableCell className={`text-end font-semibold ${c.total_pending > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                {c.total_pending}
                              </TableCell>
                            )}
                            <TableCell>
                              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${c.status === "open" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                {c.status === "open" ? (making ? "Running" : "At company") : "Finished"}
                              </span>
                            </TableCell>
                            <TableCell className="text-end whitespace-nowrap">
                              <Button variant="ghost" size="icon" title="View details" onClick={() => setViewingChallan(c)}>
                                <Eye className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Print challan" onClick={() => setPrintingChallan(c)}>
                                <Printer className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={photoCounts[c.id] ? `${photoCounts[c.id]} photo(s)` : "Attach the paper slip"}
                                onClick={() => setViewing({ type: "job_work_challan", id: c.id, title: `Challan #${c.number} — ${c.supplier_name}` })}
                              >
                                <Paperclip className={`size-4 ${photoCounts[c.id] ? "text-primary" : "text-muted-foreground/50"}`} />
                              </Button>
                              {canManage && (
                                <>
                                  {(making ? c.status === "open" : c.total_pending > 0) && (
                                    <Button variant="ghost" size="icon" title="Goods received" onClick={() => { setEditingReceipt(null); setReceiveFor(c.id); }}>
                                      <PackageCheck className="size-4 text-success" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" title={c.status === "open" ? "Close challan" : "Reopen challan"} onClick={() => toggleStatus(c)}>
                                    {c.status === "open" ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
                                  </Button>
                                  <Button variant="ghost" size="icon" title="Edit" onClick={() => editChallan(c)}><Edit2 className="size-4" /></Button>
                                  <Button variant="ghost" size="icon" title="Delete" onClick={() => removeChallan(c)}><Trash2 className="size-4 text-destructive" /></Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                          {expanded[c.id] && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell />
                              <TableCell colSpan={8} className="py-3">
                                <div className="space-y-2">
                                  {c.items.map((it) => (
                                    <div key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                                      <span className="font-medium min-w-48">{it.description}</span>
                                      <span className="text-muted-foreground">
                                        {it.quantity} {making ? "boxes" : "pcs"}
                                        {!making && it.bundles ? ` (${it.bundles} × ${it.pieces_per_bundle ?? "?"})` : ""}
                                        {making && it.per_piece_weight
                                          ? ` · ${wt(it.quantity * it.per_piece_weight)} weight`
                                          : ""}
                                      </span>
                                      <span className="flex flex-wrap gap-1">
                                        {it.process_ids.length === 0 ? (
                                          <span className="text-xs text-muted-foreground">no work ticked</span>
                                        ) : (
                                          it.process_ids.map((pid) => (
                                            <span key={pid} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                              {processLabel(pid)}
                                            </span>
                                          ))
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground ms-auto">
                                        back {it.received}
                                        {it.short > 0 ? ` · short ${it.short}` : ""}
                                        {it.damaged > 0 ? ` · damaged ${it.damaged}` : ""}
                                        {!making && it.pending > 0 ? ` · pending ${it.pending}` : ""}
                                      </span>
                                    </div>
                                  ))}
                                  {(c.sent_via || c.counted_by || c.total_bundles || c.notes) && (
                                    <div className="text-xs text-muted-foreground pt-1 border-t">
                                      {[
                                        c.sent_via ? `Sent via ${c.sent_via}` : null,
                                        c.counted_by ? `Counted by ${c.counted_by}` : null,
                                        c.total_bundles ? `${c.total_bundles} bundles` : null,
                                        c.notes,
                                      ].filter(Boolean).join(" · ")}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination
                  page={challanPages.page}
                  pageSize={challanPages.pageSize}
                  totalItems={challanPages.totalItems}
                  onPageChange={challanPages.setPage}
                  onPageSizeChange={challanPages.setPageSize}
                />
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bills">
          <Card className="shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>{copy.party}</TableHead>
                    <TableHead>Challan</TableHead>
                    <TableHead>Book no.</TableHead>
                    {making && <TableHead className="text-end">Weight back</TableHead>}
                    <TableHead className="text-end">Charges</TableHead>
                    <TableHead className="text-end">Deduction</TableHead>
                    <TableHead className="text-end">Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">No bills in this range.</TableCell></TableRow>
                  ) : (
                    receiptPages.visible.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{r.number}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                        <TableCell className="font-medium">{r.supplier_name}</TableCell>
                        <TableCell>#{r.challan_number}</TableCell>
                        <TableCell>{r.book_number ?? ""}</TableCell>
                        {making && <TableCell className="text-end">{wt(r.received_weight)}</TableCell>}
                        <TableCell className="text-end">{formatMoney(r.charges_total, currency)}</TableCell>
                        <TableCell className="text-end text-destructive">{r.deduction ? formatMoney(r.deduction, currency) : ""}</TableCell>
                        <TableCell className="text-end font-semibold">{formatMoney(r.total, currency)}</TableCell>
                        <TableCell className="text-end whitespace-nowrap">
                          <Button variant="ghost" size="icon" title="View details" onClick={() => setViewingBill(r)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Print bill" onClick={() => setPrintingBill(r)}>
                            <Printer className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={photoCounts[r.id] ? `${photoCounts[r.id]} photo(s)` : "Attach the paper bill"}
                            onClick={() => setViewing({ type: "job_work_receipt", id: r.id, title: `Bill #${r.number} — ${r.supplier_name}` })}
                          >
                            <Paperclip className={`size-4 ${photoCounts[r.id] ? "text-primary" : "text-muted-foreground/50"}`} />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditingReceipt(r); setReceiveFor(r.challan_id); }}><Edit2 className="size-4" /></Button>
                              <Button variant="ghost" size="icon" title="Delete" onClick={() => removeReceipt(r)}><Trash2 className="size-4 text-destructive" /></Button>
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
              page={receiptPages.page}
              pageSize={receiptPages.pageSize}
              totalItems={receiptPages.totalItems}
              onPageChange={receiptPages.setPage}
              onPageSizeChange={receiptPages.setPageSize}
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
                    <TableHead>{copy.party}</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                        No payments for {copy.title.toLowerCase()} in this range.
                      </TableCell>
                    </TableRow>
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
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" title="Edit" onClick={() => setPaymentDraft(paymentToDraft(p))}><Edit2 className="size-4" /></Button>
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

      <PartyPaymentDialog
        draft={paymentDraft}
        setDraft={setPaymentDraft}
        kind={kind}
        parties={processors}
        partyLabel={copy.party}
        methods={payments.map((x) => x.method)}
        canEdit={canManage}
        onSaved={load}
      />

      {/* ------------------------------------------------- challan dialog */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="w-[96vw] sm:max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Edit challan" : making ? "New challan — material going out" : "New challan — goods going out"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{copy.party} *</Label>
                  <Select value={draft.supplier_id} onValueChange={(v) => setDraft({ ...draft, supplier_id: v })}>
                    <SelectTrigger><SelectValue placeholder={`Choose a ${copy.party.toLowerCase()}`} /></SelectTrigger>
                    <SelectContent>
                      {(processors.length ? processors : parties).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}{p.city ? ` — ${p.city}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {processors.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No party is marked as {making ? "a maker" : "a processing company"} yet — set that on the Parties page.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Date *</Label>
                  <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Book no.</Label>
                  <Input value={draft.book_number} onChange={(e) => setDraft({ ...draft, book_number: e.target.value })} placeholder="Number on the paper slip" />
                </div>
                <div className="space-y-1.5">
                  <Label>Sent via <span className="text-muted-foreground" dir="rtl">بذریعہ</span></Label>
                  <Input value={draft.sent_via} onChange={(e) => setDraft({ ...draft, sent_via: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Sent by</Label>
                  <Input
                    value={draft.sent_by}
                    onChange={(e) => setDraft({ ...draft, sent_by: e.target.value })}
                    placeholder="Who sent it out"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Counted by <span className="text-muted-foreground" dir="rtl">کنتی کرنے والا</span></Label>
                  <Input value={draft.counted_by} onChange={(e) => setDraft({ ...draft, counted_by: e.target.value })} />
                </div>
                {/* Bundles are a finished-goods count; raw material goes out
                    by the box and is reconciled by weight. */}
                {!making && (
                  <div className="space-y-1.5">
                    <Label>Total bundles <span className="text-muted-foreground" dir="rtl">ٹوٹل بنڈل</span></Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={draft.total_bundles}
                      onChange={(e) => setDraft({ ...draft, total_bundles: e.target.value })}
                      placeholder={draftBundles ? String(draftBundles) : ""}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{making ? "Material going out" : "Goods and the work they need"}</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, items: [...draft.items, emptyItem()] })}>
                    <Plus className="size-3.5 mr-1.5" /> Add line
                  </Button>
                </div>
                <div className="space-y-2">
                  {draft.items.map((it, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2.5">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[200px] space-y-1">
                          <Label className="text-xs">Detail <span dir="rtl">تفصیل</span></Label>
                          <Input className="h-9" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="e.g. سفید 2/72" />
                        </div>

                        {making ? (
                          <>
                            {/* Raw material goes out by the box — کاٹن — so the
                                box count is the quantity, and there is no piece
                                count or rate until the shawls come back. */}
                            <div className="w-[110px] space-y-1">
                              <Label className="text-xs">Boxes <span dir="rtl">کاٹن</span></Label>
                              <Input
                                className="h-9"
                                type="number"
                                step="0.01"
                                value={it.quantity}
                                onChange={(e) => setItem(i, { quantity: e.target.value })}
                              />
                            </div>
                            <div className="w-[120px] space-y-1">
                              <Label className="text-xs">Weight / box</Label>
                              <Input
                                className="h-9"
                                type="number"
                                step="0.001"
                                value={it.per_piece_weight}
                                onChange={(e) => setItem(i, { per_piece_weight: e.target.value })}
                                placeholder="optional"
                              />
                            </div>
                            <div className="w-[120px] space-y-1">
                              <Label className="text-xs">Total weight</Label>
                              <Input
                                className="h-9 bg-muted/40"
                                readOnly
                                value={
                                  num(it.quantity) * num(it.per_piece_weight)
                                    ? String(Number((num(it.quantity) * num(it.per_piece_weight)).toFixed(3)))
                                    : ""
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-[84px] space-y-1">
                              <Label className="text-xs">Bundles</Label>
                              <Input className="h-9" type="number" step="0.01" value={it.bundles} onChange={(e) => setItem(i, { bundles: e.target.value })} />
                            </div>
                            <div className="w-[84px] space-y-1">
                              <Label className="text-xs">× pcs</Label>
                              <Input className="h-9" type="number" step="0.01" value={it.pieces_per_bundle} onChange={(e) => setItem(i, { pieces_per_bundle: e.target.value })} />
                            </div>
                            <div className="w-[100px] space-y-1">
                              <Label className="text-xs">Pieces</Label>
                              <Input
                                className={`h-9 ${it.quantityEdited ? "border-primary" : ""}`}
                                type="number"
                                step="0.01"
                                value={it.quantity}
                                onChange={(e) => setItem(i, { quantity: e.target.value })}
                              />
                            </div>
                          </>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0"
                          disabled={draft.items.length === 1}
                          onClick={() => setDraft({ ...draft, items: draft.items.filter((_, x) => x !== i) })}
                          title="Remove line"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>

                      {!making && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">Work needed:</span>
                        {processes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            No processing work set up — add it in Settings → Processing work.
                          </span>
                        ) : (
                          processes.map((p) => {
                            const on = it.process_ids.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleProcess(i, p.id)}
                                aria-pressed={on}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                  on
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                <Check className={`size-3 ${on ? "opacity-100" : "opacity-25"}`} />
                                {p.name}
                                {p.name_local && <span dir="rtl">{p.name_local}</span>}
                              </button>
                            );
                          })
                        )}
                      </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {making
                    ? "Boxes of raw material going out. Weight per box is optional; total weight is boxes × that."
                    : "Type bundles and pieces-per-bundle and the piece count fills itself in — the ×-sum from the bottom of your book. Tick the work each lot needs."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>

              <div className="border-t pt-3">
                <AttachmentsField
                  entityType="job_work_challan"
                  entityId={draft.id}
                  canEdit={canManage}
                  pending={pendingPhotos}
                  onPendingChange={setPendingPhotos}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Total going out</span>
                <span className="text-xl font-bold">
                  {draftPieces} {making ? "boxes" : "pieces"}
                  {making && draftWeight > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}· {Number(draftWeight.toFixed(3))} weight
                    </span>
                  )}

                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={busy} onClick={saveChallan} className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiveGoodsDialog
        challanId={receiveFor}
        receipt={editingReceipt}
        processes={processes}
        currency={currency}
        onClose={() => { setReceiveFor(null); setEditingReceipt(null); }}
        onSaved={() => { setReceiveFor(null); setEditingReceipt(null); load(); }}
      />

      {/* Which challan are these goods coming back from? */}
      <Dialog open={pickingChallan} onOpenChange={(o) => !o && setPickingChallan(false)}>
        <DialogContent className="w-[96vw] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Goods received — which challan?</DialogTitle>
          </DialogHeader>
          {pickerLoading ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : receivableChallans.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Nothing is out for processing right now. Send a challan first.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {receivableChallans.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-start p-3 hover:bg-muted/50 flex items-center justify-between gap-3"
                    onClick={() => {
                      setPickingChallan(false);
                      setEditingReceipt(null);
                      setReceiveFor(c.id);
                    }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {c.supplier_name}
                        <span className="text-muted-foreground font-normal"> · challan #{c.number}</span>
                        {c.book_number && <span className="text-muted-foreground font-normal"> (book {c.book_number})</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        sent {c.date} · {c.items.length} line{c.items.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="text-end shrink-0">
                      <div className="font-bold text-primary">{making ? c.total_qty : c.total_pending}</div>
                      <div className="text-[10px] text-muted-foreground">{making ? "boxes sent" : "pending"}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <RecordDetailsDialog
        open={!!viewingChallan}
        onClose={() => setViewingChallan(null)}
        title={`Challan #${viewingChallan?.number ?? ""}`}
        subtitle={viewingChallan ? `${viewingChallan.supplier_name} · ${viewingChallan.date}` : undefined}
        fields={
          viewingChallan
            ? [
                { label: copy.party, value: viewingChallan.supplier_name },
                { label: "Date", value: viewingChallan.date },
                { label: "Book no.", value: viewingChallan.book_number },
                { label: "Sent via", value: viewingChallan.sent_via },
                { label: "Sent by", value: viewingChallan.sent_by },
                { label: "Counted by", value: viewingChallan.counted_by },
                { label: "Total bundles", value: viewingChallan.total_bundles },
                {
                  label: "Status",
                  value: viewingChallan.status === "open" ? (making ? "With maker" : "At company") : "Finished",
                },
                { label: "Bills against it", value: viewingChallan.receipts_count },
                { label: "Notes", value: viewingChallan.notes, full: true },
              ]
            : []
        }
        tables={
          viewingChallan
            ? [
                {
                  title: making ? "Material sent" : "Goods sent",
                  columns: [
                    { header: "Detail" },
                    { header: making ? "Boxes" : "Pieces", align: "end" },
                    ...(making
                      ? [{ header: "Weight / box", align: "end" as const }, { header: "Total weight", align: "end" as const }]
                      : [{ header: "Back", align: "end" as const }, { header: "Pending", align: "end" as const }]),
                    { header: making ? "" : "Work" },
                  ],
                  rows: viewingChallan.items.map((it) => [
                    it.description,
                    it.quantity,
                    ...(making
                      ? [it.per_piece_weight ?? "—", it.per_piece_weight ? wt(it.quantity * it.per_piece_weight) : "—"]
                      : [it.received, it.pending]),
                    making
                      ? ""
                      : it.process_ids.map(processLabel).join(", ") || "—",
                  ]),
                  footer: [
                    "Total",
                    viewingChallan.total_qty,
                    ...(making
                      ? ["", wt(viewingChallan.sent_weight)]
                      : ["", viewingChallan.total_pending]),
                    "",
                  ],
                },
              ]
            : []
        }
        totals={
          viewingChallan && making
            ? [
                { label: "Weight sent", value: wt(viewingChallan.sent_weight) },
                { label: "Weight back", value: wt(viewingChallan.received_weight) },
                { label: "Still with the maker", value: wt(viewingChallan.pending_weight), strong: true },
              ]
            : []
        }
        actions={
          viewingChallan ? (
            <Button variant="outline" onClick={() => { setPrintingChallan(viewingChallan); setViewingChallan(null); }}>
              <Printer className="size-4 mr-1.5" /> Print
            </Button>
          ) : undefined
        }
      />

      <RecordDetailsDialog
        open={!!viewingBill}
        onClose={() => setViewingBill(null)}
        title={`Bill #${viewingBill?.number ?? ""}`}
        subtitle={viewingBill ? `${viewingBill.supplier_name} · ${viewingBill.date}` : undefined}
        fields={
          viewingBill
            ? [
                { label: copy.party, value: viewingBill.supplier_name },
                { label: "Date", value: viewingBill.date },
                { label: "Book no.", value: viewingBill.book_number },
                { label: "Against challan", value: `#${viewingBill.challan_number}` },
                { label: "Received via", value: viewingBill.received_via },
                { label: "Notes", value: viewingBill.notes, full: true },
              ]
            : []
        }
        tables={
          viewingBill
            ? [
                {
                  title: "Goods received",
                  columns: [
                    { header: "Detail" },
                    { header: "Received", align: "end" },
                    ...(making
                      ? [{ header: "Weight / piece", align: "end" as const }, { header: "Total weight", align: "end" as const }]
                      : [{ header: "Short", align: "end" as const }, { header: "Damaged", align: "end" as const }]),
                    { header: "Work charged" },
                    { header: "Line total", align: "end" },
                  ],
                  rows: viewingBill.items.map((it) => [
                    it.note ? `${it.description} — ${it.note}` : it.description,
                    it.received_qty,
                    ...(making
                      ? [
                          it.per_piece_weight ?? "—",
                          it.per_piece_weight ? wt(it.received_qty * it.per_piece_weight) : "—",
                        ]
                      : [it.short_qty || "", it.damaged_qty || ""]),
                    it.charges.map((c) => `${c.process_name} ${c.rate}×${c.quantity}`).join(", ") || "—",
                    formatMoney(it.line_total, currency),
                  ]),
                },
              ]
            : []
        }
        totals={
          viewingBill
            ? [
                ...(making ? [{ label: "Weight back on this bill", value: wt(viewingBill.received_weight) }] : []),
                { label: "Charges", value: formatMoney(viewingBill.charges_total, currency) },
                { label: "Deduction", value: viewingBill.deduction ? formatMoney(viewingBill.deduction, currency) : "—" },
                { label: "Bill total", value: formatMoney(viewingBill.total, currency), strong: true },
                { label: "Paid with the bill", value: viewingBill.paid_now ? formatMoney(viewingBill.paid_now, currency) : "—" },
              ]
            : []
        }
        actions={
          viewingBill ? (
            <Button variant="outline" onClick={() => { setPrintingBill(viewingBill); setViewingBill(null); }}>
              <Printer className="size-4 mr-1.5" /> Print
            </Button>
          ) : undefined
        }
      />

      <ChallanPrintDialog
        challan={printingChallan}
        processes={processes}
        onClose={() => setPrintingChallan(null)}
      />

      <JobWorkBillPrintDialog receipt={printingBill} onClose={() => setPrintingBill(null)} />

      <AttachmentsDialog
        open={!!viewing}
        onClose={() => { setViewing(null); load(); }}
        title={viewing?.title ?? ""}
        entityType={viewing?.type ?? "job_work_challan"}
        entityId={viewing?.id ?? null}
        canEdit={canManage}
      />

      {confirmDialog}
    </div>
  );
}
