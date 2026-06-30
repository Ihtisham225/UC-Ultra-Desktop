import { ReactNode, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "destructive",
  busy = false,
  onConfirm,
}: ConfirmDialogProps) => {
  const { t } = useTranslation();
  const isDestructive = variant === "destructive";
  const Icon = isDestructive ? Trash2 : AlertTriangle;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div
            className={cn(
              "mx-auto sm:mx-0 mb-2 flex size-12 items-center justify-center rounded-full",
              isDestructive
                ? "bg-destructive/10 text-destructive"
                : "bg-warning/10 text-warning",
            )}
          >
            <Icon className="size-6" />
          </div>
          <AlertDialogTitle>{title ?? t("common.confirmDelete")}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            {cancelLabel ?? t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onConfirm();
            }}
            disabled={busy}
            className={cn(
              isDestructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {busy ? t("common.loading") : confirmLabel ?? t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Hook for imperative usage similar to window.confirm
interface ConfirmState {
  open: boolean;
  title?: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: "destructive" | "default";
  resolve?: (value: boolean) => void;
}

export const useConfirm = () => {
  const [state, setState] = useState<ConfirmState>({ open: false });

  const confirm = useCallback(
    (opts: {
      title?: string;
      description?: ReactNode;
      confirmLabel?: string;
      variant?: "destructive" | "default";
    }) =>
      new Promise<boolean>((resolve) => {
        setState({ open: true, ...opts, resolve });
      }),
    [],
  );

  const handleOpenChange = (open: boolean) => {
    if (!open && state.resolve) {
      state.resolve(false);
    }
    setState((s) => ({ ...s, open }));
  };

  const handleConfirm = () => {
    state.resolve?.(true);
    setState((s) => ({ ...s, open: false }));
  };

  const dialog = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={handleOpenChange}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      variant={state.variant}
      onConfirm={handleConfirm}
    />
  );

  return { confirm, dialog };
};
