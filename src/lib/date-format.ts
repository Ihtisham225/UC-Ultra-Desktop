/**
 * The shop's chosen date and time format — Settings → Shop → "Date & time".
 *
 * One shop writes 30/09/2026, the next 09/30/2026, a third 2026/09/30. Every
 * date the app SHOWS goes through `fmtDate` / `fmtDateTime` / `fmtTime` here,
 * and every date the app ASKS for goes through `<DateInput>`, which reads and
 * writes the same pattern. Storage is untouched: dates still travel as
 * yyyy-MM-dd strings and instants as ISO — this is display only.
 *
 * ⚠️ The preference is module state, set by the ShopProvider as it renders
 * (`setDatePrefs`). That is deliberate: dates are formatted in dozens of
 * helpers that are not components (print HTML, CSV, toasts) and could never
 * call a hook. Changing the setting reloads the page so nothing keeps an old
 * string.
 *
 * ⚠️ PURE and COPIED VERBATIM into the desktop app (`src/lib/date-format.ts`).
 * Change both together.
 */

export type DateFormatId =
  | "dd/MM/yyyy"
  | "MM/dd/yyyy"
  | "yyyy/MM/dd"
  | "dd-MM-yyyy"
  | "MM-dd-yyyy"
  | "yyyy-MM-dd"
  | "dd.MM.yyyy"
  | "dd MMM yyyy"
  | "MMM dd, yyyy";

export type TimeFormatId = "12h" | "24h";

export const DEFAULT_DATE_FORMAT: DateFormatId = "dd/MM/yyyy";
export const DEFAULT_TIME_FORMAT: TimeFormatId = "12h";

export const DATE_FORMATS: { id: DateFormatId; label: string }[] = [
  { id: "dd/MM/yyyy", label: "DD/MM/YYYY" },
  { id: "MM/dd/yyyy", label: "MM/DD/YYYY" },
  { id: "yyyy/MM/dd", label: "YYYY/MM/DD" },
  { id: "dd-MM-yyyy", label: "DD-MM-YYYY" },
  { id: "MM-dd-yyyy", label: "MM-DD-YYYY" },
  { id: "yyyy-MM-dd", label: "YYYY-MM-DD" },
  { id: "dd.MM.yyyy", label: "DD.MM.YYYY" },
  { id: "dd MMM yyyy", label: "DD Mon YYYY" },
  { id: "MMM dd, yyyy", label: "Mon DD, YYYY" },
];

export const TIME_FORMATS: { id: TimeFormatId; label: string }[] = [
  { id: "12h", label: "12-hour (2:30 PM)" },
  { id: "24h", label: "24-hour (14:30)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const isDateFormat = (v: unknown): v is DateFormatId =>
  typeof v === "string" && DATE_FORMATS.some((f) => f.id === v);
export const isTimeFormat = (v: unknown): v is TimeFormatId => v === "12h" || v === "24h";

/** A stored value (possibly null or stale) as a usable format. For server code, which has no provider. */
export const dateFormatOf = (v: unknown): DateFormatId => (isDateFormat(v) ? v : DEFAULT_DATE_FORMAT);
export const timeFormatOf = (v: unknown): TimeFormatId => (isTimeFormat(v) ? v : DEFAULT_TIME_FORMAT);

// --- the current preference -------------------------------------------------

let current: { date: DateFormatId; time: TimeFormatId } = {
  date: DEFAULT_DATE_FORMAT,
  time: DEFAULT_TIME_FORMAT,
};

/** Called by the shop provider with the shop's saved choice (nulls = defaults). */
export function setDatePrefs(date?: string | null, time?: string | null) {
  current = {
    date: isDateFormat(date) ? date : DEFAULT_DATE_FORMAT,
    time: isTimeFormat(time) ? time : DEFAULT_TIME_FORMAT,
  };
}

export const getDatePrefs = () => current;

// --- reading a value --------------------------------------------------------

type DateLike = Date | string | number | null | undefined;

/**
 * The calendar parts of a value, as the shopkeeper means them.
 *
 * ⚠️ A bare "yyyy-MM-dd" is a calendar DAY, not an instant: `new Date("2026-09-30")`
 * is UTC midnight, which reads as the 29th anywhere west of Greenwich. So a
 * day string is split, never parsed. Anything with a time is an instant and
 * shown in the device's own timezone.
 */
function parts(v: DateLike): { y: number; m: number; d: number; h: number; min: number; hasTime: boolean } | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
    if (day) return { y: +day[1], m: +day[2], d: +day[3], h: 0, min: 0, hasTime: false };
  }
  const dt = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    y: dt.getFullYear(),
    m: dt.getMonth() + 1,
    d: dt.getDate(),
    h: dt.getHours(),
    min: dt.getMinutes(),
    hasTime: true,
  };
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function renderDate(p: { y: number; m: number; d: number }, fmt: DateFormatId): string {
  const dd = pad(p.d);
  const MM = pad(p.m);
  const yyyy = pad(p.y, 4);
  const mon = MONTHS[p.m - 1] ?? "";
  switch (fmt) {
    case "dd/MM/yyyy": return `${dd}/${MM}/${yyyy}`;
    case "MM/dd/yyyy": return `${MM}/${dd}/${yyyy}`;
    case "yyyy/MM/dd": return `${yyyy}/${MM}/${dd}`;
    case "dd-MM-yyyy": return `${dd}-${MM}-${yyyy}`;
    case "MM-dd-yyyy": return `${MM}-${dd}-${yyyy}`;
    case "yyyy-MM-dd": return `${yyyy}-${MM}-${dd}`;
    case "dd.MM.yyyy": return `${dd}.${MM}.${yyyy}`;
    case "dd MMM yyyy": return `${dd} ${mon} ${yyyy}`;
    case "MMM dd, yyyy": return `${mon} ${dd}, ${yyyy}`;
  }
}

