/**
 * Small cheque helpers shared by the server, the web screens and the desktop
 * (a copy lives in the desktop's `src/lib/cheques.ts` — keep the two in step).
 */

export interface ChequeDto {
  id: string;
  direction: "received" | "issued";
  cheque_number: string;
  bank_name: string | null;
  amount: number;
  cheque_date: string;
  status: "pending" | "cleared" | "bounced";
  party_id: string | null;
  person_name: string;
  account_id: string | null;
  account_name: string | null;
  cleared_at: string | null;
  bounced_at: string | null;
  notes: string | null;
  created_at: string;
}

/** "Cheque #123456 (HBL) dated 05 Oct 2026" — written onto the khata entries. */
export function chequeLabel(c: { cheque_number: string; bank_name: string | null; cheque_date: string }): string {
  const [y, m, d] = c.cheque_date.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = y && m && d ? `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}` : c.cheque_date;
  return `Cheque #${c.cheque_number}${c.bank_name ? ` (${c.bank_name})` : ""} dated ${when}`;
}

/**
 * Whole days from today to a yyyy-mm-dd date: 0 today, negative once past.
 * Both ends are taken as calendar days in UTC, the way `@db.Date` stores them,
 * so the count doesn't flip at some odd hour.
 */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = Date.UTC(y, (m ?? 1) - 1, d ?? 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

/** "in 3 days", "today", "2 days overdue". */
export function dueLabel(days: number): string {
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days > 0) return `due in ${days} days`;
  return days === -1 ? "1 day overdue" : `${-days} days overdue`;
}
