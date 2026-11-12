import { getById } from "@/lib/localDb";
import { normalizePlate } from "@/lib/oil";
import type { HistoryVisit } from "@/components/VehicleHistoryDialog";

/**
 * A car's oil-change history from the offline store, so the till, the
 * Vehicles page and global search can show it with no connection.
 */
export interface LocalOilVisit {
  id: string;
  vehicle_id?: string | null;
  vehicle_number?: string | null;
  vehicle_key?: string | null;
  serviced_at: string;
  current_km?: number | string | null;
  next_km?: number | string | null;
  oil_changer?: string | null;
  visitor_name?: string | null;
  phone?: string | null;
  sale_id?: string | null;
  notes?: string | null;
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * This car's visits: linked to it by id, or — for visits written before the
 * register existed — by the same normalized plate. Newest first.
 */
export function visitsForVehicle<T extends LocalOilVisit>(
  rows: T[],
  vehicle: { id?: string | null; vehicle_number: string },
): T[] {
  const key = normalizePlate(vehicle.vehicle_number);
  return rows
    .filter((r) =>
      (vehicle.id && r.vehicle_id === vehicle.id) ||
      (!!key && normalizePlate(r.vehicle_key || r.vehicle_number || "") === key))
    .sort((a, b) => (b.serviced_at ?? "").localeCompare(a.serviced_at ?? ""));
}

/** Shaped for VehicleHistoryDialog, with each visit's bill number and total read from the local sales. */
export async function toHistoryVisits(rows: LocalOilVisit[]): Promise<HistoryVisit[]> {
  return Promise.all(rows.map(async (r) => {
    const sale = r.sale_id
      ? await getById<{ receipt_number?: string | null; total?: number | string | null }>("sales", r.sale_id).catch(() => null)
      : null;
    return {
      id: r.id,
      serviced_at: r.serviced_at,
      oil_changer: r.oil_changer ?? null,
      current_km: num(r.current_km),
      next_km: num(r.next_km),
      visitor_name: r.visitor_name ?? null,
      phone: r.phone ?? null,
      sale_id: sale ? r.sale_id : null,
      receipt_number: sale?.receipt_number ?? null,
      sale_total: sale ? num(sale.total) : null,
      notes: r.notes ?? null,
    };
  }));
}
