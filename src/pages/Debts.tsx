import { useEffect, useMemo, useState } from "react";
import { useLocalStore } from "@/hooks/useLocalStore";
import { derivePaidAmount } from "@/lib/ledger";
import { syncNow } from "@/lib/syncEngine";
import { rpc } from "@/lib/apiClient";
import { v4 as uuid } from "uuid";
import { upsertLocal, deleteLocal, notifyChange, getById } from "@/lib/localDb";
import { allocateSettlement, groupLedgers, increaseTarget, type LedgerGroup } from "@/lib/ledger-groups";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2, Wallet, Eye, TrendingUp, TrendingDown, MessageCircle, Upload, Printer } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildLedgerStatementHtml } from "@/lib/ledger-statement";
import { ImportDebtsDialog } from "@/components/ImportDebtsDialog";
import { buildDebtReminderMessage, buildWaReminderUrl } from "@/lib/debt-reminder";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DetailsDialog } from "@/components/DetailsDialog";
import { LedgerEntriesTable } from "@/components/LedgerEntriesLog";
import { PageTip } from "@/components/PageTip";
import { AccountPicker } from "@/components/AccountPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { LedgerPersonPicker, type LedgerPerson } from "@/components/LedgerPersonPicker";
import { useAddNew } from "@/hooks/useAddNew";
import { useDaybookHandoff } from "@/hooks/useDaybookHandoff";
import type { DaybookEntryDto } from "@/lib/daybookTypes";

type Direction = "owed_to_me" | "i_owe";
type Status = "open" | "settled";

interface Debt {
  id: string;
  shop_id: string;
  created_by: string;
  direction: Direction;
  person_name: string;
  party_id: string | null;
  phone: string | null;
  amount: number;
  paid_amount: number;
  currency: string | null;
  due_date: string | null;
  status: Status;
  notes: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
  /** The bill this row was raised by, when it came from a sale or a purchase. */
  sale_id?: string | null;
  purchase_id?: string | null;
}

type Group = LedgerGroup<Debt>;
type EntryKind = "payment" | "increase";

interface DebtPayment {
  id: string;
  debt_id: string;
  shop_id: string;
  amount: number;
  /** Written off alongside the cash — clears balance but was never collected. */
  discount?: number;
  payment_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  kind: EntryKind;
  account_id?: string | null;
  /** The cheque this entry came from — it moves only with the cheque. */
  cheque_id?: string | null;
}

const empty = {
  direction: "owed_to_me" as Direction,
  person_name: "",
  phone: "",
  amount: "",
  due_date: "",
  notes: "",
};

const emptyPayment = {
  kind: "payment" as EntryKind,
  amount: "",
  // Written off at the same time — the customer asks for something off to
  // settle and the shop agrees. It clears the balance exactly as cash does,
  // so it is recorded apart from the amount rather than folded into it.
  discount: "",
  payment_date: new Date().toISOString().slice(0, 10),
  notes: "",
  /** Paid by a post-dated cheque instead of cash / an account. */
  byCheque: false,
  cheque_number: "",
  bank_name: "",
  cheque_date: "",
};

const getRemainingAmount = (debt: Pick<Debt, "amount" | "paid_amount">) =>
  Math.max(Number(debt.amount) - Number(debt.paid_amount ?? 0), 0);

/** How one khata row is named inside a person's account. */
const billLabel = (d: Pick<Debt, "sale_id" | "purchase_id" | "notes">, billNo: Map<string, string>) =>
  d.sale_id
    ? `Bill ${billNo.get(d.sale_id) ?? ""}`.trim()
    : d.purchase_id
      ? `Purchase ${billNo.get(d.purchase_id) ?? ""}`.trim()
      : d.notes?.trim() || "Ledger entry";

