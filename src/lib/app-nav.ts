import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign, BarChart3, BookOpenCheck, Boxes, Car, ClipboardCheck, Factory, FileBarChart, FlaskConical,
  FolderTree, HandCoins, HeartPulse, Landmark, LayoutDashboard, LifeBuoy, Package, PackageOpen, Receipt,
  ScanBarcode, Scissors, ScrollText, Settings, ShieldCheck, Tag, TrendingUp, Truck, Undo2, UserPlus, Users,
  Wallet, FileText, Banknote, SlidersHorizontal, KeyRound, MapPin, Building2, HandHeart,
} from "lucide-react";

/**
 * Every page a shop can reach, and everything it can create — the ONE list the
 * sidebar, the Go to popup (Ctrl/Cmd+G) and the Add new popup (Ctrl/Cmd+E) are
 * all built from, so the three can never disagree about what a user may open.
 *
 * Visibility rules live here and only here: a handicraft shop never sees the
 * till, a cashier never sees payroll. Order is the sidebar's order.
 *
 * A copy of the web app's `src/lib/app-nav.ts` — keep the two in step.
 */

export type NavSection = "Overview" | "Selling" | "Stock" | "Lab" | "Workshop" | "Money" | "Store";

export interface NavPage {
  to: string;
  label: string;
  icon: LucideIcon;
  section: NavSection;
  /** Extra words the Go to popup matches on — what people call the page. */
  keywords?: string[];
}

export interface NewAction {
  /** Stable id a page registers its handler under (see hooks/useAddNew). */
  id: string;
  label: string;
  icon: LucideIcon;
  /** The page whose form this opens. */
  to: string;
  keywords?: string[];
}

export interface NavContext {
  t: (key: string) => string;
  craft: boolean;
  oil: boolean;
  lab: boolean;
  role: string | null | undefined;
  hasPerm: (module: string, action: string) => boolean;
  investorsEnabled: boolean;
  perms: {
    canManageProducts: boolean;
    canManagePurchases: boolean;
    canManageExpenses: boolean;
    canManageSuppliers: boolean;
    canManageStaff: boolean;
  };
}

const ownerOrManager = (ctx: NavContext) => ctx.role === "owner" || ctx.role === "manager";

