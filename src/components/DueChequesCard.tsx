import { FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { daysUntil, dueLabel, type ChequeDto } from "@/lib/cheques";

/**
 * The dashboard's cheque warning: every pending cheque whose date falls within
 * the shop's reminder window (Settings → Cheques), overdue ones first. Hidden
 * when there are none. `renderLink` is the app's own link, so the web and the
 * terminal share this card.
 */
export function DueChequesCard({
  cheques, currency, reminderDays, renderLink,
}: {
  cheques: ChequeDto[];
  currency: string;
  reminderDays: number;
  renderLink: (children: React.ReactNode) => React.ReactNode;
}) {
  if (cheques.length === 0) return null;
  const total = cheques.reduce((a, c) => a + c.amount, 0);
  return (
    <Card className="p-4 border-warning/40 bg-warning/5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <FileCheck2 className="size-4 text-warning" />
          {cheques.length} cheque{cheques.length === 1 ? "" : "s"} due in the next {reminderDays} days
          <span className="text-muted-foreground font-normal">· {formatMoney(total, currency)}</span>
        </h2>
        {renderLink(<span className="text-sm text-primary hover:underline">Open cheques →</span>)}
      </div>
      <div className="divide-y">
        {cheques.slice(0, 6).map((c) => {
          const days = daysUntil(c.cheque_date);
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">#{c.cheque_number} · {c.person_name}</div>
                <div className="text-xs text-muted-foreground">{c.bank_name ?? "Cheque"} · {c.cheque_date}</div>
              </div>
              <div className="text-end shrink-0">
                <div className="tabular-nums font-semibold">{formatMoney(c.amount, currency)}</div>
                <div className={`text-xs ${days <= 0 ? "text-destructive" : "text-warning"}`}>{dueLabel(days)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
