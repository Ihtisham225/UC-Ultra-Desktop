import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailsDialog } from "@/components/DetailsDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { Undo2, Eye, Trash2, Truck } from "lucide-react";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { format } from "date-fns";
import { toast } from "sonner";

const PAGE_SIZE_KEY = "pos.pageSize.returns";
const DEFAULT_PAGE_SIZE = 20;

interface CustomerReturnRow {
  id: string;
  return_number: string | null;
  total_refund: number;
  refund_method: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  sale_id: string;
  sales: { receipt_number: string | null } | null;
  sale_return_items: { id: string; product_name: string; quantity: number; unit_price: number; line_total: number }[];
}

interface SupplierReturnRow {
  id: string;
  return_number: string | null;
  total_refund: number;
  refund_method: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  purchase_id: string;
  supplier_id: string | null;
  purchases: { reference_number: string | null } | null;
  suppliers: { name: string } | null;
  supplier_return_items: { id: string; product_name: string; quantity: number; unit_cost: number; line_total: number }[];
}

export default function Returns() {
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  const canDelete = role === "owner";
  const formatMoney = useFormatMoney();
  const cur = currentShop?.currency ?? "USD";

  // Customer returns state
  const [custRows, setCustRows] = useState<CustomerReturnRow[]>([]);
  const [custCount, setCustCount] = useState(0);
  const [custLoading, setCustLoading] = useState(true);
  const [custPage, setCustPage] = useState(1);

  // Supplier returns state
  const [supRows, setSupRows] = useState<SupplierReturnRow[]>([]);
  const [supCount, setSupCount] = useState(0);
  const [supLoading, setSupLoading] = useState(true);
  const [supPage, setSupPage] = useState(1);

  const [pageSize, setPageSizeState] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(PAGE_SIZE_KEY) : null;
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_PAGE_SIZE;
  });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    setCustPage(1); setSupPage(1);
    try { localStorage.setItem(PAGE_SIZE_KEY, String(n)); } catch {}
  };

  const [custDetails, setCustDetails] = useState<CustomerReturnRow | null>(null);
  const [supDetails, setSupDetails] = useState<SupplierReturnRow | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => { document.title = "UCU"; }, []);

  const loadCustomer = useCallback(async () => {
    if (!currentShop) return;
    setCustLoading(true);
    const offset = (custPage - 1) * pageSize;
    const { data, count } = await supabase
      .from("sale_returns")
      .select(
        "id, return_number, total_refund, refund_method, reason, notes, created_at, sale_id, sales(receipt_number), sale_return_items(id, product_name, quantity, unit_price, line_total)",
        { count: "exact" },
      )
      .eq("shop_id", currentShop.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    setCustRows(((data as any) ?? []) as CustomerReturnRow[]);
    setCustCount(count ?? 0);
    setCustLoading(false);
  }, [currentShop, custPage, pageSize]);

  const loadSupplier = useCallback(async () => {
    if (!currentShop) return;
    setSupLoading(true);
    const offset = (supPage - 1) * pageSize;
    const { data, count } = await (supabase
      .from("supplier_returns" as any)
      .select(
        "id, return_number, total_refund, refund_method, reason, notes, created_at, purchase_id, supplier_id, purchases(reference_number), suppliers(name), supplier_return_items(id, product_name, quantity, unit_cost, line_total)",
        { count: "exact" },
      )
      .eq("shop_id", currentShop.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1) as any);
    setSupRows(((data as any) ?? []) as SupplierReturnRow[]);
    setSupCount(count ?? 0);
    setSupLoading(false);
  }, [currentShop, supPage, pageSize]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);
  useEffect(() => { loadSupplier(); }, [loadSupplier]);

  const deleteCustReturn = async (id: string) => {
    const ok = await confirm({
      title: t("returns.deleteReturn"),
      description: t("returns.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("delete_sale_return" as any, { _return_id: id });
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    loadCustomer();
  };

  const deleteSupReturn = async (id: string) => {
    const ok = await confirm({
      title: "Delete supplier return",
      description: "This will reverse the stock change. Continue?",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await (supabase.rpc("delete_supplier_return" as any, { _return_id: id }) as any);
    if (error) return toast.error(error.message);
    toast.success(t("common.deleted"));
    loadSupplier();
  };

  const custTotal = useMemo(() => custRows.reduce((a, r) => a + Number(r.total_refund), 0), [custRows]);
  const supTotal = useMemo(() => supRows.reduce((a, r) => a + Number(r.total_refund), 0), [supRows]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Undo2 className="size-6 text-primary" /> {t("returns.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Customer refunds and items you returned to suppliers</p>
      </header>

      <Tabs defaultValue="customer" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="customer" className="gap-2">
            <Undo2 className="size-4" /> From customers
          </TabsTrigger>
          <TabsTrigger value="supplier" className="gap-2">
            <Truck className="size-4" /> To suppliers
          </TabsTrigger>
        </TabsList>

        {/* CUSTOMER RETURNS */}
        <TabsContent value="customer" className="space-y-4">
          <Card className="px-5 py-3 inline-block">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("returns.totalRefunded")}</div>
            <div className="text-xl font-bold tabular-nums">{formatMoney(custTotal, cur)}</div>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("returns.returnNumber")}</TableHead>
                  <TableHead>{t("returns.receiptCol")}</TableHead>
                  <TableHead>{t("common.items")}</TableHead>
                  <TableHead>{t("returns.method")}</TableHead>
                  <TableHead>{t("returns.reason")}</TableHead>
                  <TableHead className="text-end">{t("returns.refund")}</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("common.loading")}</TableCell></TableRow>
                ) : custRows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">{t("returns.empty")}</TableCell></TableRow>
                ) : custRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums whitespace-nowrap">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sales?.receipt_number ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.sale_return_items.reduce((a, i) => a + Number(i.quantity), 0)}</TableCell>
                    <TableCell className="capitalize">{r.refund_method}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{r.reason ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatMoney(Number(r.total_refund), cur)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setCustDetails(r)}><Eye className="size-4" /></Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" title={t("returns.deleteReturn")} onClick={() => deleteCustReturn(r.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={custPage}
              pageSize={pageSize}
              totalItems={custCount}
              onPageChange={setCustPage}
              onPageSizeChange={setPageSize}
            />
          </Card>
        </TabsContent>

        {/* SUPPLIER RETURNS */}
        <TabsContent value="supplier" className="space-y-4">
          <Card className="px-5 py-3 inline-block">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total returned to suppliers</div>
            <div className="text-xl font-bold tabular-nums">{formatMoney(supTotal, cur)}</div>
          </Card>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>Return #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Purchase ref</TableHead>
                  <TableHead>{t("common.items")}</TableHead>
                  <TableHead>{t("returns.reason")}</TableHead>
                  <TableHead className="text-end">Refund</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{t("common.loading")}</TableCell></TableRow>
                ) : supRows.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No supplier returns yet. Open a purchase and click the return icon.</TableCell></TableRow>
                ) : supRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums whitespace-nowrap">{format(new Date(r.created_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                    <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.purchases?.reference_number ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.supplier_return_items.reduce((a, i) => a + Number(i.quantity), 0)}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{r.reason ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium">{formatMoney(Number(r.total_refund), cur)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setSupDetails(r)}><Eye className="size-4" /></Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" title="Delete return" onClick={() => deleteSupReturn(r.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={supPage}
              pageSize={pageSize}
              totalItems={supCount}
              onPageChange={setSupPage}
              onPageSizeChange={setPageSize}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {custDetails && (
        <DetailsDialog
          open={!!custDetails}
          onClose={() => setCustDetails(null)}
          title={custDetails.return_number ?? t("returns.title")}
          subtitle={`${format(new Date(custDetails.created_at), "PPp")} · ${t("returns.receiptCol")} ${custDetails.sales?.receipt_number ?? "—"}`}
          rows={[
            { label: t("returns.refundMethod"), value: <span className="capitalize">{custDetails.refund_method}</span> },
            { label: t("returns.totalRefund"), value: <span className="font-bold">{formatMoney(Number(custDetails.total_refund), cur)}</span> },
            { label: t("returns.reason"), value: custDetails.reason ?? "—", full: true },
            ...(custDetails.notes ? [{ label: t("common.notes"), value: custDetails.notes, full: true }] : []),
            {
              label: t("returns.items"), full: true,
              value: (
                <div className="border rounded-md divide-y mt-1">
                  {custDetails.sale_return_items.map((it) => (
                    <div key={it.id} className="flex justify-between p-2 text-xs">
                      <span>{it.product_name} × {Number(it.quantity)}</span>
                      <span className="tabular-nums font-medium">{formatMoney(Number(it.line_total), cur)}</span>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      )}

      {supDetails && (
        <DetailsDialog
          open={!!supDetails}
          onClose={() => setSupDetails(null)}
          title={supDetails.return_number ?? "Supplier return"}
          subtitle={`${format(new Date(supDetails.created_at), "PPp")} · ${supDetails.suppliers?.name ?? "—"}`}
          rows={[
            { label: "Purchase ref", value: supDetails.purchases?.reference_number ?? "—" },
            { label: t("returns.refundMethod"), value: <span className="capitalize">{supDetails.refund_method}</span> },
            { label: t("returns.totalRefund"), value: <span className="font-bold">{formatMoney(Number(supDetails.total_refund), cur)}</span> },
            { label: t("returns.reason"), value: supDetails.reason ?? "—", full: true },
            ...(supDetails.notes ? [{ label: t("common.notes"), value: supDetails.notes, full: true }] : []),
            {
              label: t("returns.items"), full: true,
              value: (
                <div className="border rounded-md divide-y mt-1">
                  {supDetails.supplier_return_items.map((it) => (
                    <div key={it.id} className="flex justify-between p-2 text-xs">
                      <span>{it.product_name} × {Number(it.quantity)}</span>
                      <span className="tabular-nums font-medium">{formatMoney(Number(it.line_total), cur)}</span>
                    </div>
                  ))}
                </div>
              ),
            },
          ]}
        />
      )}
      {confirmDialog}
    </div>
  );
}
