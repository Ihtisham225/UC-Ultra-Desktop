/**
 * Reports page tabs whose figures come from the server: Assets, Payroll,
 * Returns, Cash & bank and Cheques. Each host passes its own data source
 * (`api`: server actions on the web, RPC on the terminal) and its own KPI /
 * toolbar / empty-state pieces, so these read exactly like the other tabs.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CsvColumn } from "@/lib/csv";
import { formatQty } from "@/lib/format";
import { fmtDate, fmtDateTime } from "@/lib/date-format";
import {
  ACCOUNT_KIND_LABELS,
  type AccountsReport,
  type AssetReportRow,
  type ChequeReportRow,
  type MoreReportsApi,
  type PayrollReport,
  type ReturnReportRow,
} from "@/lib/more-reports";

export interface MoreReportsUi {
  KPI: ComponentType<{ label: string; value: string; sub?: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Toolbar: ComponentType<{ title: string; rows: any[]; columns: CsvColumn<any>[]; filename: string }>;
  Empty: ComponentType<{ msg: string }>;
}

export interface MoreReportProps {
  api: MoreReportsApi;
  ui: MoreReportsUi;
  /** yyyy-mm-dd, already validated by the page. */
  fromDate: string;
  toDate: string;
  /** Start / end of those days as instants. */
  fromISO: string;
  toISO: string;
  formatMoney: (n: number | string, c?: string) => string;
  cur: string;
}

const Loading = () => <div className="p-8 text-center text-muted-foreground">Loading…</div>;
const Failed = ({ msg }: { msg: string }) => (
  <Card className="p-8 text-center text-sm text-muted-foreground">{msg}</Card>
);

/**
 * Loads one report whenever `key` (its inputs) changes, and ignores answers
 * that arrive after the inputs moved on. Loading is derived — the answer on
 * hand belongs to an older key — so no state is set inside the effect itself.
 */
