import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { rpc } from "@/lib/apiClient";

export interface ExpiryRow {
  id: string;
  product_id: string;
  name: string;
  batch_no: string | null;
  expiry_date: string;
  stock: number;
  shelf_location: string | null;
  days_left: number;
}
import { toast } from "sonner";

/**
 * Pharmacy expiry watchlist: already-expired stock first, then whatever falls
 * inside the selected window, so near-expiry medicine can be returned to the
 * distributor before it becomes worthless.
 */
export function ExpiryReportTable() {
  const [rows, setRows] = useState<ExpiryRow[]>([]);
  const [days, setDays] = useState("90");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    rpc<ExpiryRow[]>("listExpiringStockAction", Number(days))
      .then((r) => { if (alive) setRows(r); })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const expiredCount = rows.filter((r) => r.days_left < 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {expiredCount > 0 && (
            <span className="text-destructive font-medium">{expiredCount} already expired · </span>
          )}
          {rows.length} item{rows.length === 1 ? "" : "s"} needing attention
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Expiring in 30 days</SelectItem>
            <SelectItem value="60">Expiring in 60 days</SelectItem>
            <SelectItem value="90">Expiring in 90 days</SelectItem>
            <SelectItem value="365">Expiring in 1 year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Shelf</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Nothing expiring in this window.</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.batch_no ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.shelf_location ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.expiry_date}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.stock}</TableCell>
                  <TableCell>
                    {r.days_left < 0 ? (
                      <Badge variant="destructive">Expired {Math.abs(r.days_left)}d ago</Badge>
                    ) : r.days_left <= 30 ? (
                      <Badge className="bg-amber-500 hover:bg-amber-500">{r.days_left}d left</Badge>
                    ) : (
                      <Badge variant="secondary">{r.days_left}d left</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
