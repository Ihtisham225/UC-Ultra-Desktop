import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { daybookTarget, type DaybookLinkTarget } from "@/lib/daybook";
import { rpc } from "@/lib/apiClient";
import type { DaybookEntryDto } from "@/lib/daybookTypes";

/**
 * The Roznamcha handing a line over to the page that raises the real record.
 *
 * The daybook navigates to `?daybook=<entry id>&as=<target>`; this fetches the
 * line, calls the handler for that target so the page can open its own form
 * pre-filled, and gives back `link()` for the page to call once the record is
 * saved — which is what writes "→ Payment #34" onto the daybook row.
 *
 * ⚠️ The hand-off must be given up when the pre-filled form is dismissed —
 * that is what `abandon()` is for, and every form opened this way has to call
 * it when the user closes it. Without that, the line stays armed and the NEXT
 * unrelated record saved on the page is written onto it, so the daybook would
 * claim a payment to one party settled a line about another.
 */
export function useDaybookHandoff(
  handlers: Partial<Record<DaybookLinkTarget, (entry: DaybookEntryDto) => void>>,
) {
  // ⚠️ react-router's hook returns a [params, setParams] pair, not the params
  // themselves the way Next's does.
  const [searchParams, setSearchParams] = useSearchParams();
  const entryId = searchParams.get("daybook");
  const target = searchParams.get("as") as DaybookLinkTarget | null;

  const handlersRef = useRef(handlers);
  // Kept current in an effect rather than during render — effects run in
  // declaration order, so this lands before the fetch below ever reads it.
  useEffect(() => { handlersRef.current = handlers; });
  const openedFor = useRef<string | null>(null);

  /**
   * The line being raised, and what it is being raised AS.
   *
   * ⚠️ The target is held here rather than re-read from the URL when the record
   * is saved: the hand-off params are stripped the moment the form opens, so by
   * save time the URL no longer says what this line was for, and the link would
   * silently never be written.
   */
  const [handoff, setHandoff] = useState<
    { entry: DaybookEntryDto; target: DaybookLinkTarget } | null
  >(null);

  useEffect(() => {
    if (!entryId || !target) return;
    const key = `${entryId}:${target}`;
    // Open the form once per hand-off, however many times this runs.
    if (openedFor.current === key) return;
    openedFor.current = key;

    let opened = false;
    let cancelled = false;
    rpc<DaybookEntryDto | null>("getDaybookEntryAction", entryId)
      .then((e) => {
        if (cancelled) return;
        opened = true;
        if (!e) return toast.error("That daybook line no longer exists.");

        // Take the hand-off out of the URL the moment it is acted on, so a
        // reload — or coming back to this page later — doesn't reopen a form
        // for a line that has already been dealt with.
        //
        // ⚠️ Through the router, NOT `history.replaceState` the way the web
        // app does it: this app runs on a HashRouter, so the route and its
        // query both live in the fragment. Writing a bare path to history
        // would drop the hash and throw the terminal back to the app root
        // mid-form. Replacing the search keeps the page mounted.
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("daybook");
            next.delete("as");
            return next;
          },
          { replace: true },
        );

        setHandoff({ entry: e, target });
        handlersRef.current[target]?.(e);
        // A line can name someone who was never added to the register, so the
        // form opens with no party chosen. Say so, rather than leaving them to
        // wonder why the one field that mattered is blank.
        if (!e.party_id) {
          toast.info(`“${e.party_name}” isn't on the register — choose the party for this record.`);
        }
      })
      .catch(() => toast.error("Could not open the daybook line — is the terminal online?"));
    return () => {
      cancelled = true;
      // ⚠️ In development React mounts, tears down and remounts every effect.
      // The first run claims the key and is then cancelled, so without giving
      // the key back here the remount sees it already claimed and the form
      // never opens — the hand-off silently does nothing.
      if (!opened) openedFor.current = null;
    };
  }, [entryId, target, setSearchParams]);

  /**
   * Give up the hand-off — the pre-filled form was closed without saving.
   * Call this from the form's dismiss path, never after a save.
   */
  const abandon = useCallback(() => setHandoff(null), []);

  /**
   * Point the daybook line at the record that has just been saved. Failing to
   * link is not fatal — the record itself is safe, and the line is already
   * marked done — so it is reported and swallowed.
   */
  const link = useCallback(
    async (recordId: string, label: string) => {
      if (!handoff) return;
      const { entry, target: raisedAs } = handoff;
      // Loose shape, not a discriminated union — see the note in Daybook.tsx.
      const result = await rpc<{ ok: boolean; error?: string }>(
        "linkDaybookEntryAction", entry.id, raisedAs, recordId, label,
      ).catch(() => ({ ok: false, error: "The terminal is offline — the line was not linked." }));
      if (result.ok) toast.success(`Roznamcha line #${entry.number} linked to ${label}`);
      else toast.error(result.error ?? "The line could not be linked.");
      setHandoff(null);
    },
    [handoff],
  );

  return {
    /** The line being raised, once loaded. Null when this isn't a hand-off. */
    entry: handoff?.entry ?? null,
    target: handoff?.target ?? null,
    /** What the line is being raised as, for a note on the form. */
    targetLabel: handoff ? daybookTarget(handoff.target)?.label ?? null : null,
    link,
    abandon,
  };
}
