import { useEffect, useState } from "react";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import type { RevenueSummary, RevenuePoint, RenewalRow } from "@/lib/adminTypes";
import { AdminPageHeader, Stat, Section, Empty, Pill, fmtNum, fmtMoney } from "@/components/admin/AdminUi";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend,
} from "recharts";
import { Sparkles, Clock, TrendingDown, Users, Info, Store, Percent } from "lucide-react";

export default function AdminRevenue() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [trend, setTrend] = useState<RevenuePoint[]>([]);
  const [renewals, setRenewals] = useState<RenewalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, t, r] = await Promise.all([
          rpc<RevenueSummary>("adminRevenueSummaryAction"),
          rpc<RevenuePoint[]>("adminRevenueTrendAction", 12),
          rpc<RenewalRow[]>("adminRenewalsAction", 30),
        ]);
        setSummary(s); setTrend(t); setRenewals(r);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load revenue");
      }
      setLoading(false);
    })();
  }, []);

  const cur = summary?.currency ?? "PKR";
  const conversion = summary && summary.trials_finished > 0
    ? Math.round((summary.trials_converted / summary.trials_finished) * 100)
    : null;

  return (
    <>
      <AdminPageHeader
        title="Revenue & subscriptions"
        description="Who is paying, who is about to lapse, and how the platform is growing."
      />

      {/* Said once, plainly, at the top: these are derived figures. Billing is
          manual — a shop sends an EasyPaisa receipt and Pro is granted by
          hand — so there is no payment record to reconcile against. */}
      <Alert className="mb-4">
        <Info className="size-4" />
        <AlertDescription className="text-xs">
          Billing is manual, so nothing here is a record of money received. Subscription figures are
          worked out from who currently holds Pro and what the plans cost — treat them as an
          estimate, not a statement.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat
          title="Estimated MRR"
          value={summary ? fmtMoney(summary.estimated_mrr, cur) : "—"}
          icon={Sparkles}
          hint={summary ? `${summary.paying_shops} paying stores` : undefined}
          accent
        />
        <Stat
          title="Estimated ARR"
          value={summary ? fmtMoney(summary.estimated_arr, cur) : "—"}
          icon={Sparkles}
        />
        <Stat
          title="On trial"
          value={summary ? fmtNum(summary.trialing_shops) : "—"}
          icon={Users}
          hint={summary ? `${summary.trials_ending_7} ending this week` : undefined}
        />
        <Stat
          title="Trial conversion"
          value={conversion === null ? "—" : `${conversion}%`}
          icon={Percent}
          hint={summary ? `${summary.trials_converted} of ${summary.trials_finished} finished` : undefined}
        />
        <Stat
          title="Renewals due"
          value={summary ? fmtNum(summary.expiring_30) : "—"}
          icon={Clock}
          hint={summary ? `${summary.expiring_7} inside a week` : undefined}
          tone={summary && summary.expiring_7 > 0 ? "warning" : undefined}
        />
        <Stat
          title="Churned (30d)"
          value={summary ? fmtNum(summary.churned_30) : "—"}
          icon={TrendingDown}
          hint={summary ? `${summary.lapsed_shops} lapsed in total` : undefined}
          tone={summary && summary.churned_30 > 0 ? "danger" : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Section title="Estimated MRR by month" description="Stores on a paid plan as each month closed.">
          {trend.length === 0 ? (
            <Empty label={loading ? "Loading…" : "Not enough history yet."} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="mrr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip
                    formatter={(v: number) => [fmtMoney(v, cur), "Estimated MRR"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="estimated_mrr"
                    stroke="hsl(var(--primary))"
                    fill="url(#mrr)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        <Section title="New stores and users" description="Signups per month.">
          {trend.length === 0 ? (
            <Empty label={loading ? "Loading…" : "Not enough history yet."} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="new_shops" name="Stores" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="new_users" name="Users" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4">
        <Section
          title="Coming up for renewal"
          description="Trials and paid plans ending in the next 30 days, soonest first. The sales column says whether the store is actually being used."
        >
          {renewals.length === 0 ? (
            <Empty label={loading ? "Loading…" : "Nothing is due in the next 30 days."} />
          ) : (
            <div className="overflow-x-auto -m-4">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-start ps-4 p-2.5 font-medium">Store</th>
                    <th className="text-start p-2.5 font-medium">Owner</th>
                    <th className="text-start p-2.5 font-medium">Kind</th>
                    <th className="text-end p-2.5 font-medium">Days left</th>
                    <th className="text-end pe-4 p-2.5 font-medium">Sales (30d)</th>
                  </tr>
                </thead>
                <tbody>
                  {renewals.map((r) => (
                    <tr key={r.shop_id} className="border-t">
                      <td className="ps-4 p-2.5 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Store className="size-3.5 text-muted-foreground shrink-0" />
                          {r.name}
                          {r.store_type !== "other" && <Pill>{r.store_type}</Pill>}
                        </div>
                      </td>
                      <td className="p-2.5 text-muted-foreground text-xs">{r.owner_email ?? "—"}</td>
                      <td className="p-2.5">
                        <Pill tone={r.kind === "trial" ? "primary" : "success"}>{r.kind}</Pill>
                      </td>
                      <td className="p-2.5 text-end tabular-nums">
                        <span className={r.days_left <= 7 ? "text-destructive font-semibold" : ""}>
                          {r.days_left}
                        </span>
                      </td>
                      <td className="pe-4 p-2.5 text-end tabular-nums">
                        {/* A renewal on a store with no sales is a different
                            conversation from one that trades every day. */}
                        <span className={r.recent_sales === 0 ? "text-muted-foreground" : ""}>
                          {fmtNum(r.recent_sales)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
