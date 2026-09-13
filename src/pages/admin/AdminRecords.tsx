import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CreditCard, Search, Ban, CheckCircle2, ArrowUpCircle, ArrowDownCircle, Crown, AlertTriangle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/AdminUi";

interface OverviewStats {
  total_users: number;
  total_shops: number;
  pro_shops: number;
  total_sales: number;
  pending_payments: number;
  total_revenue: number;
}

interface AdminUser {
  user_id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_super_admin: boolean;
  shop_count: number;
  is_blocked: boolean;
  shop_roles: string | null;
  /** Which stores this person belongs to, and as what. */
  shops: { shop_id: string; name: string; role: string }[];
}

interface AdminShop {
  shop_id: string;
  name: string;
  currency: string;
  is_pro: boolean;
  pro_until: string | null;
  trial_ends_at?: string | null;
  created_at: string;
  owner_email: string | null;
  member_count: number;
  sales_count: number;
  sales_total: number;
  is_blocked: boolean;
  /** Who works in this store, so staff can be traced to a shop. */
  members: { user_id: string; email: string; name: string | null; role: string }[];
}


/**
 * The two record tables — users and stores. One component with a `section`
 * prop rather than two: both share every dialog (block, delete, grant Pro) and
 * every handler, and splitting them would mean maintaining that twice.
 */
