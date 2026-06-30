import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, MessageCircle, Mail, Phone, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function PlanRequired() {
  const { signOut } = useAuth();
  const { currentShop, role } = useShop();
  useEffect(() => { document.title = "Subscription Required — UCU"; }, []);

  const isOwner = role === "owner";
  const proUntil = currentShop?.pro_until ? new Date(currentShop.pro_until) : null;
  const expired = !!proUntil && proUntil.getTime() < Date.now();
  const isNew = !currentShop?.is_pro && !proUntil;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-surface">
      <div className="max-w-xl w-full bg-card border rounded-2xl shadow-elevated p-8 text-center space-y-5">
        <div className="size-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <Lock className="size-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">
          {isNew ? "Subscription required" : expired ? "Your 7-day free trial has ended" : "Subscription required"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isNew
            ? "Welcome! Your account is ready. To activate your subscription, please contact Tech Town Swat."
            : expired
              ? <>Your free trial ended on <span className="font-semibold">{proUntil ? format(proUntil, "PP") : ""}</span>. To keep using UCU, please contact <span className="font-semibold">Tech Town Swat</span> to activate a paid plan.</>
              : "This shop does not have an active subscription. Please contact Tech Town Swat to activate your plan."}
        </p>

        <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 p-4 text-left space-y-2">
          <div className="text-sm font-semibold text-center">Pay via EasyPaisa</div>
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Send to EasyPaisa account</div>
            <div className="font-mono text-xl font-bold">03480152906</div>
            <div className="text-xs text-muted-foreground">Tech Town Swat</div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            After payment, send the receipt screenshot to us on WhatsApp. Your plan will be activated within minutes.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 text-left space-y-3">
            <div className="text-sm font-semibold text-center">Contact Tech Town Swat</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                <a href="https://wa.me/923105892935" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4 mr-2" /> WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href="mailto:uihtisham0@gmail.com?subject=UCU%20subscription">
                  <Mail className="size-4 mr-2" /> Email
                </a>
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2"><Phone className="size-3" /> 0310 5892935</div>
              <div className="flex items-center gap-2"><Mail className="size-3" /> uihtisham0@gmail.com</div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
              <CheckCircle2 className="size-3 text-success" /> Once activated, your account unlocks instantly.
            </p>
          </div>


        <Button variant="outline" onClick={() => signOut()} className="w-full">Sign out</Button>
      </div>
    </div>
  );
}
