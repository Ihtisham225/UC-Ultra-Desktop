import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Building2, Plus, Pencil, Trash2, Eye, Tag, RotateCcw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountPicker } from "@/components/AccountPicker";
import { PartySelect } from "@/components/PartySelect";
import { PageTip } from "@/components/PageTip";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useAddNew } from "@/hooks/useAddNew";
import { monthlyDepreciation } from "@/lib/assets";
import { rpc } from "@/lib/apiClient";
import { syncNow } from "@/lib/syncEngine";

/*
 * Port of the web app's Assets page — online, over /api/desktop/rpc, like the
 * other money screens that keep no offline store. A write is followed by a
 * sync so the account balances and the supplier's khata here catch up.
 */
interface AssetDto {
  id: string; name: string; category: string | null; purchase_date: string; cost: number; salvage_value: number;
  useful_life_months: number; amount_paid: number; account_id: string | null; supplier_id: string | null;
  supplier_name: string | null; serial_number: string | null; notes: string | null; status: string;
  disposed_at: string | null; disposal_amount: number | null; disposal_account_id: string | null; disposal_note: string | null;
  monthly_depreciation: number; accumulated_depreciation: number; book_value: number; end_of_life: string; disposal_gain: number | null;
}
// One loose shape, as elsewhere on the desktop: it compiles with strict off,
// where a { ok: true } | { ok: false; error } union doesn't narrow.
type Ok<T = object> = { ok: boolean; error?: string } & Partial<T>;
const afterWrite = <T,>(p: Promise<T>) => p.then(async (r) => { void syncNow().catch(() => {}); return r; });
const listAssetsAction = () => rpc<AssetDto[]>("listAssetsAction");
const listSuppliersAction = () => rpc<{ id: string; name: string; phone: string | null }[]>("listSuppliersAction");
const saveAssetAction = (d: unknown) => afterWrite(rpc<Ok<{ id: string }>>("saveAssetAction", d));
const disposeAssetAction = (d: unknown) => afterWrite(rpc<Ok<{ gain: number | null }>>("disposeAssetAction", d));
const reopenAssetAction = (id: string) => afterWrite(rpc<Ok>("reopenAssetAction", id));
const deleteAssetAction = (id: string) => afterWrite(rpc<Ok>("deleteAssetAction", id));

/** Common kinds, offered as suggestions — any text is fine. */
const CATEGORIES = ["Furniture & shelving", "Electronics", "Computer & printer", "Refrigeration", "Generator / UPS", "Vehicle", "Machinery", "Tools", "Building work"];
/** Typical useful lives, so nobody has to guess. */
const LIFE_HINTS: Record<string, number> = {
  "Furniture & shelving": 60, Electronics: 36, "Computer & printer": 36, Refrigeration: 60,
  "Generator / UPS": 60, Vehicle: 60, Machinery: 84, Tools: 36, "Building work": 120,
};

interface Draft {
  id?: string;
  name: string;
  category: string;
  purchase_date: string;
  cost: string;
  salvage_value: string;
  life_years: string;
  amount_paid: string;
  account_id: string | null;
  supplier_id: string;
  serial_number: string;
  notes: string;
}

const todayYmd = () => format(new Date(), "yyyy-MM-dd");
const blankDraft = (): Draft => ({
  name: "", category: "", purchase_date: todayYmd(), cost: "", salvage_value: "", life_years: "5",
  amount_paid: "", account_id: null, supplier_id: "", serial_number: "", notes: "",
});
const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Fixed assets — the shop's register of things it USES (a fridge, a
 * generator, shelves). Their cost reaches profit slowly, as monthly
 * depreciation, rather than all at once as an expense would.
 */