export default function AdminRecords({ section }: { section: "users" | "shops" }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [shops, setShops] = useState<AdminShop[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");
  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);
  const [blockShopTarget, setBlockShopTarget] = useState<AdminShop | null>(null);
  const [proTarget, setProTarget] = useState<AdminShop | null>(null);
  const [proMode, setProMode] = useState<"grant" | "deactivate">("grant");
  const [proDays, setProDays] = useState<number>(30);
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUser | null>(null);
  const [deleteShopTarget, setDeleteShopTarget] = useState<AdminShop | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "UCU"; }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, sh] = await Promise.all([
        rpc<OverviewStats>("adminOverviewAction"),
        rpc<AdminUser[]>("adminListUsersAction"),
        rpc<AdminShop[]>("adminListShopsAction"),
      ]);
      setStats(s ?? null);
      setUsers(u ?? []);
      setShops(sh ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const requestToggleBlock = (u: AdminUser) => {
    if (u.is_super_admin) { toast.error(t("admin.users.cantBlockSuper")); return; }
    setBlockTarget(u);
  };
  const confirmToggleShopBlock = async () => {
    if (!blockShopTarget) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>(
        "adminSetShopBlockedAction", blockShopTarget.shop_id, !blockShopTarget.is_blocked);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(blockShopTarget.is_blocked ? "Store unblocked" : "Store blocked");
    setBlockShopTarget(null);
    load();
  };

  const confirmToggleBlock = async () => {
    if (!blockTarget) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminSetUserBlockedAction", blockTarget.user_id, !blockTarget.is_blocked);
      if (!res.ok) { toast.error(res.error ?? "Failed"); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed"); return;
    } finally {
      setBusy(false);
    }
    toast.success(blockTarget.is_blocked ? t("admin.users.unblocked") : t("admin.users.blocked2"));
    setBlockTarget(null);
    load();
  };

  // Granting stacks days onto any remaining time (incl. an active free trial),
  // so a trial shop can be put on a paid plan without losing trial days.
  const requestGrantPro = (s: AdminShop) => {
    setProMode("grant");
    setProDays(30);
    setProTarget(s);
  };
  const requestDeactivatePro = (s: AdminShop) => {
    setProMode("deactivate");
    setProTarget(s);
  };
  const confirmTogglePro = async () => {
    if (!proTarget) return;
    const grant = proMode === "grant";
    if (grant && (!proDays || proDays < 1)) { toast.error("Enter a valid number of days"); return; }
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminSetShopProAction", proTarget.shop_id, grant, grant ? proDays : 0);
      if (!res.ok) { toast.error(res.error ?? "Failed"); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed"); return;
    } finally {
      setBusy(false);
    }
    toast.success(grant ? t("admin.shops.proGrantedMsg", { days: proDays }) : t("admin.shops.proRemovedMsg"));
    setProTarget(null);
    load();
  };

  const requestDeleteUser = (u: AdminUser) => {
    if (u.is_super_admin) { toast.error(t("admin.users.cantDeleteSuper")); return; }
    setDeleteConfirmText("");
    setDeleteUserTarget(u);
  };
  const confirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminDeleteUserAction", deleteUserTarget.user_id);
      if (!res.ok) { toast.error(res.error ?? "Failed"); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed"); return;
    } finally {
      setBusy(false);
    }
    toast.success(t("admin.users.deleted"));
    setDeleteUserTarget(null);
    setDeleteConfirmText("");
    load();
  };

  const requestDeleteShop = (s: AdminShop) => {
    setDeleteConfirmText("");
    setDeleteShopTarget(s);
  };
  const confirmDeleteShop = async () => {
    if (!deleteShopTarget) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminDeleteShopAction", deleteShopTarget.shop_id);
      if (!res.ok) { toast.error(res.error ?? "Failed"); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed"); return;
    } finally {
      setBusy(false);
    }
    toast.success(t("admin.shops.deleted"));
    setDeleteShopTarget(null);
    setDeleteConfirmText("");
    load();
  };

  const fmt = (n: number) => Number(n ?? 0).toLocaleString();

  const filteredUsers = users.filter((u) =>
    !search || u.email?.toLowerCase().includes(search.toLowerCase()) || u.display_name?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredShops = shops.filter((s) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={section === "users" ? "Users" : "Stores"}
        description={
          section === "users"
            ? "Every account on the platform, and which stores they belong to."
            : "Every store, what it runs on, and what it is paying."
        }
        actions={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.searchPlaceholder")}
                className="ps-8"
              />
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/billing"><CreditCard className="size-4 me-1.5" /> Billing</Link>
            </Button>
          </>
        }
      />

      {section === "users" ? (
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-start p-3">{t("admin.users.email")}</th>
                  <th className="text-start p-3">{t("admin.users.name")}</th>
                  <th className="text-start p-3">Stores</th>
                  <th className="text-start p-3">{t("admin.users.joined")}</th>
                  <th className="text-start p-3">{t("admin.users.lastSignIn")}</th>
                  <th className="text-start p-3">{t("admin.users.role")}</th>
                  <th className="text-end p-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.user_id} className={cn("border-t hover:bg-muted/20", u.is_blocked && "opacity-60")}>
                    <td className="p-3 font-medium">
                      {u.email}
                      {u.is_blocked && <span className="ms-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">{t("admin.users.blocked")}</span>}
                    </td>
                    <td className="p-3 text-muted-foreground">{u.display_name ?? "—"}</td>
                    <td className="p-3">
                      {u.shops.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.shops.map((sh) => (
                            <span
                              key={sh.shop_id}
                              className="text-[11px] px-1.5 py-0.5 rounded bg-muted whitespace-nowrap"
                              title={sh.role}
                            >
                              {sh.name}
                              <span className="text-muted-foreground"> · {sh.role}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{format(new Date(u.created_at), "PP")}</td>
                    <td className="p-3 text-muted-foreground text-xs">{u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "PPp") : "—"}</td>
                    <td className="p-3">
                      {u.is_super_admin ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">{t("admin.users.super")}</span>
                      ) : u.shop_roles ? (
                        <div className="flex flex-wrap gap-1">
                          {u.shop_roles.split(",").map((r) => {
                            const role = r.trim();
                            const cls =
                              role === "owner"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                : role === "manager"
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                : "bg-muted-foreground/10 text-muted-foreground";
                            return (
                              <span key={role} className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", cls)}>
                                {role}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-end">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant={u.is_blocked ? "outline" : "ghost"}
                          disabled={u.is_super_admin}
                          onClick={() => requestToggleBlock(u)}
                          className={cn("h-7 px-2 text-xs", u.is_blocked ? "text-success border-success/40" : "text-destructive hover:bg-destructive/10")}
                        >
                          {u.is_blocked ? <><CheckCircle2 className="size-3.5 mr-1" /> {t("admin.users.unblock")}</> : <><Ban className="size-3.5 mr-1" /> {t("admin.users.block")}</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={u.is_super_admin}
                          onClick={() => requestDeleteUser(u)}
                          className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5 mr-1" /> {t("admin.users.delete")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredUsers.length && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{loading ? t("common.loading") : t("admin.noUsers")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
      ) : (
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-start p-3">{t("admin.shops.shop")}</th>
                  <th className="text-start p-3">{t("admin.shops.owner")}</th>
                  <th className="text-start p-3">{t("admin.shops.plan")}</th>
                  <th className="text-end p-3">{t("admin.shops.members")}</th>
                  <th className="text-end p-3">{t("admin.shops.sales")}</th>
                  <th className="text-end p-3">{t("admin.shops.revenue")}</th>
                  <th className="text-start p-3">{t("admin.shops.created")}</th>
                  <th className="text-end p-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map((s) => {
                  const active = s.is_pro && (!s.pro_until || new Date(s.pro_until) > new Date());
                  return (
                    <tr key={s.shop_id} className={cn("border-t hover:bg-muted/20", s.is_blocked && "opacity-60")}>
                      <td className="p-3 font-medium">
                        {s.name} <span className="text-xs text-muted-foreground">({s.currency})</span>
                        {s.is_blocked && (
                          <span className="ms-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
                            BLOCKED
                          </span>
                        )}
                        {s.members.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.members.map((m) => (
                              <span
                                key={m.user_id}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-muted whitespace-nowrap"
                                title={m.email}
                              >
                                {m.name || m.email}
                                <span className="text-muted-foreground"> · {m.role}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{s.owner_email ?? "—"}</td>
                      <td className="p-3"><ProTag is_pro={s.is_pro} pro_until={s.pro_until} trial_ends_at={s.trial_ends_at} /></td>
                      <td className="p-3 text-end">{s.member_count}</td>
                      <td className="p-3 text-end">{s.sales_count}</td>
                      <td className="p-3 text-end">{fmt(s.sales_total)}</td>
                      <td className="p-3 text-muted-foreground text-xs">{format(new Date(s.created_at), "PP")}</td>
                      <td className="p-3 text-end">
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => requestGrantPro(s)}
                            className="h-7 px-2 text-xs border-primary/40 text-primary hover:bg-primary/10"
                          >
                            <ArrowUpCircle className="size-3.5 mr-1" /> {active ? t("admin.shops.extend", { defaultValue: "Extend" }) : t("admin.shops.activate")}
                          </Button>
                          {active && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => requestDeactivatePro(s)}
                              className="h-7 px-2 text-xs text-muted-foreground"
                            >
                              <ArrowDownCircle className="size-3.5 mr-1" /> {t("admin.shops.deactivate")}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBlockShopTarget(s)}
                            className={cn(
                              "h-7 px-2 text-xs",
                              s.is_blocked
                                ? "border-success/40 text-success hover:bg-success/10"
                                : "border-destructive/40 text-destructive hover:bg-destructive/10",
                            )}
                          >
                            <Ban className="size-3.5 mr-1" /> {s.is_blocked ? "Unblock" : "Block"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => requestDeleteShop(s)}
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5 mr-1" /> {t("admin.shops.delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredShops.length && (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{loading ? t("common.loading") : t("admin.noShops")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
      )}


      <AlertDialog open={!!blockShopTarget} onOpenChange={(o) => !o && setBlockShopTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">
              {blockShopTarget?.is_blocked ? "Unblock this store?" : "Block this store?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {blockShopTarget?.is_blocked
                ? "Everyone in the store can sign in and work as normal again."
                : "Nobody will be able to open the store until it's unblocked. Nothing is deleted — every purchase, challan and payment stays exactly as it is."}
              <div className="mt-3 rounded-md border bg-muted/40 p-3 text-start text-xs">
                <div className="font-medium text-foreground">{blockShopTarget?.name}</div>
                {blockShopTarget?.owner_email && <div className="text-muted-foreground">{blockShopTarget.owner_email}</div>}
                <div className="text-muted-foreground">
                  {blockShopTarget?.member_count ?? 0} member{(blockShopTarget?.member_count ?? 0) === 1 ? "" : "s"} affected
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); confirmToggleShopBlock(); }}
              className={cn(
                blockShopTarget?.is_blocked
                  ? "bg-success text-white hover:bg-success/90"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              )}
            >
              {blockShopTarget?.is_blocked ? "Unblock store" : "Block store"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!blockTarget} onOpenChange={(o) => !o && setBlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className={cn(
              "mx-auto mb-2 flex size-12 items-center justify-center rounded-full",
              blockTarget?.is_blocked ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
            )}>
              {blockTarget?.is_blocked ? <CheckCircle2 className="size-6" /> : <AlertTriangle className="size-6" />}
            </div>
            <AlertDialogTitle className="text-center">
              {blockTarget?.is_blocked ? t("admin.blockDialog.titleUnblock") : t("admin.blockDialog.titleBlock")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {blockTarget?.is_blocked ? t("admin.blockDialog.bodyUnblock") : t("admin.blockDialog.bodyBlock")}
              <div className="mt-3 rounded-md border bg-muted/40 p-3 text-start text-xs">
                <div className="font-medium text-foreground">{blockTarget?.email}</div>
                {blockTarget?.display_name && <div className="text-muted-foreground">{blockTarget.display_name}</div>}
                <div className="text-muted-foreground">{t("admin.blockDialog.ownsShops", { n: blockTarget?.shop_count ?? 0 })}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); confirmToggleBlock(); }}
              className={cn(blockTarget?.is_blocked ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            >
              {busy ? t("admin.blockDialog.working") : blockTarget?.is_blocked ? t("admin.users.unblock") : t("admin.users.block")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!proTarget} onOpenChange={(o) => !o && setProTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const active = proMode === "deactivate";
            return (
              <>
                <DialogHeader>
                  <div className={cn(
                    "mx-auto mb-2 flex size-12 items-center justify-center rounded-full",
                    active ? "bg-muted text-muted-foreground" : "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                  )}>
                    <Crown className="size-6" />
                  </div>
                  <DialogTitle className="text-center">
                    {active ? t("admin.proDialog.titleRemove") : t("admin.proDialog.titleGrant")}
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    {active ? t("admin.proDialog.bodyRemove") : t("admin.proDialog.bodyGrant")}
                  </DialogDescription>
                </DialogHeader>

                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="font-medium">{proTarget?.name}</div>
                  <div className="text-xs text-muted-foreground">{proTarget?.owner_email ?? "—"}</div>
                  {proTarget?.pro_until && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("admin.proDialog.currentExpiry", { date: format(new Date(proTarget.pro_until), "PP") })}
                    </div>
                  )}
                </div>

                {!active && (
                  <div className="space-y-2">
                    <Label htmlFor="pro-days">{t("admin.proDialog.duration")}</Label>
                    <Input
                      id="pro-days"
                      type="number"
                      min={1}
                      value={proDays}
                      onChange={(e) => setProDays(Number(e.target.value) || 0)}
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[7, 30, 90, 180, 365].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          size="sm"
                          variant={proDays === d ? "default" : "outline"}
                          className="h-7 px-2 text-xs"
                          onClick={() => setProDays(d)}
                        >
                          {d === 365 ? t("admin.proDialog.year1") : t("admin.proDialog.daysN", { n: d })}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setProTarget(null)} disabled={busy}>{t("common.cancel")}</Button>
                  <Button
                    onClick={confirmTogglePro}
                    disabled={busy || (!active && (!proDays || proDays < 1))}
                    className={active ? "" : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-500/90 hover:to-amber-600/90 text-white"}
                  >
                    {busy ? t("admin.proDialog.saving") : active ? t("admin.proDialog.deactivate") : t("admin.proDialog.activateFor", { days: proDays })}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserTarget} onOpenChange={(o) => { if (!o) { setDeleteUserTarget(null); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="size-6" />
            </div>
            <AlertDialogTitle className="text-center">{t("admin.deleteUser.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-center" asChild>
              <div>
                <div>{t("admin.deleteUser.body", { n: deleteUserTarget?.shop_count ?? 0 })}</div>
                <div className="mt-3 rounded-md border bg-muted/40 p-3 text-start text-xs">
                  <div className="font-medium text-foreground">{deleteUserTarget?.email}</div>
                  {deleteUserTarget?.display_name && <div className="text-muted-foreground">{deleteUserTarget.display_name}</div>}
                  <div className="text-muted-foreground">{t("admin.blockDialog.ownsShops", { n: deleteUserTarget?.shop_count ?? 0 })}</div>
                </div>
                <div className="mt-3 text-start">
                  <Label htmlFor="confirm-del-user" className="text-xs">{t("admin.deleteUser.typeToConfirm")}</Label>
                  <Input
                    id="confirm-del-user"
                    autoComplete="off"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || deleteConfirmText !== "DELETE"}
              onClick={(e) => { e.preventDefault(); confirmDeleteUser(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? t("admin.deleteUser.deleting") : t("admin.deleteUser.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteShopTarget} onOpenChange={(o) => { if (!o) { setDeleteShopTarget(null); setDeleteConfirmText(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <Trash2 className="size-6" />
            </div>
            <AlertDialogTitle className="text-center">{t("admin.deleteShop.title")}</AlertDialogTitle>
            <AlertDialogDescription className="text-center" asChild>
              <div>
                <div>{t("admin.deleteShop.body")}</div>
                <div className="mt-3 rounded-md border bg-muted/40 p-3 text-start text-xs">
                  <div className="font-medium text-foreground">{deleteShopTarget?.name}</div>
                  <div className="text-muted-foreground">{deleteShopTarget?.owner_email ?? "—"}</div>
                  <div className="text-muted-foreground">
                    {t("admin.deleteShop.meta", { sales: deleteShopTarget?.sales_count ?? 0, members: deleteShopTarget?.member_count ?? 0 })}
                  </div>
                </div>
                <div className="mt-3 text-start">
                  <Label htmlFor="confirm-del-shop" className="text-xs">{t("admin.deleteUser.typeToConfirm")}</Label>
                  <Input
                    id="confirm-del-shop"
                    autoComplete="off"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || deleteConfirmText !== "DELETE"}
              onClick={(e) => { e.preventDefault(); confirmDeleteShop(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? t("admin.deleteUser.deleting") : t("admin.deleteShop.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const ProTag = forwardRef<HTMLSpanElement, { is_pro: boolean; pro_until: string | null; trial_ends_at?: string | null }>(
  ({ is_pro, pro_until, trial_ends_at }, ref) => {
    const { t } = useTranslation();
    const active = is_pro && (!pro_until || new Date(pro_until) > new Date());
    // Still on the free-trial grant: pro time doesn't extend past the trial window.
    const onTrial =
      active && !!trial_ends_at && !!pro_until &&
      new Date(pro_until) <= new Date(trial_ends_at) && new Date(trial_ends_at) > new Date();
    if (onTrial) {
      return <span ref={ref} className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">{t("admin.shops.trial", { defaultValue: "Trial" })}</span>;
    }
    return active ? (
      <span ref={ref} className="text-xs font-bold px-2 py-0.5 rounded bg-success/15 text-success">{t("admin.shops.active")}</span>
    ) : (
      <span ref={ref} className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">{t("admin.shops.inactive")}</span>
    );
  }
);
ProTag.displayName = "ProTag";
