import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Truck, Trash2, Search, Eye, Edit2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DetailsDialog } from "@/components/DetailsDialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { usePagination } from "@/hooks/usePagination";
import { Pagination } from "@/components/Pagination";
import { useRowSelection } from "@/hooks/useRowSelection";
import { BulkActionBar } from "@/components/BulkActionBar";
import { downloadCsv } from "@/lib/csv";
import { usePermissions } from "@/hooks/usePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isHandicraft, isMaterialSupplier, isMaker, isProcessor, isCustomerParty, partyRoleLabel, PARTY_ROLE_FIELDS,
} from "@/lib/handicraft";
import { formatMoney } from "@/lib/format";
import type { PartyBalance } from "@/lib/handicraftTypes";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  /** What this party does. A party can be more than one of these. */
  is_supplier?: boolean;
  /** Also buys from the shop — the same record appears under Customers. */
  is_customer?: boolean;
  is_maker?: boolean;
  is_processor?: boolean;
  city?: string | null;
  opening_balance?: number;
}

export default function Suppliers() {
  const { t } = useTranslation();
  const { currentShop } = useShop();
  const perms = usePermissions();
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [details, setDetails] = useState<Supplier | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const sel = useRowSelection();
  // Handicraft shops read this page as a khata of what each party is owed.
  const [balances, setBalances] = useState<Record<string, PartyBalance>>({});
  const [roleTab, setRoleTab] = useState<"all" | "supplier" | "maker" | "processor" | "customer">("all");

  const canManage = perms.canManageSuppliers;
  const craft = isHandicraft(currentShop);
  const currency = currentShop?.currency ?? "PKR";

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q !== search) setSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const byRole = useMemo(() => {
    if (!craft || roleTab === "all") return items;
    if (roleTab === "supplier") return items.filter(isMaterialSupplier);
    if (roleTab === "maker") return items.filter(isMaker);
    if (roleTab === "customer") return items.filter(isCustomerParty);
    return items.filter(isProcessor);
  }, [items, craft, roleTab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byRole;
    return byRole.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q) ||
      (s.email ?? "").toLowerCase().includes(q) ||
      (s.city ?? "").toLowerCase().includes(q)
    );
  }, [byRole, search]);

  const { page, pageSize, setPage, setPageSize, visible, totalItems } = usePagination(
    filtered,
    { key: "suppliers", defaultSize: 20, resetDeps: [search, roleTab, items.length] },
  );

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      const data = await rpc<Supplier[]>("listSuppliersAction");
      setItems(data ?? []);
      if (isHandicraft(currentShop)) {
        const rows = await rpc<PartyBalance[]>("listPartyBalancesAction");
        setBalances(Object.fromEntries((rows ?? []).map((b) => [b.id, b])));
      }
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
    if (!name) return toast.error(t("purchases.nameRequired"));

    if (!editing.id) {
      const existing = items.find((s) => s.name.trim().toLowerCase() === name.toLowerCase());
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
      // Every shop can mark a party as also being a customer — the toggle for
      // it is rendered for non-craft shops too, so the flag has to travel with
      // the save or ticking it silently does nothing.
      is_customer: !!editing.is_customer,
      ...(craft
        ? {
            is_supplier: !!editing.is_supplier,
            is_maker: !!editing.is_maker,
            is_processor: !!editing.is_processor,
            city: editing.city || null,
            opening_balance: Number(editing.opening_balance) || 0,
          }
        : {}),
    };
    try {
      const res = editing.id
        ? await rpc<{ ok: boolean; error?: string }>("updateSupplierAction", editing.id, payload)
        : await rpc<{ ok: boolean; error?: string }>("createSupplierAction", payload);
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
      title: t("suppliers.title"),
      description: t("suppliers.deleteConfirm"),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await rpc("deleteSuppliersAction", [id]);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    load();
  };

  const visibleIds = visible.map((s) => s.id);

  const bulkDelete = async () => {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: t("bulk.deleteTitle"),
      description: t("bulk.deleteConfirm", { count: sel.count }),
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await rpc("deleteSuppliersAction", sel.ids);
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : t("common.error"));
    }
    toast.success(t("bulk.deleted", { count: sel.count }));
    sel.clear();
    load();
  };

  const bulkExport = () => {
    const rows = items.filter((s) => sel.has(s.id));
    if (rows.length === 0) return toast.error(t("bulk.nothingExported"));
    downloadCsv(`suppliers-${new Date().toISOString().slice(0, 10)}`, rows, [
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
          <h1 className="text-3xl font-bold flex items-center gap-2"><Truck className="size-7 text-primary" /> {craft ? "Parties" : t("suppliers.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("suppliers.countLabel", { count: items.length })}</p>
        </div>
        {canManage && (
          <Button
            onClick={() =>
              setEditing({
                name: "",
                // Adding from a role tab pre-ticks that role. On the customer
                // tab that means supplier stays OFF, or every customer added
                // here would also turn up in the purchase form's seller list.
                is_supplier: craft ? roleTab === "all" || roleTab === "supplier" : true,
                is_customer: craft && roleTab === "customer",
                is_maker: craft && roleTab === "maker",
                is_processor: craft && roleTab === "processor",
              })
            }
            className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
          >
            <Plus className="size-4 mr-2" /> {t("suppliers.addNew")}
          </Button>
        )}
      </header>

      {craft && (
        <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as typeof roleTab)}>
          <TabsList>
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="supplier">Suppliers ({items.filter(isMaterialSupplier).length})</TabsTrigger>
            <TabsTrigger value="maker">Makers ({items.filter(isMaker).length})</TabsTrigger>
            <TabsTrigger value="processor">Processing ({items.filter(isProcessor).length})</TabsTrigger>
            <TabsTrigger value="customer">Customers ({items.filter(isCustomerParty).length})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t("suppliers.searchPlaceholder")}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}, { replace: true }); }}
          className="ps-9"
        />
      </div>

      <BulkActionBar
        selectedCount={sel.count}
        onClear={sel.clear}
        onExport={bulkExport}
        onDelete={canManage ? bulkDelete : undefined}
        canDelete={canManage}
      />

      <Card className="shadow-card overflow-hidden">
        {loading ? <div className="p-12 text-center text-muted-foreground">{t("common.loading")}</div>
        : items.length === 0 ? (
          <div className="p-16 text-center">
            <Truck className="size-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">{t("suppliers.empty")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">{t("suppliers.noMatch", { q: search })}</div>
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
              {visible.map((s) => (
                <li key={s.id} className={`p-4 flex items-center justify-between gap-2 hover:bg-muted/30 ${sel.has(s.id) ? "bg-primary/5" : ""}`}>
                  <Checkbox
                    checked={sel.has(s.id)}
                    onCheckedChange={(v) => sel.toggle(s.id, !!v)}
                    aria-label={`select ${s.name}`}
                  />
                  <button className="flex-1 text-start min-w-0" onClick={() => setDetails(s)}>
                    <div className="font-medium flex items-center gap-2">
                      {s.name}
                      {craft && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                          {partyRoleLabel(s)}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[craft ? s.city : null, s.phone || s.email].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </button>
                  {craft && balances[s.id] && (
                    <div className="text-end shrink-0 hidden sm:block">
                      <div className={`font-semibold ${balances[s.id].balance > 0 ? "text-destructive" : "text-success"}`}>
                        {formatMoney(balances[s.id].balance, currency)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {balances[s.id].balance > 0 ? "you owe" : balances[s.id].balance < 0 ? "in credit" : "settled"}
                      </div>
                    </div>
                  )}
                  <Button variant="ghost" size="icon" title={t("common.details")} onClick={() => setDetails(s)}><Eye className="size-4" /></Button>
                  {canManage && (
                    <Button variant="ghost" size="icon" title={t("common.edit")} onClick={() => setEditing(s)}><Edit2 className="size-4" /></Button>
                  )}
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="size-4 text-destructive" /></Button>
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
          <DialogHeader><DialogTitle>{editing?.id ? t("suppliers.editSupplier") : t("suppliers.newSupplier")}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5"><Label>{t("common.name")} *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>{t("common.phone")}</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>{t("common.email")}</Label><Input type="email" value={editing.email ?? ""} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></div>
              </div>
              {/* Non-craft shops get the one toggle that matters to them;
                  craft shops pick from the full role grid below. */}
              {!craft && (
                <label className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${editing.is_customer ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
                  <Checkbox
                    checked={!!editing.is_customer}
                    onCheckedChange={(v) => setEditing({ ...editing, is_customer: !!v })}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Also a customer</span>
                    <span className="block text-[11px] text-muted-foreground">
                      You sell to them too. They appear under Customers as well, sharing one ledger.
                    </span>
                  </span>
                </label>
              )}
              {craft && (
                <>
                  <div className="space-y-1.5">
                    <Label>What this party does</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {PARTY_ROLE_FIELDS.map((f) => (
                        <label
                          key={f.key}
                          className={`flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                            editing[f.key] ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={!!editing[f.key]}
                            onCheckedChange={(v) => setEditing({ ...editing, [f.key]: !!v })}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">{f.label}</span>
                            <span className="block text-[11px] text-muted-foreground">{f.hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Tick every one that applies — it decides which forms offer this party.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={editing.city ?? ""} onChange={(e) => setEditing({ ...editing, city: e.target.value })} placeholder="Swat, Multan, Lilliani…" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Opening balance</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editing.opening_balance ?? 0}
                      onChange={(e) => setEditing({ ...editing, opening_balance: e.target.value === "" ? 0 : Number(e.target.value) })}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      What you already owed this party before the app — the سابقہ رقم line at the top of
                      their page. Enter a minus figure if they owed you.
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-1.5"><Label>{t("common.notes")}</Label><Textarea rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
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
            ...(craft
              ? [
                  { label: "Roles", value: partyRoleLabel(details) },
                  { label: "City", value: details.city ?? "—" },
                  { label: "Opening balance", value: formatMoney(details.opening_balance ?? 0, currency) },
                  { label: "Purchases", value: formatMoney(balances[details.id]?.purchases_total ?? 0, currency) },
                  { label: "Job work", value: formatMoney(balances[details.id]?.job_work_total ?? 0, currency) },
                  { label: "Paid", value: formatMoney(balances[details.id]?.payments_total ?? 0, currency) },
                  { label: "Balance", value: formatMoney(balances[details.id]?.balance ?? 0, currency) },
                ]
              : []),
            { label: t("common.phone"), value: details.phone ?? "—" },
            { label: t("common.email"), value: details.email ?? "—" },
            { label: t("common.notes"), value: details.notes ?? "—", full: true },
          ]}
          footer={
            <>
              {craft && (
                <Button variant="outline" asChild>
                  <Link to={`/material-purchases?party=${details.id}`}>Open register</Link>
                </Button>
              )}
              {canManage && <Button variant="outline" onClick={() => { setEditing(details); setDetails(null); }}>{t("common.edit")}</Button>}
            </>
          }
        />
      )}
      {confirmDialog}
    </div>
  );
}
