import { useCallback } from "react";
import { ChequesScreen } from "@/components/ChequesScreen";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import { syncNow } from "@/lib/syncEngine";
import { notifyChange } from "@/lib/localDb";
import type { ChequeDto } from "@/lib/cheques";

type Result = { ok: boolean; error?: string };

/**
 * Cheques live on the server (like the rest of the money-side registers), so
 * this screen is online-only. Clearing or bouncing moves khata rows and money,
 * so the terminal syncs straight after to show the new balances.
 */
export default function Cheques() {
  const { currentShop, role } = useShop();

  const list = useCallback(
    (status: "pending" | "cleared" | "bounced" | "all") => rpc<ChequeDto[]>("listChequesAction", { status }),
    [],
  );
  const after = async (res: Result) => {
    if (res.ok) {
      await syncNow().catch(() => {});
      notifyChange("debts");
      notifyChange("debt_payments");
    }
    return res;
  };
  const clear = async (id: string, accountId: string | null) => after(await rpc<Result>("clearChequeAction", id, accountId));
  const bounce = async (id: string) => after(await rpc<Result>("bounceChequeAction", id));

  if (!currentShop?.cheques_enabled) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-muted-foreground">
        Cheques are switched off. Turn them on in Settings → Shop.
      </div>
    );
  }
  return (
    <ChequesScreen
      currency={currentShop.currency}
      reminderDays={currentShop.cheque_reminder_days ?? 10}
      canManage={role === "owner" || role === "manager"}
      list={list}
      clear={clear}
      bounce={bounce}
    />
  );
}