function renderTime(h: number, min: number, fmt: TimeFormatId): string {
  if (fmt === "24h") return `${pad(h)}:${pad(min)}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(min)} ${h < 12 ? "AM" : "PM"}`;
}

/** "30/09/2026" — a day or an instant, in the shop's date format. "" for nothing. */
export function fmtDate(v: DateLike, fmt: DateFormatId = current.date): string {
  const p = parts(v);
  return p ? renderDate(p, fmt) : "";
}

/** "30/09/2026 2:30 PM". A bare day string has no time, so it prints the date alone. */
export function fmtDateTime(v: DateLike, fmt: DateFormatId = current.date, time: TimeFormatId = current.time): string {
  const p = parts(v);
  if (!p) return "";
  return p.hasTime ? `${renderDate(p, fmt)} ${renderTime(p.h, p.min, time)}` : renderDate(p, fmt);
}

/** "2:30 PM" / "14:30". */
export function fmtTime(v: DateLike, time: TimeFormatId = current.time): string {
  const p = parts(v);
  return p && p.hasTime ? renderTime(p.h, p.min, time) : "";
}

/** "Sep 2026" — month headings. Independent of the chosen order on purpose. */
export function fmtMonth(v: DateLike): string {
  const p = parts(typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : v);
  return p ? `${MONTHS[p.m - 1]} ${p.y}` : "";
}

// --- typing a date ----------------------------------------------------------

/**
 * What `<DateInput>` shows and accepts. Named-month formats are typed with
 * numbers in the same order (nobody types "Sep"), so "dd MMM yyyy" is typed as
 * dd/MM/yyyy and "MMM dd, yyyy" as MM/dd/yyyy.
 */
export function inputPattern(fmt: DateFormatId = current.date): {
  order: ("d" | "m" | "y")[];
  sep: string;
  placeholder: string;
} {
  switch (fmt) {
    case "MM/dd/yyyy": return { order: ["m", "d", "y"], sep: "/", placeholder: "MM/DD/YYYY" };
    case "MMM dd, yyyy": return { order: ["m", "d", "y"], sep: "/", placeholder: "MM/DD/YYYY" };
    case "MM-dd-yyyy": return { order: ["m", "d", "y"], sep: "-", placeholder: "MM-DD-YYYY" };
    case "yyyy/MM/dd": return { order: ["y", "m", "d"], sep: "/", placeholder: "YYYY/MM/DD" };
    case "yyyy-MM-dd": return { order: ["y", "m", "d"], sep: "-", placeholder: "YYYY-MM-DD" };
    case "dd-MM-yyyy": return { order: ["d", "m", "y"], sep: "-", placeholder: "DD-MM-YYYY" };
    case "dd.MM.yyyy": return { order: ["d", "m", "y"], sep: ".", placeholder: "DD.MM.YYYY" };
    default: return { order: ["d", "m", "y"], sep: "/", placeholder: "DD/MM/YYYY" };
  }
}

/** A yyyy-MM-dd day as the input shows it ("" for nothing or nonsense). */
export function isoToInput(iso: string | null | undefined, fmt: DateFormatId = current.date): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  const { order, sep } = inputPattern(fmt);
  const by = { y: m[1], m: m[2], d: m[3] };
  return order.map((k) => by[k]).join(sep);
}

/**
 * Typed text → yyyy-MM-dd, or null while it isn't a whole, real date yet.
 * Accepts any of / - . or space between the parts, and one-digit day/month.
 * A two-digit year is read as 20xx.
 */
export function inputToIso(text: string, fmt: DateFormatId = current.date): string | null {
  const bits = text.trim().split(/[/\-. ]+/).filter(Boolean);
  if (bits.length !== 3 || bits.some((b) => !/^\d+$/.test(b))) return null;
  const { order } = inputPattern(fmt);
  const by: Record<string, string> = {};
  order.forEach((k, i) => (by[k] = bits[i]));
  let y = Number(by.y);
  if (by.y.length === 2) y += 2000;
  else if (by.y.length !== 4) return null;
  const m = Number(by.m);
  const d = Number(by.d);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1) return null; // 31/02 and friends
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

/**
 * Put separators in as the digits arrive, so "30092026" reads "30/09/2026".
 * Only acts on pure digits — once someone types a separator themselves, their
 * text is left alone.
 */
export function autoSeparate(text: string, fmt: DateFormatId = current.date): string {
  if (!/^\d*$/.test(text)) return text;
  const { order, sep } = inputPattern(fmt);
  const widths = order.map((k) => (k === "y" ? 4 : 2));
  const out: string[] = [];
  let i = 0;
  for (const w of widths) {
    if (i >= text.length) break;
    out.push(text.slice(i, i + w));
    i += w;
  }
  let joined = out.join(sep);
  // Typing the last digit of a part adds the separator, so the next digit lands in the next part.
  if (out.length < widths.length && out.length > 0 && out[out.length - 1].length === widths[out.length - 1]) {
    joined += sep;
  }
  return joined;
}
