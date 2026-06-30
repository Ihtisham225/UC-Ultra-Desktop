import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { PublicFooter } from "@/components/LegalLayout";
import { usePageMeta } from "@/hooks/usePageMeta";

const FEATURES = [
  "Unlimited products & inventory",
  "Point-of-sale with barcode scanning",
  "Sales, returns & receipts",
  "Customers, debts & suppliers",
  "Purchases & expenses tracking",
  "Analytics & reports",
  "Staff accounts with roles",
  "Multi-device sync",
  "Email & WhatsApp support",
];

export default function Pricing() {
  usePageMeta({
    title: "Pricing — UCU by Tech Town Swat",
    description: "Simple, transparent pricing for UCU. $6/month or $58/year. 30-day money-back guarantee.",
    path: "/pricing",
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-bold">UCU</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/pricing" className="hover:underline font-medium">Pricing</Link>
            <Link to="/auth" className="hover:underline">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-3">Simple pricing for your shop</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            One plan, two billing options. Run your entire shop on UCU with all features included.
            30-day money-back guarantee.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <PlanCard
            name="Monthly"
            price="Rs 1,500"
            cadence="per month"
            description="Billed monthly via EasyPaisa. Cancel anytime."
          />
          <PlanCard
            name="Yearly"
            price="Rs 14,500"
            cadence="per year"
            description="Save ~20% vs monthly. Billed yearly via EasyPaisa."
            highlight
          />
        </div>

        <section className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 text-center">Everything included</h2>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="size-4 text-primary mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 max-w-2xl mx-auto text-sm text-muted-foreground text-center space-y-2">
          <p>
            Payments are made via <strong>EasyPaisa</strong> to account{" "}
            <span className="font-mono text-foreground">03480152906</span> (Tech Town Swat).
            After payment, send the receipt screenshot on WhatsApp to activate your plan.
          </p>
          <p>
            By subscribing you agree to our <Link to="/terms" className="underline">Terms</Link>,{" "}
            <Link to="/privacy" className="underline">Privacy Notice</Link>, and{" "}
            <Link to="/refunds" className="underline">Refund Policy</Link>.
          </p>
        </section>

      </main>

      <PublicFooter />
    </div>
  );
}

function PlanCard({
  name, price, cadence, description, highlight,
}: { name: string; price: string; cadence: string; description: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-6 flex flex-col ${highlight ? "border-primary shadow-lg ring-1 ring-primary/20" : ""}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-semibold">{name}</h3>
        {highlight && <span className="text-[10px] uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">Best value</span>}
      </div>
      <div className="mt-3">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-muted-foreground ms-1">{cadence}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{description}</p>
      <Button asChild className="mt-6 w-full" size="lg">
        <Link to="/auth">Get started</Link>
      </Button>
    </div>
  );
}