export default function Debts() {
  const { currentShop } = useShop();
  const { user } = useAuth();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const canManage = perms.canManageExpenses; // owner/manager

  const { data: rawDebts, loading: debtsLoading } = useLocalStore<Debt>("debts", currentShop?.id);
  const { data: allPayments } = useLocalStore<DebtPayment>("debt_payments", currentShop?.id);
  // Only to name the account each settlement went through in the details log.
  const { data: moneyAccounts } = useLocalStore<{ id: string; name: string }>("money_accounts", currentShop?.id);

  /**
   * ⚠️ paid_amount is DERIVED, not read. The stored column is the server's
   * figure and lags any settlement taken offline, so it is recomputed here
   * with the server's own rule — cash plus written-off discount, kind
   * "payment" only — and the two therefore always agree once the push lands.
   */
  const items: Debt[] = useMemo(() => {
    const byDebt = new Map<string, DebtPayment[]>();
    for (const p of allPayments) {
      const arr = byDebt.get(p.debt_id) ?? [];
      arr.push(p);
      byDebt.set(p.debt_id, arr);
    }
    return [...rawDebts]
      .map((d) => ({
        ...d,
        paid_amount: derivePaidAmount(byDebt.get(d.id) ?? []),
      }))
      .sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      );
  }, [rawDebts, allPayments]);
  const loading = debtsLoading;
  const [tab, setTab] = useState<"all" | "open" | "settled">("open");
  const [filter, setFilter] = useState<"all" | Direction>("all");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [form, setForm] = useState({ ...empty });
  /** Who the ledger is against, when it was picked rather than typed. */
  const [person, setPerson] = useState<LedgerPerson | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  /**
   * One account per person. Every unpaid bill still has its own khata row (so
   * editing or voiding that bill reverses exactly its share), but a customer
   * with two unpaid bills is ONE ledger on this screen, not two.
   */
  const groups = useMemo(
    () => groupLedgers(items).sort((a, b) => b.latest_at.localeCompare(a.latest_at)),
    [items],
  );

  /**
   * Each bill's number, for naming it inside the account. Looked up by id
   * rather than loading every sale and purchase into this page.
   */
  const [billNo, setBillNo] = useState<Map<string, string>>(new Map());
  const billIds = useMemo(
    () =>
      items
        .map((d) => (d.sale_id ? `sales:${d.sale_id}` : d.purchase_id ? `purchases:${d.purchase_id}` : ""))
        .filter(Boolean)
        .sort()
        .join(","),
    [items],
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map<string, string>();
      for (const ref of billIds ? billIds.split(",") : []) {
        const [table, id] = ref.split(":");
        const row = await getById<{ receipt_number?: string | null; reference_number?: string | null }>(table, id);
        const no = table === "sales" ? row?.receipt_number : row?.reference_number;
        if (no) next.set(id, no);
      }
      if (!cancelled) setBillNo(next);
    })();
    return () => { cancelled = true; };
  }, [billIds]);

  const [paymentsOpen, setPaymentsOpen] = useState(false);
  // Held by ledger key, not by value: the open dialog's balance has to follow
  // the derived list, so recording a payment updates it without a refetch.
  const [payKey, setPayKey] = useState<string | null>(null);
  const selectedGroup = useMemo(() => groups.find((g) => g.key === payKey) ?? null, [groups, payKey]);
  const payments: DebtPayment[] = useMemo(() => {
    const ids = new Set(selectedGroup?.debts.map((d) => d.id) ?? []);
    return allPayments
      .filter((p) => ids.has(p.debt_id))
      .sort(
        (a, b) =>
          String(a.payment_date ?? "").localeCompare(String(b.payment_date ?? "")) ||
          String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
      );
  }, [allPayments, selectedGroup]);
  const [payAccountId, setPayAccountId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ ...emptyPayment });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [confirmPaymentDeleteId, setConfirmPaymentDeleteId] = useState<string | null>(null);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const detailsGroup = useMemo(() => groups.find((g) => g.key === detailsKey) ?? null, [groups, detailsKey]);
  const [importOpen, setImportOpen] = useState(false);

  const cur = currentShop?.currency ?? "USD";

  /** Open WhatsApp (owner's own) with a pre-filled reminder for everything the person owes. */
  const sendReminder = (g: Group) => {
    if (!g.phone) return toast.error("This ledger has no phone number.");
    const message = buildDebtReminderMessage({
      personName: g.person_name,
      shopName: currentShop?.name ?? "our shop",
      balance: g.remaining,
      currency: g.currency ?? cur,
      dueDate: g.due_date,
      formatMoney,
    });
    const url = buildWaReminderUrl(g.phone, message);
    if (!url) return toast.error("This phone number looks invalid for WhatsApp.");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /**
   * The khata reads from the local store, so it works with no connection.
   *
   * ⚠️ `paid_amount` on the row is the SERVER's figure and lags a settlement
   * taken offline, so it is recomputed here from the local payments using the
   * server's own rule — cash plus written-off discount, kind "payment" only.
   * Trusting the stored column would show a balance that ignores money the
   * shop just took.
   */
  const load = async () => {
    return items;
  };


  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.id]);

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (tab !== "all" && g.status !== tab) return false;
      if (filter !== "all" && g.direction !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hit =
          g.person_name.toLowerCase().includes(s) ||
          (g.phone ?? "").toLowerCase().includes(s) ||
          g.debts.some(
            (d) =>
              (d.notes ?? "").toLowerCase().includes(s) ||
              (d.phone ?? "").toLowerCase().includes(s) ||
              ((d.sale_id && billNo.get(d.sale_id)) || (d.purchase_id && billNo.get(d.purchase_id)) || "")
                .toLowerCase()
                .includes(s),
          );
        if (!hit) return false;
      }
      return true;
    });
  }, [groups, tab, filter, search, billNo]);

  // The tiles follow the list: the tab, the receive/pay filter and the search
  // all narrow them, so searching one person shows what THAT person owes.
  const totals = useMemo(() => {
    let owedToMe = 0;
    let iOwe = 0;
    filtered.forEach((g) => {
      g.debts.forEach((d) => {
        const remaining = getRemainingAmount(d);
        if (remaining <= 0) return;
        if (d.direction === "owed_to_me") owedToMe += remaining;
        else iOwe += remaining;
      });
    });
    return { owedToMe, iOwe, net: owedToMe - iOwe };
  }, [filtered]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(filtered, {
    key: "debts",
    resetDeps: [tab, filter, search],
  });

  const selectedRemaining = selectedGroup?.remaining ?? 0;

  useAddNew({ "ledger-entry": canManage && (() => startCreate()) });

  const startCreate = () => {
    setEditing(null);
    setForm({ ...empty });
    setOpen(true);
  };

  const startEdit = (d: Debt) => {
    setEditing(d);
    setPerson(
      d.party_id
        ? {
            id: d.party_id, name: d.person_name, phone: d.phone,
            source: "party" as const, role_label: "Party",
            // Only what the row itself remembers; the picker replaces this
            // with the real flags the moment another person is chosen.
            is_customer: false, is_supplier: false, is_maker: false, is_processor: false,
          }
        : null,
    );
    setForm({
      direction: d.direction,
      person_name: d.person_name,
      phone: d.phone ?? "",
      amount: String(d.amount),
      due_date: d.due_date ?? "",
      notes: d.notes ?? "",
    });
    setOpen(true);
  };

  const openPaymentsDialog = (g: Group) => {
    setPayKey(g.key);
    setPaymentsOpen(true);
    setPaymentForm({
      ...emptyPayment,
      amount: g.paid > 0 ? String(g.remaining || "") : "",
    });
  };

  // ── Roznamcha hand-off: a line of the day raised as a ledger record ──────
  const lineText = (e: DaybookEntryDto) =>
    [e.kind === "material" && (e.quantity || e.description)
      ? `${e.quantity ? `${Number(Number(e.quantity).toFixed(3))}${e.unit ? ` ${e.unit}` : ""} ` : ""}${e.description ?? ""}`.trim()
      : null, e.notes].filter(Boolean).join(" — ");

  /** A new khata row: whoever TOOK money or goods owes the shop; whoever GAVE is owed. */
  const openEntryFromLine = (e: DaybookEntryDto) => {
    startCreate();
    setForm({
      ...empty,
      direction: e.direction === "out" ? "owed_to_me" : "i_owe",
      person_name: e.party_name,
      amount: e.amount ? String(e.amount) : "",
      notes: lineText(e),
    });
    setPerson(
      e.party_id
        ? {
            id: e.party_id, name: e.party_name, phone: null, source: "party" as const, role_label: "Party",
            is_customer: false, is_supplier: false, is_maker: false, is_processor: false,
          }
        : null,
    );
  };

  /** A payment on their existing account, the amount filled in. */
  const openPaymentFromLine = (e: DaybookEntryDto, direction: Direction) => {
    const name = e.party_name.trim().toLowerCase();
    const group = groups.find(
      (g) => g.direction === direction && g.remaining > 0 &&
        (e.party_id ? g.party_id === e.party_id : g.person_name.trim().toLowerCase() === name),
    );
    if (!group) {
      toast.info(`${e.party_name} has nothing open on the ledger that way — opening a new entry instead.`);
      openEntryFromLine(e);
      return;
    }
    openPaymentsDialog(group);
    setPaymentForm({ ...emptyPayment, amount: e.amount ? String(Math.min(Number(e.amount), group.remaining)) : "", notes: lineText(e) });
  };

  const daybook = useDaybookHandoff({
    ledger_entry: openEntryFromLine,
    ledger_payment_in: (e) => openPaymentFromLine(e, "owed_to_me"),
    ledger_payment_out: (e) => openPaymentFromLine(e, "i_owe"),
  });

  const save = async () => {
    if (!currentShop || !user) return;
    if (!form.person_name.trim()) return toast.error("Name is required");
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Amount must be greater than 0");
    if (editing && amt < Number(editing.paid_amount ?? 0)) {
      return toast.error("Amount cannot be less than the amount already paid");
    }
    setSaving(true);

    const payload = {
      direction: form.direction,
      person_name: form.person_name.trim(),
      // Only parties can be linked; a customer ledger keeps the name snapshot.
      party_id: person?.source === "party" ? person.id : null,
      phone: form.phone.trim() || null,
      amount: amt,
      due_date: form.due_date || null,
      notes: form.notes.trim() || null,
    };
    // Written locally and queued: the khata has to work with no line. `debts`
    // is last-write-wins on the server, so an edit made offline lands cleanly.
    // ⚠️ paid_amount is never written from here — the server derives it from
    // the settlements, and sending a stale figure would move a balance nobody
    // touched.
    const now = new Date().toISOString();
    const newId = editing ? null : uuid();
    try {
      // ⚠️ paid_amount, status and settled_at are DERIVED on the server and
      // must never travel from here. `debts` is last-write-wins, so pushing
      // the figure shown on screen would overwrite the server's — and this
      // terminal may not have pulled every settlement yet, which would book a
      // balance that is quietly too low.
      const { paid_amount: _p, status: _s, settled_at: _st, ...editable } = (editing ?? {}) as Debt & {
        settled_at?: string | null;
      };
      void _p; void _s; void _st;
      await upsertLocal(
        "debts",
        editing
          ? { ...editable, ...payload, updated_at: now }
          : {
              id: newId,
              shop_id: currentShop.id,
              created_by: user.id,
              ...payload,
              currency: currentShop.currency ?? null,
              status: "open",
              paid_amount: 0,
              created_at: now,
              updated_at: now,
            },
        true,
      );
      notifyChange("debts");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
    void syncNow().catch(() => {});
    toast.success(editing ? "Ledger entry updated" : "Ledger entry added");
    if (newId && daybook.entry) await daybook.link(newId, `Ledger entry — ${payload.person_name}`);
    setOpen(false);
    await load();
  };

  const savePayment = async () => {
    if (!currentShop || !user || !selectedGroup) return;
    // A cheque settles the khata now; its money reaches an account only when it
    // clears. Cheques live on the server, so this path needs a connection.
    if (paymentForm.kind === "payment" && paymentForm.byCheque) {
      const amt = Number(paymentForm.amount || 0);
      if (!paymentForm.cheque_number.trim()) return toast.error("Enter the cheque number");
      if (!paymentForm.cheque_date) return toast.error("Enter the date on the cheque");
      if (!(amt > 0)) return toast.error("Amount must be greater than 0");
      if (amt > selectedGroup.remaining + 0.001) return toast.error("The cheque can't be for more than the remaining balance");
      if (!navigator.onLine) return toast.error("Recording a cheque needs a connection.");
      setPaymentSaving(true);
      try {
        // The server must hold every khata row this cheque is spread over.
        await syncNow();
        const res = await rpc<{ ok: boolean; error?: string }>("takeChequeAction", {
          debt_ids: selectedGroup.debts.map((d) => d.id),
          cheque_number: paymentForm.cheque_number.trim(),
          bank_name: paymentForm.bank_name.trim() || null,
          cheque_date: paymentForm.cheque_date,
          amount: amt,
          notes: paymentForm.notes.trim() || null,
        });
        if (!res.ok) return toast.error(res.error ?? "Failed");
        // Pull the settlement rows the server just wrote.
        await syncNow().catch(() => {});
        notifyChange("debt_payments");
        notifyChange("debts");
      } catch (e) {
        return toast.error(e instanceof Error ? e.message : "Failed");
      } finally {
        setPaymentSaving(false);
      }
      toast.success("Cheque recorded — it's on the Cheques page until it clears");
      if (daybook.entry) await daybook.link(selectedGroup.debts[0].id, `Cheque ${paymentForm.cheque_number.trim()} — ${selectedGroup.person_name}`);
      setPaymentForm({ ...emptyPayment });
      return;
    }
    const amount = Number(paymentForm.amount || 0);
    const discount = paymentForm.kind === "payment" ? Number(paymentForm.discount || 0) : 0;
    const remaining = selectedGroup.remaining;
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Amount can't be negative");
    if (!Number.isFinite(discount) || discount < 0) return toast.error("Discount can't be negative");
    if (paymentForm.kind === "increase" && amount <= 0) {
      return toast.error("Amount must be greater than 0");
    }
    // A settlement can be all cash, all discount, or a mix — what matters is
    // that the two together clear something and never more than is owed.
    if (paymentForm.kind === "payment" && amount + discount <= 0) {
      return toast.error("Enter an amount, a discount, or both");
    }
    if (paymentForm.kind === "payment" && amount + discount > remaining + 0.001) {
      return toast.error("Payment and discount together can't be more than the remaining balance");
    }

    const remainingOf = (d: Debt) => getRemainingAmount(d);
    // A payment is spread across the person's bills, oldest first, as one
    // settlement row per bill — the same split the server makes online, so
    // each bill's balance (and what its edit or void reverses) stays its own.
    let parts: { debt_id: string; amount: number; discount: number }[];
    try {
      if (paymentForm.kind === "payment") {
        parts = allocateSettlement(
          selectedGroup.debts.map((d) => ({ id: d.id, created_at: d.created_at, remaining: remainingOf(d) })),
          amount,
          discount,
        );
      } else {
        const target = increaseTarget(selectedGroup.debts, remainingOf);
        if (!target) return toast.error("This ledger has no bills");
        parts = [{ debt_id: target.id, amount, discount: 0 }];
      }
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }

    setPaymentSaving(true);
    // The money account and the recalculated balance are the server's job when
    // these rows are pushed; the terminal only records that the money came in,
    // so the counter can take payment with no connection.
    try {
      const now = new Date().toISOString();
      for (const part of parts) {
        await upsertLocal(
          "debt_payments",
          {
            id: uuid(),
            shop_id: currentShop.id,
            debt_id: part.debt_id,
            created_by: user.id,
            kind: paymentForm.kind,
            amount: part.amount,
            discount: part.discount,
            payment_date: paymentForm.payment_date,
            account_id: payAccountId || null,
            notes: paymentForm.notes.trim() || null,
            created_at: now,
          },
          true,
        );
        // An 'increase' raises the principal; mirror it locally so the balance
        // on screen is right before the push confirms it.
        if (paymentForm.kind === "increase") {
          const debt = selectedGroup.debts.find((d) => d.id === part.debt_id);
          if (debt) {
            await upsertLocal(
              "debts",
              { ...debt, amount: Number(debt.amount) + part.amount, updated_at: now },
              false,
            );
          }
        }
      }
      notifyChange("debt_payments");
      if (paymentForm.kind === "increase") notifyChange("debts");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setPaymentSaving(false);
    }
    void syncNow().catch(() => {});

    toast.success(paymentForm.kind === "payment" ? "Payment recorded" : "Debt increased");
    if (daybook.entry) await daybook.link(selectedGroup.debts[0].id, `Ledger payment — ${selectedGroup.person_name}`);
    setPaymentForm({ ...emptyPayment });
  };

  const remove = async (id: string) => {
    try {
      // The settlements go with it: the server cascades on delete, and locally
      // they would otherwise be orphaned rows still counted into a balance.
      for (const pay of allPayments.filter((p) => p.debt_id === id)) {
        await deleteLocal("debt_payments", pay.id, false);
      }
      await deleteLocal("debts", id, true);
      notifyChange("debts");
      notifyChange("debt_payments");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    void syncNow().catch(() => {});
    toast.success("Ledger entry deleted");
    setConfirmId(null);
  };

  const removePayment = async (id: string) => {
    try {
      // The khata's paid figure is recomputed on the server once this delete
      // is pushed; locally it falls out of the derived sum straight away.
      await deleteLocal("debt_payments", id, true);
      notifyChange("debt_payments");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    void syncNow().catch(() => {});
    toast.success("Payment deleted");
    setConfirmPaymentDeleteId(null);
  };

  /**
   * Print an A4 statement — one account, or every account. Goes through a
   * hidden iframe so the sheet is the document, without the app's chrome
   * around it; the browser's print dialog is also how it becomes a PDF.
   */
  const printStatements = async (ids?: string[]) => {
    if (!currentShop) return;
    // Built from the local store rather than fetched: every figure on the
    // sheet is already here, and a shop settling up with someone at the
    // counter should not need the line to be up to hand them their statement.
    // One sheet per PERSON, not per khata row — the same merge the server's
    // statement action makes.
    const wanted = ids ? items.filter((d) => ids.includes(d.id)) : items;
    const ledgers = groupLedgers(wanted)
      .sort((a, b) => a.person_name.localeCompare(b.person_name))
      .map((g) => ({
        person_name: g.person_name,
        phone: g.phone,
        direction: g.direction,
        amount: g.amount,
        paid_amount: g.paid,
        notes: g.debts.length === 1 ? g.debts[0].notes : null,
        // Every bill and entry, so the sheet prints the same dated history as
        // the account dialog (personLedgerLog) rather than one opening lump.
        bills: g.debts.map((d) => ({
          id: d.id,
          amount: Number(d.amount ?? 0),
          created_at: d.created_at,
          label: billLabel(d, billNo),
          notes: d.sale_id || d.purchase_id ? d.notes : null,
        })),
        payments: allPayments
          .filter((pay) => g.debts.some((d) => d.id === pay.debt_id))
          .map((pay) => ({
            id: pay.id,
            debt_id: pay.debt_id,
            payment_date: String(pay.payment_date ?? "").slice(0, 10),
            created_at: pay.created_at ?? null,
            amount: Number(pay.amount ?? 0),
            discount: Number(pay.discount ?? 0),
            kind: String(pay.kind ?? "payment"),
            notes: pay.notes ?? null,
            account_name: pay.account_id ? (moneyAccounts.find((a) => a.id === pay.account_id)?.name ?? null) : null,
          })),
      }));
    if (ledgers.length === 0) return toast.error("Nothing to print.");

    const html = buildLedgerStatementHtml({
      shop: { name: currentShop.name, phone: currentShop.phone, address: currentShop.address },
      ledgers,
      currency: cur,
      subtitle: ledgers.length === 1 ? undefined : `${ledgers.length} accounts`,
    });

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    // Parked off-screen at a real A4 width rather than 0x0: a zero-sized frame
    // lays its document out in a zero-width viewport, which on some browsers
    // clips a multi-sheet print down to the first page.
    iframe.style.cssText =
      "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;opacity:0;pointer-events:none;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return toast.error("Could not open the print view.");
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => iframe.remove(), 60_000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ledger (Khata)</h1>
          <p className="text-sm text-muted-foreground">Track money you will receive and money you need to pay.</p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Printer className="size-4 mr-2" /> Print
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {/* Printing "all" from the filtered list would silently drop
                    the settled accounts, since the list opens on Open. */}
                <DropdownMenuItem onClick={() => void printStatements()}>
                  Every account ({groups.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void printStatements(filtered.flatMap((g) => g.debts.map((d) => d.id)))}>
                  Just this list ({filtered.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4 mr-2" /> Import
            </Button>
            <Button onClick={startCreate}>
              <Plus className="size-4 mr-2" /> Add debt
            </Button>
          </div>
        )}
      </div>

      <PageTip id="debts.intro" title="Two directions: to receive, and to pay">
        Use <b>To receive</b> when a customer owes you (these are also created automatically from credit sales at POS).
        Use <b>To pay</b> for money your shop owes a supplier or anyone else. Each person has one ledger: a new unpaid bill
        adds to it, and a payment clears their oldest bill first. Once fully paid, the ledger is marked <b>settled</b>.
      </PageTip>



      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ArrowDownLeft className="size-4 text-success" /> To receive
          </div>
          <div className="text-lg sm:text-2xl font-bold mt-1 tabular-nums break-words leading-tight">{formatMoney(totals.owedToMe, cur)}</div>
          <div className="text-xs text-muted-foreground mt-1">Open remaining balance</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <ArrowUpRight className="size-4 text-destructive" /> To pay
          </div>
          <div className="text-lg sm:text-2xl font-bold mt-1 tabular-nums break-words leading-tight">{formatMoney(totals.iOwe, cur)}</div>
          <div className="text-xs text-muted-foreground mt-1">Open remaining balance</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Net balance</div>
          <div
            className={
              "text-lg sm:text-2xl font-bold mt-1 tabular-nums break-words leading-tight " +
              (totals.net >= 0 ? "text-success" : "text-destructive")
            }
          >
            {formatMoney(totals.net, cur)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Based on unpaid amounts only</div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "open" | "settled")}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="settled">Settled</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as "all" | Direction)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directions</SelectItem>
                <SelectItem value="owed_to_me">To receive</SelectItem>
                <SelectItem value="i_owe">To pay</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Search name, phone, bill #, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No debts to show.</TableCell></TableRow>
              ) : visible.map((g) => {
                const money = (n: number) => formatMoney(n, g.currency ?? cur);
                const only = g.debts.length === 1 ? g.debts[0] : null;

                return (
                  <TableRow key={g.key}>
                    <TableCell>
                      <div className="font-medium">{g.person_name}</div>
                      {g.phone && <div className="text-xs text-muted-foreground">{g.phone}</div>}
                      {g.debts.length > 1 && (
                        <div className="text-xs text-muted-foreground">{g.debts.length} bills</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {g.direction === "owed_to_me" ? (
                        <Badge variant="outline" className="text-success border-success/40">
                          <ArrowDownLeft className="size-3 mr-1" /> To receive
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40">
                          <ArrowUpRight className="size-3 mr-1" /> To pay
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(g.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(g.paid)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{money(g.remaining)}</TableCell>
                    <TableCell className="text-sm">{g.due_date ?? "—"}</TableCell>
                    <TableCell>
                      {g.status === "open"
                        ? <Badge variant="secondary">Open</Badge>
                        : <Badge>Settled</Badge>}
                    </TableCell>

                    <TableCell className="text-right">
                      {canManage && (
                        <div className="flex justify-end gap-2">
                          {g.direction === "owed_to_me" && g.phone && g.remaining > 0 && (
                            <Button variant="ghost" size="icon" className="size-8 text-success" onClick={() => sendReminder(g)} title="Send WhatsApp reminder">
                              <MessageCircle className="size-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setDetailsKey(g.key)} title="Details">
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openPaymentsDialog(g)} title="Payments">
                            <Wallet className="size-4" />
                          </Button>
                          {/* With several bills, each is edited from the details
                              view — one pencil here couldn't say which bill. */}
                          {only && (
                            <>
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => startEdit(only)} title="Edit">
                                <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setConfirmId(only.id)} title="Delete">
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) daybook.abandon(); }}>
        <DialogContent data-add-new="ledger-entry">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit debt" : "Add debt"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v as Direction })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owed_to_me">I will receive money</SelectItem>
                  <SelectItem value="i_owe">I will pay money</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Person</Label>
              <LedgerPersonPicker
                value={person}
                onChange={(p) => {
                  setPerson(p);
                  if (p) setForm((f) => ({ ...f, person_name: p.name, phone: p.phone ?? "" }));
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Customers and every kind of party are in this list. Use + to add someone new.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name on the ledger</Label>
                <Input value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({cur})</Label>
                <Input type="number" inputMode="decimal" min="0" step="0.01"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                {editing && Number(editing.paid_amount ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Already paid: {formatMoney(editing.paid_amount, editing.currency ?? cur)}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Due date (optional)</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); daybook.abandon(); }}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={paymentsOpen}
        onOpenChange={(nextOpen) => {
          setPaymentsOpen(nextOpen);
          if (!nextOpen) daybook.abandon();
          if (!nextOpen) {
            setPayKey(null);
            setPaymentForm({ ...emptyPayment });
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Payments{selectedGroup ? ` · ${selectedGroup.person_name}` : ""}</DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            // min-w-0: the dialog is a grid, and without it the entries table
            // (wider now it names each bill) stretches the dialog past its edge.
            <div className="space-y-4 py-2 min-w-0">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Total debt</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatMoney(selectedGroup.amount, selectedGroup.currency ?? cur)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Paid</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatMoney(selectedGroup.paid, selectedGroup.currency ?? cur)}</div>
                </Card>
                <Card className="p-3">
                  <div className="text-xs text-muted-foreground">Remaining</div>
                  <div className="mt-1 font-semibold tabular-nums">{formatMoney(selectedRemaining, selectedGroup.currency ?? cur)}</div>
                </Card>
              </div>

              {canManage && (
                <div className="rounded-md border p-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Entry type</Label>
                    <RadioGroup
                      value={paymentForm.kind}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, kind: v as EntryKind })}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <label
                        htmlFor="kind-payment"
                        className={
                          "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors " +
                          (paymentForm.kind === "payment" ? "border-primary bg-primary/5" : "hover:bg-muted/50")
                        }
                      >
                        <RadioGroupItem value="payment" id="kind-payment" className="mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <TrendingDown className="size-4 text-success" />
                            {selectedGroup.direction === "owed_to_me" ? "Receive payment" : "Make payment"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedGroup.debts.length > 1
                              ? "Reduces the remaining balance, oldest bill first."
                              : "Reduces the remaining balance."}
                          </div>
                        </div>
                      </label>
                      <label
                        htmlFor="kind-increase"
                        className={
                          "flex items-start gap-2 rounded-md border p-3 cursor-pointer transition-colors " +
                          (paymentForm.kind === "increase" ? "border-primary bg-primary/5" : "hover:bg-muted/50")
                        }
                      >
                        <RadioGroupItem value="increase" id="kind-increase" className="mt-0.5" />
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium flex items-center gap-1.5">
                            <TrendingUp className="size-4 text-destructive" />
                            Add more debt
                          </div>
                          <div className="text-xs text-muted-foreground">Increases the total owed.</div>
                        </div>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        max={paymentForm.kind === "payment" ? selectedRemaining : undefined}
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      />
                    </div>
                    {/* Settling often comes with "take something off" — that
                        clears the balance like cash but was never collected,
                        so it is recorded apart from the amount. */}
                    {paymentForm.kind === "payment" && (
                      <div className="space-y-1.5">
                        <Label>Discount given</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={paymentForm.discount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, discount: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      />
                    </div>
                  </div>
                  {paymentForm.kind === "payment" && currentShop?.cheques_enabled && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <Checkbox
                        checked={paymentForm.byCheque}
                        onCheckedChange={(v) => setPaymentForm({ ...paymentForm, byCheque: !!v })}
                      />
                      Paid by cheque
                      <span className="text-xs text-muted-foreground">— comes off the balance now; money reaches the bank when it clears</span>
                    </label>
                  )}
                  {paymentForm.kind === "payment" && paymentForm.byCheque && currentShop?.cheques_enabled ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Cheque number</Label>
                        <Input value={paymentForm.cheque_number} onChange={(e) => setPaymentForm({ ...paymentForm, cheque_number: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bank</Label>
                        <Input value={paymentForm.bank_name} onChange={(e) => setPaymentForm({ ...paymentForm, bank_name: e.target.value })} placeholder="e.g. HBL" />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Cheque date</Label>
                        <Input type="date" value={paymentForm.cheque_date} onChange={(e) => setPaymentForm({ ...paymentForm, cheque_date: e.target.value })} />
                      </div>
                    </div>
                  ) : (
                    <AccountPicker value={payAccountId} onChange={setPayAccountId} label="Money in / out of" />
                  )}
                  <div className="space-y-1.5">
                    <Label>Notes (optional)</Label>
                    <Input
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Cash, bank transfer, note…"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={savePayment} disabled={paymentSaving} className="w-full sm:w-auto">
                      {paymentSaving ? "Saving…" : paymentForm.kind === "payment" ? "Record payment" : "Add debt"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-md border overflow-auto max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      {selectedGroup.debts.length > 1 && <TableHead>Bill</TableHead>}
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No entries recorded yet.</TableCell>
                      </TableRow>
                    ) : payments.map((payment) => {
                      const isIncrease = payment.kind === "increase";
                      const bill = selectedGroup.debts.find((d) => d.id === payment.debt_id);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.payment_date}</TableCell>
                          <TableCell>
                            {isIncrease ? (
                              <Badge variant="outline" className="text-destructive border-destructive/40">
                                <TrendingUp className="size-3 mr-1" /> Added debt
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-success border-success/40">
                                <TrendingDown className="size-3 mr-1" /> Payment
                              </Badge>
                            )}
                          </TableCell>
                          {selectedGroup.debts.length > 1 && (
                            <TableCell className="text-sm whitespace-nowrap">{bill ? billLabel(bill, billNo) : "—"}</TableCell>
                          )}
                          <TableCell className="text-sm text-muted-foreground">{payment.notes ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums text-warning">
                            {Number(payment.discount ?? 0) > 0 ? formatMoney(Number(payment.discount), cur) : "—"}
                          </TableCell>
                          <TableCell className={"text-right tabular-nums font-medium " + (isIncrease ? "text-destructive" : "text-success")}>
                            {isIncrease ? "+" : "−"}{formatMoney(payment.amount, selectedGroup.currency ?? cur)}
                          </TableCell>
                          <TableCell className="text-right">
                            {canManage && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive"
                                onClick={() => setConfirmPaymentDeleteId(payment.id)}
                                disabled={!!payment.cheque_id}
                                title={payment.cheque_id ? "Part of a cheque — clear or bounce it on the Cheques page" : "Delete entry"}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {detailsGroup && (
        <DetailsDialog
          open={!!detailsGroup}
          onClose={() => setDetailsKey(null)}
          title={detailsGroup.person_name}
          subtitle={detailsGroup.direction === "owed_to_me" ? "To receive" : "To pay"}
          rows={[
            { label: "Type", value: detailsGroup.direction === "owed_to_me" ? "I will receive money" : "I will pay money" },
            { label: "Status", value: detailsGroup.status === "settled" ? "Settled" : "Open" },
            { label: "Phone", value: detailsGroup.phone ?? "—" },
            { label: "Due date", value: detailsGroup.due_date ?? "—" },
            { label: "Total amount", value: formatMoney(detailsGroup.amount, detailsGroup.currency ?? cur) },
            { label: "Paid", value: formatMoney(detailsGroup.paid, detailsGroup.currency ?? cur) },
            { label: "Remaining", value: formatMoney(detailsGroup.remaining, detailsGroup.currency ?? cur) },
            { label: "Since", value: new Date(detailsGroup.debts[0].created_at).toLocaleString() },
          ]}
          wide
        >
          <section className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-semibold">
              Bills on this ledger ({detailsGroup.debts.length})
            </h3>
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...detailsGroup.debts].reverse().map((d) => {
                    const money = (n: number) => formatMoney(n, d.currency ?? cur);
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="font-medium">{billLabel(d, billNo)}</div>
                          {(d.sale_id || d.purchase_id) && d.notes && (
                            <div className="text-xs text-muted-foreground break-words">{d.notes}</div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{new Date(d.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(d.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(d.paid_amount ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{money(getRemainingAmount(d))}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => startEdit(d)} title="Edit">
                                <Pencil className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setConfirmId(d.id)} title="Delete">
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
          <LedgerEntriesTable
            debts={detailsGroup.debts.map((d) => ({
              id: d.id,
              amount: d.amount,
              created_at: d.created_at,
              label: billLabel(d, billNo),
            }))}
            payments={allPayments
              .filter((p) => detailsGroup.debts.some((d) => d.id === p.debt_id))
              .map((p) => ({
                ...p,
                account_name: p.account_id ? (moneyAccounts.find((a) => a.id === p.account_id)?.name ?? null) : null,
              }))}
            currency={detailsGroup.currency ?? cur}
          />
        </DetailsDialog>
      )}

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="Delete this bill from the ledger?"
        description="This action cannot be undone."
        variant="destructive"
        onConfirm={() => { if (confirmId) void remove(confirmId); }}
      />

      <ConfirmDialog
        open={!!confirmPaymentDeleteId}
        onOpenChange={(v) => !v && setConfirmPaymentDeleteId(null)}
        title="Delete payment?"
        description="The debt balance will be recalculated automatically."
        variant="destructive"
        onConfirm={() => { if (confirmPaymentDeleteId) void removePayment(confirmPaymentDeleteId); }}
      />

      <ImportDebtsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void load()}
      />
    </div>
  );
}
