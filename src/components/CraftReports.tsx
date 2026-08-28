// Reports for a handicraft shop: what was bought, what the factories charged,
// what they still owe, and where every party's balance stands.
import { useCallback, useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, FileBarChart, PackageOpen, Factory, Clock, Truck } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { downloadCsv, type CsvColumn } from "@/lib/csv";
import { rpc } from "@/lib/apiClient";
import type {
  PurchasesByPartyRow,
  JobWorkByProcessRow,
  PendingAtCompanyRow,
  PartyBalanceReportRow,
} from "@/lib/handicraftTypes";

const todayISO = () => format(new Date(), "yyyy-MM-dd");
const daysAgoISO = (n: number) => format(subDays(new Date(), n), "yyyy-MM-dd");

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}

function Toolbar<T>({ title, rows, columns, filename }: {
  title: string; rows: T[]; columns: CsvColumn<T>[]; filename: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 print:hidden">
      <h3 className="font-semibold">{title}</h3>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => downloadCsv(filename, rows, columns)}>
          <Download className="size-3.5 mr-1.5" />CSV
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="size-3.5 mr-1.5" />PDF / Print
        </Button>
      </div>
    </div>
  );
}

const Empty = ({ msg }: { msg: string }) => (
  <div className="text-sm text-muted-foreground py-8 text-center">{msg}</div>
);

