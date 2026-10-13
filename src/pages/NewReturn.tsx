import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { NewReturnScreen, type ChainProps } from "@/components/NewReturnScreen";
import type { ReturnProductOption, NewReturnInput, NewSupplierReturnInput, ReturnBillOption } from "@/components/NewReturnDialog";
import { PartySelect } from "@/components/PartySelect";
import { CustomerPicker, type CustomerLite } from "@/components/CustomerPicker";
import { ReturnReceiptDialog } from "@/components/ReturnReceiptDialog";
import type { ReturnSlip } from "@/lib/return-receipt";
import { averageCosts } from "@/lib/pnl";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useProductsWithVariants } from "@/hooks/useProductsWithVariants";
import { useAddNew } from "@/hooks/useAddNew";
import { syncNow } from "@/lib/syncEngine";
import { bulkUpsertLocal, notifyChange } from "@/lib/localDb";
import { focusSoon } from "@/lib/checkout-keys";
import { useCheckoutMode } from "@/components/appearance/useCheckoutMode";

type KhataRows = { debts: Record<string, unknown>[]; debt_payments: Record<string, unknown>[] };
type SaveResult = { ok: boolean; error?: string; returnId?: string; totalRefund?: number; rows?: KhataRows };

/**
 * New return — a full page laid out like the till (components/NewReturnScreen,
 * shared with the web). The product list and bill search come from the
 * terminal's own store, so the screen opens offline; saving goes to the
 * server, which restocks and books the refund.
 */
