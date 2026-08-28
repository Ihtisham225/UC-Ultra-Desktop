import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Factory, Plus, Truck, Clock } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import type { CraftDashboard } from "@/lib/handicraftTypes";

/**
 * The overview a shawl maker actually needs: what's owed to whom, and how many
 * pieces are still sitting at a processing factory. No sales, no stock — this
 * shop doesn't sell through the app.
 */
export default function HandicraftDashboard({ stats }: { stats: CraftDashboard }) {
  const { currentShop } = useShop();
  const formatMoney = useFormatMoney();
  const currency = currentShop?.currency ?? "PKR";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{currentShop?.name ?? "Dashboard"}</h1>
          <p className="text-muted-foreground mt-1">
            What you owe, and what's still lying at the factories.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/job-work"><Factory className="size-4 mr-2" /> Job work</Link>
          </Button>
          <Button asChild className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            <Link to="/material-purchases"><Plus className="size-4 mr-2" /> Add purchase</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card p-4 border-primary/40">
          <div className="text-xs text-muted-foreground">Total payable</div>
          <div className="text-2xl font-bold mt-1 text-primary">{formatMoney(stats.payable_total, currency)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {formatMoney(stats.payable_material, currency)} material ·{" "}
            {formatMoney(stats.payable_job_work, currency)} job work
          </div>
        </Card>
        <Card className="shadow-card p-4">
          <div className="text-xs text-muted-foreground">Out of the shop</div>
          <div className="text-2xl font-bold mt-1">{stats.pieces_at_companies}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.pieces_with_makers} with makers · {stats.pieces_at_processors} at factories
          </div>
        </Card>
        <Card className="shadow-card p-4">
          <div className="text-xs text-muted-foreground">Bought this month</div>
          <div className="text-2xl font-bold mt-1">{formatMoney(stats.month_purchases, currency)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.month_label} · {formatMoney(stats.month_job_work, currency)} job work
          </div>
        </Card>
        <Card className="shadow-card p-4">
          <div className="text-xs text-muted-foreground">Paid this month</div>
          <div className="text-2xl font-bold mt-1 text-success">{formatMoney(stats.month_payments, currency)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.in_credit > 0 ? `${formatMoney(stats.in_credit, currency)} sitting in credit` : stats.month_label}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Factory className="size-4 text-primary" /> Still out</h2>
            <Link to="/job-work" className="text-xs text-primary hover:underline">Open job work</Link>
          </div>
          {stats.by_company.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nothing is out with a maker or a factory right now.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.by_company.map((c) => (
                <li key={`${c.id}-${c.kind}`} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted font-bold">
                        {c.kind === "making" ? "making" : "processing"}
                      </span>
                      {c.city && <span>{c.city}</span>}
                      <span>{c.challans} challan{c.challans === 1 ? "" : "s"}</span>
                      {c.oldest_days > 0 && (
                        <span className={`flex items-center gap-1 ${c.oldest_days > 30 ? "text-destructive" : ""}`}>
                          <Clock className="size-3" /> {c.oldest_days}d
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-lg font-bold">{c.pieces}</div>
                    <div className="text-[10px] text-muted-foreground">pieces</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="shadow-card">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><Truck className="size-4 text-primary" /> Party balances</h2>
            <Link to="/suppliers" className="text-xs text-primary hover:underline">All parties</Link>
          </div>
          {stats.top_balances.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No balances yet. Record a purchase to start the register.
            </p>
          ) : (
            <ul className="divide-y">
              {stats.top_balances.map((p) => (
                <li key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <Link to={`/material-purchases?party=${p.id}`} className="min-w-0 hover:underline">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[p.city, p.roles].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                  <div className={`font-semibold shrink-0 ${p.balance > 0 ? "text-destructive" : "text-success"}`}>
                    {formatMoney(p.balance, currency)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="shadow-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          The register holds every purchase, bill and payment with a running balance.
        </div>
        <Button variant="outline" asChild>
          <Link to="/material-purchases"><BookOpen className="size-4 mr-2" /> Open the register</Link>
        </Button>
      </Card>
    </div>
  );
}
