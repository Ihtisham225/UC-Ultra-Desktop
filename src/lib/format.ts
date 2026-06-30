// Currencies that conventionally use 3 decimal places (per ISO 4217)
const THREE_DECIMAL_CURRENCIES = new Set(["KWD", "BHD", "OMR", "JOD", "TND", "LYD", "IQD"]);

const decimalsFor = (currency: string) =>
  THREE_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 3 : 2;

export const formatMoney = (amount: number | string, currency = "USD", locale?: string) => {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const fractionDigits = decimalsFor(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(fractionDigits)}`;
  }
};

export const formatNumber = (n: number | string, locale?: string) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return new Intl.NumberFormat(locale).format(v || 0);
};
