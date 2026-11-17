/**
 * One person's ledger as a single statement — the way a khata book reads, and
 * the way daily-cup shows a customer: every bill, every extra debt, every
 * payment on one line each, oldest at the bottom of the running balance, with
 * what they owe after each line.
 *
 * Underneath, the shop keeps one khata row per unpaid bill (so editing or
 * voiding a bill reverses exactly its share), a second set of rows when the
 * account turns the other way (an advance, a supplier who also buys), and a
 * payment spread over several bills as several parts. None of that is the
 * shopkeeper's business: this folds it all into one balance.
 *
 * Pure (no React, no server) and COPIED VERBATIM into the desktop
 * (`src/lib/person-ledger.ts`). Keep the two in step.
 */

export interface StatementDebt {
  id: string;
  direction: string; // "owed_to_me" | "i_owe"
  amount: number;
  created_at: string;
  notes: string | null;
  sale_id?: string | null;
  purchase_id?: string | null;
  bill_number?: string | null;
}

export interface StatementPayment {
  id: string;
  debt_id: string;
  amount: number;
  discount: number;
  kind: string; // "payment" | "increase"
  payment_date: string;
  created_at: string;
  notes: string | null;
  account_name: string | null;
  cheque_id?: string | null;
  receipt_id?: string | null;
  sale_id?: string | null;
  sale_return_id?: string | null;
  supplier_return_id?: string | null;
  purchase_id?: string | null;
}

/**
 * Whose side the statement is written from. A customer's account counts what
 * they owe the shop; a supplier's counts what the shop owes them. Either way a
 * positive balance means "still to settle".
 */
export type StatementSide = "receivable" | "payable";

export type StatementKind = "bill" | "debt" | "payment" | "credit";

export interface StatementLine {
  key: string;
  /** yyyy-mm-dd */
  date: string;
  kind: StatementKind;
  /** "Bill 1173", "Payment", "Purchase PO-12"… */
  title: string;
  /** How it was paid, the note, the discount — whatever explains the line. */
  detail: string;
  /** Adds to the balance. */
  charge: number;
  /** Takes off the balance. */
  paid: number;
  /** The balance after this line. Below zero = held in their favour (or ours). */
  balance: number;
  /** The khata entries behind this line, for edit / delete / receipt. */
  payment_ids: string[];
  receipt_id: string | null;
}

