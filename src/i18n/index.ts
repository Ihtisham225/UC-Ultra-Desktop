import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en";
import ar from "./locales/ar";

export const SUPPORTED_LANGS = ["en", "ar"] as const;
export type AppLang = (typeof SUPPORTED_LANGS)[number];

export const LANG_META: Record<AppLang, { label: string; nativeLabel: string; dir: "ltr" | "rtl" }> = {
  en: { label: "English", nativeLabel: "English", dir: "ltr" },
  ar: { label: "Arabic (Kuwaiti)", nativeLabel: "العربية", dir: "rtl" },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "ucu.lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  });

// Apply dir + lang attributes to <html> on load and on change.
const applyDir = (lng: string) => {
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(lng) ? lng : "en";
  const meta = LANG_META[lang as AppLang];
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", meta.dir);
};
applyDir(i18n.language);
i18n.on("languageChanged", applyDir);

export default i18n;
