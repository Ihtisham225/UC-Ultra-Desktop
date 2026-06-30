import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Trash2, Download, X } from "lucide-react";

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  canDelete?: boolean;
}

/**
 * Sticky toolbar shown when one or more rows are selected. Offers
 * "export selected as CSV" and "delete selected" actions.
 */
export function BulkActionBar({
  selectedCount,
  onClear,
  onDelete,
  onExport,
  canDelete = true,
}: BulkActionBarProps) {
  const { t } = useTranslation();
  if (selectedCount === 0) return null;
  return (
    <div className="sticky top-14 lg:top-16 z-20 -mx-4 lg:-mx-8 px-4 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-primary/5 backdrop-blur-sm border-primary/20 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="icon" className="size-7" onClick={onClear} aria-label={t("common.cancel")}>
            <X className="size-4" />
          </Button>
          <span className="font-medium">{t("bulk.selectedCount", { count: selectedCount })}</span>
        </div>
        <div className="flex items-center gap-2">
          {onExport && (
            <Button size="sm" variant="outline" onClick={onExport}>
              <Download className="size-4 me-1.5" /> {t("bulk.exportCsv")}
            </Button>
          )}
          {onDelete && canDelete && (
            <Button size="sm" variant="destructive" onClick={onDelete}>
              <Trash2 className="size-4 me-1.5" /> {t("bulk.deleteSelected")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
