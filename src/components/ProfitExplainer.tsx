"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Pnl } from "@/lib/pnl";

/**
 * "How are these worked out?" — every figure on the P&L and Analytics in plain
 * words, with the sum done on THIS period's numbers, so a shopkeeper asked
 * "how did you get gross profit?" can point at the screen.
 * Copied verbatim into the desktop.
 */
export function ProfitExplainer({ pnl, format, defaultOpen = false }: {
  pnl: Pnl;
  format: (n: number) => string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const m = format;
  const terms: { term: string; what: string; sum: string }[] = [
    {
      term: "Sales before discounts",
      what: "The full price of everything sold on the bills in this period — price × quantity on every line — before any discount.",
      sum: m(pnl.salesBeforeDiscount),
    },
    {
      term: "Discounts given",
      what: "What was knocked off the bills at checkout.",
      sum: m(pnl.discounts),
    },
    {
      term: "Total billed",
      what: "What customers were actually charged: sales before discounts, minus discounts, plus any tax. Paid or on credit, it all counts — a sale is income the moment it is billed.",
      sum: `${m(pnl.salesBeforeDiscount)} − ${m(pnl.discounts)} + ${m(pnl.tax)} tax = ${m(pnl.billed)}`,
    },
    {
      term: "Net sales",
      what: "The shop's real income from selling. Tax is taken out because it belongs to the government, and refunds for returned goods are taken out because that money went back.",
      sum: `${m(pnl.billed)} billed − ${m(pnl.tax)} tax − ${m(pnl.returns)} refunds = ${m(pnl.netSales)}`,
    },
    {
      term: "Cost of goods sold",
      what: "What the goods you sold cost you to buy. For each product we take its average purchase cost — the price on your purchase bills plus the transport/loading charges on them, averaged over every purchase of that product — and multiply by the quantity sold. Goods that came back on returns go back on the shelf, so their cost is taken off again.",
      sum: pnl.cogsReturned
        ? `${m(pnl.cogsSold)} sold − ${m(pnl.cogsReturned)} returned = ${m(pnl.cogs)}`
        : m(pnl.cogs),
    },
    {
      term: "Gross profit",
      what: "Profit on the goods alone — what you sold them for, minus what they cost you. It doesn't count rent, bills or salaries yet.",
      sum: `${m(pnl.netSales)} net sales − ${m(pnl.cogs)} cost of goods = ${m(pnl.grossProfit)}`,
    },
    {
      term: "Margin",
      what: "Gross profit as a share of net sales: out of every 100 you sell, how much is profit on the goods.",
      sum: `${m(pnl.grossProfit)} ÷ ${m(pnl.netSales)} × 100 = ${pnl.margin.toFixed(1)}%`,
    },
    {
      term: "Expenses & salaries",
      what: "The cost of running the shop in this period: the expenses you recorded, salaries and wages paid, and the part of your fixed assets (fridge, computer…) used up.",
      sum: `${m(pnl.expenses)} expenses + ${m(pnl.payroll)} salaries + ${m(pnl.depreciation)} depreciation = ${m(pnl.overheads)}`,
    },
    {
      term: "Net profit",
      what: "What is really left for the owner after the goods AND the running costs are paid for. A loss shows below zero.",
      sum: `${m(pnl.grossProfit)} gross profit − ${m(pnl.overheads)} expenses & salaries${pnl.assetGain ? ` ${pnl.assetGain > 0 ? "+" : "−"} ${m(Math.abs(pnl.assetGain))} on assets sold` : ""} = ${m(pnl.netProfit)}`,
    },
  ];

  return (
    <Card className="shadow-card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <span className="flex items-center gap-2 font-medium">
          <HelpCircle className="size-4 text-primary" /> How are these numbers worked out?
        </span>
        <ChevronDown className={"size-4 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t">
          {pnl.uncosted.lines > 0 && (
            <div className="mt-3 flex gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
              <span>
                {pnl.uncosted.lines} line{pnl.uncosted.lines === 1 ? "" : "s"} sold ({m(pnl.uncosted.salesValue)}) are
                for products never bought through a purchase bill, so the app doesn&apos;t know what they cost. Their cost
                is counted as 0, which makes the profit look higher than it is. Record a purchase for those products to fix it.
              </span>
            </div>
          )}
          <dl className="divide-y">
            {terms.map((t) => (
              <div key={t.term} className="py-3 grid gap-1 sm:grid-cols-[180px_1fr]">
                <dt className="font-medium">{t.term}</dt>
                <dd className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t.what}</p>
                  <p className="text-sm font-mono tabular-nums">{t.sum}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  );
}
