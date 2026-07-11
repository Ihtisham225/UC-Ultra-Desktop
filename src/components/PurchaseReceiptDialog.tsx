import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { format } from "date-fns";
import { useShop } from "@/contexts/ShopContext";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const withLineBreaks = (value?: string | null) => escapeHtml(value ?? "").replace(/\n/g, "<br />");

interface PurchaseItem { id?: string; product_name: string; quantity: number | string; unit_cost: number | string; line_total: number | string; }
interface Purchase {
  reference_number: string | null;
  created_at: string;
  payment_method?: string | null;
  notes?: string | null;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  paid_amount: number | string;
  suppliers?: { name: string; phone: string | null } | null;
  purchase_items: PurchaseItem[];
}

interface Shop {
  name: string;
  address?: string | null;
  phone?: string | null;
  receipt_header?: string | null;
  receipt_footer?: string | null;
  currency?: string | null;
}

const buildPrintHtml = ({ purchase, shop, currency }: { purchase: Purchase; shop: Shop; currency: string }) => {
  const balance = Number(purchase.total) - Number(purchase.paid_amount);
  const metaRows = [
    { label: "Voucher", value: purchase.reference_number ?? "" },
    { label: "Date", value: format(new Date(purchase.created_at), "Pp") },
    ...(purchase.suppliers?.name ? [{ label: "Supplier", value: purchase.suppliers.name }] : []),
    ...(purchase.suppliers?.phone ? [{ label: "Phone", value: purchase.suppliers.phone }] : []),
  ];

  const itemsHtml = purchase.purchase_items
    .map(
      (item) => `
        <div class="item">
          <div class="item-name">${escapeHtml(item.product_name ?? "")}</div>
          <div class="row small">
            <span>${escapeHtml(String(Number(item.quantity)))} x ${escapeHtml(formatMoney(item.unit_cost, currency))}</span>
            <span class="value">${escapeHtml(formatMoney(item.line_total, currency))}</span>
          </div>
        </div>`
    )
    .join("");

  const summaryRows = [
    `<div class="row"><span>Subtotal</span><span class="value">${escapeHtml(formatMoney(purchase.subtotal, currency))}</span></div>`,
    Number(purchase.tax) > 0
      ? `<div class="row"><span>Tax</span><span class="value">${escapeHtml(formatMoney(purchase.tax, currency))}</span></div>`
      : "",
    `<div class="total-row"><span>TOTAL</span><span class="value">${escapeHtml(formatMoney(purchase.total, currency))}</span></div>`,
    `<div class="row small"><span>Paid${purchase.payment_method ? ` (${escapeHtml(purchase.payment_method)})` : ""}</span><span class="value">${escapeHtml(formatMoney(purchase.paid_amount, currency))}</span></div>`,
    balance > 0
      ? `<div class="row small"><span>Balance due</span><span class="value">${escapeHtml(formatMoney(balance, currency))}</span></div>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Purchase ${escapeHtml(purchase.reference_number ?? "")}</title>
      <style>
        @page { margin: 0; }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: "Courier New", Courier, monospace; }
        body { width: 80mm; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .receipt { width: 72mm; margin: 0 auto; padding: 4mm 0 6mm; font-size: 12px; line-height: 1.35; }
        .center { text-align: center; }
        .title { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
        .small { font-size: 11px; }
        .note { white-space: pre-line; word-break: break-word; }
        .rule { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .row > :first-child { flex: 0 0 auto; }
        .row > .value { flex: 1 1 auto; min-width: 0; text-align: right; word-break: break-word; }
        .item { margin-bottom: 6px; }
        .item-name { white-space: normal; word-break: break-word; overflow-wrap: anywhere; margin-bottom: 2px; }
        .total-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; font-size: 13px; font-weight: 700; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
        .value { text-align: right; }
      </style>
    </head>
    <body>
      <div class="receipt" dir="ltr">
        <div class="center">
          <div class="title">${escapeHtml(shop.name ?? "")}</div>
          ${shop.address ? `<div class="small note">${withLineBreaks(shop.address)}</div>` : ""}
          ${shop.phone ? `<div class="small">${escapeHtml(shop.phone)}</div>` : ""}
          <div class="small" style="margin-top:4px;font-weight:700;">PURCHASE VOUCHER</div>
        </div>

        <div class="rule"></div>

        <div class="small">
          ${metaRows
            .map((row) => `<div class="row"><span>${escapeHtml(row.label)}</span><span class="value">${escapeHtml(row.value)}</span></div>`)
            .join("")}
        </div>

        <div class="rule"></div>

        <div>${itemsHtml}</div>

        <div class="rule"></div>

        <div>${summaryRows}</div>

        ${purchase.notes ? `<div class="rule"></div><div class="small note">${withLineBreaks(purchase.notes)}</div>` : ""}
        ${shop.receipt_footer ? `<div class="rule"></div><div class="center small note">${withLineBreaks(shop.receipt_footer)}</div>` : ""}

        <div class="center small" style="margin-top:8px;">** Goods received **</div>
      </div>
      <script>
        window.onload = () => { setTimeout(() => { window.focus(); window.print(); }, 150); };
      </script>
    </body>
  </html>`;
};

export const PurchaseReceiptDialog = ({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) => {
  const { currentShop } = useShop();
  const shop = (currentShop ?? { name: "" }) as Shop;
  const cur = shop.currency ?? "USD";
  const balance = Number(purchase.total) - Number(purchase.paid_amount);

  const print = () => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", opacity: "0", pointerEvents: "none" } as CSSStyleDeclaration);

    const cleanup = () => { window.removeEventListener("message", handleMessage); setTimeout(() => iframe.remove(), 100); };
    const handleMessage = (event: MessageEvent) => {
      if (event.source === iframe.contentWindow && event.data === "receipt-print-done") cleanup();
    };
    window.addEventListener("message", handleMessage);
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) { cleanup(); window.print(); return; }
    doc.open();
    doc.write(
      buildPrintHtml({ purchase, shop, currency: cur }).replace(
        "window.print();",
        `window.print();\n            setTimeout(() => window.parent.postMessage("receipt-print-done", "*"), 300);`
      )
    );
    doc.close();
    setTimeout(cleanup, 60000);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-white text-black">
        <div className="px-4 pt-5 pb-2 flex justify-center">
          <div dir="ltr" className="w-full max-w-[72mm] mx-auto bg-white text-black font-mono text-[12px] leading-[1.35]">
            <div className="text-center">
              <div className="font-bold text-base uppercase tracking-[0.08em]">{shop.name}</div>
              {shop.address && <div className="text-[11px] whitespace-pre-line break-words">{shop.address}</div>}
              {shop.phone && <div className="text-[11px]">{shop.phone}</div>}
              <div className="text-[11px] mt-1 font-bold">PURCHASE VOUCHER</div>
            </div>
            <div className="border-t border-dashed border-black my-2" />
            <div className="text-[11px] space-y-0.5">
              <div className="flex justify-between gap-2"><span className="shrink-0">Voucher</span><span className="text-right break-words">{purchase.reference_number}</span></div>
              <div className="flex justify-between gap-2"><span className="shrink-0">Date</span><span className="text-right break-words">{format(new Date(purchase.created_at), "Pp")}</span></div>
              {purchase.suppliers?.name && <div className="flex justify-between gap-2"><span className="shrink-0">Supplier</span><span className="text-right break-words">{purchase.suppliers.name}</span></div>}
            </div>
            <div className="border-t border-dashed border-black my-2" />
            <div className="space-y-1.5">
              {purchase.purchase_items.map((it, i) => (
                <div key={it.id ?? i} className="space-y-0.5">
                  <div className="whitespace-normal break-words [overflow-wrap:anywhere] leading-tight">{it.product_name}</div>
                  <div className="flex justify-between text-[11px] gap-2">
                    <span className="shrink-0">{Number(it.quantity)} x {formatMoney(it.unit_cost, cur)}</span>
                    <span className="tabular-nums text-right break-words">{formatMoney(it.line_total, cur)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-black my-2" />
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between gap-2"><span>Subtotal</span><span className="tabular-nums">{formatMoney(purchase.subtotal, cur)}</span></div>
              {Number(purchase.tax) > 0 && <div className="flex justify-between gap-2"><span>Tax</span><span className="tabular-nums">{formatMoney(purchase.tax, cur)}</span></div>}
              <div className="flex justify-between gap-2 text-[13px] font-bold border-t border-black mt-1 pt-1"><span>TOTAL</span><span className="tabular-nums">{formatMoney(purchase.total, cur)}</span></div>
              <div className="flex justify-between gap-2"><span>Paid{purchase.payment_method ? ` (${purchase.payment_method})` : ""}</span><span className="tabular-nums">{formatMoney(purchase.paid_amount, cur)}</span></div>
              {balance > 0 && <div className="flex justify-between gap-2"><span>Balance due</span><span className="tabular-nums">{formatMoney(balance, cur)}</span></div>}
            </div>
            <div className="text-center text-[11px] mt-2">** Goods received **</div>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t bg-muted/30">
          <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
          <Button className="flex-1 bg-gradient-primary hover:opacity-90 text-primary-foreground" onClick={print}>
            <Printer className="size-4 mr-2" /> Print
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
