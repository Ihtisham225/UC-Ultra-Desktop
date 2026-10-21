import { useNavigate } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { usePageMeta } from "@/hooks/usePageMeta";
import { rpc } from "@/lib/apiClient";
import { PurchaseOrdersScreen } from "@/components/purchase-orders/PurchaseOrdersScreen";
import type { OrderSlipDto } from "@/lib/order-slip";
import type {
  PoProductOption,
  PoSupplierOption,
  PurchaseOrderDto,
  PurchaseOrderInput,
  PurchaseOrdersApi,
  PurchaseOrderStatus,
} from "@/lib/purchase-orders";

type Res<T = object> = { ok: boolean; error?: string } & Partial<T>;

/**
 * Purchase orders on the terminal: the shared screen, over RPC. Orders live on
 * the server (they move nothing, so there is no offline copy to keep), which
 * means this page needs a connection — the screen says so when it can't load.
 * ⚠️ rpc() is variadic: every argument on its own, never as an array.
 */
const api: PurchaseOrdersApi = {
  list: (status: PurchaseOrderStatus | "all") => rpc<PurchaseOrderDto[]>("listPurchaseOrdersAction", status),
  save: async (id: string | null, input: PurchaseOrderInput) => {
    const r = await rpc<Res<{ order: PurchaseOrderDto }>>("savePurchaseOrderAction", id, input);
    return r.ok && r.order ? { ok: true as const, order: r.order } : { ok: false as const, error: r.error ?? "Could not save" };
  },
  setStatus: async (id: string, status: "open" | "cancelled") => {
    const r = await rpc<Res>("setPurchaseOrderStatusAction", id, status);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? "Could not update" };
  },
  remove: async (id: string) => {
    const r = await rpc<Res>("deletePurchaseOrderAction", id);
    return r.ok ? { ok: true as const } : { ok: false as const, error: r.error ?? "Could not delete" };
  },
  slip: (id: string) => rpc<OrderSlipDto | null>("getPurchaseOrderSlipAction", id),
  formData: () => rpc<{ suppliers: PoSupplierOption[]; products: PoProductOption[] }>("purchaseOrderFormDataAction"),
};

export default function PurchaseOrders() {
  usePageMeta({ title: "Purchase orders — UCU", description: "Order goods from a supplier and turn the order into a purchase when they arrive.", path: "/purchase-orders" });
  const navigate = useNavigate();
  const { currentShop, role } = useShop();
  const perms = usePermissions();
  if (!currentShop) return null;
  if (!perms.canManagePurchases) {
    return <div className="p-12 text-center text-muted-foreground">You don't have access to purchase orders.</div>;
  }
  return (
    <PurchaseOrdersScreen
      api={api}
      shop={{
        name: currentShop.name,
        address: currentShop.address ?? null,
        phone: currentShop.phone ?? null,
        currency: currentShop.currency ?? "PKR",
        receipt_header: currentShop.receipt_header ?? null,
        receipt_footer: currentShop.receipt_footer ?? null,
      }}
      canDelete={role === "owner" || role === "manager"}
      onConvert={(o) => navigate(`/purchases?from_po=${o.id}`)}
    />
  );
}
