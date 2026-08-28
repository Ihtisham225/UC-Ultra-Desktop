/**
 * Labels for the printed challan and bill.
 *
 * The app's screens stay English, but the paper goes to a factory in Islampur
 * where everyone reads Urdu — so the print carries the same column headings as
 * the shop's own carbon book, with the English underneath for anyone else.
 */
export const UR = {
  serial: "نمبرشمار",
  detail: "تفصیل",
  quantity: "تعداد",
  date: "تاریخ",
  billNumber: "نمبر",
  billTo: "بل بنام",
  sentVia: "بذریعہ",
  countedBy: "کنتی کرنے والا",
  totalBundles: "ٹوٹل بنڈل",
  total: "ٹوٹل",
  totalAmount: "ٹوٹل رقم",
  receivedAmount: "وصول رقم",
  remainingAmount: "بقایہ رقم",
  signature: "دستخط",
  received: "واپس",
  short: "کمی",
  damaged: "خراب",
  rate: "ریٹ",
  amount: "رقم",
  deduction: "کٹوتی",
  note: "نوٹ",
  goodsOut: "بھیجا گیا مال",
  perPieceWeight: "فی عدد وزن",
  totalWeight: "کل وزن",
  goodsIn: "وصول شدہ مال",
} as const;

/**
 * Naskh first: nastaliq is beautiful but needs so much line height that a
 * 10-row table stops fitting on one page. Falls back through whatever Urdu or
 * Arabic face the machine happens to have.
 */
export const URDU_FONT_STACK =
  '"Noto Naskh Arabic", "Jameel Noori Nastaleeq", "Noto Nastaliq Urdu", "Segoe UI", Tahoma, sans-serif';

/**
 * Print rules shared by every A4 document here: hide the app, show only the
 * sheet, and keep table borders when the browser strips backgrounds.
 */
export const printCss = (id: string) => `
  @media print {
    @page { size: A4; margin: 12mm; }
    body * { visibility: hidden; }
    #${id}, #${id} * { visibility: visible; }
    #${id} {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #${id} table { page-break-inside: auto; }
    #${id} tr { page-break-inside: avoid; page-break-after: auto; }
    #${id} thead { display: table-header-group; }
  }
`;