function useReport<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });
  useEffect(() => {
    let live = true;
    load()
      .then((data) => { if (live) setState({ key, data, error: null }); })
      .catch((e) => { if (live) setState({ key, data: null, error: e instanceof Error ? e.message : "Could not load this report." }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data: state.data, error: state.error, loading: state.key !== key };
}

const NO_ASSETS: AssetReportRow[] = [];
const NO_PAYROLL: PayrollReport = { employees: [], payments: [] };
const NO_RETURNS: ReturnReportRow[] = [];
const NO_ACCOUNTS: AccountsReport = { accounts: [], by_kind: [] };
const NO_CHEQUES: ChequeReportRow[] = [];

const money2 = (n: number) => n.toFixed(2);

/* ---------- Assets ---------- */

export function AssetsReport({ api, ui, fromDate, toDate, formatMoney, cur }: MoreReportProps) {
  const { KPI, Toolbar, Empty } = ui;
  const { data, error, loading } = useReport(() => api.assets(fromDate, toDate), `${fromDate}|${toDate}`);
  const rows = data ?? NO_ASSETS;

  const stats = useMemo(() => {
    const inUse = rows.filter((r) => r.book_value > 0 || r.status === "active");
    return {
      inUse: inUse.length,
      cost: inUse.reduce((a, r) => a + r.cost, 0),
      book: rows.reduce((a, r) => a + r.book_value, 0),
      depreciation: rows.reduce((a, r) => a + r.depreciation, 0),
      bought: rows.filter((r) => r.bought_in_period),
      gain: rows.reduce((a, r) => a + (r.gain ?? 0), 0),
      disposed: rows.filter((r) => r.gain !== null).length,
    };
  }, [rows]);

  const status = (r: AssetReportRow) =>
    r.status === "active" ? "In use" : r.status === "sold" ? `Sold ${r.disposed_at ? fmtDate(r.disposed_at) : ""}` : `Written off ${r.disposed_at ? fmtDate(r.disposed_at) : ""}`;

  const columns: CsvColumn<AssetReportRow>[] = [
    { header: "Asset", value: (r) => r.name },
    { header: "Category", value: (r) => r.category ?? "" },
    { header: "Bought", value: (r) => r.purchase_date },
    { header: "Cost", value: (r) => money2(r.cost) },
    { header: "Life (months)", value: (r) => r.useful_life_months },
    { header: "Per month", value: (r) => money2(r.monthly) },
    { header: "Depreciation in period", value: (r) => money2(r.depreciation) },
    { header: "Accumulated", value: (r) => money2(r.accumulated) },
    { header: "Book value", value: (r) => money2(r.book_value) },
    { header: "Status", value: (r) => status(r).trim() },
    { header: "Gain / loss", value: (r) => (r.gain === null ? "" : money2(r.gain)) },
  ];

  if (loading) return <Loading />;
  if (error) return <Failed msg={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Assets in use" value={String(stats.inUse)} sub={`Cost ${formatMoney(stats.cost, cur)}`} />
        <KPI label="Book value" value={formatMoney(stats.book, cur)} sub={`on ${fmtDate(toDate)}`} />
        <KPI label="Depreciation in period" value={formatMoney(stats.depreciation, cur)} sub="charged to profit & loss" />
        <KPI
          label="Bought in period"
          value={formatMoney(stats.bought.reduce((a, r) => a + r.cost, 0), cur)}
          sub={stats.disposed > 0 ? `${stats.disposed} sold / written off · ${stats.gain >= 0 ? "gain" : "loss"} ${formatMoney(Math.abs(stats.gain), cur)}` : `${stats.bought.length} assets`}
        />
      </div>
      <Card className="shadow-card p-4">
        <Toolbar title="Fixed assets" rows={rows} columns={columns} filename={`assets_${fromDate}_${toDate}`} />
        {rows.length === 0 ? <Empty msg="No assets recorded yet." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead><TableHead>Bought</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Per month</TableHead>
                  <TableHead className="text-right">In period</TableHead><TableHead className="text-right">Accumulated</TableHead>
                  <TableHead className="text-right">Book value</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      {r.category && <div className="text-xs text-muted-foreground">{r.category}</div>}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.purchase_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.cost, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.monthly, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.depreciation ? formatMoney(r.depreciation, cur) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(r.accumulated, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(r.book_value, cur)}</TableCell>
                    <TableCell className="text-xs">
                      {status(r)}
                      {r.gain !== null && (
                        <div className={r.gain >= 0 ? "text-success" : "text-destructive"}>
                          {r.gain >= 0 ? "Gain" : "Loss"} {formatMoney(Math.abs(r.gain), cur)}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Straight-line, by the day: (cost − salvage value) spread over the asset&apos;s useful life. Book value is cost less
          everything charged up to the end of the period; an asset sold or written off has none left.
        </p>
      </Card>
    </div>
  );
}

/* ---------- Payroll ---------- */

const PAY_TYPE: Record<string, string> = { salary: "Salary", advance: "Advance", bonus: "Bonus" };
const PERIOD: Record<string, string> = {
  daily: "day", weekly: "week", fortnightly: "fortnight", monthly: "month",
  quarterly: "quarter", half_yearly: "half-year", yearly: "year", custom: "period",
};

export function PayrollReportTab({ api, ui, fromDate, toDate, formatMoney, cur }: MoreReportProps) {
  const { KPI, Toolbar, Empty } = ui;
  const { data, error, loading } = useReport(() => api.payroll(fromDate, toDate), `${fromDate}|${toDate}`);
  const report = data ?? NO_PAYROLL;

  const totals = useMemo(() => report.employees.reduce(
    (a, e) => ({ salary: a.salary + e.salary, advance: a.advance + e.advance, bonus: a.bonus + e.bonus, total: a.total + e.total, awaiting: a.awaiting + e.awaiting }),
    { salary: 0, advance: 0, bonus: 0, total: 0, awaiting: 0 },
  ), [report]);
  const paidPeople = report.employees.filter((e) => e.total !== 0).length;

  const empCols: CsvColumn<PayrollReport["employees"][number]>[] = [
    { header: "Employee", value: (r) => r.name },
    { header: "Wage", value: (r) => (r.salary_amount ? `${money2(r.salary_amount)} / ${PERIOD[r.salary_period ?? ""] ?? "period"}` : "") },
    { header: "Salary paid", value: (r) => money2(r.salary) },
    { header: "Advances", value: (r) => money2(r.advance) },
    { header: "Bonuses", value: (r) => money2(r.bonus) },
    { header: "Total paid", value: (r) => money2(r.total) },
    { header: "Payslips", value: (r) => r.payslips },
    { header: "Payslips net", value: (r) => money2(r.payslips_net) },
    { header: "Awaiting payment", value: (r) => money2(r.awaiting) },
  ];
  const payCols: CsvColumn<PayrollReport["payments"][number]>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Employee", value: (r) => r.employee },
    { header: "Type", value: (r) => PAY_TYPE[r.type] ?? r.type },
    { header: "Account", value: (r) => r.account ?? "" },
    { header: "Note", value: (r) => r.note ?? "" },
    { header: "Amount", value: (r) => money2(r.amount) },
  ];

  if (loading) return <Loading />;
  if (error) return <Failed msg={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Paid to staff" value={formatMoney(totals.total, cur)} sub={`${paidPeople} ${paidPeople === 1 ? "person" : "people"} · ${report.payments.length} payments`} />
        <KPI label="Salaries" value={formatMoney(totals.salary, cur)} sub={`Bonuses ${formatMoney(totals.bonus, cur)}`} />
        <KPI label="Advances" value={formatMoney(totals.advance, cur)} sub="taken back on payslips" />
        <KPI label="Awaiting payment" value={formatMoney(totals.awaiting, cur)} sub="finalized payslips not yet paid" />
      </div>
      <Card className="shadow-card p-4">
        <Toolbar title="By employee" rows={report.employees} columns={empCols} filename={`payroll_staff_${fromDate}_${toDate}`} />
        {report.employees.length === 0 ? <Empty msg="No staff on the payroll." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead><TableHead className="text-right">Wage</TableHead>
                  <TableHead className="text-right">Salary</TableHead><TableHead className="text-right">Advances</TableHead>
                  <TableHead className="text-right">Bonuses</TableHead><TableHead className="text-right">Total paid</TableHead>
                  <TableHead className="text-right">Awaiting</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.employees.map((e) => (
                  <TableRow key={e.key}>
                    <TableCell className="font-medium">
                      {e.name}
                      {!e.is_active && <span className="ml-2 text-xs text-muted-foreground">(left)</span>}
                      {e.payslips > 0 && <div className="text-xs text-muted-foreground">{e.payslips} payslip{e.payslips === 1 ? "" : "s"} · net {formatMoney(e.payslips_net, cur)}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs whitespace-nowrap">
                      {e.salary_amount ? `${formatMoney(e.salary_amount, cur)} / ${PERIOD[e.salary_period ?? ""] ?? "period"}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.salary ? formatMoney(e.salary, cur) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.advance ? formatMoney(e.advance, cur) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.bonus ? formatMoney(e.bonus, cur) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(e.total, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.awaiting ? formatMoney(e.awaiting, cur) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <Card className="shadow-card p-4">
        <Toolbar title="Payments in this period" rows={report.payments} columns={payCols} filename={`payroll_payments_${fromDate}_${toDate}`} />
        {report.payments.length === 0 ? <Empty msg="No wages paid in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Type</TableHead>
                  <TableHead>Account</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                    <TableCell className="font-medium">{p.employee}</TableCell>
                    <TableCell>{PAY_TYPE[p.type] ?? p.type}</TableCell>
                    <TableCell className="text-xs">{p.account ?? "—"}</TableCell>
                    <TableCell className="max-w-[16rem] truncate text-xs">{p.note ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(p.amount, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Returns ---------- */

type ReturnFilter = "all" | "customer" | "supplier";

export function ReturnsReport({ api, ui, fromDate, toDate, fromISO, toISO, formatMoney, cur }: MoreReportProps) {
  const { KPI, Toolbar, Empty } = ui;
  const { data, error, loading } = useReport(() => api.returns(fromISO, toISO), `${fromISO}|${toISO}`);
  const [show, setShow] = useState<ReturnFilter>("all");
  const all = data ?? NO_RETURNS;
  const rows = show === "all" ? all : all.filter((r) => r.kind === show);

  const sum = (list: ReturnReportRow[]) => list.reduce((a, r) => a + r.amount, 0);
  const fromCustomers = all.filter((r) => r.kind === "customer");
  const toSuppliers = all.filter((r) => r.kind === "supplier");

  const columns: CsvColumn<ReturnReportRow>[] = [
    { header: "Date", value: (r) => r.date.slice(0, 16).replace("T", " ") },
    { header: "Number", value: (r) => r.number ?? "" },
    { header: "Type", value: (r) => (r.kind === "customer" ? "From customer" : "To supplier") },
    { header: "Party", value: (r) => r.party ?? "" },
    { header: "Against", value: (r) => r.against ?? "" },
    { header: "Quantity", value: (r) => r.quantity },
    { header: "Deduction", value: (r) => money2(r.deduction) },
    { header: "Amount", value: (r) => money2(r.amount) },
    { header: "Settled", value: (r) => (r.to_ledger ? "Ledger" : r.account ?? "") },
    { header: "Reason", value: (r) => r.reason ?? "" },
  ];

  if (loading) return <Loading />;
  if (error) return <Failed msg={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Refunded to customers" value={formatMoney(sum(fromCustomers), cur)} sub={`${fromCustomers.length} returns`} />
        <KPI label="Kept as deductions" value={formatMoney(fromCustomers.reduce((a, r) => a + r.deduction, 0), cur)} sub="withheld from refunds" />
        <KPI label="Sent back to suppliers" value={formatMoney(sum(toSuppliers), cur)} sub={`${toSuppliers.length} returns`} />
        <KPI label="Settled on the ledger" value={formatMoney(sum(all.filter((r) => r.to_ledger)), cur)} sub="no cash moved" />
      </div>
      <Card className="shadow-card p-4">
        <Toolbar title="Returns" rows={rows} columns={columns} filename={`returns_${fromDate}_${toDate}`} />
        <div className="mt-3 flex gap-1 p-1 bg-muted rounded-lg w-fit print:hidden">
          {([["all", "All"], ["customer", "From customers"], ["supplier", "To suppliers"]] as const).map(([k, label]) => (
            <Button key={k} size="sm" variant={show === k ? "default" : "ghost"} onClick={() => setShow(k)} className="h-7 px-2 text-xs">{label}</Button>
          ))}
        </div>
        {rows.length === 0 ? <Empty msg="No returns in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Number</TableHead><TableHead>Party</TableHead>
                  <TableHead>Against</TableHead><TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead>Settled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.kind}:${r.id}`}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.number ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.party ?? (r.kind === "customer" ? "Walk-in" : "—")}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.kind === "customer" ? "From customer" : "To supplier"}
                        {r.reason ? ` · ${r.reason}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.against ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatQty(r.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatMoney(r.amount, cur)}
                      {r.deduction > 0 && <div className="text-xs font-normal text-muted-foreground">−{formatMoney(r.deduction, cur)} kept</div>}
                    </TableCell>
                    <TableCell className="text-xs">{r.to_ledger ? "Ledger" : r.account ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Cash & bank ---------- */

export function AccountsReportTab({ api, ui, fromDate, toDate, formatMoney, cur }: MoreReportProps) {
  const { KPI, Toolbar, Empty } = ui;
  const { data, error, loading } = useReport(() => api.accounts(fromDate, toDate), `${fromDate}|${toDate}`);
  const report = data ?? NO_ACCOUNTS;
  const t = report.accounts.reduce(
    (a, r) => ({ opening: a.opening + r.opening, in: a.in + r.money_in, out: a.out + r.money_out, closing: a.closing + r.closing }),
    { opening: 0, in: 0, out: 0, closing: 0 },
  );

  const accCols: CsvColumn<AccountsReport["accounts"][number]>[] = [
    { header: "Account", value: (r) => r.name },
    { header: "Type", value: (r) => r.type },
    { header: "Opening", value: (r) => money2(r.opening) },
    { header: "Money in", value: (r) => money2(r.money_in) },
    { header: "Money out", value: (r) => money2(r.money_out) },
    { header: "Closing", value: (r) => money2(r.closing) },
  ];
  const kindCols: CsvColumn<AccountsReport["by_kind"][number]>[] = [
    { header: "For", value: (r) => ACCOUNT_KIND_LABELS[r.kind] ?? r.kind },
    { header: "Money in", value: (r) => money2(r.money_in) },
    { header: "Money out", value: (r) => money2(r.money_out) },
  ];

  if (loading) return <Loading />;
  if (error) return <Failed msg={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Opening balance" value={formatMoney(t.opening, cur)} sub={`on ${fmtDate(fromDate)}`} />
        <KPI label="Money in" value={formatMoney(t.in, cur)} />
        <KPI label="Money out" value={formatMoney(t.out, cur)} />
        <KPI label="Closing balance" value={formatMoney(t.closing, cur)} sub={`on ${fmtDate(toDate)}`} />
      </div>
      <Card className="shadow-card p-4">
        <Toolbar title="Accounts" rows={report.accounts} columns={accCols} filename={`cash_bank_${fromDate}_${toDate}`} />
        {report.accounts.length === 0 ? <Empty msg="No money accounts yet." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead><TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Money in</TableHead><TableHead className="text-right">Money out</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">
                      {a.name}
                      <span className="ml-2 text-xs text-muted-foreground capitalize">{a.type}{a.is_archived ? " · archived" : ""}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(a.opening, cur)}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{a.money_in ? formatMoney(a.money_in, cur) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">{a.money_out ? formatMoney(a.money_out, cur) : "—"}</TableCell>
                    <TableCell className={`text-right tabular-nums font-semibold ${a.closing < 0 ? "text-destructive" : ""}`}>{formatMoney(a.closing, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
      <Card className="shadow-card p-4">
        <Toolbar title="What the money moved for" rows={report.by_kind} columns={kindCols} filename={`cash_bank_by_type_${fromDate}_${toDate}`} />
        {report.by_kind.length === 0 ? <Empty msg="No money moved in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>For</TableHead><TableHead className="text-right">Money in</TableHead><TableHead className="text-right">Money out</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {report.by_kind.map((k) => (
                  <TableRow key={k.kind}>
                    <TableCell className="font-medium">{ACCOUNT_KIND_LABELS[k.kind] ?? k.kind}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.money_in ? formatMoney(k.money_in, cur) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{k.money_out ? formatMoney(k.money_out, cur) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Transfers between your own accounts show as money out of one and into the other, so they cancel out in the totals.
        </p>
      </Card>
    </div>
  );
}

/* ---------- Cheques ---------- */

const CHEQUE_STATUS: Record<string, string> = { pending: "Pending", cleared: "Cleared", bounced: "Bounced" };

export function ChequesReport({ api, ui, fromDate, toDate, formatMoney, cur }: MoreReportProps) {
  const { KPI, Toolbar, Empty } = ui;
  const { data, error, loading } = useReport(() => api.cheques(fromDate, toDate), `${fromDate}|${toDate}`);
  const rows = data ?? NO_CHEQUES;
  const inPeriod = (d: string | null) => !!d && d >= fromDate && d <= toDate;

  const pendingIn = rows.filter((r) => r.status === "pending" && r.direction === "received");
  const pendingOut = rows.filter((r) => r.status === "pending" && r.direction === "issued");
  const cleared = rows.filter((r) => r.status === "cleared" && inPeriod(r.settled_on));
  const bounced = rows.filter((r) => r.status === "bounced" && inPeriod(r.settled_on));
  const sum = (list: ChequeReportRow[]) => list.reduce((a, r) => a + r.amount, 0);

  const columns: CsvColumn<ChequeReportRow>[] = [
    { header: "Cheque date", value: (r) => r.cheque_date },
    { header: "Number", value: (r) => r.number },
    { header: "Bank", value: (r) => r.bank ?? "" },
    { header: "Party", value: (r) => r.party },
    { header: "Direction", value: (r) => (r.direction === "received" ? "Received" : "Issued") },
    { header: "Status", value: (r) => CHEQUE_STATUS[r.status] ?? r.status },
    { header: "Cleared / bounced on", value: (r) => r.settled_on ?? "" },
    { header: "Amount", value: (r) => money2(r.amount) },
  ];

  if (loading) return <Loading />;
  if (error) return <Failed msg={error} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Pending to receive" value={formatMoney(sum(pendingIn), cur)} sub={`${pendingIn.length} cheques`} />
        <KPI label="Pending to pay" value={formatMoney(sum(pendingOut), cur)} sub={`${pendingOut.length} cheques`} />
        <KPI label="Cleared in period" value={formatMoney(sum(cleared), cur)} sub={`${cleared.length} cheques`} />
        <KPI label="Bounced in period" value={formatMoney(sum(bounced), cur)} sub={`${bounced.length} cheques`} />
      </div>
      <Card className="shadow-card p-4">
        <Toolbar title="Cheques" rows={rows} columns={columns} filename={`cheques_${fromDate}_${toDate}`} />
        {rows.length === 0 ? <Empty msg="No cheques pending or in this range." /> : (
          <div className="mt-3 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cheque date</TableHead><TableHead>Number</TableHead><TableHead>Party</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.cheque_date)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.number}
                      {r.bank && <div className="font-sans text-muted-foreground">{r.bank}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.party}</div>
                      <div className="text-xs text-muted-foreground">{r.direction === "received" ? "Received" : "Issued"}</div>
                    </TableCell>
                    <TableCell className={`text-xs ${r.status === "bounced" ? "text-destructive" : r.status === "pending" ? "text-warning" : "text-success"}`}>
                      {CHEQUE_STATUS[r.status] ?? r.status}
                      {r.settled_on && <span className="text-muted-foreground"> · {fmtDate(r.settled_on)}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{formatMoney(r.amount, cur)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Every pending cheque is listed whatever its date; cleared and bounced ones show when they were dated or settled in this range.
        </p>
      </Card>
    </div>
  );
}