export interface Statement {
  side: StatementSide;
  /** Oldest first. */
  lines: StatementLine[];
  charged: number;
  paid: number;
  balance: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
/** A stored instant → the local calendar day it fell on. */
const localDay = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Which side a person's statement is written from: whichever way most of their account runs. */
export function statementSide(debts: Pick<StatementDebt, "direction" | "amount">[], preferred?: string): StatementSide {
  if (preferred === "owed_to_me") return "receivable";
  if (preferred === "i_owe") return "payable";
  let mine = 0, theirs = 0;
  for (const d of debts) {
    if (d.direction === "i_owe") theirs += num(d.amount);
    else mine += num(d.amount);
  }
  return theirs > mine ? "payable" : "receivable";
}

function billTitle(d: StatementDebt): { kind: StatementKind; title: string; detail: string } {
  const note = d.notes?.trim() ?? "";
  if (d.sale_id) return { kind: "bill", title: `Bill ${d.bill_number ?? ""}`.trim(), detail: "Sold on credit" };
  if (d.purchase_id) return { kind: "bill", title: `Purchase ${d.bill_number ?? ""}`.trim(), detail: "Bought on credit" };
  if (/\[old-ledger\]/i.test(note) || /opening/i.test(note)) return { kind: "debt", title: "Opening balance", detail: note.replace(/\[old-ledger\]/i, "").trim() };
  return { kind: "debt", title: d.direction === "i_owe" ? "Owed to them" : "Added to account", detail: note };
}

/**
 * Build the statement. `side` defaults to whichever way most of the account
 * runs; pass the list's own direction to keep the screen consistent with it.
 */
export function buildLedgerStatement(
  debts: StatementDebt[],
  payments: StatementPayment[],
  side: StatementSide = statementSide(debts),
): Statement {
  const byId = new Map(debts.map((d) => [d.id, d]));
  // + = they owe the shop more.
  const effect = (dir: string, amount: number, grows: boolean) =>
    (dir === "i_owe" ? -1 : 1) * (grows ? 1 : -1) * amount;
  const flip = side === "receivable" ? 1 : -1;

  type Ev = { sort: string; date: string; line: Omit<StatementLine, "balance"> };
  const evs: Ev[] = [];

  // What each row started at: its amount less the "add more debt" entries,
  // which get their own lines.
  const increases = new Map<string, number>();
  for (const p of payments) {
    if (p.kind === "increase") increases.set(p.debt_id, num(increases.get(p.debt_id)) + num(p.amount));
  }

  for (const d of debts) {
    const start = r2(num(d.amount) - num(increases.get(d.id)));
    if (start <= 0) continue;
    const v = effect(d.direction, start, true) * flip;
    const t = billTitle(d);
    // An advance: they paid more than they owed, so the account turned the
    // other way. Named for what it is rather than "owed to them".
    const title = !d.sale_id && !d.purchase_id && v < 0 && t.kind === "debt" && side === "receivable"
      ? "Paid in advance"
      : !d.sale_id && !d.purchase_id && v < 0 && t.kind === "debt" && side === "payable"
        ? "Advance with them"
        : t.title;
    evs.push({
      sort: `${localDay(d.created_at)}|${d.created_at}|a|${d.id}`,
      date: localDay(d.created_at),
      line: {
        key: `d-${d.id}`,
        date: localDay(d.created_at),
        kind: v < 0 && t.kind === "debt" ? "credit" : t.kind,
        title,
        detail: t.detail,
        charge: v > 0 ? r2(v) : 0,
        paid: v < 0 ? r2(-v) : 0,
        payment_ids: [],
        receipt_id: null,
      },
    });
  }

  // Payments: the parts of one receipt are one line. A credit bill setting
  // off what the shop already owed this person writes a matching pair on both
  // sides (tagged with the bill) — they cancel, so they are left out.
  const groups = new Map<string, StatementPayment[]>();
  for (const p of payments) {
    const d = byId.get(p.debt_id);
    if (!d) continue;
    if (p.kind === "payment" && p.sale_id) continue;
    const key = p.receipt_id && p.kind === "payment" ? `r-${p.receipt_id}` : `p-${p.id}`;
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }
  for (const [key, parts] of groups) {
    const first = parts[0];
    let v = 0;
    let discount = 0;
    for (const p of parts) {
      const d = byId.get(p.debt_id)!;
      if (p.kind === "increase") v += effect(d.direction, num(p.amount), true);
      else {
        v += effect(d.direction, num(p.amount) + num(p.discount), false);
        discount += num(p.discount);
      }
    }
    v = r2(v * flip);
    if (Math.abs(v) < 0.005) continue;
    const bits: string[] = [];
    let title: string;
    let kind: StatementKind;
    if (first.kind === "increase") {
      kind = "debt";
      title = first.cheque_id ? "Cheque bounced" : "More debt added";
      if (first.account_name) bits.push(`via ${first.account_name}`);
    } else if (first.sale_return_id || first.supplier_return_id) {
      kind = "credit";
      title = "Goods returned";
    } else if (first.purchase_id) {
      kind = "credit";
      title = "Settled by goods bought";
    } else {
      kind = "payment";
      title = side === "payable" && v < 0 ? "Paid to them" : side === "receivable" && v < 0 ? "Payment received" : "Payment";
      if (first.cheque_id) bits.push("by cheque");
      else if (first.account_name) bits.push(`via ${first.account_name}`);
      if (discount > 0) bits.push(`includes ${r2(discount).toLocaleString()} discount`);
      if (parts.length > 1) bits.push(`over ${parts.length} bills`);
    }
    const note = first.notes?.trim();
    if (note) bits.push(note);
    evs.push({
      sort: `${first.payment_date}|${first.created_at}|b|${first.id}`,
      date: first.payment_date,
      line: {
        key,
        date: first.payment_date,
        kind,
        title,
        detail: bits.join(" · "),
        charge: v > 0 ? v : 0,
        paid: v < 0 ? -v : 0,
        payment_ids: parts.map((p) => p.id),
        receipt_id: first.receipt_id ?? null,
      },
    });
  }

  evs.sort((a, b) => a.sort.localeCompare(b.sort));
  let running = 0;
  let charged = 0;
  let paid = 0;
  const lines = evs.map((e) => {
    running = r2(running + e.line.charge - e.line.paid);
    charged += e.line.charge;
    paid += e.line.paid;
    return { ...e.line, balance: running };
  });
  return { side, lines, charged: r2(charged), paid: r2(paid), balance: running };
}

/** The balance just before `from` (yyyy-mm-dd), for a date-filtered view. */
export function openingBefore(lines: StatementLine[], from: string): number {
  let bal = 0;
  for (const l of lines) {
    if (l.date >= from) break;
    bal = l.balance;
  }
  return bal;
}

/** How a balance reads on this side of the account. */
export function balanceWords(balance: number, side: StatementSide): string {
  if (Math.abs(balance) < 0.005) return "Settled";
  if (side === "receivable") return balance > 0 ? "They owe you" : "You owe them (advance)";
  return balance > 0 ? "You owe them" : "They owe you (advance)";
}
