import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { rpc } from "@/lib/apiClient";

// Shapes of the web app's listCustomerSalesAction / listSupplierPurchasesAction
// (customers/actions.ts, suppliers/actions.ts), reached over the desktop RPC.
// This component is a copy of the web app's `src/components/PartyHistory.tsx`.
interface PartySaleHistory {
  rows: { id: string; receipt_number: string | null; created_at: string; total: number; paid: number; due: number; item_count: number }[];
  totals: { count: number; total: number; paid: number; due: number };
  truncated: boolean;
}
interface PartyPurchaseHistory {
  rows: { id: string; reference: string | null; date: string; total: number; paid: number | null; due: number | null; item_count: number }[];
  totals: { count: number; total: number; paid: number | null; due: number | null };
  truncated: boolean;
  per_bill_payments: boolean;
}
const listCustomerSalesAction = (id: string) => rpc<PartySaleHistory>("listCustomerSalesAction", id);
const listSupplierPurchasesAction = (id: string) => rpc<PartyPurchaseHistory>("listSupplierPurchasesAction", id);

/**
 * A yyyy-mm-dd is a calendar day, not an instant. `new Date("2026-09-10")`
 * reads it as UTC midnight, which is the 9th anywhere west of Greenwich — so a
 * bare day is built in local time instead.
 */
const toDate = (v: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1, Number(v.slice(8, 10))) : new Date(v);

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold tabular-nums mt-0.5 ${tone === "warn" ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}

/** What a customer has bought. Clicking a bill opens its receipt. */
export function CustomerSalesHistory({
  customerId,
  currency,
  onOpenSale,
}: {
  customerId: string;
  currency: string;
  onOpenSale?: (saleId: string) => void;
}) {
  // The result remembers which customer it was loaded for, so opening another
  // customer reads as loading at once — without clearing state inside the effect.
  const [result, setResult] = useState<{ id: string; data?: PartySaleHistory; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCustomerSalesAction(customerId)
      .then((data) => { if (!cancelled) setResult({ id: customerId, data }); })
      .catch((e) => {
        if (!cancelled) setResult({ id: customerId, error: e instanceof Error ? e.message : "Couldn't load sales" });
      });
    return () => { cancelled = true; };
  }, [customerId]);

  const current = result?.id === customerId ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Sale history</h3>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.totals.count === 0 ? (
        <p className="text-sm text-muted-foreground">No sales to this customer yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Tile label="Bills" value={String(data.totals.count)} />
            <Tile label="Total" value={formatMoney(data.totals.total, currency)} />
            <Tile label="Paid" value={formatMoney(data.totals.paid, currency)} />
            <Tile label="Unpaid" value={formatMoney(data.totals.due, currency)} tone={data.totals.due > 0 ? "warn" : undefined} />
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-end">Items</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                  <TableHead className="text-end">Paid</TableHead>
                  <TableHead className="text-end">Unpaid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className={onOpenSale ? "cursor-pointer" : undefined}
                    onClick={onOpenSale ? () => onOpenSale(r.id) : undefined}
                    title={onOpenSale ? "Open receipt" : undefined}
                  >
                    <TableCell className="whitespace-nowrap">{format(toDate(r.created_at), "d MMM yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.receipt_number ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{r.item_count}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(r.total, currency)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(r.paid, currency)}</TableCell>
                    <TableCell className={`text-end tabular-nums ${r.due > 0 ? "text-warning font-medium" : "text-muted-foreground"}`}>
                      {r.due > 0 ? formatMoney(r.due, currency) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {data.truncated && (
            <p className="text-xs text-muted-foreground">
              Showing the latest {data.rows.length} of {data.totals.count} bills. The figures above cover all of them.
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** What has been bought from a party. */
export function SupplierPurchaseHistory({ supplierId, currency }: { supplierId: string; currency: string }) {
  const [result, setResult] = useState<{ id: string; data?: PartyPurchaseHistory; error?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listSupplierPurchasesAction(supplierId)
      .then((data) => { if (!cancelled) setResult({ id: supplierId, data }); })
      .catch((e) => {
        if (!cancelled) setResult({ id: supplierId, error: e instanceof Error ? e.message : "Couldn't load purchases" });
      });
    return () => { cancelled = true; };
  }, [supplierId]);

  const current = result?.id === supplierId ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? null;

  const perBill = data?.per_bill_payments ?? true;

  return (
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">Purchase history</h3>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : data.totals.count === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing bought from this party yet.</p>
      ) : (
        <>
          <div className={`grid gap-2 ${perBill ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
            <Tile label="Bills" value={String(data.totals.count)} />
            <Tile label="Total" value={formatMoney(data.totals.total, currency)} />
            {perBill && <Tile label="Paid" value={formatMoney(data.totals.paid ?? 0, currency)} />}
            {perBill && (
              <Tile label="Unpaid" value={formatMoney(data.totals.due ?? 0, currency)} tone={(data.totals.due ?? 0) > 0 ? "warn" : undefined} />
            )}
          </div>
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>{perBill ? "Reference" : "Bill no."}</TableHead>
                  <TableHead className="text-end">Items</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                  {perBill && <TableHead className="text-end">Paid</TableHead>}
                  {perBill && <TableHead className="text-end">Unpaid</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format(toDate(r.date), "d MMM yyyy")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.reference ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">{r.item_count}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatMoney(r.total, currency)}</TableCell>
                    {perBill && <TableCell className="text-end tabular-nums">{formatMoney(r.paid ?? 0, currency)}</TableCell>}
                    {perBill && (
                      <TableCell className={`text-end tabular-nums ${(r.due ?? 0) > 0 ? "text-warning font-medium" : "text-muted-foreground"}`}>
                        {(r.due ?? 0) > 0 ? formatMoney(r.due ?? 0, currency) : "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!perBill && (
            <p className="text-xs text-muted-foreground">
              Payments on this register are made against the party&apos;s khata rather than a single bill, so the balance
              is shown above from the ledger.
            </p>
          )}
          {data.truncated && (
            <p className="text-xs text-muted-foreground">
              Showing the latest {data.rows.length} of {data.totals.count} bills. The figures above cover all of them.
            </p>
          )}
        </>
      )}
    </section>
  );
}
