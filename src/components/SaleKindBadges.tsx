/**
 * What kind of sale a bill was, at a glance on the Sales list: how it was
 * served (the shop's own order-type labels), an oil change, and how it was
 * paid — in full, all on the customer's ledger, or part paid / part ledger.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client") — change both.
 */

import { BookOpen, Car, CheckCircle2, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { oilChangeLabel, orderTypeLabel, paymentStatus, PAYMENT_LABELS } from "@/lib/order-types";

type ShopArg = Parameters<typeof orderTypeLabel>[0];

export interface SaleKindLike {
  order_type?: string | null;
  table_label?: string | null;
  has_oil_change?: boolean;
  total: number | string;
  amount_paid?: number | string | null;
}

const chip = "gap-1 text-[10px] font-medium px-1.5 py-0 h-5";

export function SaleKindBadges({
  sale,
  shop,
  formatMoney,
  showPaid = true,
}: {
  sale: SaleKindLike;
  shop: ShopArg;
  formatMoney: (n: number) => string;
  /** "Paid" on every ordinary bill can be noise; the list shows it, compact views may not. */
  showPaid?: boolean;
}) {
  const type = orderTypeLabel(shop, sale.order_type);
  const status = paymentStatus(sale.total, sale.amount_paid ?? 0);
  const paid = Math.max(0, Math.min(Number(sale.amount_paid) || 0, Number(sale.total) || 0));
  const owed = Math.max(0, (Number(sale.total) || 0) - paid);
  return (
    <>
      {type && (
        <Badge variant="secondary" className={chip}>
          <ShoppingBag className="size-3" />
          {type}
          {sale.order_type === "dine_in" && sale.table_label ? ` · Table ${sale.table_label}` : ""}
        </Badge>
      )}
      {sale.has_oil_change && (
        <Badge variant="secondary" className={chip}>
          <Car className="size-3" /> {oilChangeLabel(shop)}
        </Badge>
      )}
      {status === "ledger" && (
        <Badge className={`${chip} bg-warning/15 text-warning border-warning/30 hover:bg-warning/20`} title={`${formatMoney(owed)} on the customer's ledger`}>
          <BookOpen className="size-3" /> {PAYMENT_LABELS.ledger}
        </Badge>
      )}
      {status === "part" && (
        <Badge
          className={`${chip} bg-warning/15 text-warning border-warning/30 hover:bg-warning/20`}
          title={`Paid ${formatMoney(paid)} · ${formatMoney(owed)} on the customer's ledger`}
        >
          <BookOpen className="size-3" /> {PAYMENT_LABELS.part}: {formatMoney(paid)} paid · {formatMoney(owed)} ledger
        </Badge>
      )}
      {status === "paid" && showPaid && (
        <Badge variant="outline" className={`${chip} text-success border-success/30`}>
          <CheckCircle2 className="size-3" /> {PAYMENT_LABELS.paid}
        </Badge>
      )}
    </>
  );
}
