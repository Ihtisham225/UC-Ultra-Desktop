import { AccountsScreen, type AccountsApi } from "@/components/AccountsScreen";
import { useShop } from "@/contexts/ShopContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { rpc } from "@/lib/apiClient";

/** Desktop talks to the same server actions over rpc. */
const api: AccountsApi = {
  list: (includeArchived) => rpc("listAccountsAction", includeArchived),
  detail: (id) => rpc("getAccountDetailAction", id),
  create: (input) => rpc("createAccountAction", input),
  update: (id, input) => rpc("updateAccountAction", id, input),
  setArchived: (id, archived) => rpc("setAccountArchivedAction", id, archived),
  adjust: (input) => rpc("adjustAccountAction", input),
  transfer: (input) => rpc("transferAccountAction", input),
};

export default function Accounts() {
  usePageMeta({ title: "Accounts — UCU", description: "Cash, bank and wallet balances.", path: "/accounts" });
  const { hasPerm, role } = useShop();
  const canEdit = role === "owner" || role === "manager" || hasPerm("accounts", "edit");
  return <AccountsScreen api={api} canEdit={canEdit} />;
}
