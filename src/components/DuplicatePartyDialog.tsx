"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { DuplicateMatch } from "@/lib/party-duplicates";

/** What the person chose: go ahead, back out, or pick the existing record. */
export type DuplicateDecision = "create" | "cancel" | { use: DuplicateMatch };

interface Pending {
  matches: DuplicateMatch[];
  /** The form picks the record it creates (POS, purchase, ledger), so it can
   *  pick an existing one instead — but only one it could have picked from its
   *  own list (a POS sale can't use a supplier-only record). */
  canUse: (m: DuplicateMatch) => boolean;
  /** "customer", "supplier"… for the wording. */
  noun: string;
  editing: boolean;
}

const why = (m: DuplicateMatch) =>
  m.on === "both" ? "same name and phone" : m.on === "name" ? "same name" : "same phone";

/**
 * Warn before a customer or supplier is entered twice.
 *
 *   const { confirmDuplicates, duplicateDialog } = useDuplicatePartyConfirm();
 *   const d = await confirmDuplicates(matches, { canUse: (m) => m.is_customer, noun: "customer" });
 *   if (d === "cancel") return;
 *   if (d !== "create") { choose(d.use); return; }
 *
 * With no matches it resolves "create" at once, without showing anything.
 * Copied verbatim into the desktop.
 */
export function useDuplicatePartyConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const resolver = useRef<((d: DuplicateDecision) => void) | null>(null);

  const confirmDuplicates = useCallback(
    (
      matches: DuplicateMatch[],
      opts: { canUse?: (m: DuplicateMatch) => boolean; noun?: string; editing?: boolean } = {},
    ): Promise<DuplicateDecision> => {
      if (matches.length === 0) return Promise.resolve("create");
      return new Promise((resolve) => {
        resolver.current = resolve;
        setPending({
          matches,
          canUse: opts.canUse ?? (() => false),
          noun: opts.noun ?? "customer or supplier",
          editing: !!opts.editing,
        });
      });
    },
    [],
  );

  const finish = (d: DuplicateDecision) => {
    const r = resolver.current;
    resolver.current = null;
    setPending(null);
    r?.(d);
  };

  const duplicateDialog = (
    <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) finish("cancel"); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" />
            This may be a duplicate
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.matches.length === 1 ? "A record" : "Records"} with the same name or phone
            already {pending?.matches.length === 1 ? "exists" : "exist"}. Entering one person twice
            splits their bills and balance across two ledgers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="space-y-2 max-h-60 overflow-y-auto">
          {pending?.matches.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
              <div className="min-w-0">
                <div className="font-medium truncate">{m.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[m.phone, m.roles, why(m)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {pending.canUse(m) && (
                <Button size="sm" variant="secondary" onClick={() => finish({ use: m })}>
                  Use this one
                </Button>
              )}
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish("cancel")}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={() => finish("create")}>
            {pending?.editing ? "Save anyway" : `Create a new ${pending?.noun ?? "record"} anyway`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirmDuplicates, duplicateDialog };
}
