import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Users as UsersIcon, Trash2, Search, Eye, Edit2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { DetailsDialog } from "@/components/DetailsDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { usePageMeta } from "@/hooks/usePageMeta";

interface Customer { id: string; name: string; phone: string | null; email: string | null; notes: string | null; }

export default function Customers() {
  usePageMeta({ title: "Customers — UCU", description: "Manage customer profiles, contact details and purchase history.", path: "/customers" });
  const { t } = useTranslation();
  const { currentShop, role } = useShop();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [details, setDetails] = useState<Customer | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sel = useRowSelection();

  const canDelete = role === "owner" || role === "manager";

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q !== search) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  }, [items, search]);

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

    // Duplicate name detection (only on insert)
    if (!editing.id) {
      const existing = items.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) {
        const ok = await confirm({
          title: t("common.duplicateFound"),
          description: t("common.duplicateMessage", { name: existing.name }),
          confirmLabel: t("common.addAnyway"),
          variant: "default",
        });
        if (!ok) return;
      }
    }

    const payload = {
      name,
      phone: editing.phone || null,
      email: editing.email || null,
      notes: editing.notes || null,
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
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: t("customers.title"),
      description: t("customers.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await rpc("deleteCustomersAction", [id]);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
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
    try {
      await rpc("deleteCustomersAction", sel.ids);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
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

      <BulkActionBar
        selectedCount={sel.count}
        onClear={sel.clear}
        onExport={bulkExport}
        onDelete={canDelete ? bulkDelete : undefined}
        canDelete={canDelete}
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
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</div>
                  </button>
                  <Button variant="ghost" size="icon" title={t("common.details")} onClick={() => setDetails(c)}><Eye className="size-4" /></Button>
                  <Button variant="ghost" size="icon" title={t("common.edit")} onClick={() => setEditing(c)}><Edit2 className="size-4" /></Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? t("customers.editCustomer") : t("customers.newCustomer")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>{t("common.name")} *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("common.phone")}</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("common.email")}</Label><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>{t("common.notes")}</Label><Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
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
          rows={[
            { label: t("common.phone"), value: details.phone ?? "—" },
            { label: t("common.email"), value: details.email ?? "—" },
            { label: t("common.notes"), value: details.notes ?? "—", full: true },
          ]}
          footer={<Button variant="outline" onClick={() => { setEditing(details); setDetails(null); }}>{t("common.edit")}</Button>}
        />
      )}
      {confirmDialog}
    </div>
  );
}
