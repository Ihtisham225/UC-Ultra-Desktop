import { PartyFieldInputs, partyFieldRows } from "@/components/PartyFieldInputs";
import { fieldsFor, type PartyFieldValues } from "@/lib/party-fields";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { syncNow } from "@/lib/syncEngine";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users as UsersIcon, Trash2, Search, Eye, Edit2, Archive, ArchiveRestore } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { DetailsDialog } from "@/components/DetailsDialog";
import { CustomerSalesHistory } from "@/components/PartyHistory";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { useDuplicatePartyConfirm } from "@/components/DuplicatePartyDialog";
import { findDuplicatePartiesLocal } from "@/lib/partyDuplicatesLocal";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAddNew } from "@/hooks/useAddNew";

interface Customer { id: string; name: string; phone: string | null; email: string | null; notes: string | null; is_supplier?: boolean; custom_fields?: PartyFieldValues; is_archived?: boolean; }

export default function Customers() {
  usePageMeta({ title: "Customers — UCU", description: "Manage customer profiles, contact details and purchase history.", path: "/customers" });
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  /** A bill reopened from the customer's history, for a reprint. */
  const [openSale, setOpenSale] = useState<Record<string, unknown> | null>(null);
  const openReceipt = async (saleId: string) => {
    try {
      // Online-only, like the Sales page reprint: the server holds the full bill.
      const data = await rpc<Record<string, unknown> | null>("getSaleReceiptAction", saleId);
      if (data) setOpenSale({ ...data, shop: currentShop });
      else toast.error("That bill could not be found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the receipt");
    }
  };
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [details, setDetails] = useState<Customer | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { confirmDuplicates, duplicateDialog } = useDuplicatePartyConfirm();
  const sel = useRowSelection();

  const canDelete = role === "owner" || role === "manager";
  /** Show only the archived customers instead of the active ones. */
  const [showArchived, setShowArchived] = useState(false);
  const archivedCount = items.filter((c) => c.is_archived).length;

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q !== search) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const shown = items.filter((c) => !!c.is_archived === showArchived);
    if (!q) return shown;
    return shown.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [items, search, showArchived]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(
    filtered,
    { key: "customers", defaultSize: 20, resetDeps: [search, items.length] },
  );

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const data = await rpc<Customer[]>("listCustomersAction");
      setItems(data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [currentShop, t]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing || !currentShop) return;
    const name = editing.name?.trim() || "";
    if (!name) return toast.error(t("customers.nameRequired"));

    // Same name or phone as anyone already on the books — customer or
    // supplier — on add AND on edit (an edit can turn one record into
    // another's twin). A warning, not a refusal: two people can share a name.
    const matches = await findDuplicatePartiesLocal(currentShop.id, name, editing.phone || null, editing.id ?? null);
    const decision = await confirmDuplicates(matches, { noun: "customer", editing: !!editing.id });
    if (decision !== "create") return;

    const payload = {
      name,
      phone: editing.phone || null,
      email: editing.email || null,
      notes: editing.notes || null,
      is_supplier: !!editing.is_supplier,
      custom_fields: editing.custom_fields ?? {},
    };
    try {
      const res = editing.id
        ? await rpc<{ ok: boolean; error?: string }>("updateCustomerAction", editing.id, payload)
        : await rpc<{ ok: boolean; error?: string }>("createCustomerAction", payload);
      if (!res.ok) return toast.error(res.error || t("common.error"));
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    toast.success(t("common.saved"));
    setEditing(null);
    load();
    // This page reads the server, but the purchase form, the till and Sales read
    // the LOCAL store — which only hears of a new party at the next background
    // sync. Pull it down now so it's there the moment someone switches screens.
    void syncNow().catch(() => { /* offline: the next sync catches up */ });
  };

  // Archiving goes through the server (the party table is shared by both
  // lists); the rpc's own sync brings the flag down to the local store.
  const setArchived = async (ids: string[], archived: boolean) => {
    let res: { ok: boolean; count?: number; error?: string };
    try {
      res = await rpc<{ ok: boolean; count?: number; error?: string }>("setPartiesArchivedAction", ids, archived);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    if (!res.ok) return toast.error(res.error ?? t("common.error"));
    const n = res.count ?? ids.length;
    toast.success(`${archived ? "Archived" : "Restored"} ${n} customer${n === 1 ? "" : "s"}`);
    sel.clear();
    load();
  };

  /** Delete refused because they're on past records — offer Archive. */
  const offerArchive = async (ids: string[], error: string) => {
    const ok = await confirm({ title: "Archive instead?", description: error, confirmLabel: "Archive" });
    if (ok) await setArchived(ids, true);
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t("customers.title"),
      description: t("customers.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    // ⚠️ A refused delete comes back as { ok: false }, not a throw.
    let res: { ok: boolean; error?: string };
    try {
      res = await rpc<{ ok: boolean; error?: string }>("deleteCustomersAction", [id]);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    if (!res.ok) return void offerArchive([id], res.error ?? t("common.error"));
    load();
  };

  const visibleIds = visible.map((c) => c.id);

  const bulkDelete = async () => {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: t("bulk.deleteTitle"),
      description: t("bulk.deleteConfirm", { count: sel.count }),
      variant: "destructive",
    });
    if (!ok) return;
    // ⚠️ A refused delete comes back as { ok: false }, not a throw.
    let res: { ok: boolean; error?: string };
    try {
      res = await rpc<{ ok: boolean; error?: string }>("deleteCustomersAction", sel.ids);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    if (!res.ok) return void offerArchive(sel.ids, res.error ?? t("common.error"));
    toast.success(t("bulk.deleted", { count: sel.count }));
    sel.clear();
    load();
  };

  const bulkExport = () => {
    const rows = items.filter((c) => sel.has(c.id));
    if (rows.length === 0) return toast.error(t("bulk.nothingExported"));
    downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}`, rows, [
      { header: "Name", value: (r) => r.name },
      { header: "Phone", value: (r) => r.phone ?? "" },
      { header: "Email", value: (r) => r.email ?? "" },
      { header: "Notes", value: (r) => r.notes ?? "" },
    ]);
    toast.success(t("bulk.exported", { count: rows.length }));
  };

  useAddNew({ customer: () => setEditing({ name: "" }) });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("customers.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("customers.countLabel", { count: items.length })}</p>
        </div>
        <Button onClick={() => setEditing({ name: "" })} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
          <Plus className="size-4 mr-2" /> {t("customers.addNew")}
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t("customers.searchPlaceholder")}
          aria-label={t("customers.searchPlaceholder")}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}, { replace: true }); }}
          className="ps-9"
        />
      </div>

      {(archivedCount > 0 || showArchived) && (
        <div className="flex justify-end -mt-3">
          <Button size="sm" variant={showArchived ? "secondary" : "ghost"} onClick={() => { setShowArchived((v) => !v); sel.clear(); }}>
            <Archive className="size-4 me-1.5" />
            {showArchived ? "Back to active" : `Archived (${archivedCount})`}
          </Button>
        </div>
      )}

      <BulkActionBar
        selectedCount={sel.count}
        onClear={sel.clear}
        onExport={bulkExport}
        onDelete={canDelete ? bulkDelete : undefined}
        canDelete={canDelete}
        onArchive={canDelete ? () => void setArchived(sel.ids, !showArchived) : undefined}
        restoring={showArchived}
      />

      <Card className="shadow-card overflow-hidden">
        {loading ? <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
        : items.length === 0 ? (
          <div className="p-16 text-center">
            <UsersIcon className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t("customers.empty")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">{t("customers.noMatch", { q: search })}</div>
        ) : (
          <>
            <div className="px-4 py-2 border-b flex items-center gap-3 bg-muted/20">
              <Checkbox
                checked={sel.allChecked(visibleIds) ? true : sel.someChecked(visibleIds) ? "indeterminate" : false}
                onCheckedChange={(v) => sel.setAll(visibleIds, !!v)}
                aria-label="select all"
              />
              <span className="text-xs text-muted-foreground">{t("common.select")}</span>
            </div>
            <ul className="divide-y">
              {visible.map((c) => (
                <li key={c.id} className={`p-4 flex items-center justify-between gap-2 hover:bg-muted/30 ${sel.has(c.id) ? "bg-primary/5" : ""}`}>
                  <Checkbox
                    checked={sel.has(c.id)}
                    onCheckedChange={(v) => sel.toggle(c.id, !!v)}
                    aria-label={`select ${c.name}`}
                  />
                  <button className="flex-1 text-start min-w-0" onClick={() => setDetails(c)}>
                    <div className="font-medium flex items-center gap-2">{c.name}{c.is_archived && <span className="text-[10px] uppercase border rounded px-1.5 py-0.5 text-muted-foreground">Archived</span>}</div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</div>
                  </button>
                  <Button variant="ghost" size="icon" title={t("common.details")} onClick={() => setDetails(c)}><Eye className="size-4" /></Button>
                  <Button variant="ghost" size="icon" title={t("common.edit")} onClick={() => setEditing(c)}><Edit2 className="size-4" /></Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" title={c.is_archived ? "Restore" : "Archive"} onClick={() => setArchived([c.id], !c.is_archived)}>
                      {c.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="size-4 text-destructive" /></Button>
                  )}
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent data-add-new="customer">
          <DialogHeader><DialogTitle>{editing?.id ? t("customers.editCustomer") : t("customers.newCustomer")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>{t("common.name")} *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("common.phone")}</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("common.email")}</Label><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("common.notes")}</Label><Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              {/* The shop's own fields (Settings → Shop → Customer & supplier fields). */}
              <PartyFieldInputs
                fields={fieldsFor(currentShop?.party_fields, { customer: true, supplier: !!editing.is_supplier })}
                values={editing.custom_fields}
                onChange={(custom_fields) => setEditing({ ...editing, custom_fields })}
              />
              {/* One party record, two lists — ticking this puts the same
                  person in the supplier picker without a second record, so
                  their ledger nets both directions instead of splitting. */}
              <label className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${editing.is_supplier ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                <Checkbox
                  checked={!!editing.is_supplier}
                  onCheckedChange={(v) => setEditing({ ...editing, is_supplier: !!v })}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Also a supplier</span>
                  <span className="block text-[11px] text-muted-foreground">
                    You buy from them too. They appear under Suppliers as well, sharing one ledger.
                  </span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button onClick={save} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {details && (
        <DetailsDialog
          open={!!details}
          onClose={() => setDetails(null)}
          title={details.name}
          wide
          rows={[
            { label: t("common.phone"), value: details.phone ?? "—" },
            { label: t("common.email"), value: details.email ?? "—" },
            ...partyFieldRows(
              fieldsFor(currentShop?.party_fields, { customer: true, supplier: !!details.is_supplier }),
              details.custom_fields,
            ),
            { label: t("common.notes"), value: details.notes ?? "—", full: true },
          ]}
          footer={<Button variant="outline" onClick={() => { setEditing(details); setDetails(null); }}>{t("common.edit")}</Button>}
        >
          <CustomerSalesHistory
            customerId={details.id}
            currency={currentShop?.currency ?? "PKR"}
            onOpenSale={openReceipt}
          />
        </DetailsDialog>
      )}
      {/* Over the details, so closing the slip returns to the history. */}
      {openSale && <ReceiptDialog sale={openSale} onClose={() => setOpenSale(null)} />}
      {confirmDialog}
      {duplicateDialog}
    </div>
  );
}
