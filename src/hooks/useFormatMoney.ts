// Hook that returns a locale-aware formatMoney bound to the current i18n language.
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { formatMoney as baseFormatMoney, formatNumber as baseFormatNumber } from "@/lib/format";

const localeFor = (lng: string) => {
  if (lng?.startsWith("ar")) return "ar-KW";
  return lng || "en";
};

export function useFormatMoney() {
  const { i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  return useCallback(
    (amount: number | string, currency = "USD") => baseFormatMoney(amount, currency, locale),
    [locale],
  );
}

export function useFormatNumber() {
  const { i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  return useCallback(
    (n: number | string) => baseFormatNumber(n, locale),
    [locale],
  );
}

export function useLocale() {
  const { i18n } = useTranslation();
  return localeFor(i18n.language);
}
