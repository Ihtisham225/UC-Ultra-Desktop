import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, FileText, Trash2 } from "lucide-react";
import { rpc } from "@/lib/apiClient";
import { toast } from "sonner";

interface ParsedDebtRow {
  person_name: string;
  phone: string | null;
  amount: number;
  direction: "owed_to_me" | "i_owe";
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

type Dir = "owed_to_me" | "i_owe";
type FieldKey = "person_name" | "phone" | "amount" | "direction";
const NONE = "__none__";

const FIELDS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "person_name", label: "Customer name", required: true },
  { key: "amount", label: "Amount / Balance", required: true },
  { key: "phone", label: "Phone" },
  { key: "direction", label: "Type (get / give)" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const guessMapping = (headers: string[]): Record<FieldKey, string> => {
  const map = {} as Record<FieldKey, string>;
  const aliases: Record<FieldKey, string[]> = {
    person_name: ["name", "customername", "customer", "partyname", "party", "account", "khata"],
    phone: ["phone", "mobile", "phonenumber", "mobilenumber", "contact", "number"],
    amount: ["amount", "balance", "closingbalance", "outstanding", "baqaya", "total"],
    direction: ["type", "direction", "status", "detail", "youllget", "youllgive", "debitcredit"],
  };
  for (const f of FIELDS) {
    const found = headers.find((h) => aliases[f.key].includes(norm(h)));
    if (found) map[f.key] = found;
  }
  return map;
};

const dirFromHint = (v: string, fallback: Dir): Dir => {
  const s = v.toLowerCase();
  if (/(give|dena|dene|payable)/.test(s)) return "i_owe";
  if (/(get|lena|lene|receivable|debit)/.test(s)) return "owed_to_me";
  return fallback;
};

export function ImportDebtsDialog({ open, onClose, onImported }: Props) {
  const [fileName, setFileName] = useState("");
  const [kind, setKind] = useState<"sheet" | "pdf" | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [defaultDir, setDefaultDir] = useState<Dir>("owed_to_me");
  const [preview, setPreview] = useState<ParsedDebtRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const reset = () => {
    setFileName(""); setKind(null); setHeaders([]); setRawRows([]);
    setMapping({} as Record<FieldKey, string>); setDefaultDir("owed_to_me");
    setPreview(null); setBusy(false); setProgress(0);
  };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    try {
      if (isPdf) {
        setKind("pdf"); setBusy(true);
        const buf = await file.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const base64 = btoa(bin);
        const res = await rpc<{ ok: true; rows: ParsedDebtRow[] } | { ok: false; error: string }>(
          "parseDigikhataPdfAction", base64,
        );
        setBusy(false);
        if (res.ok) {
          if (res.rows.length === 0) {
            toast.error("Couldn't read any entries from this PDF. Try a CSV/Excel export instead.");
            return;
          }
          setPreview(res.rows);
        } else {
          toast.error((res as { error: string }).error);
        }
      } else {
        setKind("sheet");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (data.length === 0) { toast.error("File is empty"); return; }
        const hdrs = Object.keys(data[0]);
        setHeaders(hdrs); setRawRows(data); setMapping(guessMapping(hdrs));
      }
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Failed to read file");
    }
  };

  const buildSheetPreview = () => {
    if (!mapping.person_name) return toast.error("Please map the Customer name column");
    if (!mapping.amount) return toast.error("Please map the Amount column");
    const get = (row: Record<string, unknown>, key: FieldKey) => {
      const col = mapping[key];
      if (!col || col === NONE) return "";
      const v = row[col];
      return v == null ? "" : String(v);
    };
    const rows: ParsedDebtRow[] = [];
    for (const r of rawRows) {
      const name = get(r, "person_name").trim();
      const amount = Math.abs(Number(get(r, "amount").replace(/[^\d.-]/g, "")));
      if (!name || !Number.isFinite(amount) || amount <= 0) continue;
      const phone = get(r, "phone").trim() || null;
      const dir = mapping.direction ? dirFromHint(get(r, "direction"), defaultDir) : defaultDir;
      rows.push({ person_name: name.slice(0, 200), phone, amount, direction: dir });
    }
    if (rows.length === 0) return toast.error("No valid rows found. Check your column mapping.");
    setPreview(rows);
  };

  const runImport = async () => {
    if (!preview || preview.length === 0) return;
    setBusy(true); setProgress(30);
    const res = await rpc<{ ok: true; imported: number; skipped: number } | { ok: false; error: string }>(
      "importDebtsAction", preview,
    );
    setProgress(100); setBusy(false);
    if (res.ok) {
      toast.success(`Imported ${res.imported} debt(s)${res.skipped ? `, ${res.skipped} skipped` : ""}`);
      onImported();
      close();
    } else {
      toast.error((res as { error: string }).error);
    }
  };

  const updateRow = (idx: number, patch: Partial<ParsedDebtRow>) =>
    setPreview((p) => (p ? p.map((r, i) => (i === idx ? { ...r, ...patch } : r)) : p));
  const removeRow = (idx: number) => setPreview((p) => (p ? p.filter((_, i) => i !== idx) : p));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from DigiKhata</DialogTitle>
        </DialogHeader>

        {!kind && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Export your khata from DigiKhata as an <b>Excel/CSV</b> or <b>PDF report</b>, then upload it
              here. You&apos;ll review every entry before it&apos;s imported.
            </p>
            <label className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer hover:bg-muted/40">
              <Upload className="size-8 text-muted-foreground" />
              <span className="text-sm font-medium">Click to choose a file</span>
              <span className="text-xs text-muted-foreground">CSV, XLSX, XLS, or PDF</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          </div>
        )}

        {kind === "sheet" && headers.length > 0 && !preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-md p-2">
              <FileSpreadsheet className="size-4 text-primary" />
              <span className="font-medium truncate flex-1">{fileName}</span>
              <span className="text-xs text-muted-foreground">{rawRows.length} rows</span>
            </div>
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
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default type (when not in the file)</Label>
              <Select value={defaultDir} onValueChange={(v) => setDefaultDir(v as Dir)}>
                <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owed_to_me">You&apos;ll get (customer owes you)</SelectItem>
                  <SelectItem value="i_owe">You&apos;ll give (you owe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-md p-2">
              {kind === "pdf" ? <FileText className="size-4 text-primary" /> : <FileSpreadsheet className="size-4 text-primary" />}
              <span className="font-medium truncate flex-1">{fileName}</span>
              <span className="text-xs text-muted-foreground">{preview.length} entries</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Review each entry. Flip the type or remove any row before importing.
            </p>
            <div className="border rounded-lg divide-y max-h-[45vh] overflow-y-auto">
              {preview.map((r, i) => (
                <div key={i} className="flex items-center gap-2 p-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.person_name}</div>
                    <div className="text-xs text-muted-foreground">{r.phone || "no phone"}</div>
                  </div>
                  <div className="tabular-nums font-medium shrink-0">{r.amount.toLocaleString()}</div>
                  <Select value={r.direction} onValueChange={(v) => updateRow(i, { direction: v as Dir })}>
                    <SelectTrigger className="h-8 w-32 text-xs shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owed_to_me">You&apos;ll get</SelectItem>
                      <SelectItem value="i_owe">You&apos;ll give</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive shrink-0" onClick={() => removeRow(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            {busy && <Progress value={progress} />}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
          {kind === "sheet" && !preview && (
            <Button onClick={buildSheetPreview} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
              Preview {rawRows.length} rows
            </Button>
          )}
          {preview && preview.length > 0 && (
            <Button onClick={runImport} disabled={busy} className="bg-gradient-primary hover:opacity-90 text-primary-foreground">
              {busy ? "Importing…" : `Import ${preview.length} debt(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
