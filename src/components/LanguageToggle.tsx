import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANG_META, SUPPORTED_LANGS, type AppLang } from "@/i18n";

export const LanguageToggle = () => {
  const { i18n, t } = useTranslation();
  const current = (SUPPORTED_LANGS as readonly string[]).includes(i18n.language)
    ? (i18n.language as AppLang)
    : "en";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={t("common.language")}
          title={t("common.language")}
        >
          <Globe className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("common.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGS.map((lng) => (
          <DropdownMenuItem
            key={lng}
            onClick={() => void i18n.changeLanguage(lng)}
            className="flex items-center justify-between gap-2"
          >
            <span>{LANG_META[lng].nativeLabel}</span>
            {current === lng && <Check className="size-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
