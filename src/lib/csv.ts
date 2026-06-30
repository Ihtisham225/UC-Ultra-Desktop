/**
 * Convert a list of plain objects to a CSV string and trigger a download.
 * - `columns` controls the order, header label, and value extraction.
 * - Values containing commas, quotes, or newlines are properly escaped.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escapeCell(c.value(r))).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const csv = rowsToCsv(rows, columns);
  // Prepend BOM so Excel detects UTF-8 (e.g. for Arabic content).
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
