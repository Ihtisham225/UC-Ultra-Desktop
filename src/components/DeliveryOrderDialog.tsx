/**
 * Delivery order (gate pass) for a bill: who is carrying the goods and where
 * to, then the numbered slip to print or send — with or without prices. The
 * goods are the bill's own lines, so nothing is retyped. Earlier delivery
 * orders for the same bill are listed for a reprint.
 *
 * ⚠️ COPIED verbatim to the desktop (minus "use client"); each app passes
 * its own `api`.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Printer, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderSlipDialog } from "@/components/OrderSlipDialog";
import { fmtDateTime } from "@/lib/date-format";
import type { OrderSlipDto, OrderSlipShop } from "@/lib/order-slip";

export interface DeliveryOrderRow {
  id: string;
  number: string;
  vehicle_number: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  deliver_to: string | null;
  notes: string | null;
  created_at: string;
}

export interface DeliveryOrderInput {
  vehicle_number?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  deliver_to?: string | null;
  notes?: string | null;
}

export interface DeliveryOrdersApi {
  list: (saleId: string) => Promise<DeliveryOrderRow[]>;
  create: (saleId: string, input: DeliveryOrderInput) => Promise<{ ok: boolean; error?: string; slip?: OrderSlipDto }>;
  slip: (id: string) => Promise<OrderSlipDto | null>;
}

const BLANK = { vehicle_number: "", driver_name: "", driver_phone: "", deliver_to: "", notes: "" };

export function DeliveryOrderDialog({
  saleId,
  billNumber,
  api,
  shop,
  onClose,
}: {
  /** The bill to deliver; null keeps the dialog closed. */
  saleId: string | null;
  billNumber?: string | null;
  api: DeliveryOrdersApi;
  shop: OrderSlipShop;
  onClose: () => void;
}) {
  const [slip, setSlip] = useState<OrderSlipDto | null>(null);
  return (
    <>
      {/* Keyed by the bill, so each bill's form starts fresh. */}
      {saleId && <DeliveryOrderForm key={saleId} saleId={saleId} billNumber={billNumber} api={api} onClose={onClose} onSlip={setSlip} />}
      <OrderSlipDialog slip={slip} shop={shop} onClose={() => setSlip(null)} />
    </>
  );
}

function DeliveryOrderForm({
  saleId,
  billNumber,
  api,
  onClose,
  onSlip,
}: {
  saleId: string;
  billNumber?: string | null;
  api: DeliveryOrdersApi;
  onClose: () => void;
  onSlip: (s: OrderSlipDto) => void;
}) {
  const [form, setForm] = useState(BLANK);
  const [previous, setPrevious] = useState<DeliveryOrderRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.list(saleId).then((rows) => {
      if (!live) return;
      setPrevious(rows);
      // A second trip for the same bill is usually the same truck.
      const last = rows[0];
      if (last) setForm({ ...BLANK, vehicle_number: last.vehicle_number ?? "", driver_name: last.driver_name ?? "", driver_phone: last.driver_phone ?? "", deliver_to: last.deliver_to ?? "" });
    }).catch(() => { if (live) setPrevious([]); });
    return () => { live = false; };
  }, [saleId, api]);

  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const create = async () => {
    setBusy(true);
    try {
      const res = await api.create(saleId, {
        vehicle_number: form.vehicle_number.trim() || null,
        driver_name: form.driver_name.trim() || null,
        driver_phone: form.driver_phone.trim() || null,
        deliver_to: form.deliver_to.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (!res.ok || !res.slip) return toast.error(res.error ?? "Could not make the delivery order");
      onSlip(res.slip);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not make the delivery order");
    } finally {
      setBusy(false);
    }
  };

  const reprint = async (id: string) => {
    try {
      const s = await api.slip(id);
      if (s) { onSlip(s); onClose(); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open it");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-primary" /> Delivery order{billNumber ? ` — bill ${billNumber}` : ""}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          A pass for whoever carries the goods. It lists this bill&apos;s items; print it with or without prices.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Vehicle number</Label><Input value={form.vehicle_number} onChange={set("vehicle_number")} placeholder="e.g. LES-1234" /></div>
          <div className="space-y-1.5"><Label>Driver name</Label><Input value={form.driver_name} onChange={set("driver_name")} /></div>
          <div className="space-y-1.5"><Label>Driver phone</Label><Input value={form.driver_phone} onChange={set("driver_phone")} inputMode="tel" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Deliver to</Label><Textarea rows={2} value={form.deliver_to} onChange={set("deliver_to")} placeholder="Address / site / city" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Note (optional)</Label><Input value={form.notes} onChange={set("notes")} placeholder="e.g. Handle with care" /></div>
        </div>
        {previous.length > 0 && (
          <div className="rounded-lg border">
            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">Already made for this bill</div>
            <ul className="divide-y">
              {previous.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="font-mono font-semibold">{p.number}</span>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {fmtDateTime(p.created_at)}{p.vehicle_number ? ` · ${p.vehicle_number}` : ""}{p.driver_name ? ` · ${p.driver_name}` : ""}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void reprint(p.id)}><Printer className="size-3.5 mr-1" /> Reprint</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={() => void create()} disabled={busy} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            {busy && <Loader2 className="size-4 mr-1.5 animate-spin" />} Make delivery order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
