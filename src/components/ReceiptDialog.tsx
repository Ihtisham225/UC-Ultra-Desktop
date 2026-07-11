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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const withLineBreaks = (value?: string | null) => escapeHtml(value ?? "").replace(/\n/g, "<br />");

const buildReceiptPrintHtml = ({ sale, customer, currency }: { sale: any; customer: { name: string; phone: string | null } | null; currency: string }) => {
  const metaRows = [
    { label: "Receipt", value: sale.receipt_number ?? "" },
    { label: "Date", value: format(new Date(sale.created_at), "Pp") },
    ...(customer ? [{ label: "Customer", value: customer.name }] : []),
  ];

  const itemsHtml = sale.items
    .map(
      (item: any) => `
        <div class="item">
          <div class="item-name">${escapeHtml(item.product_name ?? "")}</div>
          <div class="row small">
            <span>${escapeHtml(String(item.quantity))} x ${escapeHtml(formatMoney(item.unit_price, currency))}</span>
            <span class="value">${escapeHtml(formatMoney(item.line_total, currency))}</span>
          </div>
        </div>`
    )
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
    `<div class="row small"><span>Paid (${escapeHtml(sale.payment_method ?? "")})</span><span class="value">${escapeHtml(formatMoney(sale.amount_paid, currency))}</span></div>`,
    Number(sale.change_due) > 0
      ? `<div class="row small"><span>Change</span><span class="value">${escapeHtml(formatMoney(sale.change_due, currency))}</span></div>`
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
          font-family: "Courier New", Courier, monospace;
        }
        body {
          width: 80mm;
          margin: 0 auto;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .receipt {
          width: 72mm;
          margin: 0 auto;
          padding: 4mm 0 6mm;
          font-size: 12px;
          line-height: 1.35;
        }
        .center { text-align: center; }
        .title {
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .small { font-size: 11px; }
        .note {
          white-space: pre-line;
          word-break: break-word;
        }
        .rule {
          border-top: 1px dashed #000000;
          margin: 8px 0;
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
          font-size: 13px;
          font-weight: 700;
          border-top: 1px solid #000000;
          margin-top: 4px;
          padding-top: 4px;
        }
        .value {
          text-align: right;
        }
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

        <div class="rule"></div>

        <div>${itemsHtml}</div>

        <div class="rule"></div>

        <div>${summaryRows}</div>

        ${sale.shop?.receipt_footer ? `<div class="rule"></div><div class="center small note">${withLineBreaks(sale.shop.receipt_footer)}</div>` : ""}

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

  useEffect(() => {
    if (sale.customer || !sale.customer_id) return;
    rpc<{ name: string; phone: string | null } | null>("getCustomerLiteAction", sale.customer_id)
      .then((data) => data && setCustomer(data))
      .catch(() => { /* ignore — receipt still prints without the name */ });
  }, [sale.customer, sale.customer_id]);

  const print = () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      setTimeout(() => iframe.remove(), 100);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.data === "receipt-print-done") cleanup();
    };

    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      window.print();
      return;
    }

    doc.open();
    doc.write(buildReceiptPrintHtml({ sale, customer, currency: cur }).replace(
      "window.print();",
      `window.print();\n            setTimeout(() => window.parent.postMessage(\"receipt-print-done\", \"*\"), 300);`
    ));
    doc.close();

    setTimeout(cleanup, 60000);
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

  const dashed = "border-t border-dashed border-black my-2";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white text-black">
        <div className="px-4 pt-5 pb-2 flex justify-center">
          <div
            id="receipt-print"
            dir="ltr"
            className="w-full max-w-[72mm] mx-auto bg-white text-black font-mono text-[12px] leading-[1.35]"
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
              {customer && (
                <div className="flex items-start justify-between gap-2"><span className="shrink-0">Customer</span><span className="min-w-0 max-w-[58%] text-right break-words">{customer.name}</span></div>
              )}
            </div>

            <div className={dashed} />

            <div className="space-y-1.5">
              {sale.items.map((it: any, i: number) => (
                <div key={i} className="space-y-0.5">
                  <div className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight">{it.product_name}</div>
                  <div className="flex items-start justify-between text-[11px] gap-2">
                    <span className="shrink-0">{it.quantity} x {formatMoney(it.unit_price, cur)}</span>
                    <span className="tabular-nums text-right break-words">{formatMoney(it.line_total, cur)}</span>
                  </div>
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
              <div className="flex justify-between text-[11px] gap-2"><span>Paid ({sale.payment_method})</span><span className="tabular-nums text-right">{formatMoney(sale.amount_paid, cur)}</span></div>
              {Number(sale.change_due) > 0 && (
                <div className="flex justify-between text-[11px] gap-2"><span>Change</span><span className="tabular-nums text-right">{formatMoney(sale.change_due, cur)}</span></div>
              )}
            </div>

            {sale.shop?.receipt_footer && (
              <>
                <div className={dashed} />
                <div className="text-center text-[11px] whitespace-pre-line break-words">{sale.shop.receipt_footer}</div>
              </>
            )}

            <div className="text-center text-[11px] mt-2">** Thank you **</div>
          </div>
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>Receipt {sale.receipt_number}</DialogTitle>
        </DialogHeader>

        {/* Receipt is a white "paper" preview, so keep the footer buttons light in any theme. */}
        <DialogFooter className="p-4 pt-0 print:hidden flex-col sm:flex-row gap-2 bg-white">
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
