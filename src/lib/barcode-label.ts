// COPIED verbatim to the desktop (src/lib/barcode-label.ts) — keep in step.

/**
 * Barcode sticker sizes and the print page for them.
 *
 * Label rolls come in many sizes, and a page that doesn't match the roll is
 * what makes a sticker print across the gap between two labels — every label
 * after the first lands a little further off. So the size is chosen (and
 * remembered on this computer), never assumed.
 */

export interface LabelSize {
  /** Across the roll, in mm. */
  width: number;
  /** Along the roll (one label's length, gap not included), in mm. */
  height: number;
}

export const LABEL_PRESETS: LabelSize[] = [
  { width: 50, height: 30 },
  { width: 50, height: 25 },
  { width: 40, height: 30 },
  { width: 40, height: 25 },
  { width: 40, height: 20 },
  { width: 38, height: 25 },
  { width: 35, height: 25 },
  { width: 30, height: 20 },
  { width: 60, height: 40 },
  { width: 70, height: 50 },
  { width: 100, height: 50 },
];

export const DEFAULT_LABEL: LabelSize = { width: 50, height: 30 };
export const LABEL_STORAGE_KEY = "ucu.labelSize";

const MIN = 15;
const MAX = 150;

export const labelKey = (s: LabelSize) => `${s.width}x${s.height}`;

/** A usable size, or null — anything outside 15–150 mm is a typo. */
export function cleanLabelSize(raw: unknown): LabelSize | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const w = Math.round(Number(r.width) * 10) / 10;
  const h = Math.round(Number(r.height) * 10) / 10;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w < MIN || w > MAX || h < MIN || h > MAX) return null;
  return { width: w, height: h };
}

export function readLabelSize(): LabelSize {
  try {
    const raw = localStorage.getItem(LABEL_STORAGE_KEY);
    return (raw && cleanLabelSize(JSON.parse(raw))) || DEFAULT_LABEL;
  } catch {
    return DEFAULT_LABEL;
  }
}

export function storeLabelSize(s: LabelSize) {
  try { localStorage.setItem(LABEL_STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export const LABEL_ROTATE_KEY = "ucu.labelRotate";

/**
 * The PAGE the printer is sent. Normally the label itself; rotated, it is the
 * label turned on its side (height × width) with the sticker drawn at 90°.
 * Many label-printer drivers describe the roll as a portrait page, and Chrome
 * then turns a landscape page sideways to fit — the barcode comes out running
 * along the roll, across two labels. Rotating lets the shop correct that from
 * the app whatever the driver says.
 */
export function labelPageSize(size: LabelSize, rotate: boolean): LabelSize {
  return rotate ? { width: size.height, height: size.width } : size;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * One page per sticker, the page exactly the label.
 *
 * - Each sticker is a hair (1px) shorter than its page: at 96dpi a mm is not a
 *   whole number of pixels, and a box that rounds up by a fraction spills onto
 *   a new page — the printer then feeds an extra label and every sticker after
 *   it straddles the gap.
 * - No break after the LAST sticker, or the printer feeds one blank label.
 * - The barcode keeps its shape (object-fit: contain) — stretched bars don't scan.
 */
export function buildLabelPrintHtml(opts: {
  imageUrl: string;
  copies: number;
  size: LabelSize;
  /** Printed above the barcode when given (product name). */
  caption?: string | null;
  /** Draw the sticker at 90° on a page turned on its side (see labelPageSize). */
  rotate?: boolean;
}): string {
  const { width: w, height: h } = opts.size;
  const page = labelPageSize(opts.size, !!opts.rotate);
  const copies = Math.max(1, Math.min(500, Math.floor(opts.copies) || 1));
  const caption = opts.caption?.trim() ? `<div class="cap">${esc(opts.caption.trim())}</div>` : "";
  const one = `<div class="sticker"><div class="face">${caption}<div class="code"><img src="${opts.imageUrl}" alt="barcode" /></div></div></div>`;
  const stickers = Array.from({ length: copies }, () => one).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Barcode</title>
<style>
  @page { size: ${page.width}mm ${page.height}mm; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${page.width}mm; background: #fff; }
  body { font-family: Arial, Helvetica, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sticker {
    position: relative; width: ${page.width}mm; height: calc(${page.height}mm - 1px);
    overflow: hidden; break-after: page; page-break-after: always;
  }
  .face {
    position: absolute; top: 50%; left: 50%; width: ${w}mm; height: ${h}mm; padding: 1.5mm 2mm;
    transform: translate(-50%, -50%)${opts.rotate ? " rotate(90deg)" : ""};
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .sticker:last-child { break-after: auto; page-break-after: auto; }
  .cap {
    width: 100%; text-align: center; font-size: ${h < 25 ? 7 : 8}pt; font-weight: 700; line-height: 1.1;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.5mm; color: #000;
  }
  .code { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
  .code img { width: 100%; height: 100%; object-fit: contain; display: block; image-rendering: pixelated; }
</style></head><body>${stickers}
<script>
  (function () {
    var imgs = Array.prototype.slice.call(document.images);
    var left = imgs.filter(function (i) { return !i.complete; }).length;
    function go() { window.print(); }
    if (!left) return go();
    imgs.forEach(function (i) { if (!i.complete) i.onload = i.onerror = function () { if (--left === 0) go(); }; });
  })();
</script>
</body></html>`;
}
