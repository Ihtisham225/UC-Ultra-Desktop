// Generates a SKU from product name + short random suffix.
// Example: "Coca Cola 500ml" -> "COC-500-A1B2"
export function generateSku(name: string): string {
  const clean = (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const prefix = clean.slice(0, 2).map((w) => w.slice(0, 4)).join("-") || "SKU";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

// Numeric-only barcode (CODE128 supports any, but EAN-like numeric scans best on cameras).
// 12 digits, time-based + random for uniqueness.
export function generateBarcode(): string {
  const ts = Date.now().toString().slice(-9);
  const rand = Math.floor(100 + Math.random() * 900).toString();
  return ts + rand; // 12 digits
}
