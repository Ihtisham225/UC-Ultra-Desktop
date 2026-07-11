import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { rpc } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Sparkles, Plus, ArrowRight, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";

const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "KWD", "BHD", "OMR", "QAR", "JOD", "EGP", "INR", "PKR", "NGN", "KES", "ZAR", "BRL", "MXN"];

export default function Onboarding() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { shops, refresh, setCurrentShopId, role } = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [showCreate, setShowCreate] = useState(false);

  const hasShops = shops.length > 0;
  const force = params.get("force") === "1";

  useEffect(() => { document.title = "UCU"; }, []);

  useEffect(() => {
    if (force) return;
    // Staff (non-owner) members are auto-routed to their assigned shop
    if (hasShops && role && role !== "owner") {
      setCurrentShopId(shops[0].id);
      navigate("/", { replace: true });
      return;
    }
    const intent = localStorage.getItem("pos.signupIntent");
    if (intent === "cashier" && !hasShops) {
      navigate("/pending-invite", { replace: true });
    }
  }, [hasShops, navigate, force, role, shops, setCurrentShopId]);

  const pickShop = async (id: string) => {
    await setCurrentShopId(id);
    navigate("/");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    let shopId: string;
    try {
      const res = await rpc<{ ok: boolean; shopId?: string; error?: string }>("createShopAction", {
        name: String(fd.get("name")),
        currency,
        taxRate: parseFloat(String(fd.get("tax") || "0")),
        receiptFooter: String(fd.get("footer") || ""),
      });
      if (!res.ok || !res.shopId) return toast.error(res.error ?? "Failed to create shop");
      shopId = res.shopId;
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to create shop");
    } finally {
      setBusy(false);
    }
    localStorage.setItem("pos.signupIntent", "owner");
    toast.success(t("onboarding.shopCreated"));
    await refresh();
    await setCurrentShopId(shopId);
    navigate("/");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-gradient-surface"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-gradient-primary shadow-glow mb-4">
            <Sparkles className="size-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">
            {hasShops ? t("onboarding.titleHas") : t("onboarding.titleNew")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {hasShops ? t("onboarding.subtitleHas") : t("onboarding.subtitleNew")}
          </p>
          {user?.email && (
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <span className="truncate max-w-[200px]">{user.email}</span>
              <span>·</span>
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary transition-colors"
              >
                <LogOut className="size-3.5" /> {t("common.signOut")}
              </button>
            </div>
          )}
        </div>

        {hasShops && (
          <div className="bg-card border rounded-2xl shadow-elevated p-4 mb-6">
            <div className="text-sm font-semibold text-muted-foreground px-2 mb-2">{t("onboarding.yourShops")}</div>
            <ul className="space-y-2">
              {shops.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pickShop(s.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border hover:bg-accent hover:border-primary/40 transition-colors text-start group"
                  >
                    <div className="size-10 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                      <Store className="size-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.currency}</div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all rtl-flip" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasShops && !showCreate && (
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="size-4 mr-2" /> {t("onboarding.createNew")}
          </Button>
        )}

        {(!hasShops || showCreate) && (
          <form onSubmit={submit} className="bg-card border rounded-2xl shadow-elevated p-6 space-y-5">
            {hasShops && (
              <div className="text-sm font-semibold text-muted-foreground">{t("onboarding.createANew")}</div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">{t("onboarding.shopName")}</Label>
              <div className="relative">
                <Store className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="name" name="name" required placeholder={t("onboarding.shopNamePlaceholder")} className="ps-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("onboarding.currency")}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax">{t("onboarding.taxRate")}</Label>
                <Input id="tax" name="tax" type="number" step="0.01" min="0" defaultValue="0" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="footer">{t("onboarding.receiptFooter")}</Label>
              <Input id="footer" name="footer" placeholder={t("onboarding.receiptFooterPlaceholder")} />
            </div>

            <div className="flex gap-2">
              {hasShops && (
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)} disabled={busy}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button disabled={busy} type="submit" size="lg" className="flex-1 bg-gradient-primary hover:opacity-90 text-primary-foreground">
                {busy ? t("onboarding.creating") : t("onboarding.create")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
