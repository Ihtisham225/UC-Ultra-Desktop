"use client";

import { Fragment } from "react";
import { ArrowDownLeft, ArrowUpRight, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  INSTRUMENTS,
  MONEY_SOURCES,
  summarizeTodayMoney,
  type Instrument,
  type InstrumentSplit,
  type MoneySource,
  type TodayMoney,
} from "@/lib/today-money";

const SOURCE_LABEL: Record<MoneySource, string> = {
  sales: "Sales",
  ledger_in: "Ledger received",
  returns: "Returns refunded",
  ledger_out: "Ledger paid",
  purchases: "Purchases paid",
  expenses: "Expenses",
};

const INSTRUMENT_LABEL: Record<Instrument, string> = {
  cash: "Cash",
  bank: "Bank",
  wallet: "Wallet",
  cheque: "Cheque",
  none: "No account",
};

/** Always shown, even on a quiet day — the three the counter asks about. */
const CORE: Instrument[] = ["cash", "bank", "cheque"];

/**
 * Today's money in and out, by source × how it was paid.
 * Copied verbatim into the desktop (`src/components/TodayMoneyCard.tsx`).
 */
export function TodayMoneyCard({
  money,
  format,
  visible = () => true,
}: {
  money: TodayMoney;
  format: (n: number) => string;
  /** Rows this person may see (purchases / expenses follow their permissions). */
  visible?: (src: MoneySource) => boolean;
}) {
  const rows = MONEY_SOURCES.filter((s) => visible(s.key));
  const sums = summarizeTodayMoney(money, visible);
  // Wallet and "no account" only earn a column on a day they were used.
  const cols = INSTRUMENTS.filter(
    (i) => CORE.includes(i) || rows.some((r) => money[r.key][i] !== 0),
  );

  const cell = (n: number, strong = false) => (
    <td
      className={cn(
        "px-3 py-2 text-end tabular-nums whitespace-nowrap",
        n === 0 && "text-muted-foreground/50",
        strong && "font-semibold",
      )}
    >
      {n === 0 ? "—" : format(n)}
    </td>
  );

  const line = (label: React.ReactNode, split: InstrumentSplit, className?: string, strong = false) => (
    <tr className={className}>
      <td className="px-3 py-2 whitespace-nowrap">{label}</td>
      {cols.map((c) => <Fragment key={c}>{cell(split[c], strong)}</Fragment>)}
      {cell(split.total, true)}
    </tr>
  );

  const group = (dir: "in" | "out") => {
    const list = rows.filter((r) => r.dir === dir);
    if (list.length === 0) return null;
    const Icon = dir === "in" ? ArrowDownLeft : ArrowUpRight;
    return (
      <>
        {list.map((r) => (
          <Fragment key={r.key}>{line(<span className="ps-5">{SOURCE_LABEL[r.key]}</span>, money[r.key])}</Fragment>
        ))}
        {line(
          <span className={cn("flex items-center gap-1.5 font-semibold", dir === "in" ? "text-success" : "text-destructive")}>
            <Icon className="size-3.5" /> Total {dir}
          </span>,
          sums[dir],
          "border-b bg-muted/40",
          true,
        )}
      </>
    );
  };

  return (
    <Card className="p-0 shadow-card overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Coins className="size-4 text-primary" /> Today&apos;s money
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          What came in and went out today, and how — cash, bank, wallet or cheque. Cheques count on
          the day they were taken, not when they clear.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 text-start font-medium" />
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 text-end font-medium whitespace-nowrap">{INSTRUMENT_LABEL[c]}</th>
              ))}
              <th className="px-3 py-2 text-end font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {group("in")}
            {group("out")}
            {line(
              <span className="font-bold">Net</span>,
              sums.net,
              cn("text-base", sums.net.total < 0 ? "text-destructive" : "text-foreground"),
              true,
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
