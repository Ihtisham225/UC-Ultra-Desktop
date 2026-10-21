/**
 * Purchase orders — shapes shared by the web screen, the desktop screen and
 * the server actions (purchase-orders/actions.ts). Types only.
 * ⚠️ COPIED verbatim to the desktop (`src/lib/purchase-orders.ts`).
 */
import type { OrderSlipDto } from "@/lib/order-slip";

export type PurchaseOrderStatus = "open" | "received" | "cancelled";

export interface PurchaseOrderLineDto {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  unit: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseOrderDto {
  id: string;
  number: string;
  status: PurchaseOrderStatus;
  supplier_id: string | null;
  supplier_name: string;
  supplier_phone: string | null;
  expected_date: string | null;
  notes: string | null;
  total: number;
  purchase_id: string | null;
  received_at: string | null;
  created_at: string;
  items: PurchaseOrderLineDto[];
}

export interface PurchaseOrderInput {
  supplier_id?: string | null;
  supplier_name?: string | null;
  supplier_phone?: string | null;
  expected_date?: string | null;
  notes?: string | null;
  items: {
    product_id?: string | null;
    variant_id?: string | null;
    product_name: string;
    unit?: string | null;
    quantity: number;
    unit_cost: number;
  }[];
}

/** One thing the form can order: a product, or one variant of it. */
export interface PoProductOption {
  key: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  unit: string | null;
}

export interface PoSupplierOption {
  id: string;
  name: string;
  phone: string | null;
}

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** What each app plugs into the shared screen (server actions on the web, RPC on the terminal). */
export interface PurchaseOrdersApi {
  list: (status: PurchaseOrderStatus | "all") => Promise<PurchaseOrderDto[]>;
  save: (id: string | null, input: PurchaseOrderInput) => Promise<Result<{ order: PurchaseOrderDto }>>;
  setStatus: (id: string, status: "open" | "cancelled") => Promise<Result>;
  remove: (id: string) => Promise<Result>;
  slip: (id: string) => Promise<OrderSlipDto | null>;
  formData: () => Promise<{ suppliers: PoSupplierOption[]; products: PoProductOption[] }>;
}

export const PO_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  open: "Open",
  received: "Received",
  cancelled: "Cancelled",
};
