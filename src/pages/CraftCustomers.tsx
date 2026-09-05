import { useCallback, useEffect, useMemo, useState } from "react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Users, Search, Printer, Trash2, HandCoins, FileText, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { usePermissions } from "@/hooks/usePermissions";
import { PartySelect } from "@/components/PartySelect";
import { CustomerChallanPrintDialog } from "@/components/CustomerChallanPrintDialog";
import { rpc } from "@/lib/apiClient";
import type {
  CraftCustomer,
  CustomerChallanDto,
  CustomerPaymentDto,
} from "@/lib/craftCustomerTypes";

/** What every craft-customer action returns over RPC. */
type Res = {
  ok: boolean;
  error?: string;
  id?: string;
  customer?: { id: string; name: string; phone: string | null };
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const emptyChallan = {
  id: undefined as string | undefined,
  customer_id: "",
  date: today(),
  amount: "",
  due_date: "",
  bill_no: "",
  bilty_no: "",
  notes: "",
};

const emptyPayment = {
  id: undefined as string | undefined,
  customer_id: "",
  date: today(),
  amount: "",
  method: "cash",
  reference: "",
  note: "",
};

/**
 * A handicraft shop's customer book: what each customer was billed on a
 * challan, what they have paid, and what is left.
 *
 * Separate from the party ledger on purpose — that one is what the shop owes a
 * party for yarn and job work, and this runs the other way. A party who both
 * sells yarn and buys shawls therefore has two figures that never net.
 */
export default function CraftCustomers() {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const perms = usePermissions();
  const cur = currentShop?.currency ?? "PKR";
  const canManage = perms.canManageSuppliers;
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [customers, setCustomers] = useState<CraftCustomer[]>([]);
  const [challans, setChallans] = useState<CustomerChallanDto[]>([]);
  const [payments, setPayments] = useState<CustomerPaymentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"customers" | "challans" | "payments">("customers");

  const [challanForm, setChallanForm] = useState({ ...emptyChallan });
  const [challanOpen, setChallanOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ ...emptyPayment });
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState<CustomerChallanDto | null>(null);

  // Quick-add, so a new customer never sends anyone off mid-challan.
  const [newOpen, setNewOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", city: "" });

  // `loading` starts true and is only ever cleared, so the effect below has no
  // synchronous setState in it. A refresh after saving therefore updates the
  // table in place instead of flashing a spinner over it.
  const load = useCallback(async () => {
    if (!currentShop) return;
    try {
      const [c, ch, p] = await Promise.all([
        rpc<CraftCustomer[]>("listCraftCustomersAction"),
        rpc<CustomerChallanDto[]>("listCustomerChallansAction"),
        rpc<CustomerPaymentDto[]>("listCustomerPaymentsAction"),
      ]);
      setCustomers(c);
      setChallans(ch);
      setPayments(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load customers");
    } finally {
      setLoading(false);
    }
  }, [currentShop]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const billed = customers.reduce((a, c) => a + c.billed, 0);
    const received = customers.reduce((a, c) => a + c.received, 0);
    return { billed, received, outstanding: Math.round((billed - received) * 100) / 100 };
  }, [customers]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  const partyOptions = useMemo(
    () => customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
    [customers],
  );

  const openChallan = (c?: CustomerChallanDto, customerId?: string) => {
    setChallanForm(
      c
        ? {
            id: c.id,
            customer_id: c.customer_id,
            date: c.date,
            amount: String(c.amount),
            due_date: c.due_date ?? "",
            bill_no: c.bill_no ?? "",
            bilty_no: c.bilty_no ?? "",
            notes: c.notes ?? "",
          }
        : { ...emptyChallan, customer_id: customerId ?? "" },
    );
    setChallanOpen(true);
  };

  const openPayment = (p?: CustomerPaymentDto, customerId?: string) => {
    setPaymentForm(
      p
        ? {
            id: p.id,
            customer_id: p.customer_id,
            date: p.date,
            amount: String(p.amount),
            method: p.method,
            reference: p.reference ?? "",
            note: p.note ?? "",
          }
        : { ...emptyPayment, customer_id: customerId ?? "" },
    );
    setPaymentOpen(true);
  };

  const saveChallan = async () => {
    if (!challanForm.customer_id) return toast.error("Pick a customer");
    const amount = parseFloat(challanForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const res = await rpc<Res>("saveCustomerChallanAction", {
        ...(challanForm.id ? { id: challanForm.id } : {}),
        customer_id: challanForm.customer_id,
        date: challanForm.date,
        amount,
        due_date: challanForm.due_date || null,
        bill_no: challanForm.bill_no || null,
        bilty_no: challanForm.bilty_no || null,
        notes: challanForm.notes || null,
      });
      if (!res.ok) return toast.error(res.error);
      toast.success(challanForm.id ? "Challan updated" : "Challan saved");
      setChallanOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async () => {
    if (!paymentForm.customer_id) return toast.error("Pick a customer");
    const amount = parseFloat(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter an amount");
    setBusy(true);
    try {
      const res = await rpc<Res>("saveCustomerPaymentAction", {
        ...(paymentForm.id ? { id: paymentForm.id } : {}),
        customer_id: paymentForm.customer_id,
        date: paymentForm.date,
        amount,
        method: paymentForm.method || "cash",
        reference: paymentForm.reference || null,
        note: paymentForm.note || null,
      });
      if (!res.ok) return toast.error(res.error);
      toast.success(paymentForm.id ? "Payment updated" : "Payment recorded");
      setPaymentOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const createCustomer = async () => {
    if (!newCustomer.name.trim()) return toast.error("Give the customer a name");
    setBusy(true);
    try {
      const res = await rpc<Res>("createCraftCustomerAction", {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone || null,
        city: newCustomer.city || null,
      });
      if (!res.ok) return toast.error(res.error);
      toast.success("Customer added");
      setNewCustomer({ name: "", phone: "", city: "" });
      setNewOpen(false);
      await load();
      // Drop straight into whichever form asked for them.
      if (challanOpen) setChallanForm((f) => ({ ...f, customer_id: res.customer.id }));
      if (paymentOpen) setPaymentForm((f) => ({ ...f, customer_id: res.customer.id }));
    } finally {
      setBusy(false);
    }
  };

  const removeChallan = async (c: CustomerChallanDto) => {
    const ok = await confirm({
      title: `Delete challan #${c.number}?`,
      description: `${c.customer_name} · ${formatMoney(c.amount, cur)}`,
      variant: "destructive",
    });
    if (!ok) return;
    const res = await rpc<Res>("deleteCustomerChallanAction", c.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Challan deleted");
    await load();
  };

  const removePayment = async (p: CustomerPaymentDto) => {
    const ok = await confirm({
      title: `Delete payment #${p.number}?`,
      description: `${p.customer_name} · ${formatMoney(p.amount, cur)}`,
      variant: "destructive",
    });
    if (!ok) return;
    const res = await rpc<Res>("deleteCustomerPaymentAction", p.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Payment deleted");
    await load();
  };

  const partyPicker = (
    value: string,
    onChange: (id: string) => void,
  ) => (
    <div className="flex items-end gap-2">
      <div className="flex-1 min-w-0 space-y-1.5">
        <Label>Customer</Label>
        <PartySelect
          value={value}
          onChange={onChange}
          options={partyOptions}
          placeholder="Select customer"
          emptyLabel={null}
          className="w-full"
        />
      </div>
      <Button type="button" variant="outline" size="icon" onClick={() => setNewOpen(true)} title="Add a customer">
        <Plus className="size-4" />
      </Button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {confirmDialog}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="size-7 text-primary" /> Customers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What each customer was billed on a challan, and what they have paid.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => openPayment()}>
              <HandCoins className="size-4 mr-2" /> Record payment
            </Button>
            <Button
              onClick={() => openChallan()}
              className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
            >
              <Plus className="size-4 mr-2" /> New challan
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Billed</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{formatMoney(totals.billed, cur)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Received</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{formatMoney(totals.received, cur)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Outstanding</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1 text-warning">
            {formatMoney(totals.outstanding, cur)}
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
          <TabsTrigger value="challans">Challans ({challans.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "customers" && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                className="ps-9"
                placeholder="Search name, phone or city"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">Loading…</div>
          ) : shown.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No customers yet. Mark a party as a customer on the Parties page, or add one from a challan.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-end">Billed</TableHead>
                  <TableHead className="text-end">Received</TableHead>
                  <TableHead className="text-end">Balance</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[c.city, c.phone].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(c.billed, cur)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(c.received, cur)}</TableCell>
                    <TableCell className={`text-end tabular-nums font-semibold ${c.balance > 0 ? "text-warning" : ""}`}>
                      {formatMoney(c.balance, cur)}
                    </TableCell>
                    <TableCell className="text-end">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openChallan(undefined, c.id)}>
                            <FileText className="size-4 me-1" /> Challan
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openPayment(undefined, c.id)}>
                            <HandCoins className="size-4 me-1" /> Payment
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "challans" && (
        <Card className="overflow-hidden">
          {challans.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No challans yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Bill / Bilty</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="text-end">Amount</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challans.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono">{c.number}</TableCell>
                    <TableCell>{c.date}</TableCell>
                    <TableCell className="font-medium">{c.customer_name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[c.bill_no, c.bilty_no].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{c.due_date ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(c.amount, cur)}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setPrinting(c)} title="Print">
                          <Printer className="size-4" />
                        </Button>
                        {canManage && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => openChallan(c)} title="Edit">
                              <Edit2 className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => void removeChallan(c)} title="Delete">
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "payments" && (
        <Card className="overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No payments yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-end">Amount</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.number}</TableCell>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="font-medium">{p.customer_name}</TableCell>
                    <TableCell className="text-xs">
                      {p.method}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(p.amount, cur)}</TableCell>
                    <TableCell className="text-end">
                      {canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openPayment(p)} title="Edit">
                            <Edit2 className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => void removePayment(p)} title="Delete">
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {/* New / edit challan */}
      <Dialog open={challanOpen} onOpenChange={(o) => { if (!busy) setChallanOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{challanForm.id ? "Edit challan" : "New challan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {partyPicker(challanForm.customer_id, (id) => setChallanForm((f) => ({ ...f, customer_id: id })))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({cur})</Label>
                <Input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={challanForm.amount}
                  onChange={(e) => setChallanForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={challanForm.date}
                  onChange={(e) => setChallanForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={challanForm.due_date}
                  onChange={(e) => setChallanForm((f) => ({ ...f, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Bill no</Label>
                <Input
                  value={challanForm.bill_no}
                  onChange={(e) => setChallanForm((f) => ({ ...f, bill_no: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>Bilty no</Label>
                <Input
                  value={challanForm.bilty_no}
                  onChange={(e) => setChallanForm((f) => ({ ...f, bilty_no: e.target.value }))}
                  placeholder="Freight receipt the goods travelled on"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={challanForm.notes}
                onChange={(e) => setChallanForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChallanOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void saveChallan()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={paymentOpen} onOpenChange={(o) => { if (!busy) setPaymentOpen(o); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{paymentForm.id ? "Edit payment" : "Record payment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {partyPicker(paymentForm.customer_id, (id) => setPaymentForm((f) => ({ ...f, customer_id: id })))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({cur})</Label>
                <Input
                  type="number" step="0.01" min="0" inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Input
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, method: e.target.value }))}
                  placeholder="cash, or the bank"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder="TID off the slip"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Textarea
                rows={2}
                value={paymentForm.note}
                onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void savePayment()} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-add a customer without leaving the form */}
      <Dialog open={newOpen} onOpenChange={(o) => { if (!busy) setNewOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={newCustomer.city}
                  onChange={(e) => setNewCustomer((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void createCustomer()} disabled={busy || !newCustomer.name.trim()}>
              {busy ? "Saving…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerChallanPrintDialog challan={printing} onClose={() => setPrinting(null)} />
    </div>
  );
}
