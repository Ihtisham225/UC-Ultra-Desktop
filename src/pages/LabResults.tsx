import { useCallback, useEffect, useMemo, useState } from "react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClipboardCheck, Printer, Search, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { LabReportDialog } from "@/components/LabReportDialog";
import { rpc } from "@/lib/apiClient";
import type { LabOrderDto } from "@/lib/labTypes";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isLabEnabled } from "@/lib/lab";

/** Every completed test, searchable — the shop's result archive. */
export default function LabResultsClient() {
  usePageMeta({ title: "Results — UCU", description: "Completed lab results.", path: "/lab-results" });
  const { currentShop } = useShop();
  const [orders, setOrders] = useState<LabOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [report, setReport] = useState<LabOrderDto | null>(null);

  const load = useCallback(async () => {
    if (!currentShop) return;
    setLoading(true);
    try {
      setOrders(await rpc<LabOrderDto[]>("listLabOrdersAction", "completed"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load results");
    }
    setLoading(false);
  }, [currentShop]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      o.token_number.toLowerCase().includes(q) ||
      o.test_name.toLowerCase().includes(q) ||
      (o.patient_name ?? "").toLowerCase().includes(q) ||
      (o.patient_phone ?? "").includes(q)
    );
  }, [orders, search]);

  if (!isLabEnabled(currentShop)) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Lab tests are turned off. Enable them in Settings → Shop.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="size-7 text-primary" /> Results
        </h1>
        <p className="text-muted-foreground mt-1">Every completed lab test — search and reprint any report.</p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder="Search by token, patient, phone or test"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Token</TableHead>
              <TableHead>Test</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Factors</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="text-end">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No results yet.</TableCell></TableRow>
            ) : filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono font-semibold">{o.token_number}</TableCell>
                <TableCell>{o.test_name}</TableCell>
                <TableCell>
                  {o.patient_name || <span className="text-muted-foreground">—</span>}
                  {o.patient_phone && <div className="text-xs text-muted-foreground">{o.patient_phone}</div>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{o.results.filter((r) => r.value).length}/{o.results.length}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {o.completed_at ? format(new Date(o.completed_at), "MMM d, HH:mm") : "—"}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setReport(o)} title="View report"><Eye className="size-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setReport(o)}><Printer className="size-4 me-1" /> Print</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <LabReportDialog order={report} onClose={() => setReport(null)} />
    </div>
  );
}
