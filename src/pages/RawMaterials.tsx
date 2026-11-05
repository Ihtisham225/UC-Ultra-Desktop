import { useMemo } from "react";
import { RawMaterialsScreen } from "@/components/RawMaterialsScreen";
import { useShop } from "@/contexts/ShopContext";
import { rpc } from "@/lib/apiClient";
import { getAll } from "@/lib/localDb";
import { rawMaterialRows, type RawMaterialsApi } from "@/lib/raw-materials";

/**
 * Raw materials (cafe shops). The list is read from the offline store —
 * products, purchases and their lines all sync — so it works with no
 * connection. Adding one goes through the server (it checks the name), and
 * the new product arrives with the sync every successful rpc() triggers.
 */
export default function RawMaterials() {
  const { currentShop, role } = useShop();
  const shopId = currentShop?.id;
  const api = useMemo<RawMaterialsApi>(() => ({
    list: async ({ from, to }) => {
      if (!shopId) return [];
      const [products, purchases, items] = await Promise.all([
        getAll<any>("products", shopId),
        getAll<any>("purchases", shopId),
        getAll<any>("purchase_items", shopId),
      ]);
      return rawMaterialRows(products, purchases, items, from, to);
    },
    create: (input) => rpc("createRawMaterialAction", input),
  }), [shopId]);
  return <RawMaterialsScreen api={api} canEdit={role === "owner" || role === "manager"} />;
}
