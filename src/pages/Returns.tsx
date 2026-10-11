import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailsDialog } from "@/components/DetailsDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { Pagination } from "@/components/Pagination";
import { SCROLL_BATCH } from "@/hooks/usePagination";
import { Undo2, Eye, Trash2, Truck, Plus, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReturnReceiptDialog } from "@/components/ReturnReceiptDialog";
import type { ReturnSlip } from "@/lib/return-receipt";
import { useAddNew } from "@/hooks/useAddNew";
import { bulkUpsertLocal, notifyChange } from "@/lib/localDb";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { toast } from "sonner";
import { fmtDateTime } from "@/lib/date-format";

interface CustomerReturnRow {
  id: string;
  return_number: string | null;
  total_refund: number;
  deduction?: number;
  refund_method: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  /** Null for a return taken without a bill. */
  sale_id: string | null;
  sales: { receipt_number: string | null } | null;
  customer_name?: string | null;
  credited_to_ledger?: boolean;
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

  // Infinite scroll: `page` counts the batches of SCROLL_BATCH shown so far.
  const pageSize = SCROLL_BATCH;
  const setPageSize = (_n: number) => { setCustPage(1); setSupPage(1); };

  const [custDetails, setCustDetails] = useState<CustomerReturnRow | null>(null);
  const [supDetails, setSupDetails] = useState<SupplierReturnRow | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => { document.title = "UCU"; }, []);

  const loadCustomer = useCallback(async () => {
    if (!currentShop) return;
    setCustLoading(true);
    try {
      const { rows, totalCount } = await rpc<{ rows: CustomerReturnRow[]; totalCount: number }>(
        "listSaleReturnsAction", 1, custPage * pageSize,
      );
      setCustRows(rows ?? []);
      setCustCount(totalCount ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setCustLoading(false);
    }
  }, [currentShop, custPage, pageSize, t]);

  const loadSupplier = useCallback(async () => {
    if (!currentShop) return;
    setSupLoading(true);
    try {
      const { rows, totalCount } = await rpc<{ rows: SupplierReturnRow[]; totalCount: number }>(
        "listSupplierReturnsAction", 1, supPage * pageSize,
      );
      setSupRows(rows ?? []);
      setSupCount(totalCount ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSupLoading(false);
    }
  }, [currentShop, supPage, pageSize, t]);

  useEffect(() => { loadCustomer(); }, [loadCustomer]);
  useEffect(() => { loadSupplier(); }, [loadSupplier]);

  const deleteCustReturn = async (id: string) => {
    const ok = await confirm({
      title: t("returns.deleteReturn"),
      description: t("returns.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      const res = await rpc<{ ok: boolean; error?: string; rows?: { debts: Record<string, unknown>[]; debt_payments: Record<string, unknown>[] } }>("deleteSaleReturnAction", id);
      if (!res.ok) return toast.error(res.error ?? t("common.error"));
      // A ledger-credited return is reversed with new khata entries — apply them now.
      if (res.rows) {
        await bulkUpsertLocal("debts", res.rows.debts);
        await bulkUpsertLocal("debt_payments", res.rows.debt_payments);
        notifyChange("debts");
        notifyChange("debt_payments");
      }
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
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
    try {
      const res = await rpc<{ ok: boolean; error?: string; rows?: { debts: Record<string, unknown>[]; debt_payments: Record<string, unknown>[] } }>("deleteSupplierReturnAction", id);
      if (!res.ok) return toast.error(res.error ?? t("common.error"));
      // A ledger credit is undone with opposite entries — apply them here.
      if (res.rows) {
        await bulkUpsertLocal("debts", res.rows.debts);
        await bulkUpsertLocal("debt_payments", res.rows.debt_payments);
        notifyChange("debts");
        notifyChange("debt_payments");
      }
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    toast.success(t("common.deleted"));
    loadSupplier();
  };

  // New return is its own page, laid out like the till (pages/NewReturn).
  const navigate = useNavigate();
  const canCreate = role === "owner" || role === "manager";
  const [reprint, setReprint] = useState<ReturnSlip | null>(null);
  const startReturn = () => navigate("/returns/new");
  useAddNew({ return: canCreate && startReturn });
  const openReprint = async (id: string) => {
    const slip = await rpc<ReturnSlip | null>("getReturnReceiptAction", id).catch(() => null);
    if (!slip) return toast.error(t("common.error"));
    setReprint(slip);
  };

  const custTotal = useMemo(() => custRows.reduce((a, r) => a + Number(r.total_refund), 0), [custRows]);
  const supTotal = useMemo(() => supRows.reduce((a, r) => a + Number(r.total_refund), 0), [supRows]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Undo2 className="size-6 text-primary" /> {t("returns.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Customer refunds and items you returned to suppliers</p>
        </div>
        {canCreate && (
          <Button onClick={startReturn}>
            <Plus className="size-4 mr-2" /> New return
          </Button>
        )}
      </header>

      <ReturnReceiptDialog slip={reprint} onClose={() => setReprint(null)} />

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
                  {/* Merged columns: ten across clipped the refund and the
                      actions off the right edge on an ordinary laptop. */}
                  <TableHead className="whitespace-nowrap">{t("returns.returnNumber")}</TableHead>
                  <TableHead>{t("returns.receiptCol")}</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>{t("returns.method")}</TableHead>
                  <TableHead className="text-end">{t("returns.refund")}</TableHead>
                  <TableHead className="w-px"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custLoading && custRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{t("common.loading")}</TableCell></TableRow>
                ) : custRows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">{t("returns.empty")}</TableCell></TableRow>
                ) : custRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-mono text-xs">{r.return_number}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(r.created_at)}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono whitespace-nowrap">{r.sales?.receipt_number ?? (r.sale_id ? "—" : "No bill")}</div>
                      {r.customer_name && <div className="text-muted-foreground">{r.customer_name}</div>}
                    </TableCell>
                    <TableCell className="text-sm min-w-[10rem]">
                      <div className="line-clamp-2">
                        {r.sale_return_items.map((i) => Number(i.quantity) > 1 ? `${i.product_name} ×${Number(i.quantity)}` : i.product_name).join(", ") || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {r.sale_return_items.reduce((a, i) => a + Number(i.quantity), 0)} {t("common.items").toLowerCase()}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="capitalize whitespace-nowrap">{r.credited_to_ledger ? "Ledger" : r.refund_method}</div>
                      {r.reason && <div className="text-xs text-muted-foreground line-clamp-2 max-w-[12rem]">{r.reason}</div>}
                    </TableCell>
                    <TableCell className="text-end tabular-nums whitespace-nowrap">
                      <div className="font-medium">{formatMoney(Number(r.total_refund), cur)}</div>
                      {Number(r.deduction ?? 0) > 0 && (
                        <div className="text-xs text-destructive">−{formatMoney(Number(r.deduction), cur)} deducted</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => setCustDetails(r)}><Eye className="size-4" /></Button>
                      <Button variant="ghost" size="icon" title="Receipt" onClick={() => void openReprint(r.id)}><Printer className="size-4" /></Button>
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
                  <TableHead className="whitespace-nowrap">Return #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Purchase ref</TableHead>
                  <TableHead>{t("common.items")}</TableHead>
                  <TableHead>{t("returns.reason")}</TableHead>
                  <TableHead className="text-end">Refund</TableHead>
                  <TableHead className="w-px"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supLoading && supRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">{t("common.loading")}</TableCell></TableRow>
                ) : supRows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">No supplier returns yet. Open a purchase and click the return icon.</TableCell></TableRow>
                ) : supRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-mono text-xs">{r.return_number}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{fmtDateTime(r.created_at)}</div>
                    </TableCell>
                    <TableCell>{r.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.purchases?.reference_number ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.supplier_return_items.reduce((a, i) => a + Number(i.quantity), 0)}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{r.reason ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums font-medium whitespace-nowrap">{formatMoney(Number(r.total_refund), cur)}</TableCell>
                    <TableCell className="whitespace-nowrap">
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
          subtitle={`${fmtDateTime(custDetails.created_at)} · ${t("returns.receiptCol")} ${custDetails.sales?.receipt_number ?? "—"}`}
          rows={[
            { label: t("returns.refundMethod"), value: <span className="capitalize">{custDetails.refund_method}</span> },
            ...(Number(custDetails.deduction ?? 0) > 0
              ? [{ label: "Deduction", value: <span className="text-destructive">−{formatMoney(Number(custDetails.deduction), cur)}</span> }]
              : []),
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
          subtitle={`${fmtDateTime(supDetails.created_at)} · ${supDetails.suppliers?.name ?? "—"}`}
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

/** The terminal's customer picker, reporting just the id to the return form. */
/** The suppliers this till knows (local store — works offline to pick). */
