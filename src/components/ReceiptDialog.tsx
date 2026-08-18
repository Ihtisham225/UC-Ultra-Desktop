import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, MessageCircle, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { rpc } from "@/lib/apiClient";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useShop } from "@/contexts/ShopContext";
import { termsToPrintHtml } from "@/lib/rich-text";
import { printThermalHtml } from "@/lib/printThermal";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const withLineBreaks = (value?: string | null) => escapeHtml(value ?? "").replace(/\n/g, "<br />");

const buildReceiptPrintHtml = ({ sale, customer, currency, withTerms }: { sale: any; customer: { name: string; phone: string | null } | null; currency: string; withTerms: boolean }) => {
  const showCustomer = sale.shop?.show_customer_on_receipt === true;
  const showImei = sale.shop?.show_imei_on_receipt === true;
  // Patient details always print on a lab sale — they identify whose sample it
  // is, which is not the same kind of optional nicety as the customer name.
  const labOrders: any[] = sale.lab_orders ?? [];
  const metaRows = [
    { label: "Receipt", value: sale.receipt_number ?? "" },
    { label: "Date", value: format(new Date(sale.created_at), "Pp") },
    ...(showCustomer && customer ? [{ label: "Customer", value: customer.name }] : []),
    ...(showCustomer && customer?.phone ? [{ label: "Phone", value: customer.phone }] : []),
    ...(sale.patient_name ? [{ label: "Patient", value: String(sale.patient_name) }] : []),
    ...(sale.patient_age || sale.patient_gender
      ? [{ label: "Age / Sex", value: [sale.patient_age, sale.patient_gender].filter(Boolean).join(" / ") }]
      : []),
    ...(sale.patient_phone ? [{ label: "Phone", value: String(sale.patient_phone) }] : []),
  ];

  const labHtml = labOrders.length > 0
    ? `<div class="rule"></div>
       <div class="center small">LAB TOKEN${labOrders.length > 1 ? "S" : ""}</div>
       ${labOrders
         .map((o) => `<div class="row"><span>${escapeHtml(String(o.test_name ?? ""))}</span><span class="value">${escapeHtml(String(o.token_number ?? ""))}</span></div>`)
         .join("")}`
    : "";

  const itemsHtml = sale.items
    .map((item: any) => {
      const imeis = showImei
        ? [item.imei1, item.imei2].filter(Boolean).map((v: string) => `<div class="row small"><span>IMEI</span><span class="value">${escapeHtml(v)}</span></div>`).join("")
        : "";
      return `
        <div class="item">
          <div class="item-name">${escapeHtml(item.product_name ?? "")}</div>
          <div class="row small">
            <span>${escapeHtml(String(item.quantity))} x ${escapeHtml(formatMoney(item.unit_price, currency))}</span>
            <span class="value">${escapeHtml(formatMoney(item.line_total, currency))}</span>
          </div>
          ${imeis}
        </div>`;
    })
    .join("");

  const summaryRows = [
    `<div class="row"><span>Subtotal</span><span class="value">${escapeHtml(formatMoney(sale.subtotal, currency))}</span></div>`,
    Number(sale.discount) > 0
      ? `<div class="row"><span>Discount</span><span class="value">-${escapeHtml(formatMoney(sale.discount, currency))}</span></div>`
      : "",
    Number(sale.tax) > 0 && sale.shop?.show_tax_line !== false
      ? `<div class="row"><span>Tax</span><span class="value">${escapeHtml(formatMoney(sale.tax, currency))}</span></div>`
      : "",
    `<div class="total-row"><span>TOTAL</span><span class="value">${escapeHtml(formatMoney(sale.total, currency))}</span></div>`,
    // One line per tender, so the slip shows 300 cash + 500 wallet rather than
    // collapsing a split payment into whichever method happened to be biggest.
    ...((sale.payments ?? []).length > 0
      ? (sale.payments as Array<{ account_name: string; amount: number }>).map(
          (p) => `<div class="row small"><span>Paid (${escapeHtml(p.account_name)})</span><span class="value">${escapeHtml(formatMoney(p.amount, currency))}</span></div>`,
        )
      : [`<div class="row small"><span>Paid (${escapeHtml(sale.payment_method ?? "")})</span><span class="value">${escapeHtml(formatMoney(sale.amount_paid, currency))}</span></div>`]),
    Number(sale.change_due) > 0
      ? `<div class="row small"><span>Change</span><span class="value">${escapeHtml(formatMoney(sale.change_due, currency))}</span></div>`
      : "",
    // Only shown when something is actually outstanding.
    Number(sale.balance_due ?? 0) > 0
      ? `<div class="total-row" style="font-size:14px;"><span>BALANCE DUE</span><span class="value">${escapeHtml(formatMoney(sale.balance_due, currency))}</span></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Receipt ${escapeHtml(sale.receipt_number ?? "")}</title>
      <style>
        @page { margin: 0; }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #ffffff;
          color: #000000;
          /* Courier's thin strokes print faint on a thermal head. Arial's real
             bold face prints dark and stays crisp — unlike a synthetic
             double-strike, which just smudges. */
          font-family: Arial, Helvetica, "Segoe UI", sans-serif;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        body {
          /* The page the driver hands us is the full 80mm roll, but an 80mm
             head only prints 576 dots = 72mm of it, leaving ~3.75mm dead on
             each side. Anything drawn out there is physically cut off, so cap
             the slip at that 72mm print window rather than the paper width.
             A 100% width keeps it correct on a 58mm roll too, where the page
             is already narrower than the cap. */
          width: 100%;
          max-width: 72mm;
          margin: 0 auto;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt {
          width: 100%;
          /* Side padding keeps text off both edges, and buys a few mm of slack
             for heads whose print window is a shade narrower than nominal. */
          padding: 4mm 3mm 6mm;
          font-size: 13px;
          line-height: 1.45;
        }
        .center { text-align: center; }
        .title {
          font-size: 18px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .small { font-size: 12px; }
        .note {
          white-space: pre-line;
          word-break: break-word;
        }
        .rule {
          border-top: 1px solid #000000;
          margin: 7px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
        }
        .row > :first-child {
          flex: 0 0 auto;
        }
        .row > .value {
          flex: 1 1 auto;
          min-width: 0;
          text-align: right;
          word-break: break-word;
        }
        .item {
          margin-bottom: 6px;
          /* Item lines print in Arial Regular so the bold header, totals and
             footer stand out against them. Arial ships Regular and Bold only,
             so this is the smallest real step down that exists — a 500 or 600
             would just snap back to Bold. */
          font-weight: 400;
        }
        .item-name {
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
          margin-bottom: 2px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          border-top: 2px solid #000000;
          margin-top: 5px;
          padding-top: 5px;
        }
        .value {
          text-align: right;
        }
        /* Terms can run several lines, so print them lighter and tighter than
           the body — they are reference text, not the transaction. */
        .terms {
          font-size: 11px;
          font-weight: 400;
          line-height: 1.35;
          word-break: break-word;
        }
        .terms ul, .terms ol { margin: 2px 0; padding-inline-start: 4mm; }
        .terms li { margin: 0; }
        .terms p { margin: 0 0 2px; }
      </style>
    </head>
    <body>
      <div class="receipt" dir="ltr">
        <div class="center">
          <div class="title">${escapeHtml(sale.shop?.name ?? "")}</div>
          ${sale.shop?.address ? `<div class="small note">${withLineBreaks(sale.shop.address)}</div>` : ""}
          ${sale.shop?.phone ? `<div class="small">${escapeHtml(sale.shop.phone)}</div>` : ""}
          ${sale.shop?.receipt_header ? `<div class="small note" style="margin-top:4px;">${withLineBreaks(sale.shop.receipt_header)}</div>` : ""}
        </div>

        <div class="rule"></div>

        <div class="small">
          ${metaRows
            .map(
              (row) => `<div class="row"><span>${escapeHtml(row.label)}</span><span class="value">${escapeHtml(row.value)}</span></div>`
            )
            .join("")}
        </div>

        ${labHtml}

        <div class="rule"></div>

        <div>${itemsHtml}</div>

        <div class="rule"></div>

        <div>${summaryRows}</div>

        ${sale.shop?.receipt_footer ? `<div class="rule"></div><div class="center small note">${withLineBreaks(sale.shop.receipt_footer)}</div>` : ""}

        ${withTerms && sale.shop?.receipt_terms ? `<div class="rule"></div><div class="terms">${termsToPrintHtml(sale.shop.receipt_terms)}</div>` : ""}

        <div class="center small" style="margin-top:8px;">** Thank you **</div>
      </div>
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.focus();
            window.print();
          }, 150);
        };
      </script>
    </body>
  </html>`;
};

export const ReceiptDialog = ({ sale, onClose }: { sale: any; onClose: () => void }) => {
  const cur = sale.shop?.currency ?? "USD";
  const { currentShop } = useShop();
  const isPro = !!currentShop?.is_pro && (!currentShop?.pro_until || new Date(currentShop.pro_until) > new Date());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; phone: string | null } | null>(
    sale.customer ?? null
  );
  const terms: string = sale.shop?.receipt_terms ?? "";
  // Shop-wide default, overridable per print from the toggle below the paper.
  const [withTerms, setWithTerms] = useState(sale.shop?.print_terms_by_default !== false);

  useEffect(() => {
    if (sale.customer || !sale.customer_id) return;
    rpc<{ name: string; phone: string | null } | null>("getCustomerLiteAction", sale.customer_id)
      .then((data) => data && setCustomer(data))
      .catch(() => { /* ignore — receipt still prints without the name */ });
  }, [sale.customer, sale.customer_id]);

  const print = () => {
    void printThermalHtml(buildReceiptPrintHtml({ sale, customer, currency: cur, withTerms }))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not print"));
  };

  const sendWhatsApp = async () => {
    if (!customer?.phone) return toast.error("Customer has no phone number");
    setSending(true);
    try {
      const res = await rpc<{ ok: boolean; error?: string }>("sendWhatsAppReceiptAction", sale.id);
      if (!res.ok) return toast.error(res.error ?? "Failed to send");
      setSent(true);
      toast.success("Receipt sent on WhatsApp");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // Solid rules print crisper than dashed on a thermal head; the preview
  // mirrors the printed slip so what the cashier sees is what comes out.
  const dashed = "border-t border-black my-2";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      {/* Column layout: only the paper scrolls, so Print/WhatsApp/New sale stay
          on screen no matter how many lines the sale has or how short the
          laptop screen is. */}
      <DialogContent className="sm:max-w-md p-0 sm:p-0 md:p-0 gap-0 overflow-hidden bg-white text-black flex flex-col max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)]">
        <div className="px-4 pt-10 pb-3 flex justify-center flex-1 min-h-0 overflow-y-auto">
          <div
            id="receipt-print"
            dir="ltr"
            className="w-full max-w-[72mm] mx-auto bg-white text-black font-sans font-bold text-[13px] leading-[1.45] [font-variant-numeric:tabular-nums]"
            style={{ direction: "ltr", unicodeBidi: "isolate" }}
          >
            <div className="text-center">
              <div className="font-bold text-base uppercase tracking-[0.08em]">{sale.shop?.name}</div>
              {sale.shop?.address && <div className="text-[11px] whitespace-pre-line break-words">{sale.shop.address}</div>}
              {sale.shop?.phone && <div className="text-[11px]">{sale.shop.phone}</div>}
              {sale.shop?.receipt_header && <div className="text-[11px] mt-1 whitespace-pre-line break-words">{sale.shop.receipt_header}</div>}
            </div>

            <div className={dashed} />

            <div className="text-[11px] space-y-0.5">
              <div className="flex items-start justify-between gap-2"><span className="shrink-0">Receipt</span><span className="min-w-0 max-w-[58%] text-right break-words">{sale.receipt_number}</span></div>
              <div className="flex items-start justify-between gap-2"><span className="shrink-0">Date</span><span className="min-w-0 max-w-[58%] text-right break-words">{format(new Date(sale.created_at), "Pp")}</span></div>
              {sale.shop?.show_customer_on_receipt && customer && (
                <div className="flex items-start justify-between gap-2"><span className="shrink-0">Customer</span><span className="min-w-0 max-w-[58%] text-right break-words">{customer.name}</span></div>
              )}
              {sale.shop?.show_customer_on_receipt && customer?.phone && (
                <div className="flex items-start justify-between gap-2"><span className="shrink-0">Phone</span><span className="min-w-0 max-w-[58%] text-right break-words">{customer.phone}</span></div>
              )}
              {sale.patient_name && (
                <div className="flex items-start justify-between gap-2"><span className="shrink-0">Patient</span><span className="min-w-0 max-w-[58%] text-right break-words">{sale.patient_name}</span></div>
              )}
              {(sale.patient_age || sale.patient_gender) && (
                <div className="flex items-start justify-between gap-2"><span className="shrink-0">Age / Sex</span><span className="min-w-0 max-w-[58%] text-right break-words">{[sale.patient_age, sale.patient_gender].filter(Boolean).join(" / ")}</span></div>
              )}
              {sale.patient_phone && (
                <div className="flex items-start justify-between gap-2"><span className="shrink-0">Phone</span><span className="min-w-0 max-w-[58%] text-right break-words">{sale.patient_phone}</span></div>
              )}
            </div>

            {(sale.lab_orders ?? []).length > 0 && (
              <>
                <div className={dashed} />
                <div className="text-center text-[11px]">LAB TOKEN{sale.lab_orders.length > 1 ? "S" : ""}</div>
                <div className="text-[11px] space-y-0.5 mt-0.5">
                  {sale.lab_orders.map((o: any) => (
                    <div key={o.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 break-words">{o.test_name}</span>
                      <span className="shrink-0 font-bold">{o.token_number}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className={dashed} />

            <div className="space-y-1.5">
              {sale.items.map((it: any, i: number) => (
                <div key={i} className="space-y-0.5 font-normal">
                  <div className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight">{it.product_name}</div>
                  <div className="flex items-start justify-between text-[11px] gap-2">
                    <span className="shrink-0">{it.quantity} x {formatMoney(it.unit_price, cur)}</span>
                    <span className="tabular-nums text-right break-words">{formatMoney(it.line_total, cur)}</span>
                  </div>
                  {sale.shop?.show_imei_on_receipt && [it.imei1, it.imei2].filter(Boolean).map((v: string, k: number) => (
                    <div key={k} className="flex items-start justify-between text-[11px] gap-2"><span className="shrink-0">IMEI</span><span className="tabular-nums text-right break-words">{v}</span></div>
                  ))}
                </div>
              ))}
            </div>

            <div className={dashed} />

            <div className="space-y-0.5">
              <div className="flex justify-between gap-2"><span>Subtotal</span><span className="tabular-nums text-right">{formatMoney(sale.subtotal, cur)}</span></div>
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between gap-2"><span>Discount</span><span className="tabular-nums text-right">-{formatMoney(sale.discount, cur)}</span></div>
              )}
              {Number(sale.tax) > 0 && (sale.shop?.show_tax_line !== false) && (
                <div className="flex justify-between gap-2"><span>Tax</span><span className="tabular-nums text-right">{formatMoney(sale.tax, cur)}</span></div>
              )}
              <div className="border-t border-black mt-1 pt-1 flex justify-between gap-2 font-bold text-[13px]">
                <span>TOTAL</span><span className="tabular-nums text-right">{formatMoney(sale.total, cur)}</span>
              </div>
              {(sale.payments ?? []).length > 0 ? (
                (sale.payments as Array<{ account_name: string; amount: number }>).map((p, i) => (
                  <div key={i} className="flex justify-between text-[11px] gap-2">
                    <span>Paid ({p.account_name})</span>
                    <span className="tabular-nums text-right">{formatMoney(p.amount, cur)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between text-[11px] gap-2"><span>Paid ({sale.payment_method})</span><span className="tabular-nums text-right">{formatMoney(sale.amount_paid, cur)}</span></div>
              )}
              {Number(sale.change_due) > 0 && (
                <div className="flex justify-between text-[11px] gap-2"><span>Change</span><span className="tabular-nums text-right">{formatMoney(sale.change_due, cur)}</span></div>
              )}
              {Number(sale.balance_due ?? 0) > 0 && (
                <div className="border-t border-black mt-1 pt-1 flex justify-between gap-2 font-bold text-[13px]">
                  <span>BALANCE DUE</span>
                  <span className="tabular-nums text-right">{formatMoney(sale.balance_due, cur)}</span>
                </div>
              )}
            </div>

            {sale.shop?.receipt_footer && (
              <>
                <div className={dashed} />
                <div className="text-center text-[11px] whitespace-pre-line break-words">{sale.shop.receipt_footer}</div>
              </>
            )}

            {withTerms && terms && (
              <>
                <div className={dashed} />
                <div
                  className="text-[11px] font-normal leading-[1.35] break-words [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-4 [&_ol]:ps-4"
                  dangerouslySetInnerHTML={{ __html: termsToPrintHtml(terms) }}
                />
              </>
            )}

            <div className="text-center text-[11px] mt-2">** Thank you **</div>
          </div>
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>Receipt {sale.receipt_number}</DialogTitle>
        </DialogHeader>

        {/* Receipt is a white "paper" preview, so keep the footer buttons light in any theme. */}
        {/* Per-print override of the shop's terms default. */}
        {terms && (
          <label className="flex items-center gap-2 px-4 pt-3 text-sm text-gray-700 bg-white shrink-0 border-t border-gray-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={withTerms}
              onChange={(e) => setWithTerms(e.target.checked)}
              className="size-4 accent-black"
            />
            Print terms &amp; conditions
          </label>
        )}

        <DialogFooter className={`p-4 pt-3 print:hidden flex-col sm:flex-row gap-2 bg-white shrink-0 ${terms ? "" : "border-t border-gray-200"}`}>
          {customer?.phone && (
            isPro ? (
              <Button variant="outline" onClick={sendWhatsApp} disabled={sending || sent} className="w-full sm:w-auto border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900">
                <MessageCircle className="size-4 mr-2" />
                {sent ? "Sent" : sending ? "Sending…" : "WhatsApp"}
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full sm:w-auto border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900">
                <Link to="/billing">
                  <Sparkles className="size-4 mr-2" />
                  WhatsApp (Pro)
                </Link>
              </Button>
            )
          )}
          <Button variant="outline" onClick={print} className="w-full sm:w-auto border-gray-300 bg-white text-gray-900 hover:bg-gray-100 hover:text-gray-900">
            <Printer className="size-4 mr-2" /> Print
          </Button>
          <Button onClick={onClose} className="w-full sm:w-auto bg-gradient-primary text-white border-0 hover:opacity-90">New sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
