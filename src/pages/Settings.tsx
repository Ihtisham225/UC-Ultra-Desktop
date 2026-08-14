import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { rpc, uploadShopLogo } from "@/lib/apiClient";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Upload, Download, Trash2, User as UserIcon, Store, Receipt, Bell, Shield, TrendingUp } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { AppUpdateCard } from "@/components/AppUpdateCard";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "KWD", "BHD", "OMR", "QAR", "JOD", "EGP", "INR", "PKR", "NGN", "KES", "ZAR", "BRL", "MXN"];

export default function Settings() {
  usePageMeta({ title: "Shop Settings — UCU", description: "Configure your shop name, logo, currency, tax and receipt details.", path: "/settings" });
  const { t } = useTranslation();
  const { currentShop, role, refresh, shops } = useShop();
  const { user } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [tax, setTax] = useState("0");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [header, setHeader] = useState("");
  const [footer, setFooter] = useState("");
  const [terms, setTerms] = useState("");
  const [printTerms, setPrintTerms] = useState(true);
  const [showTax, setShowTax] = useState(true);
  const [storeType, setStoreType] = useState("other");
  const [labTests, setLabTests] = useState(false);
  const [imeiMode, setImeiMode] = useState<"sale" | "product">("sale");
  const [showCustomer, setShowCustomer] = useState(false);
  const [showImei, setShowImei] = useState(false);

  const [notifyLow, setNotifyLow] = useState(true);
  const [notifyDaily, setNotifyDaily] = useState(false);
  const [investorsOn, setInvestorsOn] = useState(false);
  const [investorMode, setInvestorMode] = useState<"individual" | "shared" | "both">("individual");
  const [investorCommission, setInvestorCommission] = useState("0");
  const [investorDeductExpenses, setInvestorDeductExpenses] = useState(true);

  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    if (currentShop) {
      setName(currentShop.name);
      setCurrency(currentShop.currency);
      setTax(String(currentShop.tax_rate));
      setHeader(currentShop.receipt_header ?? "");
      setFooter(currentShop.receipt_footer ?? "");
      setTerms(currentShop.receipt_terms ?? "");
      setPrintTerms(currentShop.print_terms_by_default !== false);
      setAddress(currentShop.address ?? "");
      setPhone(currentShop.phone ?? "");
      setEmail(currentShop.email ?? "");
      setLogoUrl(currentShop.logo_url ?? null);
      setShowTax(currentShop.show_tax_line ?? true);
      setStoreType(currentShop.store_type ?? "other");
      setLabTests(!!currentShop.lab_tests_enabled);
      setImeiMode((currentShop.imei_capture_mode as "sale" | "product") ?? "sale");
      setShowCustomer(currentShop.show_customer_on_receipt ?? false);
      setShowImei(currentShop.show_imei_on_receipt ?? false);
      setNotifyLow(currentShop.notify_low_stock ?? true);
      setNotifyDaily(currentShop.notify_daily_summary ?? false);
      setInvestorsOn(currentShop.investors_enabled ?? false);
      setInvestorMode(currentShop.investor_mode ?? "individual");
      setInvestorCommission(String(currentShop.investor_default_commission ?? 0));
      setInvestorDeductExpenses(currentShop.investor_deduct_expenses ?? true);
    }
  }, [currentShop]);

  useEffect(() => {
    // The display name is already in the cached device session.
    if (user) setDisplayName(user.display_name ?? "");
  }, [user]);

  const canEdit = role === "owner";
  const canEditShop = role === "owner" || role === "manager";

  const saveProfile = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("updateProfileAction", displayName);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(t("settings.profile.profileSaved"));
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return toast.error(t("settings.profile.passwordMin"));
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("changePasswordAction", newPassword);
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    setNewPassword("");
    toast.success(t("settings.profile.passwordChanged"));
  };

  const saveShop = async () => {
    if (!currentShop) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("updateShopAction", {
        name, currency, tax_rate: parseFloat(tax) || 0,
        address: address || null, phone: phone || null, email: email || null,
        store_type: storeType,
        lab_tests_enabled: labTests,
        imei_capture_mode: imeiMode,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(t("settings.shop.shopSaved"));
    refresh();
  };

  const saveReceipt = async () => {
    if (!currentShop) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("updateReceiptAction", {
        header: header || null, footer: footer || null, show_tax_line: showTax,
        show_customer_on_receipt: showCustomer, show_imei_on_receipt: showImei,
        receipt_terms: terms || null, print_terms_by_default: printTerms,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(t("settings.receipt.receiptSaved"));
    refresh();
  };

  const saveNotifications = async () => {
    if (!currentShop) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("updateNotificationsAction", {
        notify_low_stock: notifyLow, notify_daily_summary: notifyDaily,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(t("settings.notifications.notificationsSaved"));
    refresh();
  };

  const saveInvestorSettings = async () => {
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("saveInvestorSettingsAction", {
        enabled: investorsOn,
        mode: investorMode,
        default_commission: Math.min(Math.max(parseFloat(investorCommission) || 0, 0), 100),
        deduct_expenses: investorDeductExpenses,
      });
      if (!res.ok) return toast.error(res.error ?? "Failed");
    } catch (e) {
      return toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
    toast.success(investorsOn
      ? t("investors.enabledToast", { defaultValue: "Investor settings saved — find Investors under Debts in the menu" })
      : t("investors.disabledToast", { defaultValue: "Investors disabled" }));
    refresh();
  };

  const uploadLogo = async (file: File) => {
    if (!currentShop) return;
    setBusy(true);
    try {
      const url = await uploadShopLogo(file);
      setLogoUrl(url);
      toast.success(t("settings.logoUploaded"));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async (table: "sales" | "expenses" | "products" | "customers") => {
    if (!currentShop) return;
    setBusy(true);
    let data: any[];
    try {
      data = await rpc<any[]>("exportTableAction", table);
    } catch (e) {
      setBusy(false);
      return toast.error(e instanceof Error ? e.message : t("settings.data.noData"));
    }
    setBusy(false);
    if (!data || data.length === 0) return toast.error(t("settings.data.noData"));
    const headers = Object.keys(data[0]);
    const rows = data.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${table}-${currentShop.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(t("settings.data.exported", { table }));
  };

  const deleteShop = async () => {
    if (!currentShop) return;
    setBusy(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("deleteShopAction");
      if (!res.ok) { setBusy(false); return toast.error(res.error ?? "Failed"); }
    } catch (e) {
      setBusy(false);
      return toast.error(e instanceof Error ? e.message : "Failed");
    }
    toast.success(t("settings.danger.shopDeleted"));
    localStorage.removeItem("pos.currentShopId");
    await refresh();
    setBusy(false);
    const remaining = shops.filter((s) => s.id !== currentShop.id);
    window.location.href = remaining.length > 0 ? "/" : "/onboarding";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t("settings.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("settings.subtitle")}</p>
      </header>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile"><UserIcon className="size-3.5 mr-1.5" />{t("settings.tabs.profile")}</TabsTrigger>
          <TabsTrigger value="shop"><Store className="size-3.5 mr-1.5" />{t("settings.tabs.shop")}</TabsTrigger>
          <TabsTrigger value="receipt"><Receipt className="size-3.5 mr-1.5" />{t("settings.tabs.receipt")}</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="size-3.5 mr-1.5" />{t("settings.tabs.notifications")}</TabsTrigger>
          {canEdit && <TabsTrigger value="investors"><TrendingUp className="size-3.5 mr-1.5" />Investors</TabsTrigger>}
          <TabsTrigger value="data"><Download className="size-3.5 mr-1.5" />{t("settings.tabs.data")}</TabsTrigger>
          {canEdit && <TabsTrigger value="danger"><Shield className="size-3.5 mr-1.5" />{t("settings.tabs.danger")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <Card className="shadow-card p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>{t("common.email")}</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.profile.displayName")}</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <Button disabled={busy} onClick={saveProfile} className="bg-gradient-primary text-primary-foreground hover:opacity-90">{t("settings.profile.saveProfile")}</Button>
            <Separator />
            <div className="space-y-1.5">
              <Label>{t("settings.profile.changePassword")}</Label>
              <PasswordInput placeholder={t("settings.profile.newPasswordPlaceholder")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <Button disabled={busy || newPassword.length < 6} onClick={changePassword} variant="outline">{t("settings.profile.updatePassword")}</Button>
            <Separator />
          </Card>
        </TabsContent>

        <TabsContent value="shop">
          <Card className="shadow-card p-6 space-y-5">
            {!canEditShop && <p className="text-xs text-muted-foreground">{t("settings.shop.viewOnly")}</p>}
            <div className="flex items-start gap-4">
              <div className="size-20 rounded-xl border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {logoUrl ? <img src={logoUrl} alt="Shop logo" className="size-full object-cover" /> : <Store className="size-8 text-muted-foreground/40" />}
              </div>
              {canEditShop && (
                <div className="flex-1">
                  <Label className="block mb-2">{t("settings.shop.logo")}</Label>
                  <label className="inline-flex cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background hover:bg-muted text-sm font-medium">
                      <Upload className="size-3.5" /> {t("settings.shop.uploadLogo")}
                    </span>
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">{t("settings.shop.logoHelp")}</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label>{t("settings.shop.shopName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEditShop} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("settings.shop.currency")}</Label>
                <Select value={currency} onValueChange={setCurrency} disabled={!canEditShop}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>{t("settings.shop.taxRate")}</Label><Input type="number" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} disabled={!canEditShop} /></div>
            </div>
            <div className="space-y-1.5"><Label>{t("common.address")}</Label><Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} disabled={!canEditShop} placeholder={t("settings.shop.addressPlaceholder")} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>{t("common.phone")}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEditShop} placeholder={t("settings.shop.phonePlaceholder")} /></div>
              <div className="space-y-1.5"><Label>{t("common.email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEditShop} placeholder={t("settings.shop.emailPlaceholder")} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Store type</Label>
              <Select value={storeType} onValueChange={setStoreType} disabled={!canEditShop}>
                <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone Shop</SelectItem>
                  <SelectItem value="computer">Computer Shop</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="supermarket">Supermarket / Mart</SelectItem>
                  <SelectItem value="industry">Industry</SelectItem>
                  <SelectItem value="wholesale">Whole Sale</SelectItem>
                  <SelectItem value="accessories">Accessories</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Tailors the app to your business — e.g. a Phone Shop can capture IMEI numbers.</p>
            </div>
            {storeType === "pharmacy" && (
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label>Lab tests</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Turn on if this pharmacy also runs a lab. Adds the Service toggle on products,
                    a Lab Tests tab in POS, and the Lab queue &amp; Results pages.
                  </p>
                </div>
                <Switch checked={labTests} onCheckedChange={setLabTests} disabled={!canEditShop} />
              </div>
            )}

            {storeType === "phone" && (
              <div className="space-y-1.5">
                <Label>Capture IMEI</Label>
                <Select value={imeiMode} onValueChange={(v) => setImeiMode(v as "sale" | "product")} disabled={!canEditShop}>
                  <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">During sale — type it at checkout</SelectItem>
                    <SelectItem value="product">On the product — each item/variant has its IMEI</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  "On the product" suits shops that add each handset (or variant) with its own IMEI — POS shows the last digits so you pick the right one.
                </p>
              </div>
            )}
            {canEditShop && <Button disabled={busy} onClick={saveShop} className="bg-gradient-primary text-primary-foreground hover:opacity-90">{t("settings.shop.saveShop")}</Button>}
          </Card>
        </TabsContent>

        <TabsContent value="receipt">
          <Card className="shadow-card p-6 space-y-5">
            <div className="space-y-1.5"><Label>{t("settings.receipt.header")}</Label><Input value={header} onChange={(e) => setHeader(e.target.value)} disabled={!canEditShop} placeholder={t("settings.receipt.headerPlaceholder")} /></div>
            <div className="space-y-1.5"><Label>{t("settings.receipt.footer")}</Label><Textarea rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} disabled={!canEditShop} placeholder={t("settings.receipt.footerPlaceholder")} /></div>
            <div className="flex items-center justify-between gap-4 py-2">
              <div><Label>{t("settings.receipt.showTax")}</Label><p className="text-xs text-muted-foreground">{t("settings.receipt.showTaxHelp")}</p></div>
              <Switch checked={showTax} onCheckedChange={setShowTax} disabled={!canEditShop} />
            </div>
            <div className="flex items-center justify-between gap-4 py-2 border-t pt-4">
              <div><Label>Print customer name &amp; phone</Label><p className="text-xs text-muted-foreground">Show the sale's customer on the receipt.</p></div>
              <Switch checked={showCustomer} onCheckedChange={setShowCustomer} disabled={!canEditShop} />
            </div>
            {storeType === "phone" && (
              <div className="flex items-center justify-between gap-4 py-2">
                <div><Label>Print IMEI</Label><p className="text-xs text-muted-foreground">Show each product's IMEI number(s) on the receipt.</p></div>
                <Switch checked={showImei} onCheckedChange={setShowImei} disabled={!canEditShop} />
              </div>
            )}
            {/* Terms print at the foot of every receipt. Free text, any
                language — shops write these in Urdu, Pashto or English. */}
            <div className="space-y-1.5 border-t pt-4">
              <Label>Terms &amp; conditions</Label>
              <p className="text-xs text-muted-foreground">
                Printed at the bottom of the receipt. Write them in any language — for example
                return and warranty rules. Leave empty to print nothing.
              </p>
              <Textarea
                rows={4}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                disabled={!canEditShop}
                placeholder={"e.g. Goods once sold are not returnable\nWarranty claims need this receipt"}
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <Label>Print terms by default</Label>
                <p className="text-xs text-muted-foreground">
                  The cashier can still switch them off for a single receipt before printing.
                </p>
              </div>
              <Switch checked={printTerms} onCheckedChange={setPrintTerms} disabled={!canEditShop || !terms.trim()} />
            </div>
            {canEditShop && <Button disabled={busy} onClick={saveReceipt} className="bg-gradient-primary text-primary-foreground hover:opacity-90">{t("settings.receipt.saveReceipt")}</Button>}
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="shadow-card p-6 space-y-5">
            <div className="flex items-center justify-between gap-4 py-2">
              <div><Label>{t("settings.notifications.lowStock")}</Label><p className="text-xs text-muted-foreground">{t("settings.notifications.lowStockHelp")}</p></div>
              <Switch checked={notifyLow} onCheckedChange={setNotifyLow} disabled={!canEditShop} />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <div><Label>{t("settings.notifications.dailySummary")}</Label><p className="text-xs text-muted-foreground">{t("settings.notifications.dailySummaryHelp")}</p></div>
              <Switch checked={notifyDaily} onCheckedChange={setNotifyDaily} disabled={!canEditShop} />
            </div>
            {canEditShop && <Button disabled={busy} onClick={saveNotifications} className="bg-gradient-primary text-primary-foreground hover:opacity-90">{t("settings.notifications.saveNotifications")}</Button>}
          </Card>
        </TabsContent>

        <TabsContent value="investors">
          <Card className="shadow-card p-6 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-base">Enable investors</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fund purchases with investor capital and pay them back automatically as that stock sells. Adds an <b>Investors</b> page under Debts.
                </p>
              </div>
              <Switch checked={investorsOn} onCheckedChange={setInvestorsOn} disabled={role !== "owner"} />
            </div>

            {investorsOn && (
              <>
                <div className="space-y-2 border-t pt-5">
                  <Label>How investors work in your shop</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      { v: "individual", title: "Individual", desc: "Each investor funds their own stock and is paid back on its sales." },
                      { v: "shared", title: "Shared pool", desc: "Everyone's money in one pot; profit split by each person's stake." },
                      { v: "both", title: "Both", desc: "Use individual investors and a shared pool side by side." },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setInvestorMode(opt.v)}
                        className={`text-left rounded-lg border p-3 transition ${investorMode === opt.v ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-muted-foreground/40"}`}
                      >
                        <div className="font-medium text-sm">{opt.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {(investorMode === "individual" || investorMode === "both") && (
                  <div className="space-y-1.5 border-t pt-5">
                    <Label>Default shop commission %</Label>
                    <Input
                      type="number" min="0" max="100" step="0.5" className="max-w-[160px]"
                      value={investorCommission}
                      onChange={(e) => setInvestorCommission(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Prefilled when you add a new individual investor — the share your shop keeps from their stock's sales. You can still change it per investor.
                    </p>
                  </div>
                )}

                {(investorMode === "shared" || investorMode === "both") && (
                  <div className="flex items-center justify-between gap-4 border-t pt-5">
                    <div>
                      <Label>Deduct shop expenses from pool profit</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        When distributing pool profit, subtract the pool's share of your shop expenses first (by its share of sales). Off = split gross profit.
                      </p>
                    </div>
                    <Switch checked={investorDeductExpenses} onCheckedChange={setInvestorDeductExpenses} />
                  </div>
                )}
              </>
            )}

            <Button disabled={busy || role !== "owner"} onClick={saveInvestorSettings} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
              {busy ? "Saving…" : "Save investor settings"}
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card className="shadow-card p-6 space-y-3">
            <h3 className="font-semibold">{t("settings.data.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("settings.data.subtitle")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["sales", "products", "customers", "expenses"] as const).map((tbl) => (
                <Button key={tbl} variant="outline" disabled={busy} onClick={() => exportCsv(tbl)} className="capitalize">
                  <Download className="size-3.5 mr-1.5" />{t(`settings.data.${tbl}` as any)}
                </Button>
              ))}
            </div>
          </Card>
          <AppUpdateCard />
        </TabsContent>

        {canEdit && (
          <TabsContent value="danger">
            <Card className="shadow-card p-6 space-y-4 border-destructive/30">
              <div>
                <h3 className="font-semibold text-destructive">{t("settings.danger.deleteShop")}</h3>
                <p className="text-sm text-muted-foreground mt-1" dangerouslySetInnerHTML={{ __html: t("settings.danger.deleteShopWarning", { name: currentShop?.name ?? "" }) }} />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive"><Trash2 className="size-4 mr-2" />{t("settings.danger.deleteShop")}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("settings.danger.deleteShopTitle", { name: currentShop?.name ?? "" })}</AlertDialogTitle>
                    <AlertDialogDescription>{t("settings.danger.deleteShopConfirm")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteShop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("settings.danger.yesDelete")}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
