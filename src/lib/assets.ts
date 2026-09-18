/**
 * Fixed assets — the maths of what a thing the shop USES is worth over time.
 *
 * Straight-line depreciation, charged by the DAY: the depreciable amount
 * (cost − salvage value) is spread evenly from the purchase date to the end of
 * its useful life, and stops early if the asset is sold or written off. By the
 * day, not the month, so any date range the reports ask about gets exactly its
 * share — a generator bought on the 20th isn't charged a whole month.
 *
 * Nothing is stored per month: every figure is computed from the asset row, so
 * editing an asset's life or cost re-states its whole history consistently.
 *
 * Pure. A copy of the web app's `src/lib/assets.ts` — keep the two in step.
 */

export interface AssetLike {
  /** yyyy-mm-dd */
  purchase_date: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  status?: string | null;
  /** yyyy-mm-dd — sold or written off on this day. */
  disposed_at?: string | null;
  disposal_amount?: number | null;
}

const DAY = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** A calendar day as a UTC instant, so day counts never slip across DST. */
const day = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The day its useful life ends: purchase date + N months (clamped to month end). */
export function endOfLife(a: Pick<AssetLike, "purchase_date" | "useful_life_months">): string {
  const y = Number(a.purchase_date.slice(0, 4));
  const m = Number(a.purchase_date.slice(5, 7)) - 1 + Math.max(0, Math.round(a.useful_life_months));
  const d = Number(a.purchase_date.slice(8, 10));
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return ymd(Date.UTC(y, m, Math.min(d, last)));
}

export const depreciable = (a: AssetLike) => Math.max(0, a.cost - Math.max(0, a.salvage_value));

/** What it costs the shop each month of its life — the figure people think in. */
export const monthlyDepreciation = (a: AssetLike) =>
  a.useful_life_months > 0 ? round2(depreciable(a) / a.useful_life_months) : 0;

/**
 * Depreciation charged between two days, both inclusive. Nothing before it was
 * bought, nothing after its life ends, and nothing after it left the shop.
 */
export function depreciationBetween(a: AssetLike, from: string, to: string): number {
  const start = day(a.purchase_date);
  const lifeEnd = day(endOfLife(a));
  const total = lifeEnd - start;
  if (total <= 0 || a.useful_life_months <= 0) return 0;
  const stop = a.disposed_at ? Math.min(lifeEnd, day(a.disposed_at)) : lifeEnd;
  // Half-open [start, stop): the disposal day itself is when it stops earning.
  const lo = Math.max(start, day(from));
  const hi = Math.min(stop, day(to) + DAY);
  if (hi <= lo) return 0;
  return round2((depreciable(a) * (hi - lo)) / total);
}

/** Everything charged from the day it was bought up to and including `asOf`. */
export const accumulatedDepreciation = (a: AssetLike, asOf: string) => depreciationBetween(a, a.purchase_date, asOf);

/** What the books say it's worth on a day: cost less what's been charged. */
export const bookValue = (a: AssetLike, asOf: string) => round2(a.cost - accumulatedDepreciation(a, asOf));

/**
 * The profit or loss made getting rid of it: what it fetched against what the
 * books said it was worth that day. A write-off fetches 0, so it's a loss of
 * the whole book value. Null while it's still in use.
 */
export function disposalGain(a: AssetLike): number | null {
  if (!a.disposed_at || (a.status ?? "active") === "active") return null;
  const bookAtDisposal = round2(a.cost - depreciationBetween(a, a.purchase_date, ymd(day(a.disposed_at) - DAY)));
  return round2((a.disposal_amount ?? 0) - bookAtDisposal);
}

/** What the reports need for a range: depreciation charged, and gains/losses on disposals in it. */
export function assetEffectsBetween(assets: AssetLike[], from: string, to: string): { depreciation: number; disposalGain: number } {
  let dep = 0;
  let gain = 0;
  for (const a of assets) {
    dep += depreciationBetween(a, from, to);
    if (a.disposed_at && a.disposed_at >= from && a.disposed_at <= to) gain += disposalGain(a) ?? 0;
  }
  return { depreciation: round2(dep), disposalGain: round2(gain) };
}
