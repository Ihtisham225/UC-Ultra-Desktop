import { WriteOffsScreen } from "@/components/WriteOffsScreen";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import type { WriteOffsApi } from "@/lib/write-offs";

/**
 * Used in the shop / wastage (cafe shops). Server-side over RPC, like stock
 * adjustments; the stock change and the record arrive with the sync every
 * successful rpc() triggers.
 */
const api: WriteOffsApi = {
  formData: () => rpc("writeOffFormDataAction"),
  list: (opts) => rpc("listWriteOffsAction", opts),
  create: (input) => rpc("createWriteOffAction", input),
  remove: (id) => rpc("deleteWriteOffAction", id),
};

export default function WriteOffs() {
  const { role } = useShop();
  return <WriteOffsScreen api={api} canEdit={role === "owner" || role === "manager"} />;
}