export default function Assets() {
  const { currentShop, role } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "PKR";
  const { confirm, dialog: confirmDialog } = useConfirm();
  const canEdit = role === "owner" || role === "manager";

  const [rows, setRows] = useState<AssetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [details, setDetails] = useState<AssetDto | null>(null);
  const [disposing, setDisposing] = useState<{ asset: AssetDto; kind: "sold" | "written_off"; date: string; amount: string; account_id: string | null; note: string } | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  const [showGone, setShowGone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAssetsAction());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load assets");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    listSuppliersAction().then((s) => setSuppliers(s.map((x) => ({ id: x.id, name: x.name, phone: x.phone })))).catch(() => {});
  }, []);

  const inUse = rows.filter((r) => r.status === "active");
  const shown = showGone ? rows : inUse;
  const totals = useMemo(() => ({
    cost: inUse.reduce((a, r) => a + r.cost, 0),
    book: inUse.reduce((a, r) => a + r.book_value, 0),
    monthly: inUse.filter((r) => r.end_of_life > todayYmd()).reduce((a, r) => a + r.monthly_depreciation, 0),
  }), [inUse]);

  const openNew = () => setDraft(blankDraft());
  useAddNew({ asset: canEdit && openNew });

  const openEdit = (a: AssetDto) =>
    setDraft({
      id: a.id, name: a.name, category: a.category ?? "", purchase_date: a.purchase_date, cost: String(a.cost),
      salvage_value: a.salvage_value ? String(a.salvage_value) : "", life_years: String(+(a.useful_life_months / 12).toFixed(2)),
      amount_paid: String(a.amount_paid), account_id: a.account_id, supplier_id: a.supplier_id ?? "",
      serial_number: a.serial_number ?? "", notes: a.notes ?? "",
    });

  const save = async () => {
    if (!draft) return;
    const cost = num(draft.cost);
    const months = Math.round(num(draft.life_years) * 12);
    if (!draft.name.trim()) return toast.error("What is it? Give it a name.");
    if (cost <= 0) return toast.error("Enter what it cost.");
    if (months < 1) return toast.error("How many years will it be used?");
    setBusy(true);
    const res = await saveAssetAction({
      id: draft.id,
      name: draft.name.trim(),
      category: draft.category.trim() || null,
      purchase_date: draft.purchase_date,
      cost,
      salvage_value: num(draft.salvage_value),
      useful_life_months: months,
      // Blank means paid in full — the common case.
      amount_paid: draft.amount_paid.trim() === "" ? cost : num(draft.amount_paid),
      account_id: draft.account_id,
      supplier_id: draft.supplier_id || null,
      serial_number: draft.serial_number.trim() || null,
      notes: draft.notes.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success(draft.id ? "Asset updated" : "Asset recorded");
    setDraft(null);
    await load();
  };

  const dispose = async () => {
    if (!disposing) return;
    setBusy(true);
    const res = await disposeAssetAction({
      id: disposing.asset.id,
      kind: disposing.kind,
      date: disposing.date,
      amount: num(disposing.amount),
      account_id: disposing.account_id,
      note: disposing.note.trim() || null,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    const g = res.gain ?? 0;
    toast.success(g === 0 ? "Recorded" : `Recorded — ${g > 0 ? "a gain" : "a loss"} of ${formatMoney(Math.abs(g), cur)} on the books`);
    setDisposing(null);
    await load();
  };

  const reopen = async (a: AssetDto) => {
    const res = await reopenAssetAction(a.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Back in use");
    setDetails(null);
    await load();
  };

  const remove = async (a: AssetDto) => {
    const ok = await confirm({
      title: `Delete “${a.name}”?`,
      description: "Only for something recorded by mistake. The money it took out of the account, and anything owed for it, are removed too. If it was sold or thrown away, use “Sell / write off” instead.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await deleteAssetAction(a.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Deleted");
    setDetails(null);
    await load();
  };

  const previewMonthly = draft
    ? monthlyDepreciation({
        purchase_date: draft.purchase_date, cost: num(draft.cost), salvage_value: num(draft.salvage_value),
        useful_life_months: Math.round(num(draft.life_years) * 12),
      })
    : 0;
  const owedPreview = draft && draft.amount_paid.trim() !== "" ? Math.max(num(draft.cost) - num(draft.amount_paid), 0) : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="size-7 text-primary" /> Assets</h1>
          <p className="text-muted-foreground mt-1">Things the shop uses — not stock, not expenses.</p>
        </div>
        {canEdit && (
          <Button onClick={openNew} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
            <Plus className="size-4 me-1.5" /> Add asset
          </Button>
        )}
      </header>

      <PageTip id="assets.intro" title="How assets reach your profit">
        A generator or a fridge serves the shop for years, so its cost isn&rsquo;t an expense of the month you bought it.
        It&rsquo;s recorded here at cost, and each month a share of it — <b>depreciation</b> — counts against profit in
        Analytics and Reports. Repairs and fuel stay ordinary expenses.
      </PageTip>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="In use" value={String(inUse.length)} />
        <Tile label="Bought for" value={formatMoney(totals.cost, cur)} />
        <Tile label="Worth on the books" value={formatMoney(totals.book, cur)} sub="cost less depreciation so far" />
        <Tile label="Depreciation / month" value={formatMoney(totals.monthly, cur)} sub="counted against profit" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <h2 className="font-semibold">{showGone ? "All assets" : "In use"}</h2>
          {rows.length !== inUse.length && (
            <Button variant="ghost" size="sm" onClick={() => setShowGone((s) => !s)}>
              {showGone ? "Hide sold & written off" : `Show sold & written off (${rows.length - inUse.length})`}
            </Button>
          )}
        </div>
        {loading ? (
          <div className="p-10 text-center text-muted-foreground">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Building2 className="size-10 mx-auto mb-2 opacity-40" />
            Nothing recorded yet. Add the counter, the fridge, the generator…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">Asset</th>
                  <th className="p-3 text-start hidden md:table-cell">Bought</th>
                  <th className="p-3 text-end">Cost</th>
                  <th className="p-3 text-end hidden md:table-cell">Per month</th>
                  <th className="p-3 text-end">Book value</th>
                  <th className="p-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium flex items-center gap-2">
                        {a.name}
                        {a.status !== "active" && (
                          <Badge variant="secondary">{a.status === "sold" ? "Sold" : "Written off"}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{a.category ?? "—"}</div>
                    </td>
                    <td className="p-3 hidden md:table-cell whitespace-nowrap">{format(new Date(a.purchase_date), "d MMM yyyy")}</td>
                    <td className="p-3 text-end tabular-nums">{formatMoney(a.cost, cur)}</td>
                    <td className="p-3 text-end tabular-nums hidden md:table-cell">
                      {a.status === "active" && a.end_of_life > todayYmd() ? formatMoney(a.monthly_depreciation, cur) : "—"}
                    </td>
                    <td className="p-3 text-end tabular-nums font-semibold">{a.status === "active" ? formatMoney(a.book_value, cur) : "—"}</td>
                    <td className="p-3 text-end whitespace-nowrap">
                      <Button variant="ghost" size="icon" title="Details" aria-label="Details" onClick={() => setDetails(a)}>
                        <Eye className="size-4" />
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="icon" title="Edit" aria-label="Edit" onClick={() => openEdit(a)}>
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / edit */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent data-add-new="asset" className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit asset" : "Add an asset"}</DialogTitle>
            <DialogDescription>Something the shop will use for more than a year.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>What is it? *</Label>
                <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Deep freezer, 20 kVA generator" />
              </div>
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Input
                  list="asset-categories"
                  value={draft.category}
                  onChange={(e) => {
                    const category = e.target.value;
                    const hint = LIFE_HINTS[category];
                    // Suggest a typical life when a known kind is picked on a new asset.
                    setDraft({ ...draft, category, life_years: !draft.id && hint ? String(hint / 12) : draft.life_years });
                  }}
                  placeholder="e.g. Refrigeration"
                />
                <datalist id="asset-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="space-y-1.5">
                <Label>Bought on *</Label>
                <Input type="date" value={draft.purchase_date} onChange={(e) => setDraft({ ...draft, purchase_date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cost *</Label>
                <Input type="number" min="0" step="0.01" value={draft.cost} onChange={(e) => setDraft({ ...draft, cost: e.target.value })} placeholder="What you paid, all in" />
              </div>
              <div className="space-y-1.5">
                <Label>Used for (years) *</Label>
                <Input type="number" min="0.1" step="0.5" value={draft.life_years} onChange={(e) => setDraft({ ...draft, life_years: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Worth at the end</Label>
                <Input type="number" min="0" step="0.01" value={draft.salvage_value} onChange={(e) => setDraft({ ...draft, salvage_value: e.target.value })} placeholder="What it'd sell for then (0 if nothing)" />
              </div>
              <div className="space-y-1.5">
                <Label>Paid now</Label>
                <Input type="number" min="0" step="0.01" value={draft.amount_paid} onChange={(e) => setDraft({ ...draft, amount_paid: e.target.value })} placeholder="Blank = paid in full" />
              </div>
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                <AccountPicker value={draft.account_id} onChange={(id) => setDraft({ ...draft, account_id: id })} label="Paid from" />
                <div className="space-y-1.5">
                  <Label>Bought from{owedPreview > 0 ? " *" : ""}</Label>
                  <PartySelect
                    value={draft.supplier_id}
                    onChange={(id) => setDraft({ ...draft, supplier_id: id })}
                    options={suppliers}
                    placeholder="Choose a supplier"
                    emptyLabel="Not recorded"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Serial / model no.</Label>
                <Input value={draft.serial_number} onChange={(e) => setDraft({ ...draft, serial_number: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={1} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
              <div className="sm:col-span-2 rounded-md bg-muted/50 p-3 text-sm flex gap-2">
                <Info className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div>
                  Counts <b>{formatMoney(previewMonthly, cur)}</b> a month against profit
                  {num(draft.life_years) > 0 && <> for {draft.life_years} year{num(draft.life_years) === 1 ? "" : "s"}</>}.
                  {owedPreview > 0 && <> <b>{formatMoney(owedPreview, cur)}</b> goes on the supplier&rsquo;s khata as still owed.</>}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details */}
      <Dialog open={!!details} onOpenChange={(o) => !o && setDetails(null)}>
        <DialogContent className="sm:max-w-lg">
          {details && (
            <>
              <DialogHeader>
                <DialogTitle>{details.name}</DialogTitle>
                <DialogDescription>{details.category ?? "Asset"}{details.serial_number ? ` · ${details.serial_number}` : ""}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <Fact label="Bought" value={format(new Date(details.purchase_date), "d MMM yyyy")} />
                <Fact label="From" value={details.supplier_name ?? "—"} />
                <Fact label="Cost" value={formatMoney(details.cost, cur)} />
                <Fact label="Paid then" value={formatMoney(details.amount_paid, cur)} />
                <Fact label="Life" value={`${+(details.useful_life_months / 12).toFixed(2)} years — to ${format(new Date(details.end_of_life), "MMM yyyy")}`} />
                <Fact label="Worth at the end" value={formatMoney(details.salvage_value, cur)} />
                <Fact label="Per month" value={formatMoney(details.monthly_depreciation, cur)} />
                <Fact label="Depreciated so far" value={formatMoney(details.accumulated_depreciation, cur)} />
                {details.status === "active" ? (
                  <Fact label="Book value today" value={formatMoney(details.book_value, cur)} strong />
                ) : (
                  <>
                    <Fact label={details.status === "sold" ? "Sold on" : "Written off on"} value={details.disposed_at ? format(new Date(details.disposed_at), "d MMM yyyy") : "—"} />
                    <Fact label="Fetched" value={formatMoney(details.disposal_amount ?? 0, cur)} />
                    <Fact
                      label={(details.disposal_gain ?? 0) >= 0 ? "Gain on the books" : "Loss on the books"}
                      value={formatMoney(Math.abs(details.disposal_gain ?? 0), cur)}
                      strong
                    />
                  </>
                )}
              </dl>
              {details.notes && <p className="text-sm text-muted-foreground">{details.notes}</p>}
              {canEdit && (
                <DialogFooter className="gap-2 sm:justify-between">
                  {role === "owner" ? (
                    <Button variant="ghost" className="text-destructive" onClick={() => remove(details)}>
                      <Trash2 className="size-4 me-1.5" /> Delete
                    </Button>
                  ) : <span />}
                  {details.status === "active" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDisposing({ asset: details, kind: "sold", date: todayYmd(), amount: "", account_id: null, note: "" });
                        setDetails(null);
                      }}
                    >
                      <Tag className="size-4 me-1.5" /> Sell / write off
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => reopen(details)}>
                      <RotateCcw className="size-4 me-1.5" /> Back in use
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sell / write off */}
      <Dialog open={!!disposing} onOpenChange={(o) => !o && setDisposing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{disposing?.asset.name} — leaving the shop</DialogTitle>
            <DialogDescription>Book value today: {disposing ? formatMoney(disposing.asset.book_value, cur) : ""}</DialogDescription>
          </DialogHeader>
          {disposing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>What happened</Label>
                <Select value={disposing.kind} onValueChange={(v) => setDisposing({ ...disposing, kind: v as "sold" | "written_off" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sold">Sold it</SelectItem>
                    <SelectItem value="written_off">Broken / thrown away</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>On</Label>
                <Input type="date" value={disposing.date} onChange={(e) => setDisposing({ ...disposing, date: e.target.value })} />
              </div>
              {disposing.kind === "sold" && (
                <>
                  <div className="space-y-1.5">
                    <Label>Sold for</Label>
                    <Input type="number" min="0" step="0.01" value={disposing.amount} onChange={(e) => setDisposing({ ...disposing, amount: e.target.value })} />
                  </div>
                  <AccountPicker value={disposing.account_id} onChange={(id) => setDisposing({ ...disposing, account_id: id })} label="Paid into" />
                </>
              )}
              <div className="space-y-1.5">
                <Label>Note</Label>
                <Input value={disposing.note} onChange={(e) => setDisposing({ ...disposing, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisposing(null)}>Cancel</Button>
            <Button onClick={dispose} disabled={busy}>{busy ? "Saving…" : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg sm:text-2xl font-bold tabular-nums mt-1 break-words leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}