export default function NewReturn() {
  const navigate = useNavigate();
  const { currentShop } = useShop();
  const cur = currentShop?.currency ?? "USD";
  const mode = useCheckoutMode("return");
  const [slip, setSlip] = useState<ReturnSlip | null>(null);

  useEffect(() => { document.title = "New return — UCU"; }, []);
  useEffect(() => {
    if (!navigator.onLine) toast.info("You're offline — a return saves on the server, so it needs a connection to complete.");
  }, []);

  const { data: catalogue } = useProductsWithVariants<{ id: string; name: string; price: number; unit: string | null; is_service?: boolean; barcode?: string | null }>(currentShop?.id);
  // Average landed cost from the local purchases — the default price when goods
  // go back to a supplier (lib/pnl, the same basis as the P&L).
  const { data: localPurchaseItems } = useLocalStore<any>("purchase_items", currentShop?.id);
  const products = useMemo<ReturnProductOption[]>(() => {
    const avg = averageCosts(localPurchaseItems);
    const costOf = (k: string) => {
      const c = avg.get(k);
      return c === undefined ? null : Math.round(c * 100) / 100;
    };
    const out: ReturnProductOption[] = [];
    for (const p of catalogue) {
      if (p.is_service) continue;
      const vs = (p.product_variants ?? []).filter((v: any) => v.is_active !== false);
      if (vs.length === 0) out.push({ product_id: p.id, variant_id: null, name: p.name, price: Number(p.price) || 0, cost: costOf(p.id), unit: p.unit ?? null, barcode: p.barcode ?? null });
      else for (const v of vs as any[]) out.push({ product_id: p.id, variant_id: v.id, name: `${p.name} — ${v.name}`, price: v.price_override == null ? Number(p.price) || 0 : Number(v.price_override), cost: costOf(v.id), unit: p.unit ?? null, barcode: v.barcode ?? p.barcode ?? null });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogue, localPurchaseItems]);

  // The optional Bill field searches the terminal's own copy of the bills.
  const { data: localSales } = useLocalStore<{ id: string; receipt_number: string | null; created_at: string; total: number | string; customer_id: string | null }>("sales", currentShop?.id);
  const { data: localParties } = useLocalStore<{ id: string; name: string; phone: string | null; is_supplier?: boolean; is_maker?: boolean; is_processor?: boolean }>("suppliers", currentShop?.id);
  const searchBills = useCallback(async (query: string): Promise<ReturnBillOption[]> => {
    const byId = new Map(localParties.map((p) => [p.id, p]));
    const q = query.trim().toLowerCase();
    return [...localSales]
      .filter((s) => {
        if (!q) return true;
        const c = s.customer_id ? byId.get(s.customer_id) : undefined;
        return (s.receipt_number ?? "").toLowerCase().includes(q) ||
          (c?.name ?? "").toLowerCase().includes(q) ||
          (c?.phone ?? "").includes(q);
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 25)
      .map((s) => ({
        id: s.id,
        receipt_number: s.receipt_number,
        created_at: s.created_at,
        total: Number(s.total) || 0,
        customer_id: s.customer_id,
        customer_name: s.customer_id ? byId.get(s.customer_id)?.name ?? null : null,
      }));
  }, [localSales, localParties]);

  /** Server-side save; the khata rows it moved are applied here at once. */
  const saveVia = async (action: string, input: NewReturnInput | NewSupplierReturnInput): Promise<SaveResult> => {
    try {
      // The server must know any product created on this terminal first.
      await syncNow().catch(() => {});
      const res = await rpc<SaveResult>(action, input);
      if (res.ok && res.rows) {
        await bulkUpsertLocal("debts", res.rows.debts);
        await bulkUpsertLocal("debt_payments", res.rows.debt_payments);
        notifyChange("debts");
        notifyChange("debt_payments");
      }
      if (res.ok) void syncNow().catch(() => {});
      return res;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed" };
    }
  };

  const openSlip = async (id: string) => {
    const s = await rpc<ReturnSlip | null>("getReturnReceiptAction", id).catch(() => null);
    if (s) setSlip(s);
  };

  // Add new → Return: this is the return screen, so just put the cursor in search.
  useAddNew({ return: () => focusSoon('[data-ret="search"]') });

  return (
    <>
      <NewReturnScreen
        currency={cur}
        products={products}
        renderCustomer={(onChange, chain) => <ReturnCustomerField onChange={onChange} chain={chain} />}
        submit={(input) => saveVia("createStandaloneReturnAction", input)}
        searchBills={searchBills}
        onSaved={(id) => void openSlip(id)}
        renderSupplier={(onChange, chain) => <ReturnSupplierField onChange={onChange} chain={chain} parties={localParties} />}
        submitSupplier={(input) => saveVia("createStandaloneSupplierReturnAction", input)}
        onBack={() => navigate("/returns")}
        mode={mode}
      />
      <ReturnReceiptDialog
        slip={slip}
        // Ready for the next return: straight back to the search box.
        onClose={() => { setSlip(null); focusSoon('[data-ret="search"]'); }}
      />
    </>
  );
}

function ReturnSupplierField({ onChange, chain, parties }: {
  onChange: (id: string | null) => void;
  chain: ChainProps;
  parties: { id: string; name: string; phone: string | null; is_supplier?: boolean; is_maker?: boolean; is_processor?: boolean }[];
}) {
  const [id, setId] = useState("");
  const options = useMemo(
    () => parties
      .filter((p) => p.is_supplier || p.is_maker || p.is_processor)
      .map((p) => ({ id: p.id, name: p.name, phone: p.phone }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [parties],
  );
  return (
    <PartySelect
      value={id}
      onChange={(next) => { setId(next); onChange(next || null); }}
      options={options}
      placeholder="Choose the supplier…"
      emptyLabel={null}
      className="w-full"
      step={chain.step}
      onPicked={chain.onPicked}
    />
  );
}

function ReturnCustomerField({ onChange, chain }: { onChange: (id: string | null) => void; chain: ChainProps }) {
  const [c, setC] = useState<CustomerLite | null>(null);
  return (
    <CustomerPicker
      value={c}
      onChange={(next) => { setC(next); onChange(next?.id ?? null); }}
      step={chain.step}
      onPicked={chain.onPicked}
    />
  );
}
