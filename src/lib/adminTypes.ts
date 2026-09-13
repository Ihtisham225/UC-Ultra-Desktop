/**
 * Shapes the admin screens get back over /api/desktop/rpc.
 *
 * ⚠️ These mirror the web app's own DTOs (src/lib/audit.ts and
 * src/app/admin/*-actions.ts) and must stay in step with them — the server
 * builds them, this file only describes them. A field renamed there and not
 * here fails silently at the counter, not at compile time.
 */

export type AuditScope = "platform" | "shop";
export type AuditSeverity = "info" | "notice" | "warning" | "critical";
export type AuditSource = "web" | "desktop" | "system" | "api";

export interface AuditLogRow {
  id: string;
  created_at: string;
  scope: AuditScope;
  severity: AuditSeverity;
  source: AuditSource;
  shop_id: string | null;
  shop_name: string | null;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  action_label: string;
  action_group: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  summary: string;
  metadata: unknown;
  ip_address: string | null;
  user_agent: string | null;
}

export interface AuditQuery {
  shop_id?: string | null;
  scope?: AuditScope | "all";
  actor_user_id?: string;
  actions?: string[];
  group?: string;
  severity?: AuditSeverity[];
  source?: AuditSource[];
  entity_type?: string;
  entity_id?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface AuditPage {
  rows: AuditLogRow[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditVocabulary {
  actions: { name: string; label: string; group: string }[];
  groups: string[];
}

export interface RevenueSummary {
  paying_shops: number;
  trialing_shops: number;
  lapsed_shops: number;
  never_started: number;
  estimated_mrr: number;
  estimated_arr: number;
  currency: string;
  monthly_plan_price: number;
  gmv: number;
  gmv_this_month: number;
  expiring_7: number;
  expiring_30: number;
  trials_ending_7: number;
  trials_finished: number;
  trials_converted: number;
  churned_30: number;
}

export interface RevenuePoint {
  month: string;
  label: string;
  new_shops: number;
  new_users: number;
  estimated_mrr: number;
}

export interface RenewalRow {
  shop_id: string;
  name: string;
  owner_email: string | null;
  store_type: string;
  kind: string;
  ends_at: string | null;
  days_left: number;
  recent_sales: number;
}

export interface ShopHealthRow {
  shop_id: string;
  name: string;
  store_type: string;
  currency: string;
  owner_email: string | null;
  created_at: string;
  is_blocked: boolean;
  subscription: string;
  ends_at: string | null;
  members: number;
  products: number;
  last_sale_at: string | null;
  quiet_days: number | null;
  sales_7: number;
  sales_30: number;
  revenue_30: number;
  uses_desktop: boolean;
  status: string;
}

export interface PlatformPulse {
  sales_today: number;
  sales_7: number;
  active_shops_today: number;
  active_shops_7: number;
  new_shops_30: number;
  new_users_30: number;
  critical_events_24h: number;
  failed_sign_ins_24h: number;
}

export interface OverviewStats {
  total_users: number;
  total_shops: number;
  pro_shops: number;
  total_sales: number;
  pending_payments: number;
  total_revenue: number;
}

export interface AnnouncementDto {
  id: string;
  title: string;
  body: string;
  severity: AuditSeverity;
  audience: "all" | "shops" | "store_type";
  store_type: string | null;
  dismissible: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  target_shop_ids: string[];
  read_count: number;
  live: boolean;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  severity: AuditSeverity;
  audience: "all" | "shops" | "store_type";
  store_type: string | null;
  dismissible: boolean;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  target_shop_ids: string[];
}

export interface ShopAnnouncementDto {
  id: string;
  title: string;
  body: string;
  severity: AuditSeverity;
  dismissible: boolean;
  created_at: string;
}

/**
 * ⚠️ The desktop compiles with `strict: false`, where TypeScript will not
 * narrow a {ok:true}|{ok:false;error} union on the `ok` check. Every RPC
 * result here is therefore one loose shape — match it, don't port the web's
 * discriminated union.
 */
export interface RpcResult {
  ok: boolean;
  error?: string;
  id?: string;
}
