import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isHandicraft } from "@/lib/handicraft";
import { format, subDays, startOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  BookOpenCheck, Plus, Trash2, Edit2, Download, ArrowDownLeft, ArrowUpRight,
  CheckCircle2, Circle, RotateCcw, Link2, Coins, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { usePagination } from "@/hooks/usePagination";
import { downloadCsv } from "@/lib/csv";
import { DaybookPartyField } from "@/components/DaybookPartyField";
import {
  DAYBOOK_UNITS, handoffHref, materialLabel, targetsFor,
  type DaybookDirectionValue, type DaybookKindValue, type DaybookLinkTarget,
} from "@/lib/daybook";
import { rpc } from "@/lib/apiClient";
import type { PartyOption } from "@/lib/handicraftTypes";
import type {
  DaybookEntryDto, DaybookEntryInput, DaybookFilters, DaybookSummary,
} from "@/lib/daybookTypes";
import { useAddNew } from "@/hooks/useAddNew";

/**
 * Every action lives on the server — the daybook is not a synced table.
 *
 * ⚠️ Written as one loose shape rather than a discriminated union, the way
 * every other RPC page here is: this project compiles with `strict: false`,
 * and without `strictNullChecks` TypeScript won't narrow `{ok:true}|{ok:false}`
 * on the `ok` check, so the error branch fails to typecheck.
 */
type Saved = { ok: boolean; error?: string; id?: string; number?: number };
type Done = { ok: boolean; error?: string };

const ALL = "all";

type Draft = {
  id: string | null;
  date: string;
  direction: DaybookDirectionValue;
  kind: DaybookKindValue;
  party_id: string | null;
  party_name: string;
  amount: string;
  description: string;
  quantity: string;
  unit: string;
  notes: string;
};

const num = (s: string) => (s.trim() === "" ? 0 : Number(s)) || 0;

const emptyDraft = (date: string): Draft => ({
  id: null, date, direction: "in", kind: "money", party_id: null, party_name: "",
  amount: "", description: "", quantity: "", unit: "", notes: "",
});

const toDraft = (e: DaybookEntryDto): Draft => ({
  id: e.id,
  date: e.date,
  direction: e.direction,
  kind: e.kind,
  party_id: e.party_id,
  party_name: e.party_name,
  amount: e.amount ? String(e.amount) : "",
  description: e.description ?? "",
  quantity: e.quantity ? String(e.quantity) : "",
  unit: e.unit ?? "",
  notes: e.notes ?? "",
});

const emptySummary: DaybookSummary = {
  money_in: 0, money_out: 0, material_in: 0, material_out: 0, pending: 0, completed: 0,
};

export default function Daybook() {
  const navigate = useNavigate();
  const { currentShop } = useShop();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const canManage = perms.canManagePurchases;
  const currency = currentShop?.currency ?? "PKR";

  const [parties, setParties] = useState<PartyOption[]>([]);
  const [entries, setEntries] = useState<DaybookEntryDto[]>([]);
  const [hints, setHints] = useState<{ units: string[]; descriptions: string[] }>({ units: [], descriptions: [] });
  const [loading, setLoading] = useState(true);

  // The book opens on today. Read after mount — a date in a useState
  // initializer renders one value on the server and another in the browser.
  const [today, setToday] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    const d = format(new Date(), "yyyy-MM-dd");
    setToday(d);
    setFrom(d);
    setTo(d);
  }, []);

  const [party, setParty] = useState(ALL);
  const [status, setStatus] = useState<"all" | "pending" | "done">("all");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState<DaybookEntryDto | null>(null);

  const filters = useMemo(
    () => ({ from: from || null, to: to || null, party_id: party === ALL ? null : party }),
    [from, to, party],
  );

  const load = useCallback(async () => {
    // `today` doubles as "the page has mounted": loading before the range is
    // set would list the whole book for a moment.
    if (!currentShop || !today) return;
    setLoading(true);
    try {
      const [p, rows, h] = await Promise.all([
        rpc<PartyOption[]>("listPartyOptionsAction"),
        rpc<DaybookEntryDto[]>("listDaybookEntriesAction", filters satisfies DaybookFilters),
        rpc<{ units: string[]; descriptions: string[] }>("listDaybookHintsAction"),
      ]);
      setParties(p);
      setEntries(rows);
      setHints(h);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load the daybook");
    }
    setLoading(false);
  }, [currentShop, filters, today]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(
    () =>
      entries.filter((e) =>
        status === "all" ? true : status === "done" ? !!e.completed_at : !e.completed_at,
      ),
    [entries, status],
  );

  // The tiles are the sums of exactly the lines listed, so the pending / done
  // filter narrows them as well — they used to ignore it. Summed here from the
  // list the screen already has, which is the same set the server would total.
  const summary = useMemo(() => {
    const s: DaybookSummary = { ...emptySummary };
    for (const r of shown) {
      if (r.kind === "money") {
        if (r.direction === "in") s.money_in += r.amount;
        else s.money_out += r.amount;
      } else if (r.direction === "in") s.material_in += 1;
      else s.material_out += 1;
      if (r.completed_at) s.completed += 1;
      else s.pending += 1;
    }
    return s;
  }, [shown]);

  const pages = usePagination(shown, {
    key: "daybook",
    defaultSize: 50,
    resetDeps: [from, to, party, status, shown.length],
  });

  const rangeLabel =
    from && to && from === to
      ? from === today ? "today" : format(new Date(`${from}T00:00:00`), "d MMM yyyy")
      : from || to
        ? `${from || "the beginning"} → ${to || "now"}`
        : "the whole book";

  const setRange = (f: string, t: string) => { setFrom(f); setTo(t); };
  const shiftDay = (days: number) => {
    const base = from || today;
    if (!base) return;
    const d = format(subDays(new Date(`${base}T00:00:00`), -days), "yyyy-MM-dd");
    setRange(d, d);
  };

  // ------------------------------------------------------------- entries

  useAddNew({ "daybook-entry": canManage && (() => newEntry("in", "money")) });

  const newEntry = (direction: DaybookDirectionValue, kind: DaybookKindValue) => {
    setDraft({ ...emptyDraft(from && from === to ? from : today), direction, kind });
  };

  /**
   * Every write is server-side — the daybook is not a synced table — so an
   * offline terminal throws rather than returning an error. Saying so beats a
   * dead button: the earlier craft pages left `busy` stuck true on a throw.
   */
  const call = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "The Roznamcha needs a connection — this line couldn't be saved.",
      );
      return null;
    }
  };

  const save = async (andAnother: boolean) => {
    if (!draft) return;
    if (!draft.party_name.trim()) return toast.error("Write whose entry this is.");
    if (draft.kind === "money" && num(draft.amount) <= 0) return toast.error("Enter the amount.");
    if (draft.kind === "material" && !draft.description.trim() && num(draft.quantity) <= 0) {
      return toast.error("Write what the material was, or how much of it.");
    }

    setBusy(true);
    const result = await call(() => rpc<Saved>("saveDaybookEntryAction", draft.id, {
      date: draft.date,
      direction: draft.direction,
      kind: draft.kind,
      party_id: draft.party_id,
      party_name: draft.party_name,
      amount: num(draft.amount),
      description: draft.description || null,
      quantity: num(draft.quantity),
      unit: draft.unit || null,
      notes: draft.notes || null,
    } satisfies DaybookEntryInput));
    setBusy(false);
    if (!result) return;
    if (!result.ok) return toast.error(result.error ?? "That didn't save.");
    toast.success(draft.id ? "Entry updated" : `Entry #${result.number} written`);
    // A daybook is filled in a run of entries, so keep the day, the direction
    // and the kind and clear only what changes from line to line.
    setDraft(
      andAnother
        ? { ...emptyDraft(draft.date), direction: draft.direction, kind: draft.kind }
        : null,
    );
    load();
  };

  const remove = async (e: DaybookEntryDto) => {
    const ok = await confirm({
      title: `Delete entry #${e.number}?`,
      description: `${e.party_name} · ${describe(e, formatMoney, currency)}`,
      variant: "destructive",
    });
    if (!ok) return;
    const result = await call(() => rpc<Done>("deleteDaybookEntryAction", e.id));
    if (!result) return;
    if (!result.ok) return toast.error(result.error ?? "That didn't save.");
    toast.success("Entry deleted");
    load();
  };

  const reopen = async (e: DaybookEntryDto) => {
    const result = await call(() => rpc<Done>("setDaybookCompletedAction", e.id, false));
    if (!result) return;
    if (!result.ok) return toast.error(result.error ?? "That didn't save.");
    toast.success(`Entry #${e.number} is pending again`);
    load();
  };

  // --------------------------------------------------------- marking done

  /** Tick the line off. Both answers close it; "yes" also opens the form. */
  const finish = async (target: DaybookLinkTarget | null) => {
    const e = completing;
    if (!e) return;
    setBusy(true);
    const result = await call(() => rpc<Done>("setDaybookCompletedAction", e.id, true));
    setBusy(false);
    if (!result) return;
    if (!result.ok) return toast.error(result.error ?? "That didn't save.");
    setCompleting(null);
    if (target) {
      navigate(handoffHref(target, e.id));
      return;
    }
    toast.success(`Entry #${e.number} marked done`);
    load();
  };

  const exportCsv = () => {
    if (shown.length === 0) return toast.error("Nothing to export.");
    downloadCsv(`roznamcha-${from || "all"}`, shown, [
      { header: "No.", value: (e) => String(e.number) },
      { header: "Date", value: (e) => e.date },
      { header: "In/Out", value: (e) => (e.direction === "in" ? "In" : "Out") },
      { header: "Type", value: (e) => (e.kind === "money" ? "Amount" : "Material") },
      { header: "Who", value: (e) => e.party_name },
      { header: "Amount", value: (e) => (e.kind === "money" ? String(e.amount) : "") },
      { header: "Material", value: (e) => (e.kind === "material" ? e.description ?? "" : "") },
      { header: "Quantity", value: (e) => (e.kind === "material" && e.quantity ? String(e.quantity) : "") },
      { header: "Unit", value: (e) => e.unit ?? "" },
      { header: "Note", value: (e) => e.notes ?? "" },
      { header: "Status", value: (e) => (e.completed_at ? "Done" : "Pending") },
      { header: "Record", value: (e) => e.linked_label ?? "" },
    ]);
  };

  const net = summary.money_in - summary.money_out;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {confirmDialog}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpenCheck className="size-7 text-primary" /> Roznamcha
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            The day&rsquo;s register — what came in, what went out, and who with. Write the line as
            it happens; raise the real challan or payment at the end of the day and tick it off.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4 mr-2" /> Export
            </Button>
            <Button variant="outline" onClick={() => newEntry("out", "money")}>
              <ArrowUpRight className="size-4 mr-2" /> Money out
            </Button>
            <Button
              onClick={() => newEntry("in", "money")}
              className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
            >
              <Plus className="size-4 mr-2" /> New entry
            </Button>
          </div>
        )}
      </div>

      {/* ⚠️ These are sums of the sheet, not of any ledger — a daybook line
          posts to nothing until the real record is raised from it. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount in</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1 text-success">
            {formatMoney(summary.money_in, currency)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount out</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1 text-warning">
            {formatMoney(summary.money_out, currency)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Net</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1">
            {formatMoney(net, currency)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary.material_in} material in · {summary.material_out} out
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Still pending</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{summary.pending}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {summary.completed} done · for {rangeLabel}
          </div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => shiftDay(-1)}>&larr;</Button>
            <Button variant="outline" size="sm" onClick={() => setRange(today, today)}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => shiftDay(1)}>&rarr;</Button>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => { const d = format(subDays(new Date(), 1), "yyyy-MM-dd"); setRange(d, d); }}>
              Yesterday
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRange(format(subDays(new Date(), 6), "yyyy-MM-dd"), today)}>
              Last 7 days
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRange(format(startOfMonth(new Date()), "yyyy-MM-dd"), today)}>
              This month
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRange("", "")}>All</Button>
          </div>
          <div className="ms-auto flex items-end gap-3">
            <div>
              <Label className="text-xs">Who</Label>
              <Select value={party} onValueChange={setParty}>
                <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Everyone on the register</SelectItem>
                  {parties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All lines</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nothing written for {rangeLabel}.
            {canManage && " Use “New entry” as things come in and go out."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">No.</TableHead>
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-24">In / out</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead>What</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-56">Status</TableHead>
                    {canManage && <TableHead className="w-24 text-end">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.visible.map((e: DaybookEntryDto) => {
                    const inbound = e.direction === "in";
                    return (
                      <TableRow key={e.id} className={e.completed_at ? "opacity-70" : undefined}>
                        <TableCell className="tabular-nums text-muted-foreground">{e.number}</TableCell>
                        <TableCell className="tabular-nums whitespace-nowrap">{e.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={inbound ? "text-success border-success/40" : "text-warning border-warning/40"}>
                            {inbound ? <ArrowDownLeft className="size-3 me-1" /> : <ArrowUpRight className="size-3 me-1" />}
                            {inbound ? "In" : "Out"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {e.party_name}
                          {!e.party_id && (
                            <span className="ms-2 text-[11px] text-muted-foreground">not on the register</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            {e.kind === "money"
                              ? <Coins className="size-3.5 text-muted-foreground" />
                              : <Package className="size-3.5 text-muted-foreground" />}
                            <span className={e.kind === "money" ? "tabular-nums font-semibold" : ""}>
                              {describe(e, formatMoney, currency)}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-56 truncate">{e.notes ?? ""}</TableCell>
                        <TableCell>
                          {e.completed_at ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-success border-success/40">
                                <CheckCircle2 className="size-3 me-1" /> Done
                              </Badge>
                              {e.linked_label && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground truncate">
                                  <Link2 className="size-3" /> {e.linked_label}
                                </span>
                              )}
                              {canManage && (
                                <Button variant="ghost" size="icon" title="Mark pending again" onClick={() => reopen(e)}>
                                  <RotateCcw className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : canManage ? (
                            <Button variant="outline" size="sm" onClick={() => setCompleting(e)}>
                              <Circle className="size-3.5 me-1.5" /> Mark done
                            </Button>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-end whitespace-nowrap">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => setDraft(toDraft(e))}>
                              <Edit2 className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(e)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={pages.page}
              pageSize={pages.pageSize}
              totalItems={pages.totalItems}
              onPageChange={pages.setPage}
              onPageSizeChange={pages.setPageSize}
            />
          </>
        )}
      </Card>

      {/* ------------------------------------------------------ entry form */}
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit entry" : "New daybook entry"}</DialogTitle>
            <DialogDescription>
              Write it the way it happened. Nothing is posted to a khata until you raise the real
              record from this line.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Direction</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button
                      type="button"
                      variant={draft.direction === "in" ? "default" : "outline"}
                      onClick={() => setDraft({ ...draft, direction: "in" })}
                    >
                      <ArrowDownLeft className="size-4 me-1.5" /> In
                    </Button>
                    <Button
                      type="button"
                      variant={draft.direction === "out" ? "default" : "outline"}
                      onClick={() => setDraft({ ...draft, direction: "out" })}
                    >
                      <ArrowUpRight className="size-4 me-1.5" /> Out
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">What moved</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button
                      type="button"
                      variant={draft.kind === "money" ? "default" : "outline"}
                      onClick={() => setDraft({ ...draft, kind: "money" })}
                    >
                      <Coins className="size-4 me-1.5" /> Amount
                    </Button>
                    <Button
                      type="button"
                      variant={draft.kind === "material" ? "default" : "outline"}
                      onClick={() => setDraft({ ...draft, kind: "material" })}
                    >
                      <Package className="size-4 me-1.5" /> Material
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">
                    Who {draft.direction === "in" ? "gave it" : "took it"}
                  </Label>
                  <DaybookPartyField
                    partyId={draft.party_id}
                    partyName={draft.party_name}
                    parties={parties}
                    onChange={({ partyId, partyName }) => setDraft({ ...draft, party_id: partyId, party_name: partyName })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={draft.date} onChange={(ev) => setDraft({ ...draft, date: ev.target.value })} />
                </div>
              </div>

              {draft.kind === "money" ? (
                <div>
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    placeholder="10000"
                    value={draft.amount}
                    onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Material</Label>
                    <Input
                      list="daybook-descriptions"
                      autoFocus
                      placeholder="2/72 shawl"
                      value={draft.description}
                      onChange={(ev) => setDraft({ ...draft, description: ev.target.value })}
                    />
                    <datalist id="daybook-descriptions">
                      {hints.descriptions.map((d) => <option key={d} value={d} />)}
                    </datalist>
                  </div>
                  <div>
                    <Label className="text-xs">Quantity</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="4"
                      value={draft.quantity}
                      onChange={(ev) => setDraft({ ...draft, quantity: ev.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Unit</Label>
                    <Input
                      list="daybook-units"
                      placeholder="kg"
                      value={draft.unit}
                      onChange={(ev) => setDraft({ ...draft, unit: ev.target.value })}
                    />
                    <datalist id="daybook-units">
                      {[...new Set([...hints.units, ...DAYBOOK_UNITS])].map((u) => <option key={u} value={u} />)}
                    </datalist>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Note</Label>
                <Textarea
                  rows={2}
                  placeholder="Anything the line should say — bilty number, which lot, who carried it."
                  value={draft.notes}
                  onChange={(ev) => setDraft({ ...draft, notes: ev.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} disabled={busy}>Cancel</Button>
            {!draft?.id && (
              <Button variant="secondary" data-enter-save-new onClick={() => save(true)} disabled={busy}>
                Save &amp; add another
              </Button>
            )}
            <Button onClick={() => save(false)} disabled={busy}>
              {busy ? "Saving…" : draft?.id ? "Save changes" : "Save entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------------------------------- marking done */}
      <Dialog open={!!completing} onOpenChange={(o) => { if (!o) setCompleting(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark entry #{completing?.number} as done?</DialogTitle>
            <DialogDescription>
              {completing && (
                <>
                  {completing.party_name} {completing.direction === "in" ? "gave" : "took"}{" "}
                  {describe(completing, formatMoney, currency)}. Do you want to make the record for
                  it now? Either way the line is marked done.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {completing && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Open the record, filled in from this line
              </div>
              {targetsFor(completing.kind, completing.direction, isHandicraft(currentShop)).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  disabled={busy}
                  onClick={() => finish(t.value)}
                  className="w-full text-start rounded-lg border p-3 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <div className="font-medium text-sm">{t.label}</div>
                  <div className="text-xs text-muted-foreground">{t.hint}</div>
                </button>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCompleting(null)} disabled={busy}>Cancel</Button>
            <Button variant="secondary" onClick={() => finish(null)} disabled={busy}>
              No, just mark it done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** What a line says it was: an amount, or the material and how much. */
function describe(
  e: DaybookEntryDto,
  formatMoney: (v: number, c: string) => string,
  currency: string,
): string {
  return e.kind === "money"
    ? formatMoney(e.amount, currency)
    : materialLabel(e.quantity, e.unit, e.description) || "material";
}
