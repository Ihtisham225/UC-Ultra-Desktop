import { getAll } from "@/lib/localDb";

export interface AttachedPayment { account_name: string; amount: number }

/**
 * Join locally-cached tender lines onto sale rows.
 *
 * The desktop screens read sales straight out of IndexedDB rather than the
 * server, and a cached `sales` row carries only the legacy single
 * `payment_method` column — so a split payment looked like plain "cash" until
 * its `sale_payments` rows were joined back on. Both tables (and
 * `money_accounts`, for the names) are pulled by the sync engine.
 */
export async function attachPayments<T extends { id: string; total?: unknown; amount_paid?: unknown }>(
  sales: T[],
  shopId: string,
): Promise<Array<T & { payments: AttachedPayment[]; balance_due: number }>> {
  const [rows, accounts] = await Promise.all([
    getAll<{ sale_id: string; account_id: string | null; amount: unknown }>("sale_payments", shopId),
    getAll<{ id: string; name: string }>("money_accounts", shopId),
  ]);

  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const bySale = new Map<string, AttachedPayment[]>();
  for (const p of rows) {
    const list = bySale.get(p.sale_id) ?? [];
    list.push({
      account_name: (p.account_id && nameById.get(p.account_id)) || "Unassigned",
      amount: Number(p.amount) || 0,
    });
    bySale.set(p.sale_id, list);
  }

  return sales.map((s) => ({
    ...s,
    payments: bySale.get(s.id) ?? [],
    balance_due: Math.max(0, Math.round((Number(s.total ?? 0) - Number(s.amount_paid ?? 0)) * 100) / 100),
  }));
}