export default function CraftReports() {
  const { currentShop } = useShop();
  const perms = usePermissions();
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "PKR";

  // Dates read after mount, or the server and client render different defaults.
  const [range, setRange] = useState({ from: "", to: "" });
  useEffect(() => { setRange({ from: daysAgoISO(29), to: todayISO() }); }, []);

  const [purchases, setPurchases] = useState<PurchasesByPartyRow[]>([]);
  const [jobWork, setJobWork] = useState<JobWorkByProcessRow[]>([]);
  const [pending, setPending] = useState<PendingAtCompanyRow[]>([]);
  const [balances, setBalances] = useState<PartyBalanceReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentShop || !range.from || !range.to) return;
    setLoading(true);
    const [p, j, pd, b] = await Promise.all([
      rpc<PurchasesByPartyRow[]>("craftPurchasesReportAction", range.from, range.to).catch(() => []),
      rpc<JobWorkByProcessRow[]>("craftJobWorkReportAction", range.from, range.to).catch(() => []),
      rpc<PendingAtCompanyRow[]>("craftPendingReportAction").catch(() => []),
      rpc<PartyBalanceReportRow[]>("craftBalancesReportAction").catch(() => []),
    ]);
    setPurchases(p);
    setJobWork(j);
    setPending(pd);
    setBalances(b);
    setLoading(false);
  }, [currentShop, range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  if (!perms.canManageExpenses) {
    return <div className="p-12 text-center text-muted-foreground">You don&apos;t have access to Reports.</div>;
  }
  if (!currentShop) return null;

  const setQuick = (days: number) => setRange({ from: daysAgoISO(days - 1), to: todayISO() });

  const purchaseTotal = purchases.reduce((s, r) => s + r.amount, 0);
  const purchasePounds = purchases.reduce((s, r) => s + r.pounds, 0);
  const jobWorkTotal = jobWork.reduce((s, r) => s + r.amount, 0);
  const pendingPieces = pending.reduce((s, r) => s + r.pending, 0);
  const owed = balances.reduce((s, r) => s + (r.balance > 0 ? r.balance : 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileBarChart className="size-7 text-primary" />Reports
          </h1>
          <p className="text-muted-foreground mt-1">Purchases, job work and party balances, with CSV &amp; print.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            From
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="h-9 w-[170px]" />
          </label>
          <label className="text-xs text-muted-foreground flex flex-col gap-1">
            To
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="h-9 w-[170px]" />
          </label>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {[7, 30, 90, 365].map((d) => (
              <Button key={d} size="sm" variant="ghost" onClick={() => setQuick(d)} className="h-7 px-2 text-xs">{d}d</Button>
            ))}
          </div>
        </div>
      </header>

      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList className="flex-wrap h-auto print:hidden">
          <TabsTrigger value="purchases"><PackageOpen className="size-3.5 mr-1.5" />Purchases</TabsTrigger>
          <TabsTrigger value="jobwork"><Factory className="size-3.5 mr-1.5" />Job work</TabsTrigger>
          <TabsTrigger value="pending"><Clock className="size-3.5 mr-1.5" />At the factories</TabsTrigger>
          <TabsTrigger value="balances"><Truck className="size-3.5 mr-1.5" />Party balances</TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <KPI label="Bought in range" value={formatMoney(purchaseTotal, cur)} sub={`${purchases.length} part${purchases.length === 1 ? "y" : "ies"}`} />
            <KPI label="Pounds" value={String(Math.round(purchasePounds * 100) / 100)} />
            <KPI label="Average rate" value={purchasePounds ? formatMoney(purchaseTotal / purchasePounds, cur) : "—"} sub="per pound, across every party" />
          </div>
          <Toolbar
            title="Purchases by party"
            rows={purchases}
            filename={`purchases-by-party-${range.from}-to-${range.to}`}
            columns={[
              { header: "Party", value: (r: PurchasesByPartyRow) => r.party },
              { header: "City", value: (r: PurchasesByPartyRow) => r.city ?? "" },
              { header: "Bills", value: (r: PurchasesByPartyRow) => String(r.bills) },
              { header: "Lines", value: (r: PurchasesByPartyRow) => String(r.lines) },
              { header: "Bags", value: (r: PurchasesByPartyRow) => String(r.bags) },
              { header: "Pounds", value: (r: PurchasesByPartyRow) => String(r.pounds) },
              { header: "Avg rate", value: (r: PurchasesByPartyRow) => r.avg_rate.toFixed(2) },
              { header: "Amount", value: (r: PurchasesByPartyRow) => String(r.amount) },
            ]}
          />
          <Card className="shadow-card overflow-x-auto">
            {loading ? <Empty msg="Loading…" /> : purchases.length === 0 ? <Empty msg="Nothing bought in this range." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead><TableHead>City</TableHead>
                    <TableHead className="text-end">Bills</TableHead><TableHead className="text-end">Lines</TableHead>
                    <TableHead className="text-end">Bags</TableHead><TableHead className="text-end">Pounds</TableHead>
                    <TableHead className="text-end">Avg rate</TableHead><TableHead className="text-end">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((r) => (
                    <TableRow key={r.party_id}>
                      <TableCell className="font-medium">{r.party}</TableCell>
                      <TableCell>{r.city ?? ""}</TableCell>
                      <TableCell className="text-end">{r.bills}</TableCell>
                      <TableCell className="text-end">{r.lines}</TableCell>
                      <TableCell className="text-end">{r.bags || ""}</TableCell>
                      <TableCell className="text-end">{r.pounds || ""}</TableCell>
                      <TableCell className="text-end">{r.avg_rate ? formatMoney(r.avg_rate, cur) : ""}</TableCell>
                      <TableCell className="text-end font-semibold">{formatMoney(r.amount, cur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="jobwork" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <KPI label="Charged in range" value={formatMoney(jobWorkTotal, cur)} sub="net of nothing — deductions sit on the bill" />
            <KPI label="Kinds of work billed" value={String(new Set(jobWork.map((r) => r.process)).size)} />
          </div>
          <Toolbar
            title="Job work by process and company"
            rows={jobWork}
            filename={`job-work-${range.from}-to-${range.to}`}
            columns={[
              { header: "Work", value: (r: JobWorkByProcessRow) => r.process },
              { header: "Company", value: (r: JobWorkByProcessRow) => r.company },
              { header: "Pieces", value: (r: JobWorkByProcessRow) => String(r.pieces) },
              { header: "Avg rate", value: (r: JobWorkByProcessRow) => r.avg_rate.toFixed(2) },
              { header: "Amount", value: (r: JobWorkByProcessRow) => String(r.amount) },
            ]}
          />
          <Card className="shadow-card overflow-x-auto">
            {loading ? <Empty msg="Loading…" /> : jobWork.length === 0 ? <Empty msg="No work billed in this range." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work</TableHead><TableHead>Company</TableHead>
                    <TableHead className="text-end">Pieces</TableHead>
                    <TableHead className="text-end">Avg rate</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobWork.map((r) => (
                    <TableRow key={`${r.process}-${r.company}`}>
                      <TableCell className="font-medium">{r.process}</TableCell>
                      <TableCell>{r.company}</TableCell>
                      <TableCell className="text-end">{r.pieces}</TableCell>
                      <TableCell className="text-end">{formatMoney(r.avg_rate, cur)}</TableCell>
                      <TableCell className="text-end font-semibold">{formatMoney(r.amount, cur)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <KPI label="Pieces still out" value={String(pendingPieces)} />
            <KPI label="Open lines" value={String(pending.length)} />
            <KPI label="Longest outstanding" value={pending.length ? `${pending[0].days_out} days` : "—"} sub={pending.length ? pending[0].company : undefined} />
          </div>
          <Toolbar
            title="Still out with makers and factories"
            rows={pending}
            filename={`still-out-${todayISO()}`}
            columns={[
              { header: "Stage", value: (r: PendingAtCompanyRow) => r.kind },
              { header: "Party", value: (r: PendingAtCompanyRow) => r.company },
              { header: "City", value: (r: PendingAtCompanyRow) => r.city ?? "" },
              { header: "Challan", value: (r: PendingAtCompanyRow) => String(r.challan_number) },
              { header: "Book no.", value: (r: PendingAtCompanyRow) => r.book_number ?? "" },
              { header: "Sent on", value: (r: PendingAtCompanyRow) => r.date },
              { header: "Days out", value: (r: PendingAtCompanyRow) => String(r.days_out) },
              { header: "Detail", value: (r: PendingAtCompanyRow) => r.description },
              { header: "Sent", value: (r: PendingAtCompanyRow) => String(r.sent) },
              { header: "Back", value: (r: PendingAtCompanyRow) => String(r.received) },
              { header: "Short", value: (r: PendingAtCompanyRow) => String(r.short) },
              { header: "Damaged", value: (r: PendingAtCompanyRow) => String(r.damaged) },
              { header: "Pending", value: (r: PendingAtCompanyRow) => String(r.pending) },
            ]}
          />
          <Card className="shadow-card overflow-x-auto">
            {loading ? <Empty msg="Loading…" /> : pending.length === 0 ? <Empty msg="Nothing is out with a maker or a factory." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead><TableHead>Party</TableHead><TableHead>Challan</TableHead>
                    <TableHead>Sent on</TableHead><TableHead className="text-end">Days</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="text-end">Sent</TableHead><TableHead className="text-end">Back</TableHead>
                    <TableHead className="text-end">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.map((r, i) => (
                    <TableRow key={`${r.challan_number}-${r.description}-${i}`}>
                      <TableCell>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted font-bold">
                          {r.kind === "making" ? "making" : "processing"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {r.company}
                        {r.city && <span className="text-xs text-muted-foreground"> · {r.city}</span>}
                      </TableCell>
                      <TableCell>#{r.challan_number}{r.book_number ? ` (${r.book_number})` : ""}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                      <TableCell className={`text-end ${r.days_out > 30 ? "text-destructive font-medium" : ""}`}>{r.days_out}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-end">{r.sent}</TableCell>
                      <TableCell className="text-end">{r.received}</TableCell>
                      <TableCell className="text-end font-semibold text-primary">{r.pending}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <KPI label="Total owed" value={formatMoney(owed, cur)} sub={`${balances.filter((b) => b.balance > 0).length} parties`} />
            <KPI label="Parties on the books" value={String(balances.length)} />
          </div>
          <Toolbar
            title="Party balances"
            rows={balances}
            filename={`party-balances-${todayISO()}`}
            columns={[
              { header: "Party", value: (r: PartyBalanceReportRow) => r.party },
              { header: "City", value: (r: PartyBalanceReportRow) => r.city ?? "" },
              { header: "Roles", value: (r: PartyBalanceReportRow) => r.roles },
              { header: "Opening", value: (r: PartyBalanceReportRow) => String(r.opening) },
              { header: "Purchases", value: (r: PartyBalanceReportRow) => String(r.purchases) },
              { header: "Job work", value: (r: PartyBalanceReportRow) => String(r.job_work) },
              { header: "Paid", value: (r: PartyBalanceReportRow) => String(r.paid) },
              { header: "Balance", value: (r: PartyBalanceReportRow) => String(r.balance) },
            ]}
          />
          <Card className="shadow-card overflow-x-auto">
            {loading ? <Empty msg="Loading…" /> : balances.length === 0 ? <Empty msg="No parties yet." /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead><TableHead>City</TableHead>
                    <TableHead className="text-end">Opening</TableHead>
                    <TableHead className="text-end">Purchases</TableHead>
                    <TableHead className="text-end">Job work</TableHead>
                    <TableHead className="text-end">Paid</TableHead>
                    <TableHead className="text-end">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((r) => (
                    <TableRow key={`${r.party}-${r.city ?? ""}`}>
                      <TableCell className="font-medium">{r.party}</TableCell>
                      <TableCell>{r.city ?? ""}</TableCell>
                      <TableCell className="text-end">{r.opening ? formatMoney(r.opening, cur) : ""}</TableCell>
                      <TableCell className="text-end">{r.purchases ? formatMoney(r.purchases, cur) : ""}</TableCell>
                      <TableCell className="text-end">{r.job_work ? formatMoney(r.job_work, cur) : ""}</TableCell>
                      <TableCell className="text-end">{r.paid ? formatMoney(r.paid, cur) : ""}</TableCell>
                      <TableCell className={`text-end font-semibold ${r.balance > 0 ? "text-destructive" : r.balance < 0 ? "text-success" : ""}`}>
                        {formatMoney(r.balance, cur)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
