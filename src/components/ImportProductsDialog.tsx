import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet } from "lucide-react";
import { upsertLocal, notifyChange } from "@/lib/localDb";
import { generateSku, generateBarcode } from "@/lib/sku";
import { v4 as uuid } from "uuid";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  shopId: string;
  onImported: () => void;
}

type FieldKey = "name" | "sku" | "barcode" | "category" | "price" | "stock" | "low_stock_threshold" | "unit";

const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "price", label: "Selling Price", required: true },
  { key: "sku", label: "SKU" },
  { key: "barcode", label: "Barcode" },
  { key: "category", label: "Category" },
  { key: "stock", label: "Stock" },
  { key: "low_stock_threshold", label: "Low Stock At" },
  { key: "unit", label: "Unit" },
];

const NONE = "__none__";

const guessMapping = (headers: string[]): Record<FieldKey, string> => {
  const map = {} as Record<FieldKey, string>;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<FieldKey, string[]> = {
    name: ["name", "productname", "title", "product"],
    sku: ["sku", "code", "itemcode"],
    barcode: ["barcode", "ean", "upc"],
    category: ["category", "type"],
    price: ["price", "sellingprice", "saleprice", "rate"],
    stock: ["stock", "quantity", "qty", "instock"],
    low_stock_threshold: ["lowstockat", "lowstock", "threshold", "minstock"],
    unit: ["unit", "uom"],
  };
  for (const f of FIELDS) {
    const found = headers.find((h) => aliases[f.key].includes(norm(h)));
    if (found) map[f.key] = found;
  }
  return map;
};

export function ImportProductsDialog({ open, onClose, shopId, onImported }: Props) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({} as Record<FieldKey, string>);
    setFileName(""); setImporting(false); setProgress(0);
  };

  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (data.length === 0) { toast.error("File is empty"); return; }
      const hdrs = Object.keys(data[0]);
      setHeaders(hdrs);
      setRows(data);
      setMapping(guessMapping(hdrs));
    } catch (e: any) {
      toast.error(e.message || "Failed to parse file");
    }
  };

  const runImport = async () => {
    if (!mapping.name) return toast.error("Please map the Name field");
    if (!mapping.price) return toast.error("Please map the Selling Price field");

    setImporting(true);
    let ok = 0, fail = 0;
    const get = (row: Record<string, any>, key: FieldKey) => {
      const col = mapping[key];
      if (!col || col === NONE) return undefined;
      const v = row[col];
      return v === "" || v === null || v === undefined ? undefined : v;
    };

    // Write to the offline sync store (like the Products screen) — queued for
    // background push, so imports work with no connection too.
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = String(get(r, "name") ?? "").trim();
      if (!name) { fail++; continue; }
      const priceRaw = get(r, "price");
      const price = Number(priceRaw);
      if (Number.isNaN(price)) { fail++; continue; }

      const now = new Date().toISOString();
      const payload = {
        id: uuid(),
        shop_id: shopId,
        name,
        sku: String(get(r, "sku") ?? "").trim() || generateSku(name),
        barcode: String(get(r, "barcode") ?? "").trim() || generateBarcode(),
        category: get(r, "category") ? String(get(r, "category")).trim() : null,
        price,
        stock: Number(get(r, "stock") ?? 0) || 0,
        low_stock_threshold: Number(get(r, "low_stock_threshold") ?? 5) || 5,
        unit: String(get(r, "unit") ?? "pcs").trim() || "pcs",
        is_active: true,
        created_at: now,
        updated_at: now,
      };
      try {
        await upsertLocal("products", payload, true);
        ok++;
      } catch {
        fail++;
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    if (ok > 0) notifyChange("products");

    setImporting(false);
    toast.success(`Imported ${ok} product(s)${fail ? `, ${fail} failed` : ""}`);
    onImported();
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Products</DialogTitle>
        </DialogHeader>

        {headers.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file (.csv, .xlsx, .xls). The first row should be column headers.
            </p>
            <label className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/40">
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to choose a file</span>
              <span className="text-xs text-muted-foreground">CSV, XLSX, or XLS</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-md p-2">
              <FileSpreadsheet className="size-4 text-primary" />
              <span className="font-medium truncate flex-1">{fileName}</span>
              <span className="text-xs text-muted-foreground">{rows.length} rows</span>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Map columns</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">
                      {f.label}{f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    <Select
                      value={mapping[f.key] || NONE}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v === NONE ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="— Skip —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— Skip —</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {importing && <Progress value={progress} />}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={importing}>Cancel</Button>
          {headers.length > 0 && (
            <Button
              onClick={runImport}
              disabled={importing}
              className="bg-gradient-primary hover:opacity-90 text-primary-foreground"
            >
              {importing ? `Importing… ${progress}%` : `Import ${rows.length} products`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
