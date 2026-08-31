import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { AttachmentsField, uploadPendingAttachments } from "@/components/AttachmentsField";
import { rpc } from "@/lib/apiClient";
import type { JobProcessDto, ReceiptDraft, ReceiptDto } from "@/lib/handicraftTypes";

type ChargeDraft = {
  process_id: string | null;
  process_name: string;
  rate: string;
  quantity: string;
  /** Typed over by hand, so the received quantity stops driving it. */
  quantityEdited: boolean;
};

type LineDraft = {
  challan_item_id: string;
  description: string;
  sent: number;
  pending: number;
  received: string;
  short: string;
  damaged: string;
  /** Making bills weigh what came back and pay per piece. */
  per_piece_weight: string;
  note: string;
  charges: ChargeDraft[];
};

const num = (s: string) => (s.trim() === "" ? 0 : Number(s)) || 0;

/**
 * The bill written when goods come back: what arrived, what the factory lost
 * or spoiled, and what they're charging for the work. Lines and pending
 * quantities come from the challan it's raised against.
 */
export function ReceiveGoodsDialog({
  challanId,
  receipt,
  processes,
  currency,
  onClose,
  onSaved,
}: {
  challanId: string | null;
  receipt?: ReceiptDto | null;
  processes: JobProcessDto[];
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const formatMoney = useFormatMoney();
  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [date, setDate] = useState("");
  const [bookNumber, setBookNumber] = useState("");
  const [receivedVia, setReceivedVia] = useState("");
  const [notes, setNotes] = useState("");
  const [deduction, setDeduction] = useState("0");
  const [paidNow, setPaidNow] = useState("0");
  const [rememberRates, setRememberRates] = useState(true);
  /** Making only: this bill finishes the job, since nothing subtracts. */
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  const processName = useCallback(
    (id: string) => processes.find((p) => p.id === id)?.name ?? "Work",
    [processes],
  );

  useEffect(() => {
    if (!challanId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const d = await rpc<ReceiptDraft | null>("loadReceiptDraftAction", challanId, receipt?.id ?? null);
        if (cancelled || !d) return;
        setDraft(d);

        const existingByItem = new Map((receipt?.items ?? []).map((it) => [it.challan_item_id, it]));
        setLines(
          d.lines.map((l) => {
            const prev = existingByItem.get(l.challan_item_id);
            const received = prev ? String(prev.received_qty) : String(l.pending || "");
            const charges: ChargeDraft[] = prev
              ? prev.charges.map((c) => ({
                  process_id: c.process_id,
                  process_name: c.process_name,
                  rate: String(c.rate),
                  quantity: String(c.quantity),
                  quantityEdited: true,
                }))
              : d.challan.kind === "making"
                ? // Making is paid per piece, not per process — one rate line.
                  // Making is paid per piece of finished goods, agreed when
                  // they come back rather than when the material went out.
                  [{ process_id: null, process_name: "Making", rate: "", quantity: received, quantityEdited: false }]
                : l.process_ids.map((pid) => ({
                    process_id: pid,
                    process_name: processName(pid),
                    rate: String(d.rates[pid] ?? 0),
                    quantity: received,
                    quantityEdited: false,
                  }));
            return {
              challan_item_id: l.challan_item_id,
              description: prev?.description ?? l.description,
              sent: l.sent,
              // Editing: this bill's own pieces are available to it again.
              pending: l.pending,
              received,
              short: prev ? String(prev.short_qty || "") : "",
              damaged: prev ? String(prev.damaged_qty || "") : "",
              // Deliberately not inherited from the challan: that figure is the
              // weight of a box of raw material, this is the weight of one
              // finished piece.
              per_piece_weight: prev?.per_piece_weight != null ? String(prev.per_piece_weight) : "",
              note: prev?.note ?? "",
              charges,
            };
          }),
        );

        setDate(receipt?.date ?? d.challan.date);
        setBookNumber(receipt?.book_number ?? "");
        setReceivedVia(receipt?.received_via ?? "");
        setNotes(receipt?.notes ?? "");
        setDeduction(String(receipt?.deduction ?? 0));
        setPaidNow(String(receipt?.paid_now ?? 0));
        setPendingPhotos([]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to open the challan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [challanId, receipt, processName]);

  // Drop the loaded challan when the dialog closes, so reopening it on another
  // challan never flashes the previous one's lines.
  useEffect(() => {
    if (!challanId) {
      setDraft(null);
      setLines([]);
    }
  }, [challanId]);

  const setLine = (index: number, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...patch };
        // Charges are billed on what actually came back, until someone says
        // otherwise on a particular row.
        if (patch.received !== undefined) {
          next.charges = next.charges.map((c) =>
            c.quantityEdited ? c : { ...c, quantity: patch.received as string },
          );
        }
        return next;
      }),
    );
  };

  const setCharge = (lineIndex: number, chargeIndex: number, patch: Partial<ChargeDraft>) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i !== lineIndex
          ? l
          : {
              ...l,
              charges: l.charges.map((c, x) =>
                x !== chargeIndex
                  ? c
                  : { ...c, ...patch, quantityEdited: patch.quantity !== undefined ? true : c.quantityEdited },
              ),
            },
      ),
    );
  };

  const addCharge = (lineIndex: number) => {
    const spare = processes.find(
      (p) => !lines[lineIndex].charges.some((c) => c.process_id === p.id),
    );
    if (!spare) return toast.error("Every process is already on this line.");
    setLines((prev) =>
      prev.map((l, i) =>
        i !== lineIndex
          ? l
          : {
              ...l,
              charges: [
                ...l.charges,
                {
                  process_id: spare.id,
                  process_name: spare.name,
                  rate: String(draft?.rates[spare.id] ?? spare.default_rate),
                  quantity: l.received,
                  quantityEdited: false,
                },
              ],
            },
      ),
    );
  };

  const making = draft?.challan.kind === "making";
  const lineTotal = (l: LineDraft) => l.charges.reduce((s, c) => s + num(c.rate) * num(c.quantity), 0);
  const lineWeight = (l: LineDraft) => num(l.received) * num(l.per_piece_weight);
  const chargesTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const total = chargesTotal - num(deduction);
  const shortPieces = lines.reduce((s, l) => s + num(l.short) + num(l.damaged), 0);
  const billWeight = lines.reduce((s, l) => s + lineWeight(l), 0);
  const stillOut = Math.max(
    0,
    (draft?.challan.sent_weight ?? 0) - (draft?.challan.received_weight ?? 0) - billWeight,
  );

  const save = async () => {
    if (!draft) return;
    const touched = lines.filter((l) => num(l.received) + num(l.short) + num(l.damaged) > 0);
    if (touched.length === 0) return toast.error("Enter what came back on at least one line.");

    setBusy(true);
    const result = await rpc<{ ok: boolean; error?: string; id?: string; number?: number }>(
      "saveReceiptAction",
      receipt?.id ?? null,
      {
      challan_id: draft.challan.id,
      date,
      book_number: bookNumber || null,
      received_via: receivedVia || null,
      notes: notes || null,
      deduction: num(deduction),
      paid_now: num(paidNow),
      remember_rates: rememberRates,
      items: touched.map((l) => ({
        challan_item_id: l.challan_item_id,
        description: l.description,
        received_qty: num(l.received),
        short_qty: num(l.short),
        damaged_qty: num(l.damaged),
        per_piece_weight: l.per_piece_weight === "" ? null : num(l.per_piece_weight),
        note: l.note || null,
        charges: l.charges
          .filter((c) => num(c.quantity) > 0)
          .map((c) => ({
            process_id: c.process_id,
            process_name: c.process_name,
            rate: num(c.rate),
            quantity: num(c.quantity),
            amount: Number((num(c.rate) * num(c.quantity)).toFixed(2)),
          })),
      })),
      },
    );
    if (result.ok && pendingPhotos.length > 0) {
      try {
        await uploadPendingAttachments("job_work_receipt", result.id, pendingPhotos);
      } catch (e) {
        // The bill is saved regardless; only the photos failed.
        toast.error(e instanceof Error ? e.message : "Photos could not be attached");
      }
    }
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "Failed");
    toast.success(receipt ? "Bill updated" : `Bill #${result.number} saved`);
    setPendingPhotos([]);
    onSaved();
  };

  return (
    <Dialog open={!!challanId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {receipt ? `Edit bill #${receipt.number}` : "Goods received"}
            {draft && (
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                {draft.challan.supplier_name} · challan #{draft.challan.number}
                {draft.challan.book_number ? ` (book ${draft.challan.book_number})` : ""}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading || !draft ? (
          <div className="py-12 text-center text-muted-foreground">Loading the challan…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Book no.</Label>
                <Input value={bookNumber} onChange={(e) => setBookNumber(e.target.value)} placeholder="Number on the paper bill" />
              </div>
              <div className="space-y-1.5">
                <Label>Received via</Label>
                <Input value={receivedVia} onChange={(e) => setReceivedVia(e.target.value)} placeholder="بذریعہ" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((l, i) => {
                const claimed = num(l.received) + num(l.short) + num(l.damaged);
                // Only meaningful when both sides are pieces.
                const over = !making && claimed > l.pending + 0.0001;
                return (
                  <div key={l.challan_item_id} className={`rounded-lg border p-3 space-y-3 ${over ? "border-destructive" : ""}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-medium">{l.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {making ? (
                          <>sent {l.sent} boxes{l.per_piece_weight ? ` · ${l.per_piece_weight} per box` : ""}</>
                        ) : (
                          <>sent {l.sent} · still at the company <b>{l.pending}</b></>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">{making ? "Pieces received" : "Received"}</Label>
                        <Input className="h-8" type="number" step="0.01" value={l.received} onChange={(e) => setLine(i, { received: e.target.value })} />
                      </div>
                      {!making && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">Short</Label>
                            <Input className="h-8" type="number" step="0.01" value={l.short} onChange={(e) => setLine(i, { short: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Damaged</Label>
                            <Input className="h-8" type="number" step="0.01" value={l.damaged} onChange={(e) => setLine(i, { damaged: e.target.value })} />
                          </div>
                        </>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Note</Label>
                        <Input className="h-8" value={l.note} onChange={(e) => setLine(i, { note: e.target.value })} placeholder={making ? "Anything to note" : "Why short?"} />
                      </div>
                    </div>

                    {making && (
                      <div className="grid gap-2 sm:grid-cols-4">
                        <div className="space-y-1">
                          <Label className="text-xs">Weight / piece</Label>
                          <Input
                            className="h-8"
                            type="number"
                            step="0.001"
                            value={l.per_piece_weight}
                            onChange={(e) => setLine(i, { per_piece_weight: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Total weight</Label>
                          <Input className="h-8 bg-muted/40" readOnly value={lineWeight(l) ? String(Number(lineWeight(l).toFixed(3))) : ""} />
                        </div>
                      </div>
                    )}

                    {over && !making && (
                      <p className="text-xs text-destructive">
                        Only {l.pending} left at the company on this line, but {claimed} is entered.
                      </p>
                    )}

                    <div className="rounded-md bg-muted/30 p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          {making ? "Making charge" : "Work charged"}
                        </span>
                        {!making && (
                          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => addCharge(i)}>
                            Add work
                          </Button>
                        )}
                      </div>
                      {l.charges.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-1">
                          No work was ticked for this line on the challan. Add it here if they charged for some.
                        </p>
                      ) : (
                        l.charges.map((c, x) => (
                          <div key={`${c.process_id ?? c.process_name}-${x}`} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="min-w-32 flex-1">{c.process_name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">rate</span>
                              <Input className="h-7 w-20" type="number" step="0.01" value={c.rate} onChange={(e) => setCharge(i, x, { rate: e.target.value })} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">×</span>
                              <Input className="h-7 w-20" type="number" step="0.01" value={c.quantity} onChange={(e) => setCharge(i, x, { quantity: e.target.value })} />
                            </div>
                            <span className="w-28 text-end font-medium">
                              {formatMoney(num(c.rate) * num(c.quantity), currency)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-destructive"
                              onClick={() =>
                                setLines((prev) =>
                                  prev.map((line, li) =>
                                    li !== i ? line : { ...line, charges: line.charges.filter((_, ci) => ci !== x) },
                                  ),
                                )
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      )}
                      <div className="flex justify-between border-t pt-1.5 text-sm">
                        <span className="text-muted-foreground">Line total</span>
                        <span className="font-semibold">{formatMoney(lineTotal(l), currency)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {making && draft.challan.sent_weight > 0 && (
              <div className="rounded-lg border p-3 space-y-1.5 bg-muted/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Weight sent out</span>
                  <span className="font-medium">{Number(draft.challan.sent_weight.toFixed(3))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Back {draft.challan.received_weight > 0 ? "(earlier bills + this one)" : "on this bill"}
                  </span>
                  <span className="font-medium">
                    {Number((draft.challan.received_weight + billWeight).toFixed(3))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm border-t pt-1.5">
                  <span className="text-muted-foreground">Still with the maker</span>
                  <span className={`font-semibold ${stillOut > 0 ? "text-primary" : "text-success"}`}>
                    {Number(stillOut.toFixed(3))}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Weight of one finished piece × what came back. The challan finishes on its own once
                  the weight is back; close it by hand from the list if some is lost in the making.
                </p>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Charges</span>
                <span className="font-medium">{formatMoney(chargesTotal, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm">Deduction</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Withheld for pieces they lost or spoiled{!making && shortPieces > 0 ? ` — ${shortPieces} on this bill` : ""}.
                  </p>
                </div>
                <Input className="h-8 w-32 text-end" type="number" step="0.01" value={deduction} onChange={(e) => setDeduction(e.target.value)} />
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm text-muted-foreground">Bill total</span>
                <span className="text-xl font-bold">{formatMoney(total, currency)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-2">
                <div>
                  <Label className="text-sm">Paid now <span className="text-muted-foreground" dir="rtl">وصول رقم</span></Label>
                  <p className="text-[11px] text-muted-foreground">
                    Money handed over as the bill was settled. It goes on their khata as a payment.
                  </p>
                </div>
                <Input className="h-8 w-32 text-end" type="number" step="0.01" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Left on this bill <span dir="rtl">بقایہ رقم</span></span>
                <span className="font-semibold">{formatMoney(total - num(paidNow), currency)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Added to what you owe {draft.challan.supplier_name}, and shown in the register.
              </p>
            </div>

            {/* Making is one rate per piece agreed on the bill; there are no
                per-process rates to remember. */}
            {!making && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={rememberRates} onCheckedChange={(v) => setRememberRates(!!v)} />
                Remember these rates for {draft.challan.supplier_name}
              </label>
            )}

            <div className="border-t pt-3">
              <AttachmentsField
                entityType="job_work_receipt"
                entityId={receipt?.id ?? null}
                canEdit
                pending={pendingPhotos}
                onPendingChange={setPendingPhotos}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || loading} onClick={save} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
            Save bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
