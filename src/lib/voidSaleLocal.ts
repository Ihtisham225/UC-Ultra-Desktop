import { deleteLocal, getAll, notifyChange } from "@/lib/localDb";

/**
 * Take a deleted bill's money off this till at once: its khata row (and any
 * settlements taken against it) and its tender lines. The deletes are queued,
 * so the server hears them too.
 *
 * ⚠️ Stock is NOT touched here. The till never lowers stock itself when a
 * bill is rung up — the figure is always the server's, pulled down on sync —
 * so restocking locally would double it. The server voids the bill when its
 * delete lands (lib/void-sale there: stock back, investor lots, cash, khata)
 * and the next pull brings the corrected stock.
 *
 * Without this the customer went on owing the deleted bill on this till until
 * a sync happened to prune it — SHAMSHER CORPORATION's owner recorded fake
 * payments to cancel such bills out.
 */
export async function voidSaleLocally(shopId: string, saleId: string): Promise<void> {
  const [debts, payments, tenders] = await Promise.all([
    getAll<{ id: string; sale_id?: string | null }>("debts", shopId),
    getAll<{ id: string; debt_id?: string | null }>("debt_payments", shopId),
    getAll<{ id: string; sale_id?: string | null }>("sale_payments", shopId),
  ]);
  const billDebts = debts.filter((d) => d.sale_id === saleId);
  const debtIds = new Set(billDebts.map((d) => d.id));
  for (const p of payments) if (p.debt_id && debtIds.has(p.debt_id)) await deleteLocal("debt_payments", p.id, true);
  for (const d of billDebts) await deleteLocal("debts", d.id, true);
  for (const t of tenders) if (t.sale_id === saleId) await deleteLocal("sale_payments", t.id, true);
  if (billDebts.length) {
    notifyChange("debts");
    notifyChange("debt_payments");
  }
  notifyChange("sale_payments");
}
