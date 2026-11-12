/**
 * One car's oil-change history: what went in last time, and every visit
 * before it. Opened from the till (beside the picked car), the Vehicles page
 * and global search.
 *
 * Presentational only — each app feeds it the visits (the web from
 * `vehicleHistoryAction`, the desktop from its offline oil_changes store).
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { Droplet, Gauge, CalendarClock, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/date-format";

export interface HistoryVisit {
  id: string;
  serviced_at: string;
  oil_changer: string | null;
  current_km: number | null;
  next_km: number | null;
  visitor_name: string | null;
  phone: string | null;
  receipt_number?: string | null;
  sale_id?: string | null;
  /** The bill's total — what the visit came to. */
  sale_total?: number | null;
  notes?: string | null;
}

export interface HistoryVehicle {
  vehicle_number: string;
  make: string | null;
  model_number: string | null;
}

const km = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toLocaleString()} km`);

/** Newest first, whatever order they arrived in. */
export const sortVisits = <T extends { serviced_at: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => b.serviced_at.localeCompare(a.serviced_at));

export function VehicleHistoryDialog({
  vehicle,
  visits,
  onClose,
  onOpenReceipt,
  formatMoney = (n) => Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
}: {
  /** null = closed. */
  vehicle: HistoryVehicle | null;
  /** null while loading. */
  visits: HistoryVisit[] | null;
  onClose: () => void;
  /** Opens a visit's bill, when the host can. */
  onOpenReceipt?: (saleId: string) => void;
  /** The shop's money format; plain figures without it. */
  formatMoney?: (n: number) => string;
}) {
  const rows = visits ? sortVisits(visits) : null;
  const last = rows?.[0] ?? null;
  // Distance between consecutive readings — how far this car goes between changes.
  const gaps: number[] = [];
  if (rows) {
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i].current_km, b = rows[i + 1].current_km;
      if (a != null && b != null && a > b) gaps.push(a - b);
    }
  }
  const avgGap = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : null;
  const billed = rows?.filter((v) => v.sale_total != null) ?? [];
  const spent = billed.reduce((s, v) => s + Number(v.sale_total), 0);

  return (
    <Dialog open={!!vehicle} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-mono tracking-wide">{vehicle?.vehicle_number}</span>
            {(vehicle?.make || vehicle?.model_number) && (
              <span className="text-sm font-normal text-muted-foreground">
                {[vehicle?.make, vehicle?.model_number].filter(Boolean).join(" · ")}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {rows === null ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading history…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No oil changes recorded for this vehicle yet.</p>
        ) : (
          <div className="space-y-4">
            {/* What the counter asks first: which oil went in last time. */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Last oil change</div>
              <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                <Droplet className="size-4 text-primary shrink-0" />
                {last?.oil_changer || <span className="text-muted-foreground font-normal">Oil not recorded</span>}
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
                <div className="flex items-center gap-1.5"><CalendarClock className="size-3.5 text-muted-foreground" /> {fmtDate(last!.serviced_at)}</div>
                <div className="flex items-center gap-1.5"><Gauge className="size-3.5 text-muted-foreground" /> At {km(last!.current_km)}</div>
                <div className="flex items-center gap-1.5"><Gauge className="size-3.5 text-muted-foreground" /> Due at {km(last!.next_km)}</div>
                {last!.sale_total != null && (
                  <div className="flex items-center gap-1.5 font-semibold"><Receipt className="size-3.5 text-muted-foreground" /> {formatMoney(Number(last!.sale_total))}</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{rows.length} visit{rows.length === 1 ? "" : "s"}</Badge>
              <Badge variant="secondary">First in {fmtDate(rows[rows.length - 1].serviced_at)}</Badge>
              {avgGap != null && <Badge variant="secondary">Avg {avgGap.toLocaleString()} km between changes</Badge>}
              {billed.length > 0 && <Badge variant="secondary">Spent {formatMoney(spent)} in all</Badge>}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">Date</th>
                    <th className="px-3 py-2 text-start font-medium">Oil</th>
                    <th className="px-3 py-2 text-end font-medium">KM</th>
                    <th className="px-3 py-2 text-end font-medium">Next KM</th>
                    <th className="px-3 py-2 text-start font-medium">Brought by</th>
                    <th className="px-3 py-2 text-start font-medium">Bill</th>
                    <th className="px-3 py-2 text-end font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((v, i) => (
                    <tr key={v.id} className={i === 0 ? "bg-primary/5" : undefined}>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(v.serviced_at)}</td>
                      <td className="px-3 py-2 font-medium">{v.oil_changer || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 text-end tabular-nums whitespace-nowrap">{v.current_km == null ? "—" : Number(v.current_km).toLocaleString()}</td>
                      <td className="px-3 py-2 text-end tabular-nums whitespace-nowrap">{v.next_km == null ? "—" : Number(v.next_km).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div>{v.visitor_name || <span className="text-muted-foreground">—</span>}</div>
                        {v.phone && <div className="text-xs text-muted-foreground">{v.phone}</div>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {v.sale_id && onOpenReceipt ? (
                          <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => onOpenReceipt(v.sale_id!)}>
                            <Receipt className="size-3.5" /> {v.receipt_number || "View"}
                          </button>
                        ) : (
                          v.receipt_number || <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums whitespace-nowrap">
                        {v.sale_total == null ? <span className="text-muted-foreground">—</span> : formatMoney(Number(v.sale_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
