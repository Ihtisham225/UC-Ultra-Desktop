"use client";

/**
 * One employee's payslips and payments, newest first.
 * ⚠️ COPIED verbatim to the desktop app (`src/components/payroll/`).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { fmtDate } from "@/lib/date-format";
import { PAYMENT_TYPE_LABELS, type EmployeeHistoryDto } from "@/lib/payroll";
import { SALARY_PERIOD_LABELS } from "@/lib/salary-period";
import { payrollApi } from "@/components/payroll/payroll-api";
import { PayslipStatusBadge } from "@/components/payroll/PayrollDialogs";

export function EmployeeHistoryScreen({
  id,
  currency,
  onBack,
  onOpenPayslip,
}: {
  id: string;
  currency: string;
  onBack: () => void;
  onOpenPayslip: (id: string) => void;
}) {
  const formatMoney = useFormatMoney();
  const money = (n: number) => formatMoney(n, currency);
  const [history, setHistory] = useState<EmployeeHistoryDto | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setHistory(await payrollApi.employeeHistory(id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the history");
      setHistory(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const back = (
    <Button variant="ghost" size="sm" onClick={onBack}>
      <ArrowLeft className="size-4 me-1" /> Back to payroll
    </Button>
  );
  if (history === undefined) return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  if (history === null) {
    return <div className="space-y-4">{back}<p className="py-12 text-center text-sm text-muted-foreground">That employee no longer exists.</p></div>;
  }

  const { employee, payslips, payments } = history;
  const paid = payslips.filter((s) => s.status === "paid");
  const paidTotal = paid.reduce((s, p) => s + p.net_pay, 0);
  const cycle = employee.salary_period === "custom"
    ? `every ${employee.salary_period_days ?? 1} days`
    : SALARY_PERIOD_LABELS[employee.salary_period].toLowerCase();

  return (
    <div className="space-y-4">
      {back}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {employee.name}
          {!employee.is_active && <Badge variant="outline" className="text-[10px]">archived</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground">
          {money(employee.salary_amount)} · paid {cycle}
          {employee.phone ? ` · ${employee.phone}` : ""}
          {employee.user_name ? ` · login ${employee.user_name}` : ""}
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Payslips</h2>
          <p className="text-sm text-muted-foreground">{money(paidTotal)} paid across {paid.length} payslip{paid.length === 1 ? "" : "s"}.</p>
        </div>
        {payslips.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payslips yet — generate them from the payroll page.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pay period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-end">Gross</TableHead>
                <TableHead className="text-end">Deductions</TableHead>
                <TableHead className="text-end">Net pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslips.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <button type="button" className="hover:underline" onClick={() => onOpenPayslip(s.id)}>{s.period_label}</button>
                  </TableCell>
                  <TableCell><PayslipStatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-end tabular-nums">{money(s.gross_pay)}</TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">{s.total_deductions > 0 ? `−${money(s.total_deductions)}` : "—"}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">{money(s.net_pay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <div>
          <h2 className="font-semibold">Payments</h2>
          <p className="text-sm text-muted-foreground">Advances and wages paid out.</p>
        </div>
        {payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing paid yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Payslip</TableHead>
                <TableHead className="text-end">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(p.date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{PAYMENT_TYPE_LABELS[p.type]}</Badge>
                    {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.payslip_label ?? (p.type === "advance" ? "Not on a payslip yet" : "—")}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{money(p.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
