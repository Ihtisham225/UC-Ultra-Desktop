/**
 * How a product is recognised at a glance: a photo, or — for shops that don't
 * photograph their stock — a colour. Pure helpers only (the compressor needs a
 * browser, but no React), so the desktop can copy this file verbatim.
 */

/** Swatches offered in the product form. Distinct at a glance, readable with white text. */
export const PRODUCT_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef",
  "#ec4899", "#78716c", "#334155", "#111827",
] as const;

const HEX = /^#[0-9a-f]{6}$/i;

/** A stored colour, or null when it isn't a plain "#RRGGBB". */
export function normalizeColor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  return HEX.test(v) ? v.toLowerCase() : null;
}

/** Black or white, whichever reads better on `hex`. */
export function textOn(hex: string): "#000000" | "#ffffff" {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Perceived luminance (ITU-R BT.601); the 150 cut keeps mid-tones on white.
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#000000" : "#ffffff";
}

/** Up to two letters from the name: "Coca Cola 1.5L" → "CC", "Sugar" → "SU". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("").toUpperCase();
  return ([...words[0]][0] + [...words[1]][0]).toUpperCase();
}

/** Longest side of an uploaded product photo, in pixels. Twice the largest place it's drawn. */
export const PRODUCT_IMAGE_MAX_SIDE = 480;

/**
 * Shrink a photo for upload: longest side ≤ `maxSide`, re-encoded as WebP
 * (JPEG where the browser can't write WebP). A 4 MB phone photo comes out at
 * roughly 15–40 KB, which matters because the till loads every product's image.
 * Browser only — needs a canvas.
 */
export async function compressProductImage(
  file: Blob,
  maxSide = PRODUCT_IMAGE_MAX_SIDE,
  quality = 0.8,
): Promise<Blob> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't resize images.");
  // A transparent PNG would turn black as JPEG; white matches the cards.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap.source, 0, 0, w, h);
  bitmap.close();

  const webp = await toBlob(canvas, "image/webp", quality);
  // Safari before 17 silently hands back PNG for an unsupported type.
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", quality);
  if (!jpeg) throw new Error("Couldn't compress that image.");
  return jpeg;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

interface Bitmap { source: CanvasImageSource; width: number; height: number; close: () => void }

async function loadBitmap(file: Blob): Promise<Bitmap> {
  if (typeof createImageBitmap === "function") {
    try {
      // Honour the phone's EXIF rotation, or portrait photos arrive sideways.
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: b, width: b.width, height: b.height, close: () => b.close() };
    } catch {
      /* fall through to <img>, which decodes a few formats createImageBitmap won't */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Revoked only once drawn: some browsers re-read the source on drawImage.
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("That file isn't an image this browser can open.");
  }
}

/**
 * Is this one of our own Vercel Blob uploads? The product form only ever saves
 * URLs that came back from the upload action, so anything else is refused —
 * the till would otherwise load whatever address was typed into the payload.
 */
export function isBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/** Largest compressed product photo the server accepts (the form sends ~15–40 KB). */
export const PRODUCT_IMAGE_MAX_BYTES = 1024 * 1024;
