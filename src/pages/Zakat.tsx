import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { HandHeart, Plus, RefreshCw, Save, Trash2, Wallet, X, Info, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountPicker } from "@/components/AccountPicker";
import { useConfirm } from "@/components/ConfirmDialog";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import {
  NISAB_GRAMS, ZAKAT_RATE, computeZakat, type NisabBasis, type StockValuation, type ZakatLine,
} from "@/lib/zakat";
import { rpc } from "@/lib/apiClient";

/*
 * Port of the web app's Zakat page. The figures come from the server's books
 * (over /api/desktop/rpc), so this screen needs a connection.
 */
interface ZakatRecordDto {
  id: string; calculated_on: string; stock_valuation: StockValuation; nisab_basis: NisabBasis; price_per_gram: number;
  nisab: number; lines: ZakatLine[]; net_wealth: number; zakat_due: number; amount_paid: number; paid_at: string | null;
  account_id: string | null; notes: string | null;
}
// One loose shape, as elsewhere on the desktop: it compiles with strict off,
// where a { ok: true } | { ok: false; error } union doesn't narrow.
type Ok<T = object> = { ok: boolean; error?: string } & Partial<T>;
const loadZakatFiguresAction = (v: StockValuation) => rpc<ZakatLine[]>("loadZakatFiguresAction", v);
const listZakatRecordsAction = () => rpc<ZakatRecordDto[]>("listZakatRecordsAction");
const saveZakatRecordAction = (d: unknown) => rpc<Ok<{ id: string }>>("saveZakatRecordAction", d);
const payZakatAction = (d: unknown) => rpc<Ok>("payZakatAction", d);
const deleteZakatRecordAction = (id: string) => rpc<Ok>("deleteZakatRecordAction", id);

