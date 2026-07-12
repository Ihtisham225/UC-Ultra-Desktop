import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppSettingsCard } from "@/components/WhatsAppSettingsCard";
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
import { ShieldCheck, Users, Store, CreditCard, Activity, Sparkles, ExternalLink, Search, Ban, CheckCircle2, ArrowUpCircle, ArrowDownCircle, Crown, AlertTriangle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
}

interface AdminShop {
  shop_id: string;
  name: string;
  currency: string;
  is_pro: boolean;
  pro_until: string | null;
  created_at: string;
  owner_email: string | null;
  member_count: number;
  sales_count: number;
  sales_total: number;
}


export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [shops, setShops] = useState<AdminShop[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("overview");
  const [blockTarget, setBlockTarget] = useState<AdminUser | null>(null);
  const [proTarget, setProTarget] = useState<AdminShop | null>(null);
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

  const requestTogglePro = (s: AdminShop) => {
    setProDays(30);
    setProTarget(s);
  };
  const confirmTogglePro = async () => {
    if (!proTarget) return;
    const active = proTarget.is_pro && (!proTarget.pro_until || new Date(proTarget.pro_until) > new Date());
    const next = !active;
    if (next && (!proDays || proDays < 1)) { toast.error("Enter a valid number of days"); return; }
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminSetShopProAction", proTarget.shop_id, next, next ? proDays : 0);
      if (!res.ok) { toast.error(res.error ?? "Failed"); return; }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed"); return;
    } finally {
      setBusy(false);
    }
    toast.success(next ? t("admin.shops.proGrantedMsg", { days: proDays }) : t("admin.shops.proRemovedMsg"));
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
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldCheck className="size-7 text-primary" /> {t("admin.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("admin.subtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/billing"><CreditCard className="size-4 mr-1.5" /> View Billing</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Stat title={t("admin.stats.users")} value={stats ? fmt(stats.total_users) : "—"} icon={Users} />
        <Stat title={t("admin.stats.shops")} value={stats ? fmt(stats.total_shops) : "—"} icon={Store} />
        <Stat title={t("admin.stats.activeSubs")} value={stats ? fmt(stats.pro_shops) : "—"} icon={Sparkles} accent />
        <Stat title={t("admin.stats.totalSales")} value={stats ? fmt(stats.total_sales) : "—"} icon={Activity} />
        <Stat title={t("admin.stats.revenue")} value={stats ? fmt(stats.total_revenue) : "—"} icon={Sparkles} accent />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="overview">{t("admin.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="users">{t("admin.tabs.users")} ({users.length})</TabsTrigger>
            <TabsTrigger value="shops">{t("admin.tabs.shops")} ({shops.length})</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>
          {tab !== "overview" && tab !== "whatsapp" && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.searchPlaceholder")} className="ps-8" />
            </div>
          )}
        </div>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Section title={t("admin.recentShops")}>
              {shops.slice(0, 8).map((s) => (
                <div key={s.shop_id} className="py-2 flex items-center justify-between text-sm border-b last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.owner_email ?? "—"}</div>
                  </div>
                  <ProTag is_pro={s.is_pro} pro_until={s.pro_until} />
                </div>
              ))}
              {!shops.length && !loading && <Empty label={t("admin.noShops")} />}
            </Section>
            <Section title="Active Pro shops">
              {shops.filter((s) => s.is_pro && (!s.pro_until || new Date(s.pro_until) > new Date())).slice(0, 8).map((s) => (
                <div key={s.shop_id} className="py-2 flex items-center justify-between text-sm border-b last:border-0">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      Until {s.pro_until ? format(new Date(s.pro_until), "PP") : "—"}
                    </div>
                  </div>
                  <ProTag is_pro={s.is_pro} pro_until={s.pro_until} />
                </div>
              ))}
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <div className="border rounded-lg overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-start p-3">{t("admin.users.email")}</th>
                  <th className="text-start p-3">{t("admin.users.name")}</th>
                  <th className="text-end p-3">{t("admin.users.shopsCount")}</th>
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
                    <td className="p-3 text-end">{u.shop_count}</td>
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
        </TabsContent>

        <TabsContent value="shops" className="mt-4">
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
                    <tr key={s.shop_id} className="border-t hover:bg-muted/20">
                      <td className="p-3 font-medium">{s.name} <span className="text-xs text-muted-foreground">({s.currency})</span></td>
                      <td className="p-3 text-muted-foreground text-xs">{s.owner_email ?? "—"}</td>
                      <td className="p-3"><ProTag is_pro={s.is_pro} pro_until={s.pro_until} /></td>
                      <td className="p-3 text-end">{s.member_count}</td>
                      <td className="p-3 text-end">{s.sales_count}</td>
                      <td className="p-3 text-end">{fmt(s.sales_total)}</td>
                      <td className="p-3 text-muted-foreground text-xs">{format(new Date(s.created_at), "PP")}</td>
                      <td className="p-3 text-end">
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => requestTogglePro(s)}
                            className={cn("h-7 px-2 text-xs", active ? "text-muted-foreground" : "border-primary/40 text-primary hover:bg-primary/10")}
                          >
                            {active ? <><ArrowDownCircle className="size-3.5 mr-1" /> {t("admin.shops.deactivate")}</> : <><ArrowUpCircle className="size-3.5 mr-1" /> {t("admin.shops.activate")}</>}
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
        </TabsContent>


        <TabsContent value="plans" className="mt-4">
          <PlansEditor />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppSettingsCard />
        </TabsContent>
      </Tabs>

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
            const active = !!proTarget && proTarget.is_pro && (!proTarget.pro_until || new Date(proTarget.pro_until) > new Date());
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

function Stat({ title, value, icon: Icon, accent }: { title: string; value: string; icon: any; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "bg-gradient-to-br from-primary/10 to-amber-500/10 border-primary/30" : "bg-card"}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{title}</span>
        <Icon className={`size-3.5 ${accent ? "text-primary" : ""}`} />
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="font-semibold mb-2">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="text-sm text-muted-foreground py-4 text-center">{label}</div>;
}

const ProTag = forwardRef<HTMLSpanElement, { is_pro: boolean; pro_until: string | null }>(
  ({ is_pro, pro_until }, ref) => {
    const { t } = useTranslation();
    const active = is_pro && (!pro_until || new Date(pro_until) > new Date());
    return active ? (
      <span ref={ref} className="text-xs font-bold px-2 py-0.5 rounded bg-success/15 text-success">{t("admin.shops.active")}</span>
    ) : (
      <span ref={ref} className="text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">{t("admin.shops.inactive")}</span>
    );
  }
);
ProTag.displayName = "ProTag";


function PlansEditor() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    try {
      const data = await rpc<any[]>("adminListPlansAction");
      setRows(data ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateField = (id: string, field: string, value: any) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const save = async (row: any) => {
    setSaving(row.id);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("adminUpdatePlanAction", {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        currency: row.currency,
        duration_days: Number(row.duration_days),
        savings_label: row.savings_label,
        is_active: row.is_active,
        sort_order: Number(row.sort_order),
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(null);
    }
    toast.success("Plan updated");
    load();
  };

  if (loading) return <div className="p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Edit subscription plan prices, durations and labels. Changes take effect immediately for all shops.</p>
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="border rounded-lg p-4 bg-card grid gap-3 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <Label className="text-xs">Name</Label>
              <Input value={r.name ?? ""} onChange={(e) => updateField(r.id, "name", e.target.value)} />
              <div className="text-[10px] text-muted-foreground mt-1">Code: {r.code}</div>
            </div>
            <div>
              <Label className="text-xs">Price</Label>
              <Input type="number" value={r.price ?? 0} onChange={(e) => updateField(r.id, "price", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Currency</Label>
              <Input value={r.currency ?? "PKR"} onChange={(e) => updateField(r.id, "currency", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Days</Label>
              <Input type="number" value={r.duration_days ?? 30} onChange={(e) => updateField(r.id, "duration_days", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Savings label</Label>
              <Input value={r.savings_label ?? ""} onChange={(e) => updateField(r.id, "savings_label", e.target.value)} placeholder="e.g. SAVE 16%" />
            </div>
            <div className="sm:col-span-6 flex items-center justify-between gap-3 pt-2 border-t">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!r.is_active} onChange={(e) => updateField(r.id, "is_active", e.target.checked)} />
                Active
              </label>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Sort</Label>
                <Input type="number" className="w-20" value={r.sort_order ?? 0} onChange={(e) => updateField(r.id, "sort_order", e.target.value)} />
                <Button size="sm" disabled={saving === r.id} onClick={() => save(r)}>
                  {saving === r.id ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