export function navPages(ctx: NavContext): NavPage[] {
  const { t, craft, oil, lab, perms } = ctx;
  const labView = lab && ctx.hasPerm("lab", "view");
  const pages: (NavPage & { show: boolean })[] = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard, section: "Overview", show: true, keywords: ["home"] },
    // The shawl trade's daily book: every movement is written here as it
    // happens, then raised as a real record at the end of the day. It sits
    // first because it is the screen they are on all day.
    { to: "/daybook", label: "Roznamcha", icon: BookOpenCheck, section: "Workshop", show: craft && perms.canManagePurchases, keywords: ["daybook"] },
    { to: "/pos", label: t("nav.pos"), icon: ScanBarcode, section: "Selling", show: !craft, keywords: ["till", "point of sale", "bill", "checkout"] },
    { to: "/products", label: t("nav.products"), icon: Package, section: "Stock", show: !craft, keywords: ["items"] },
    { to: "/categories", label: "Categories", icon: FolderTree, section: "Stock", show: !craft && perms.canManageProducts },
    { to: "/brands", label: "Brands", icon: Tag, section: "Stock", show: !craft && perms.canManageProducts },
    { to: "/inventory", label: "Inventory", icon: Boxes, section: "Stock", show: !craft && perms.canManageProducts, keywords: ["stock", "adjustment"] },
    // Where goods are kept. Not for handicraft shops: they hold no catalogue.
    { to: "/shelves", label: "Shelves & racks", icon: MapPin, section: "Stock", show: !craft && perms.canManageProducts, keywords: ["shelf", "rack", "location", "godown", "count"] },
    { to: "/lab", label: "Lab", icon: FlaskConical, section: "Lab", show: labView, keywords: ["tests"] },
    { to: "/lab-results", label: "Results", icon: ClipboardCheck, section: "Lab", show: labView, keywords: ["lab results", "reports"] },
    { to: "/patients", label: "Patients", icon: HeartPulse, section: "Lab", show: labView },
    { to: "/oil-changes", label: "Oil Changes", icon: Car, section: "Selling", show: oil, keywords: ["vehicles", "cars"] },
    { to: "/sales", label: t("nav.sales"), icon: Receipt, section: "Selling", show: !craft, keywords: ["bills", "receipts", "orders"] },
    { to: "/returns", label: t("nav.returns"), icon: Undo2, section: "Selling", show: !craft, keywords: ["refunds"] },
    { to: "/customers", label: t("nav.customers"), icon: Users, section: "Selling", show: !craft },
    // Craft shops sell to customers on a challan, not through the till, so
    // they get their own Customers screen rather than the sales-shaped one.
    { to: "/customers", label: t("nav.customers"), icon: Users, section: "Selling", show: craft && perms.canManageSuppliers, keywords: ["challans"] },
    { to: "/analytics", label: t("nav.analytics"), icon: BarChart3, section: "Overview", show: !craft && perms.canManageExpenses, keywords: ["charts", "profit"] },
    { to: "/reports", label: "Reports", icon: FileBarChart, section: "Overview", show: perms.canManageExpenses },
    { to: "/purchases", label: t("nav.purchases"), icon: PackageOpen, section: "Stock", show: !craft && perms.canManagePurchases, keywords: ["buying"] },
    { to: "/material-purchases", label: t("nav.purchases"), icon: PackageOpen, section: "Workshop", show: craft && perms.canManagePurchases, keywords: ["material", "yarn"] },
    { to: "/making", label: "Making", icon: Scissors, section: "Workshop", show: craft && perms.canManagePurchases, keywords: ["karigar"] },
    { to: "/job-work", label: "Job Work", icon: Factory, section: "Workshop", show: craft && perms.canManagePurchases, keywords: ["factory", "processing"] },
    { to: "/suppliers", label: craft ? "Parties" : t("nav.suppliers"), icon: Truck, section: craft ? "Workshop" : "Stock", show: perms.canManageSuppliers, keywords: craft ? ["suppliers"] : ["vendors", "parties"] },
    { to: "/expenses", label: t("nav.expenses"), icon: Wallet, section: "Money", show: perms.canManageExpenses },
    { to: "/accounts", label: "Accounts", icon: Landmark, section: "Money", show: perms.canManageExpenses || ctx.hasPerm("accounts", "view"), keywords: ["cash", "bank"] },
    // A craft shop keeps two books already — what it owes each party, on the
    // Parties page, and what customers owe it, on Customers — so the general
    // khata would be a third place for the same money.
    { to: "/debts", label: `${t("nav.debts")} (Khata)`, icon: HandCoins, section: "Money", show: !craft && perms.canManageExpenses, keywords: ["ledger", "khata", "debts", "udhaar"] },
    { to: "/investors", label: t("nav.investors"), icon: TrendingUp, section: "Money", show: perms.canManageExpenses && ctx.investorsEnabled },
    { to: "/payroll", label: t("nav.payroll"), icon: BadgeDollarSign, section: "Money", show: perms.canManageExpenses, keywords: ["salary", "wages"] },
    // Things the shop uses (fridge, generator, shelving) — cost spread as depreciation.
    { to: "/assets", label: "Assets", icon: Building2, section: "Money", show: perms.canManageExpenses, keywords: ["equipment", "depreciation", "furniture", "generator", "fixed assets"] },
    // Every store type: zakat is on the owner's wealth, whatever the shop sells.
    { to: "/zakat", label: "Zakat", icon: HandHeart, section: "Money", show: ownerOrManager(ctx), keywords: ["nisab", "charity"] },
    { to: "/staff", label: t("nav.staff"), icon: ShieldCheck, section: "Store", show: perms.canManageStaff, keywords: ["users", "roles", "employees"] },
    // Who did what in this store. Owner/manager only, matching the action's
    // own guard — a cashier must not be able to read their own trail.
    { to: "/activity", label: "Activity", icon: ScrollText, section: "Store", show: ownerOrManager(ctx), keywords: ["audit", "log", "history"] },
    { to: "/settings", label: t("nav.settings"), icon: Settings, section: "Store", show: true, keywords: ["preferences", "receipt", "shop"] },
    { to: "/support", label: t("nav.support"), icon: LifeBuoy, section: "Store", show: true, keywords: ["help", "contact"] },
  ];
  return pages.filter((p) => p.show);
}

/**
 * Everything the Add new popup offers. Each `id` must be registered with
 * `useAddNew` by the page at `to`, or choosing it only opens the page.
 */
