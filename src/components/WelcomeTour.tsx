import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ScanBarcode, Package, PackageOpen, Receipt, HandCoins,
  Boxes, BarChart3, Sparkles, ArrowRight, ArrowLeft, Check,
} from "lucide-react";

const storageKey = (uid?: string) => `ucu.tour.seen.${uid ?? "guest"}`;

interface Step {
  icon: any;
  title: string;
  body: string;
  bullets?: string[];
  cta?: { to: string; label: string };
  tone?: "primary" | "accent" | "warning" | "success";
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Welcome to UCU 👋",
    body: "Your all-in-one point of sale. Here's a 60-second tour of how everything connects so you can start selling today.",
    bullets: [
      "Add what you sell → Products",
      "Sell it → POS",
      "Track who owes you → Debts",
      "See how the shop is doing → Analytics",
    ],
    tone: "primary",
  },
  {
    icon: Package,
    title: "1. Add your Products",
    body: "Every product has a name, price and stock. You can also add a barcode so you can scan instead of search at checkout.",
    bullets: [
      "Set a low-stock threshold to get alerts",
      "Use variants for sizes, colors, flavors",
      "Bulk-import from CSV to save time",
    ],
    cta: { to: "/products", label: "Open Products" },
  },
  {
    icon: PackageOpen,
    title: "2. Record Purchases",
    body: "When new stock arrives from a supplier, record a purchase. Stock goes up automatically — no manual counting.",
    bullets: [
      "Pick a supplier (or add one on the fly)",
      "Each line adds to its product's stock",
      "Delete a purchase to reverse stock instantly",
    ],
    cta: { to: "/purchases", label: "Record a purchase" },
    tone: "accent",
  },
  {
    icon: ScanBarcode,
    title: "3. Make a Sale at POS",
    body: "Scan or tap products into the cart, choose how the customer is paying, and charge. Stock drops automatically.",
    bullets: [
      "Apply a discount in % or fixed amount",
      "Cash → see change due instantly",
      "Pay later? Tick \"Credit / pay later\" and pick the customer",
    ],
    cta: { to: "/pos", label: "Go to POS" },
    tone: "primary",
  },
  {
    icon: HandCoins,
    title: "4. Track Debts & Payments",
    body: "Any unpaid amount from a credit sale shows up under Debts. Record part-payments over time until it's settled.",
    bullets: [
      "Money owed to you, and money you owe — in one place",
      "Add a payment any time, see remaining balance",
      "Mark settled automatically when fully paid",
    ],
    cta: { to: "/debts", label: "Open Debts" },
    tone: "warning",
  },
  {
    icon: Boxes,
    title: "5. Adjust Stock when needed",
    body: "Damage, theft, recount, or stock-take? Use Inventory to add or remove stock with a reason — every change is logged.",
    cta: { to: "/inventory", label: "Open Inventory" },
  },
  {
    icon: Receipt,
    title: "6. Returns & Sales history",
    body: "Look up any sale, reprint the receipt, or process a partial/full return. Refunded items go back into stock automatically.",
    cta: { to: "/sales", label: "Open Sales" },
    tone: "accent",
  },
  {
    icon: BarChart3,
    title: "7. Know your numbers",
    body: "Analytics shows top products, revenue trends and profit. Reports gives you exports for your accountant.",
    bullets: [
      "Daily / monthly revenue at a glance",
      "Spot best & worst sellers",
      "Export anything to CSV",
    ],
    cta: { to: "/analytics", label: "Open Analytics" },
    tone: "success",
  },
];

const toneClass: Record<NonNullable<Step["tone"]> | "default", string> = {
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent-foreground",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/15 text-success",
  default: "bg-muted text-foreground",
};

export function WelcomeTour({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [i, setI] = useState(0);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? !!controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  // Auto-open once per user
  useEffect(() => {
    if (isControlled || !user) return;
    try {
      if (!localStorage.getItem(storageKey(user.id))) {
        setInternalOpen(true);
      }
    } catch {}
  }, [user, isControlled]);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const Icon = step.icon;
  const tone = toneClass[step.tone ?? "default"];

  const dismiss = () => {
    try { if (user) localStorage.setItem(storageKey(user.id), "1"); } catch {}
    setOpen(false);
    setI(0);
  };

  const dots = useMemo(
    () => STEPS.map((_, idx) => (
      <button
        key={idx}
        aria-label={`Step ${idx + 1}`}
        onClick={() => setI(idx)}
        className={`h-1.5 rounded-full transition-all ${
          idx === i ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
        }`}
      />
    )),
    [i]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
              <Icon className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Step {i + 1} of {STEPS.length}
              </div>
              <h2 className="text-xl font-bold mt-0.5 leading-tight">{step.title}</h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4 leading-relaxed">{step.body}</p>

          {step.bullets && (
            <ul className="mt-4 space-y-2">
              {step.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="size-4 text-success shrink-0 mt-0.5" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {step.cta && (
            <Button asChild variant="outline" size="sm" className="mt-4" onClick={dismiss}>
              <Link to={step.cta.to}>{step.cta.label} <ArrowRight className="size-3.5 ms-1.5 rtl-flip" /></Link>
            </Button>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">{dots}</div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setI((n) => Math.max(0, n - 1))}>
                <ArrowLeft className="size-4 me-1 rtl-flip" /> Back
              </Button>
            )}
            {last ? (
              <Button size="sm" onClick={dismiss} className="bg-gradient-primary text-primary-foreground">
                Let's go <Sparkles className="size-4 ms-1.5" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => setI((n) => Math.min(STEPS.length - 1, n + 1))}>
                Next <ArrowRight className="size-4 ms-1 rtl-flip" />
              </Button>
            )}
          </div>
        </div>

        <button
          onClick={dismiss}
          className="absolute top-3 end-3 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded"
        >
          Skip
        </button>
      </DialogContent>
    </Dialog>
  );
}
