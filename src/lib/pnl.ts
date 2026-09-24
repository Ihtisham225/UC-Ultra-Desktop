/**
 * Profit & loss — the ONE way every screen works out sales, gross profit and
 * net profit: Reports → Profit & Loss, Analytics and the dashboard's
 * gross-profit tile, on the web and (COPIED VERBATIM as `src/lib/pnl.ts`) on
 * the desktop. Each screen used to do its own sums and they disagreed — the
 * P&L said 61,110 net profit while Analytics said 565,370, because Analytics
 * forgot the cost of the goods. Change both copies together.
 *
 * The statement, top to bottom:
 *
 *   Sales before discounts   Σ bill subtotals (price × qty)
 * − Discounts given          what was knocked off the bills
 * = Total billed             Σ bill totals — what customers were charged, incl. tax
 * − Tax collected            owed to the government, not the shop's money
 * − Returns refunded         money given back for goods returned in the period
 * = NET SALES                what the shop really earned from selling
 * − Cost of goods sold       what the goods sold cost to buy (average landed
 *                            cost × qty), less the cost of goods returned
 * = GROSS PROFIT             profit on the goods alone
 * − Expenses, salaries, asset depreciation (± gain/loss on assets sold)
 * = NET PROFIT               what is left after running the shop
 *
 * Pure: no React, no server, no dates — the caller passes rows already
 * narrowed to the period (purchase items are ALL of them: the average cost is
 * worked out over every purchase ever made of a product).
 */

type Num = number | string | null | undefined;
const n = (v: Num) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
const r2 = (x: number) => Math.round(x * 100) / 100;

interface Line { product_id?: string | null; variant_id?: string | null; quantity: Num; line_total?: Num }

export interface PnlInput {
  sales: { subtotal: Num; tax: Num; total: Num; items: Line[] }[];
  /** Returns taken in the period, with what came back. */
  returns: { total_refund: Num; items: Line[] }[];
  /** EVERY purchase line of the shop — the average cost is over all of them. */
  purchaseItems: (Line & { unit_cost: Num; expense_amount?: Num })[];
  expenses: number;
  expensesByCategory?: { name: string; total: number }[];
  payroll?: number;
  depreciation?: number;
  /** Gain (or, below zero, loss) on fixed assets sold or written off. */
  assetGain?: number;
  /** Services (lab tests, labour) cost nothing by design — never "uncosted". */
  serviceIds?: ReadonlySet<string>;
}

export interface Pnl {
  salesBeforeDiscount: number;
  discounts: number;
  billed: number;
  tax: number;
  returns: number;
  netSales: number;
  /** Cost of what was sold… */
  cogsSold: number;
  /** …less the cost of what came back on returns. */
  cogsReturned: number;
  cogs: number;
  grossProfit: number;
  /** Gross profit as a share of net sales, in %. */
  margin: number;
  expenses: number;
  expensesByCategory: { name: string; total: number }[];
  payroll: number;
  depreciation: number;
  assetGain: number;
  /** Expenses + salaries + depreciation. */
  overheads: number;
  netProfit: number;
  /** Lines sold whose product was never bought through the app: their cost
   *  counts as 0, so gross profit reads HIGH by up to this much in sales. */
  uncosted: { lines: number; salesValue: number };
  billCount: number;
}

const keyOf = (l: Line) => l.variant_id ?? l.product_id ?? null;

/** Average landed cost per product/variant: (qty × price + purchase charges) / qty. */
export function averageCosts(purchaseItems: PnlInput["purchaseItems"]): Map<string, number> {
  const totals = new Map<string, { qty: number; cost: number }>();
  for (const p of purchaseItems) {
    const k = keyOf(p);
    if (!k) continue;
    const t = totals.get(k) ?? { qty: 0, cost: 0 };
    t.qty += n(p.quantity);
    t.cost += n(p.quantity) * n(p.unit_cost) + n(p.expense_amount);
    totals.set(k, t);
  }
  const avg = new Map<string, number>();
  totals.forEach((t, k) => avg.set(k, t.qty > 0 ? t.cost / t.qty : 0));
  return avg;
}

