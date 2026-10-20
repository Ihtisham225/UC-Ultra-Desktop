import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useShop } from "@/contexts/ShopContext";
import { usePermissions } from "@/hooks/usePermissions";
import { isHandicraft } from "@/lib/handicraft";
import { isOil } from "@/lib/oil";
import { isLabEnabled } from "@/lib/lab";
import { navPages, newActions, type NavContext } from "@/lib/app-nav";
import { orderedNav } from "@/lib/nav-order";

/**
 * The pages and "new" actions the current user can reach in the current shop,
 * plus the sidebar's groups in the order the shop chose (Settings → Shop → Menu).
 */
export function useAppNav() {
  const { t, i18n } = useTranslation();
  const { currentShop, role, hasPerm } = useShop();
  const perms = usePermissions();

  return useMemo(() => {
    const ctx: NavContext = {
      t: (k) => t(k),
      craft: isHandicraft(currentShop),
      oil: isOil(currentShop),
      lab: isLabEnabled(currentShop),
      role,
      hasPerm,
      investorsEnabled: !!currentShop?.investors_enabled,
      chequesEnabled: !!currentShop?.cheques_enabled,
      daybookEnabled: !!currentShop?.daybook_enabled,
      perms,
    };
    const pages = navPages(ctx);
    return { pages, groups: orderedNav(pages, currentShop?.nav_order ?? null), actions: newActions(ctx) };
    // `perms` is rebuilt every render from `role`, and the language decides the labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, i18n.language, currentShop, role, hasPerm]);
}
