import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProAccess } from "@/hooks/useProAccess";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ArrowLeft, MessageCircle, Copy, Phone } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { usePageMeta } from "@/hooks/usePageMeta";

const EASYPAISA_NUMBER = "03480152906";
const EASYPAISA_NAME = "Tech Town Swat";

interface Plan {
  code: "monthly" | "yearly";
  name: string;
  pkr: number;
  durationDays: number;
  savingsLabel?: string;
}

const PLANS: Plan[] = [
  { code: "monthly", name: "Monthly", pkr: 1500, durationDays: 30 },
  { code: "yearly", name: "Yearly", pkr: 14500, durationDays: 365, savingsLabel: "Save ~20%" },
];

export default function Billing() {
  usePageMeta({ title: "Billing & Subscription — UCU", description: "View your active plan and activate via EasyPaisa.", path: "/billing" });
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentShop } = useShop();
  const { isPro, proUntil, daysLeft } = useProAccess();

  useEffect(() => { document.title = "UCU"; }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  };

  const whatsappLink = (plan: Plan) => {
    const msg = `Assalam o Alaikum, I want to activate UCU ${plan.name} plan (Rs ${plan.pkr}).\nShop: ${currentShop?.name ?? ""}\nEmail: ${user?.email ?? ""}\nI have sent the payment to EasyPaisa ${EASYPAISA_NUMBER}.`;
    return `https://wa.me/923105892935?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ms-2"><Link to="/"><ArrowLeft className="size-4 mr-1 rtl-flip" /> {t("common.back")}</Link></Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t("billing.title")}</h1>
            <p className="text-muted-foreground">Pay via EasyPaisa and get activated within minutes.</p>
          </div>
          {isPro && proUntil && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 px-4 py-3 text-end">
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1 justify-end"><Sparkles className="size-3.5" /> {t("billing.subscriptionActive")}</div>
              <div className="text-sm font-medium">{t("billing.daysLeftLabel", { days: daysLeft })}</div>
              <div className="text-xs text-muted-foreground">{t("billing.until", { date: format(proUntil, "PP") })}</div>
            </div>
          )}
        </div>
      </div>

      {/* EasyPaisa account card */}
      <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-9 rounded-lg bg-emerald-600 text-white grid place-items-center font-bold text-sm">EP</div>
          <div>
            <div className="font-semibold">EasyPaisa Account</div>
            <div className="text-xs text-muted-foreground">Send your subscription amount here</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-card border p-3">
            <div className="text-xs text-muted-foreground">Account number</div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="font-mono text-lg font-semibold">{EASYPAISA_NUMBER}</span>
              <Button size="icon" variant="ghost" onClick={() => copy(EASYPAISA_NUMBER)}><Copy className="size-4" /></Button>
            </div>
          </div>
          <div className="rounded-lg bg-card border p-3">
            <div className="text-xs text-muted-foreground">Account title</div>
            <div className="font-semibold text-lg mt-0.5">{EASYPAISA_NAME}</div>
          </div>
        </div>
      </div>

      {/* Plans */}
      <div className="grid sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <div key={plan.code} className={`relative rounded-2xl border-2 p-6 transition-all hover:shadow-lg ${
            plan.code === "yearly" ? "border-primary bg-gradient-to-br from-primary/5 to-amber-50/30 dark:to-amber-950/10" : "border-border bg-card"
          }`}>
            {plan.savingsLabel && (
              <div className="absolute -top-3 end-4 bg-gradient-to-r from-amber-400 to-amber-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                {plan.savingsLabel}
              </div>
            )}
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{plan.name}</div>
            <div className="mt-2 mb-1">
              <span className="text-4xl font-bold">Rs {plan.pkr.toLocaleString()}</span>
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              {plan.code === "monthly" ? t("billing.perMonth") : t("billing.perYear")} · {t("billing.daysAccess", { days: plan.durationDays })}
            </div>
            <ul className="space-y-2 text-sm mb-6">
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {t("billing.features.analytics")}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {t("billing.features.staff")}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {t("billing.features.purchasesExpenses")}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {t("billing.features.whatsapp")}</li>
              <li className="flex items-center gap-2"><Check className="size-4 text-success" /> {t("billing.features.support")}</li>
            </ul>
            <Button asChild className={`w-full ${plan.code === "yearly" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`} variant={plan.code === "yearly" ? "default" : "outline"}>
              <a href={whatsappLink(plan)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4 mr-1.5" /> Send receipt on WhatsApp
              </a>
            </Button>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold mb-3">How to activate</h2>
        <ol className="space-y-2 text-sm list-decimal list-inside text-muted-foreground">
          <li>Open EasyPaisa app and send the plan amount to <span className="font-mono text-foreground">{EASYPAISA_NUMBER}</span> ({EASYPAISA_NAME}).</li>
          <li>Take a screenshot of the payment receipt.</li>
          <li>Click <strong className="text-foreground">Send receipt on WhatsApp</strong> above and attach the screenshot.</li>
          <li>Admin will activate your plan within a few minutes.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="https://wa.me/923105892935" target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 mr-1.5" /> WhatsApp 0310 5892935</a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="tel:+923105892935"><Phone className="size-4 mr-1.5" /> Call</a>
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        See our{" "}
        <Link to="/terms" className="underline">Terms</Link>,{" "}
        <Link to="/privacy" className="underline">Privacy</Link>, and{" "}
        <Link to="/refunds" className="underline">Refund Policy</Link>.
      </p>
    </div>
  );
}