export function computePnl(input: PnlInput): Pnl {
  const avg = averageCosts(input.purchaseItems);
  let salesBeforeDiscount = 0, billed = 0, tax = 0, cogsSold = 0;
  const uncosted = { lines: 0, salesValue: 0 };
  for (const s of input.sales) {
    salesBeforeDiscount += n(s.subtotal);
    billed += n(s.total);
    tax += n(s.tax);
    for (const it of s.items) {
      const k = keyOf(it);
      const unit = k ? avg.get(k) : undefined;
      if (unit === undefined) {
        if (it.product_id && input.serviceIds?.has(it.product_id)) continue;
        uncosted.lines += 1;
        uncosted.salesValue += n(it.line_total);
        continue;
      }
      cogsSold += n(it.quantity) * unit;
    }
  }
  // total = subtotal − discount + tax, so the discount is what's left over.
  const discounts = Math.max(salesBeforeDiscount + tax - billed, 0);

  let returns = 0, cogsReturned = 0;
  for (const r of input.returns) {
    returns += n(r.total_refund);
    for (const it of r.items) {
      const k = keyOf(it);
      cogsReturned += n(it.quantity) * (k ? avg.get(k) ?? 0 : 0);
    }
  }

  const netSales = billed - tax - returns;
  const cogs = cogsSold - cogsReturned;
  const grossProfit = netSales - cogs;
  const payroll = input.payroll ?? 0;
  const depreciation = input.depreciation ?? 0;
  const assetGain = input.assetGain ?? 0;
  const overheads = input.expenses + payroll + depreciation;
  return {
    salesBeforeDiscount: r2(salesBeforeDiscount),
    discounts: r2(discounts),
    billed: r2(billed),
    tax: r2(tax),
    returns: r2(returns),
    netSales: r2(netSales),
    cogsSold: r2(cogsSold),
    cogsReturned: r2(cogsReturned),
    cogs: r2(cogs),
    grossProfit: r2(grossProfit),
    margin: netSales > 0 ? Math.round((grossProfit / netSales) * 1000) / 10 : 0,
    expenses: r2(input.expenses),
    expensesByCategory: input.expensesByCategory ?? [],
    payroll: r2(payroll),
    depreciation: r2(depreciation),
    assetGain: r2(assetGain),
    overheads: r2(overheads),
    netProfit: r2(grossProfit - overheads + assetGain),
    uncosted: { lines: uncosted.lines, salesValue: r2(uncosted.salesValue) },
    billCount: input.sales.length,
  };
}

/** The P&L as statement lines, top to bottom — for the table, CSV and print. */
export function pnlStatement(p: Pnl): { label: string; value: number; strong?: boolean; note?: string }[] {
  return [
    { label: "Sales before discounts", value: p.salesBeforeDiscount },
    ...(p.discounts ? [{ label: "Discounts given", value: -p.discounts }] : []),
    { label: "Total billed (incl. tax)", value: p.billed },
    ...(p.tax ? [{ label: "Tax collected", value: -p.tax }] : []),
    ...(p.returns ? [{ label: "Returns refunded", value: -p.returns }] : []),
    { label: "Net sales", value: p.netSales, strong: true },
    { label: "Cost of goods sold", value: -p.cogsSold },
    ...(p.cogsReturned ? [{ label: "Cost of goods returned", value: p.cogsReturned }] : []),
    { label: "Gross profit", value: p.grossProfit, strong: true },
    ...p.expensesByCategory.map((c) => ({ label: `Expense — ${c.name}`, value: -c.total })),
    { label: "Total expenses", value: -p.expenses },
    ...(p.payroll ? [{ label: "Salaries & wages", value: -p.payroll }] : []),
    ...(p.depreciation ? [{ label: "Depreciation of assets", value: -p.depreciation }] : []),
    ...(p.assetGain ? [{ label: p.assetGain > 0 ? "Gain on assets sold" : "Loss on assets sold / written off", value: p.assetGain }] : []),
    { label: "Net profit", value: p.netProfit, strong: true },
  ];
}
