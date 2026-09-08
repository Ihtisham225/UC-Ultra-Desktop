/**
 * Pay periods.
 *
 * A staff member's wage falls due once per period, and the period is theirs —
 * one shop can pay a cleaner daily, a cashier weekly and a manager monthly. So
 * the payroll screen never asks for "a month"; it asks for a DATE, and every
 * row shows the period that contains it.
 *
 * All maths is UTC, because payroll dates are stored as `@db.Date` (UTC
 * midnight). Feeding a local-midnight Date in here would land on the wrong day
 * for anyone west of Greenwich — always go through `dayFromISO`.
 *
 * A copy of the web app's `src/lib/salary-period.ts`, and the two must stay in
 * step: the server decides which payments fall in a period, so a terminal that
 * computed the boundaries differently would show a balance its own payslip
 * contradicts. Change one, change both (`src/test/salary-period.test.ts`
 * pins the behaviour on this side).
 */

export type SalaryPeriod =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "yearly"
  | "custom";

export const SALARY_PERIODS: SalaryPeriod[] = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "half_yearly",
  "yearly",
  "custom",
];

export const SALARY_PERIOD_LABELS: Record<SalaryPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Every 6 months",
  yearly: "Yearly",
  custom: "Custom",
};

/** The wage label for one period, e.g. "Weekly wage". */
export function salaryAmountLabel(period: SalaryPeriod, days?: number | null): string {
  if (period === "custom") return `Wage per ${days && days > 0 ? `${days} days` : "period"}`;
  return `${SALARY_PERIOD_LABELS[period]} wage`;
}

export interface SalaryConfig {
  period: SalaryPeriod;
  /** Length in days when `period` is "custom". Ignored otherwise. */
  periodDays?: number | null;
  /** yyyy-mm-dd the cycle is aligned to. Null = calendar-aligned. */
  anchor?: string | null;
}

export interface PayPeriod {
  /** yyyy-mm-dd, inclusive. */
  start: string;
  /** yyyy-mm-dd, inclusive. */
  end: string;
  /** Whole days covered. */
  days: number;
}

const MS_PER_DAY = 86_400_000;
/** A Monday, so unanchored weekly/biweekly cycles start on a Monday. */
const EPOCH_MONDAY = Date.UTC(1970, 0, 5);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

/** UTC midnight for a yyyy-mm-dd. Throws on anything else — callers validate first. */
export function dayFromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoFromDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today, as the shop's local calendar day, expressed as a UTC-midnight Date. */
export function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Coerce whatever a caller passed as "when" into a yyyy-mm-dd reference day.
 * Accepts a full day, or a yyyy-mm month (older callers, and the desktop's
 * month picker) — a month resolves to its 15th, which sits inside that month's
 * period whichever day of the month the cycle is anchored to.
 */
export function referenceDay(when: string | null | undefined): string {
  if (when && ISO_DAY.test(when)) return when;
  if (when && ISO_MONTH.test(when)) return `${when}-15`;
  return todayISO();
}

function dayNumber(d: Date): number {
  return Math.floor(d.getTime() / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** A date from an absolute month index, with the day clamped to the month's length. */
function fromMonthIndex(monthIndex: number, day: number): Date {
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12;
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

/** Fixed-length periods, in days. `custom` has no fixed length. */
const FIXED_DAYS: Partial<Record<SalaryPeriod, number>> = { daily: 1, weekly: 7, biweekly: 14 };
/** Calendar-length periods, in months. */
const MONTHS: Partial<Record<SalaryPeriod, number>> = {
  monthly: 1,
  quarterly: 3,
  half_yearly: 6,
  yearly: 12,
};

/** How many days a custom period runs — clamped to something a person could mean. */
export function customDays(days: number | null | undefined): number {
  const n = Math.floor(Number(days ?? 0));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 3650);
}

/** The pay period containing `onISO` for a staff member on `config`. */
export function periodFor(config: SalaryConfig, onISO: string): PayPeriod {
  const on = dayFromISO(referenceDay(onISO));
  const anchor = config.anchor && ISO_DAY.test(config.anchor) ? dayFromISO(config.anchor) : null;

  const months = MONTHS[config.period];
  if (months) {
    const anchorDay = anchor ? anchor.getUTCDate() : 1;
    // Month index of the period start. Before the anchor day we are still
    // inside the period that opened last month.
    let m = on.getUTCFullYear() * 12 + on.getUTCMonth();
    const effectiveDay = Math.min(anchorDay, daysInMonth(on.getUTCFullYear(), on.getUTCMonth()));
    if (on.getUTCDate() < effectiveDay) m -= 1;
    if (months > 1) {
      // Periods open on months congruent to the anchor's month, so a quarterly
      // cycle anchored to February runs Feb–Apr, May–Jul, …
      const anchorMonth = anchor ? anchor.getUTCFullYear() * 12 + anchor.getUTCMonth() : 0;
      m -= ((((m - anchorMonth) % months) + months) % months);
    }
    const start = fromMonthIndex(m, anchorDay);
    const end = addDays(fromMonthIndex(m + months, anchorDay), -1);
    return {
      start: isoFromDay(start),
      end: isoFromDay(end),
      days: dayNumber(end) - dayNumber(start) + 1,
    };
  }

  const length = config.period === "custom" ? customDays(config.periodDays) : (FIXED_DAYS[config.period] ?? 1);
  // Blocks are counted forward and backward from the anchor, so a weekly cycle
  // lands on the anchor's weekday and an unanchored one on a Monday.
  const base = anchor ?? new Date(EPOCH_MONDAY);
  const elapsed = dayNumber(on) - dayNumber(base);
  const blocks = Math.floor(elapsed / length);
  const start = addDays(base, blocks * length);
  const end = addDays(start, length - 1);
  return { start: isoFromDay(start), end: isoFromDay(end), days: length };
}

/** The period immediately before/after the one containing `onISO`. */
export function shiftPeriod(config: SalaryConfig, onISO: string, direction: -1 | 1): PayPeriod {
  const current = periodFor(config, onISO);
  const step = direction === -1 ? addDays(dayFromISO(current.start), -1) : addDays(dayFromISO(current.end), 1);
  return periodFor(config, isoFromDay(step));
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDay(iso: string): string {
  const d = dayFromISO(iso);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;
}

/** Human label for a period, kept as short as the period allows. */
export function periodLabel(period: SalaryPeriod, p: PayPeriod): string {
  const start = dayFromISO(p.start);
  const end = dayFromISO(p.end);

  if (p.start === p.end) return `${shortDay(p.start)} ${start.getUTCFullYear()}`;

  if (period === "monthly" && start.getUTCDate() === 1) {
    return `${MONTH_NAMES[start.getUTCMonth()]} ${start.getUTCFullYear()}`;
  }
  if (period === "yearly" && start.getUTCDate() === 1 && start.getUTCMonth() === 0) {
    return String(start.getUTCFullYear());
  }
  if (period === "quarterly" && start.getUTCDate() === 1 && start.getUTCMonth() % 3 === 0) {
    return `Q${start.getUTCMonth() / 3 + 1} ${start.getUTCFullYear()}`;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  return sameYear
    ? `${shortDay(p.start)} – ${shortDay(p.end)} ${end.getUTCFullYear()}`
    : `${shortDay(p.start)} ${start.getUTCFullYear()} – ${shortDay(p.end)} ${end.getUTCFullYear()}`;
}
