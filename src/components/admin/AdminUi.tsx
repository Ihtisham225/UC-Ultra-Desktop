// Shared furniture for the admin area, kept in step with the web app's
// src/app/admin/ui.tsx — the two panels must look like one product.
// Shared furniture for the admin area. Kept in one place so eight screens
// cannot drift into eight different-looking stat cards.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({
  title,
  value,
  icon: Icon,
  hint,
  accent,
  tone,
}: {
  title: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  accent?: boolean;
  tone?: "danger" | "warning" | "success";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4",
        accent && "border-primary/30 bg-primary/5",
        tone === "danger" && "border-destructive/30 bg-destructive/5",
        tone === "warning" && "border-amber-500/30 bg-amber-500/5",
        tone === "success" && "border-emerald-500/30 bg-emerald-500/5",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {title}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{label}</div>;
}

/** The one place a severity becomes a colour, so the two logs agree. */
export function SeverityDot({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full shrink-0",
        severity === "critical" && "bg-destructive",
        severity === "warning" && "bg-amber-500",
        severity === "notice" && "bg-sky-500",
        severity === "info" && "bg-muted-foreground/40",
      )}
      title={severity}
    />
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "success" | "warning" | "danger" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "success" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        tone === "warning" && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        tone === "danger" && "bg-destructive/10 text-destructive",
        tone === "primary" && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </span>
  );
}

/** Subscription state as one pill — used by Stores, Revenue and Overview. */
export function SubscriptionPill({ kind }: { kind: string }) {
  if (kind === "paid") return <Pill tone="success">Pro</Pill>;
  if (kind === "trial") return <Pill tone="primary">Trial</Pill>;
  if (kind === "lapsed") return <Pill tone="warning">Lapsed</Pill>;
  return <Pill>Free</Pill>;
}

export function HealthPill({ status }: { status: string }) {
  if (status === "blocked") return <Pill tone="danger">Blocked</Pill>;
  if (status === "dormant") return <Pill tone="danger">Dormant</Pill>;
  if (status === "quiet") return <Pill tone="warning">Quiet</Pill>;
  if (status === "slowing") return <Pill tone="warning">Slowing</Pill>;
  return <Pill tone="success">Healthy</Pill>;
}

export const fmtNum = (n: number) => n.toLocaleString();

export function fmtMoney(n: number, currency: string): string {
  return `${currency} ${Math.round(n).toLocaleString()}`;
}

/** Relative time, for log lines where "2 hours ago" beats a timestamp. */
export function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
