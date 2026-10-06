/**
 * What a person can keep private behind their authenticator code: whole
 * pages, and single figures on the dashboard. Each person chooses their own
 * (Settings → Security), so an owner can hide profit on the shop-floor
 * computer without hiding anything from anyone else.
 *
 * A private page or figure is unlocked with a 6-digit code and stays unlocked
 * only while you are on that page — leaving it locks it again.
 *
 * Pure, so the server, the web and the desktop all read the same list.
 * ⚠️ COPIED verbatim to the desktop app (`src/lib/privacy.ts`).
 */

export interface PrivateItem {
  key: string;
  label: string;
  hint: string;
  /** For a page: the route it lives at (and everything under it). */
  route?: string;
}

export const PRIVATE_PAGES: PrivateItem[] = [
  { key: "page.analytics", route: "/analytics", label: "Analytics", hint: "Sales and profit charts" },
  { key: "page.reports", route: "/reports", label: "Reports", hint: "Profit & loss, sales and stock reports" },
  { key: "page.accounts", route: "/accounts", label: "Accounts", hint: "Cash, bank and wallet balances" },
  { key: "page.debts", route: "/debts", label: "Ledger (Khata)", hint: "Who owes what" },
  { key: "page.expenses", route: "/expenses", label: "Expenses", hint: "What the shop spends" },
  { key: "page.payroll", route: "/payroll", label: "Payroll", hint: "Wages, advances and payslips" },
  { key: "page.investors", route: "/investors", label: "Investors", hint: "Investor money and profit shares" },
  { key: "page.assets", route: "/assets", label: "Assets", hint: "Equipment and its value" },
  { key: "page.zakat", route: "/zakat", label: "Zakat", hint: "Your zakat working" },
  { key: "page.activity", route: "/activity", label: "Activity", hint: "Who did what in the shop" },
];

export const PRIVATE_DETAILS: PrivateItem[] = [
  { key: "dashboard.sales", label: "Today's sales", hint: "Revenue, number of sales and credit given on the dashboard" },
  { key: "dashboard.profit", label: "Today's profit", hint: "The gross profit tile on the dashboard" },
  { key: "dashboard.spending", label: "Today's purchases & expenses", hint: "What went out today, on the dashboard" },
  { key: "dashboard.money", label: "Today's money & money owed", hint: "The cash/bank breakdown and what customers owe" },
];

export const PRIVATE_ITEMS = [...PRIVATE_PAGES, ...PRIVATE_DETAILS];
const KNOWN = new Set(PRIVATE_ITEMS.map((i) => i.key));

export interface PrivacySettings {
  items: string[];
}

/** Anything stored or sent → only keys this version knows about. */
export function normalizePrivacy(raw: unknown): PrivacySettings {
  const items = (raw && typeof raw === "object" ? (raw as { items?: unknown }).items : null) ?? [];
  return { items: Array.isArray(items) ? [...new Set(items.filter((k): k is string => typeof k === "string" && KNOWN.has(k)))] : [] };
}

/** The private page a path belongs to, if any ("/reports/x" → page.reports). */
export function privatePageFor(pathname: string): PrivateItem | null {
  return PRIVATE_PAGES.find((p) => p.route && (pathname === p.route || pathname.startsWith(`${p.route}/`))) ?? null;
}

/** Dashboard figures, grouped by the privacy item that hides them. */
export const DASHBOARD_FIELDS: Record<string, string[]> = {
  "dashboard.sales": ["todaySales", "todayCount", "todayCredit"],
  "dashboard.profit": ["todayGrossProfit"],
  "dashboard.spending": ["todayPurchases", "todayExpenses"],
  "dashboard.money": ["money", "totalOwedToMe"],
};