const todayYmd = () => format(new Date(), "yyyy-MM-dd");
const num = (s: string | number) => {
  const n = typeof s === "number" ? s : parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Zakat calculator. The figures come from the shop's books; the shopkeeper
 * ticks off what doesn't apply, adds what the books don't know (personal gold,
 * savings), enters today's gold or silver price, and can keep the result as
 * the year's record and mark it paid.
 */
export default function Zakat() {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "PKR";
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [valuation, setValuation] = useState<StockValuation>("sale");
  const [basis, setBasis] = useState<NisabBasis>("silver");
  const [price, setPrice] = useState("");
  // Set after mount: the server's "today" (UTC) and the shop's can differ.
  const [countedOn, setCountedOn] = useState("");
  const [lines, setLines] = useState<ZakatLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ZakatRecordDto[]>([]);
  const [paying, setPaying] = useState<{ record: ZakatRecordDto; amount: string; date: string; account_id: string | null } | null>(null);
  const [viewing, setViewing] = useState<ZakatRecordDto | null>(null);
  const [busy, setBusy] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      const rows = await listZakatRecordsAction();
      setRecords(rows);
      return rows;
    } catch {
      return [];
    }
  }, []);

  /** Refill the book figures; lines typed by hand are kept. */
  const loadFigures = useCallback(async (v: StockValuation) => {
    setLoading(true);
    try {
      const auto = await loadZakatFiguresAction(v);
      setLines((prev) => [...auto, ...prev.filter((l) => l.source === "manual")]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read the books");
    }
    setLoading(false);
  }, []);

  // Start from last year's choices, so the price and basis carry over.
  useEffect(() => {
    void (async () => {
      setCountedOn(todayYmd());
      const rows = await loadRecords();
      const last = rows[0];
      const v = last?.stock_valuation ?? "sale";
      if (last) {
        setValuation(last.stock_valuation);
        setBasis(last.nisab_basis);
        setPrice(last.price_per_gram ? String(last.price_per_gram) : "");
      }
      await loadFigures(v);
    })();
  }, [loadRecords, loadFigures]);

  const result = useMemo(() => computeZakat(lines, basis, num(price)), [lines, basis, price]);

  const update = (key: string, patch: Partial<ZakatLine>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = (kind: ZakatLine["kind"]) =>
    setLines((ls) => [
      ...ls,
      {
        key: `manual:${Date.now()}`,
        label: "",
        amount: 0,
        kind,
        source: "manual",
        included: true,
      },
    ]);

  const save = async () => {
    if (num(price) <= 0) return toast.error(`Enter today's ${basis} price per gram first.`);
    const bad = lines.find((l) => l.source === "manual" && !l.label.trim());
    if (bad) return toast.error("Give every line you added a name.");
    setBusy(true);
    const res = await saveZakatRecordAction({
      calculated_on: countedOn,
      stock_valuation: valuation,
      nisab_basis: basis,
      price_per_gram: num(price),
      lines: lines.map((l) => ({ ...l, label: l.label.trim(), amount: Math.max(0, num(l.amount)) })),
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Saved as this year's record");
    await loadRecords();
  };

  const pay = async () => {
    if (!paying) return;
    setBusy(true);
    const res = await payZakatAction({
      id: paying.record.id, amount: num(paying.amount), date: paying.date, account_id: paying.account_id,
    });
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Marked as paid");
    setPaying(null);
    await loadRecords();
  };

  const remove = async (r: ZakatRecordDto) => {
    const ok = await confirm({
      title: `Delete the record of ${format(new Date(r.calculated_on), "d MMM yyyy")}?`,
      description: r.amount_paid > 0 ? "The payment recorded against it is taken out of the account too." : "Only the saved calculation is removed.",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await deleteZakatRecordAction(r.id);
    if (!res.ok) return toast.error(res.error);
    toast.success("Deleted");
    await loadRecords();
  };

  const assets = lines.filter((l) => l.kind === "asset");
  const liabilities = lines.filter((l) => l.kind === "liability");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2"><HandHeart className="size-7 text-primary" /> Zakat</h1>
        <p className="text-muted-foreground mt-1">2.5% of zakatable wealth held for a year, once it reaches the nisab.</p>
      </header>

      <Card className="p-4 border-amber-500/40 bg-amber-500/5 text-sm flex gap-2">
        <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
        <div>
          A guide, not a ruling. The figures come from your books — tick off anything that isn&rsquo;t zakatable, add
          wealth the shop doesn&rsquo;t know about (gold, savings), and confirm with a scholar you trust.
          Shop equipment and fittings (Assets) are not counted.
        </div>
      </Card>

      <Card className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Counted on</Label>
          <Input type="date" value={countedOn} onChange={(e) => setCountedOn(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Value stock at</Label>
          <Select
            value={valuation}
            onValueChange={(v) => {
              setValuation(v as StockValuation);
              void loadFigures(v as StockValuation);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sale">Selling price</SelectItem>
              <SelectItem value="cost">Purchase cost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Nisab by</Label>
          <Select value={basis} onValueChange={(v) => setBasis(v as NisabBasis)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="silver">Silver — {NISAB_GRAMS.silver} g</SelectItem>
              <SelectItem value="gold">Gold — {NISAB_GRAMS.gold} g</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{basis === "gold" ? "Gold" : "Silver"} price per gram ({cur})</Label>
          <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Today's rate" />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <LinesCard
            title="Zakatable wealth"
            hint="Counted in"
            lines={assets}
            loading={loading}
            onUpdate={update}
            onRemove={(k) => setLines((ls) => ls.filter((l) => l.key !== k))}
            onAdd={() => addLine("asset")}
            addLabel="Add wealth (gold, savings…)"
            formatMoney={(n) => formatMoney(n, cur)}
          />
          <LinesCard
            title="Less: debts due now"
            hint="Taken off"
            lines={liabilities}
            loading={loading}
            onUpdate={update}
            onRemove={(k) => setLines((ls) => ls.filter((l) => l.key !== k))}
            onAdd={() => addLine("liability")}
            addLabel="Add a debt (wages due, rent…)"
            formatMoney={(n) => formatMoney(n, cur)}
          />
          <Button variant="ghost" size="sm" onClick={() => loadFigures(valuation)} disabled={loading}>
            <RefreshCw className="size-3.5 me-1.5" /> Re-read the books
          </Button>
        </div>

        <Card className="p-5 space-y-3 h-fit lg:sticky lg:top-4">
          <Row label="Zakatable wealth" value={formatMoney(result.assets, cur)} />
          <Row label="Less debts" value={`− ${formatMoney(result.liabilities, cur)}`} />
          <div className="border-t pt-2">
            <Row label="Net" value={formatMoney(result.net, cur)} strong />
          </div>
          <Row
            label={`Nisab (${NISAB_GRAMS[basis]} g ${basis})`}
            value={result.nisab > 0 ? formatMoney(result.nisab, cur) : "Enter the price"}
          />
          <div className={`rounded-md p-3 text-center ${result.aboveNisab ? "bg-primary/10" : "bg-muted"}`}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Zakat due ({ZAKAT_RATE * 100}%)</div>
            <div className="text-3xl font-bold tabular-nums mt-1">{formatMoney(result.due, cur)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {result.nisab <= 0 ? "Enter today's price to compare with the nisab." : result.aboveNisab ? "Above the nisab." : "Below the nisab — no zakat due."}
            </div>
          </div>
          <Button className="w-full" onClick={save} disabled={busy || loading}>
            <Save className="size-4 me-1.5" /> Save as this year&rsquo;s record
          </Button>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold">Past years</div>
        {records.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No saved calculations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">Counted on</th>
                  <th className="p-3 text-end">Net wealth</th>
                  <th className="p-3 text-end">Zakat due</th>
                  <th className="p-3 text-end">Paid</th>
                  <th className="p-3 w-40" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">
                      <button type="button" className="font-medium hover:underline" onClick={() => setViewing(r)}>
                        {format(new Date(r.calculated_on), "d MMM yyyy")}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {r.nisab_basis === "gold" ? "Gold" : "Silver"} nisab · stock at {r.stock_valuation === "sale" ? "selling price" : "cost"}
                      </div>
                    </td>
                    <td className="p-3 text-end tabular-nums">{formatMoney(r.net_wealth, cur)}</td>
                    <td className="p-3 text-end tabular-nums font-semibold">{formatMoney(r.zakat_due, cur)}</td>
                    <td className="p-3 text-end">
                      {r.amount_paid > 0 ? (
                        <span className="inline-flex items-center gap-1 text-success tabular-nums">
                          <CheckCircle2 className="size-3.5" /> {formatMoney(r.amount_paid, cur)}
                        </span>
                      ) : r.zakat_due > 0 ? (
                        <Badge variant="secondary">Not paid</Badge>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-end whitespace-nowrap">
                      {r.zakat_due > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPaying({ record: r, amount: String(r.amount_paid || r.zakat_due), date: r.paid_at ?? todayYmd(), account_id: r.account_id })}
                        >
                          <Wallet className="size-3.5 me-1" /> {r.amount_paid > 0 ? "Edit payment" : "Mark paid"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(r)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Zakat paid</DialogTitle>
            <DialogDescription>
              Recorded as money the owner took out — not a shop expense, so profit isn&rsquo;t reduced.
            </DialogDescription>
          </DialogHeader>
          {paying && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Amount</Label>
                <Input type="number" min="0" step="0.01" value={paying.amount} onChange={(e) => setPaying({ ...paying, amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Paid on</Label>
                <Input type="date" value={paying.date} onChange={(e) => setPaying({ ...paying, date: e.target.value })} />
              </div>
              <AccountPicker value={paying.account_id} onChange={(id) => setPaying({ ...paying, account_id: id })} label="Paid from" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
            <Button onClick={pay} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>Zakat — {format(new Date(viewing.calculated_on), "d MMM yyyy")}</DialogTitle>
                <DialogDescription>
                  {viewing.nisab_basis === "gold" ? "Gold" : "Silver"} at {formatMoney(viewing.price_per_gram, cur)}/g · nisab {formatMoney(viewing.nisab, cur)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1 text-sm">
                {viewing.lines.filter((l) => l.included).map((l) => (
                  <div key={l.key} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{l.kind === "liability" ? "− " : ""}{l.label}</span>
                    <span className="tabular-nums">{formatMoney(l.amount, cur)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
                  <span>Net wealth</span><span className="tabular-nums">{formatMoney(viewing.net_wealth, cur)}</span>
                </div>
                <div className="flex justify-between gap-3 font-semibold">
                  <span>Zakat due</span><span className="tabular-nums">{formatMoney(viewing.zakat_due, cur)}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 text-sm ${strong ? "font-semibold text-base" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function LinesCard({
  title, hint, lines, loading, onUpdate, onRemove, onAdd, addLabel, formatMoney,
}: {
  title: string;
  hint: string;
  lines: ZakatLine[];
  loading: boolean;
  onUpdate: (key: string, patch: Partial<ZakatLine>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
  addLabel: string;
  formatMoney: (n: number) => string;
}) {
  const total = lines.filter((l) => l.included).reduce((a, l) => a + Math.max(0, l.amount), 0);
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(total)}</span>
      </div>
      {loading && lines.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Reading the books…</div>
      ) : (
        <div className="divide-y">
          {lines.map((l) => (
            <div key={l.key} className={`flex items-start gap-3 px-4 py-2.5 ${l.included ? "" : "opacity-60"}`}>
              <Checkbox
                className="mt-2.5"
                checked={l.included}
                onCheckedChange={(v) => onUpdate(l.key, { included: !!v })}
                aria-label={`${hint}: ${l.label || "line"}`}
              />
              <div className="flex-1 min-w-0">
                {l.source === "manual" ? (
                  <Input
                    value={l.label}
                    onChange={(e) => onUpdate(l.key, { label: e.target.value })}
                    placeholder="What is it?"
                    className="h-9"
                  />
                ) : (
                  <div className="text-sm font-medium pt-2">{l.label}</div>
                )}
                {l.note && <div className="text-xs text-muted-foreground mt-0.5">{l.note}</div>}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={Number.isFinite(l.amount) ? l.amount : 0}
                onChange={(e) => onUpdate(l.key, { amount: num(e.target.value) })}
                className="h-9 w-36 text-end tabular-nums"
                aria-label="Amount"
              />
              {l.source === "manual" && (
                <Button variant="ghost" size="icon" className="size-9" onClick={() => onRemove(l.key)} aria-label="Remove line">
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="px-4 py-2">
            <Button variant="ghost" size="sm" onClick={onAdd}><Plus className="size-3.5 me-1" /> {addLabel}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}
