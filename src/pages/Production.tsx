import { ProductionScreen } from "@/components/ProductionScreen";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import type { ProductionApi } from "@/lib/production";

/**
 * Production (cafe batches). Server-side over RPC, like stock adjustments: a
 * batch moves stock on several products at once, and the till's stock is the
 * server's figure pulled down. The new stock and the run itself arrive with
 * the sync that every successful rpc() triggers.
 */
const api: ProductionApi = {
  formData: () => rpc("productionFormDataAction"),
  list: (opts) => rpc("listProductionRunsAction", opts),
  create: (input) => rpc("createProductionRunAction", input),
  remove: (id) => rpc("deleteProductionRunAction", id),
};

export default function Production() {
  const { role } = useShop();
  return <ProductionScreen api={api} canEdit={role === "owner" || role === "manager"} />;
}
