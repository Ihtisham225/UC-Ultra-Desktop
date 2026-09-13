import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { rpc } from "@/lib/apiClient";
import type {
  OverviewStats, PlatformPulse, ShopHealthRow, RevenueSummary, AuditLogRow, AuditPage,
} from "@/lib/adminTypes";
import { AdminPageHeader, Stat, Section, Empty, SeverityDot, SubscriptionPill, HealthPill, fmtNum, fmtMoney, ago } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import {
  Users, Store, Sparkles, Activity, ShieldAlert, TrendingUp, ScrollText,
  AlertTriangle, ArrowRight, Clock,
} from "lucide-react";

export default function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [pulse, setPulse] = useState<PlatformPulse | null>(null);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [health, setHealth] = useState<ShopHealthRow[]>([]);
  const [recent, setRecent] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, p, r, h, a] = await Promise.all([
          rpc<OverviewStats>("adminOverviewAction"),
          rpc<PlatformPulse>("adminPulseAction"),
          rpc<RevenueSummary>("adminRevenueSummaryAction"),
          rpc<ShopHealthRow[]>("adminShopHealthAction"),
          rpc<AuditPage>("adminListAuditAction", { page_size: 12 }),
        ]);
        setStats(s); setPulse(p); setRevenue(r); setHealth(h); setRecent(a.rows);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't load the overview");
      }
      setLoading(false);
    })();
  }, []);

  // Worth looking at: anything that isn't trading normally.
  const needsAttention = health
    .filter((h) => h.status !== "healthy")
    .sort((a, b) => (b.quiet_days ?? 9999) - (a.quiet_days ?? 9999))
    .slice(0, 6);

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="The platform at a glance — who is trading, who is paying, and what changed."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat title="Users" value={stats ? fmtNum(stats.total_users) : "—"} icon={Users} />
        <Stat title="Stores" value={stats ? fmtNum(stats.total_shops) : "—"} icon={Store} />
        <Stat
          title="Paying"
          value={revenue ? fmtNum(revenue.paying_shops) : "—"}
          icon={Sparkles}
          hint={revenue ? `${revenue.trialing_shops} on trial` : undefined}
          accent
        />
        <Stat
          title="Active today"
          value={pulse ? fmtNum(pulse.active_shops_today) : "—"}
          icon={Activity}
          hint={pulse ? `${fmtNum(pulse.sales_today)} sales` : undefined}
        />
        <Stat
          title="Critical events"
          value={pulse ? fmtNum(pulse.critical_events_24h) : "—"}
          icon={ShieldAlert}
          hint="last 24 hours"
          tone={pulse && pulse.critical_events_24h > 0 ? "danger" : undefined}
        />
        <Stat
          title="Failed sign-ins"
          value={pulse ? fmtNum(pulse.failed_sign_ins_24h) : "—"}
          icon={AlertTriangle}
          hint="last 24 hours"
          tone={pulse && pulse.failed_sign_ins_24h > 10 ? "warning" : undefined}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <Section
          title="Latest activity"
          description="Everything the platform and its shops have just done."
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/audit">
                <ScrollText className="size-4 me-1.5" /> Full log <ArrowRight className="size-3.5 ms-1" />
              </Link>
            </Button>
          }
        >
          {recent.length === 0 ? (
            <Empty label={loading ? "Loading…" : "Nothing has happened yet."} />
          ) : (
            <ul className="space-y-2.5">
              {recent.map((r) => (
                <li key={r.id} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5"><SeverityDot severity={r.severity} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{r.summary}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.actor_name ?? r.actor_email ?? "System"}
                      {r.shop_name ? ` · ${r.shop_name}` : ""} · {ago(r.created_at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="space-y-4">
          <Section
            title="Needs attention"
            description="Stores that have gone quiet, stalled, or been blocked."
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/shops">All stores <ArrowRight className="size-3.5 ms-1" /></Link>
              </Button>
            }
          >
            {needsAttention.length === 0 ? (
              <Empty label={loading ? "Loading…" : "Every store is trading normally."} />
            ) : (
              <ul className="space-y-2">
                {needsAttention.map((s) => (
                  <li key={s.shop_id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {s.last_sale_at ? `Last sale ${ago(s.last_sale_at)}` : "Never sold anything"}
                        {s.owner_email ? ` · ${s.owner_email}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <SubscriptionPill kind={s.subscription} />
                      <HealthPill status={s.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Money"
            description="Subscriptions the platform is owed, and what the shops themselves sold."
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/revenue">
                  <TrendingUp className="size-4 me-1.5" /> Detail <ArrowRight className="size-3.5 ms-1" />
                </Link>
              </Button>
            }
          >
            {revenue && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Estimated MRR</div>
                  <div className="text-lg font-bold tabular-nums">
                    {fmtMoney(revenue.estimated_mrr, revenue.currency)}
                  </div>
                  {/* Said plainly: billing is manual, so nothing here is a
                      receipt. See the note on revenue-actions.ts. */}
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {revenue.paying_shops} paying × {fmtMoney(revenue.monthly_plan_price, revenue.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Renewals due (30d)</div>
                  <div className="text-lg font-bold tabular-nums flex items-center gap-1.5">
                    <Clock className="size-4 text-muted-foreground" />
                    {fmtNum(revenue.expiring_30)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {revenue.trials_ending_7} trial{revenue.trials_ending_7 === 1 ? "" : "s"} ending this week
                  </div>
                </div>
                <div className="col-span-2 border-t pt-3">
                  <div className="text-xs text-muted-foreground">
                    Sold by the shops this month (not platform revenue)
                  </div>
                  <div className="text-base font-semibold tabular-nums">
                    {fmtMoney(revenue.gmv_this_month, revenue.currency)}
                  </div>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
