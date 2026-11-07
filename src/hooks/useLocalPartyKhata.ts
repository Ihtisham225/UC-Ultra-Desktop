import { useMemo } from "react";
import { useLocalStore } from "@/hooks/useLocalStore";
import { derivePaidAmount } from "@/lib/ledger";
import { partyKhataBalances, type PartyKhata } from "@/lib/party-balances";

interface KhataRow {
  id: string;
  party_id?: string | null;
  direction: string;
  amount: number | string;
}
interface KhataPayment {
  id: string;
  debt_id: string;
  kind?: string | null;
  amount?: number | string | null;
  discount?: number | string | null;
}

/**
 * Each customer's / supplier's standing on the Ledger, from the till's own
 * offline store — so the Customers and Suppliers balances work with no
 * connection, exactly like the Ledger itself.
 *
 * ⚠️ `paid_amount` is DERIVED from the local payments with the Ledger's rule
 * (`derivePaidAmount`), never read off the row: the stored column is the
 * server's figure and lags a settlement taken offline, so reading it would put
 * a different balance here than the Ledger shows for the same person.
 */
export function useLocalPartyKhata(shopId: string | null | undefined): Record<string, PartyKhata> {
  const { data: debts } = useLocalStore<KhataRow>("debts", shopId);
  const { data: payments } = useLocalStore<KhataPayment>("debt_payments", shopId);
  return useMemo(() => {
    const byDebt = new Map<string, KhataPayment[]>();
    for (const p of payments) {
      const arr = byDebt.get(p.debt_id) ?? [];
      arr.push(p);
      byDebt.set(p.debt_id, arr);
    }
    return partyKhataBalances(
      debts.map((d) => ({
        party_id: d.party_id,
        direction: d.direction,
        amount: d.amount,
        paid_amount: derivePaidAmount(byDebt.get(d.id) ?? []),
      })),
    );
  }, [debts, payments]);
}