export function newActions(ctx: NavContext): NewAction[] {
  const { craft, oil, lab, perms } = ctx;
  const labView = lab && ctx.hasPerm("lab", "view");
  const edit = ownerOrManager(ctx);
  const actions: (NewAction & { show: boolean })[] = [
    // Workshop (handicraft) shops
    { id: "daybook-entry", label: "Roznamcha entry", icon: BookOpenCheck, to: "/daybook", show: craft && perms.canManagePurchases, keywords: ["daybook"] },
    { id: "material-purchase", label: "Purchase", icon: PackageOpen, to: "/material-purchases", show: craft && perms.canManagePurchases, keywords: ["material", "yarn", "bill"] },
    { id: "making-challan", label: "Making challan", icon: Scissors, to: "/making", show: craft && perms.canManagePurchases, keywords: ["karigar"] },
    { id: "job-work-challan", label: "Job work challan", icon: Factory, to: "/job-work", show: craft && perms.canManagePurchases, keywords: ["factory"] },
    { id: "customer-challan", label: "Customer challan", icon: FileText, to: "/customers", show: craft && perms.canManageSuppliers, keywords: ["bill", "sale"] },
    { id: "customer-payment", label: "Customer payment", icon: Banknote, to: "/customers", show: craft && perms.canManageSuppliers, keywords: ["received"] },

    // Selling
    { id: "sale", label: "Sale", icon: ScanBarcode, to: "/pos", show: !craft, keywords: ["pos", "till", "bill"] },
    { id: "manual-sale", label: "Past sale (record)", icon: Receipt, to: "/sales", show: !craft, keywords: ["manual", "record"] },
    { id: "customer", label: "Customer", icon: Users, to: "/customers", show: craft ? perms.canManageSuppliers : true },
    { id: "vehicle", label: "Vehicle", icon: Car, to: "/oil-changes", show: oil, keywords: ["car", "register"] },
    { id: "patient", label: "Patient", icon: HeartPulse, to: "/patients", show: labView },

    // Stock
    { id: "product", label: "Product", icon: Package, to: "/products", show: !craft && edit, keywords: ["item"] },
    { id: "purchase", label: "Purchase", icon: PackageOpen, to: "/purchases", show: !craft && perms.canManagePurchases, keywords: ["buying", "stock in"] },
    { id: "supplier", label: craft ? "Party" : "Supplier", icon: Truck, to: "/suppliers", show: perms.canManageSuppliers, keywords: craft ? ["supplier", "maker", "factory"] : ["vendor"] },
    { id: "stock-adjustment", label: "Stock adjustment", icon: SlidersHorizontal, to: "/inventory", show: !craft && perms.canManageProducts, keywords: ["inventory", "count"] },
    { id: "category", label: "Category", icon: FolderTree, to: "/categories", show: !craft && perms.canManageProducts },
    { id: "brand", label: "Brand", icon: Tag, to: "/brands", show: !craft && perms.canManageProducts },
    { id: "storage-location", label: "Shelf / rack", icon: MapPin, to: "/shelves", show: !craft && perms.canManageProducts, keywords: ["location", "godown"] },

    // Money
    { id: "expense", label: "Expense", icon: Wallet, to: "/expenses", show: perms.canManageExpenses },
    { id: "ledger-entry", label: "Ledger entry", icon: HandCoins, to: "/debts", show: !craft && perms.canManageExpenses, keywords: ["khata", "debt", "udhaar"] },
    { id: "account", label: "Money account", icon: Landmark, to: "/accounts", show: edit || ctx.hasPerm("accounts", "edit"), keywords: ["cash", "bank", "wallet"] },
    { id: "asset", label: "Asset", icon: Building2, to: "/assets", show: perms.canManageExpenses, keywords: ["equipment", "fridge", "generator", "furniture"] },
    { id: "payroll-payment", label: "Salary payment", icon: BadgeDollarSign, to: "/payroll", show: perms.canManageExpenses, keywords: ["payroll", "advance", "bonus", "wages"] },
    { id: "investor", label: "Investor", icon: TrendingUp, to: "/investors", show: perms.canManageExpenses && ctx.investorsEnabled },

    // Store
    { id: "staff", label: "Staff member", icon: UserPlus, to: "/staff", show: perms.canManageStaff, keywords: ["user", "employee", "cashier"] },
    { id: "role", label: "Staff role", icon: KeyRound, to: "/staff", show: perms.canManageStaff, keywords: ["permissions"] },
  ];
  return actions.filter((a) => a.show);
}
