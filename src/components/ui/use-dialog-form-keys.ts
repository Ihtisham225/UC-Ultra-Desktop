import * as React from "react";
import { runAddNew } from "@/lib/add-new";
import { hasFields, isPicker, isTextEntry, moveFrom, saveNewButtonIn, submitButtonIn } from "@/lib/form-keys";

/**
 * The Enter-driven form behaviour every DialogContent carries — see
 * lib/form-keys for the keys and the attributes a dialog can set.
 *
 * Returns a ref callback and an onKeyDown for the dialog's content element.
 */
export function useDialogFormKeys(forwarded: React.ForwardedRef<HTMLDivElement>) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  /** A picker the chain opened (or Enter opened) — moves on once it closes by Enter. */
  const armed = React.useRef<HTMLElement | null>(null);
  const lastInput = React.useRef<{ kind: string; at: number }>({ kind: "", at: 0 });
  /** Ctrl/Cmd+Shift+Enter was pressed: open this id once the dialog has gone. */
  const pendingNew = React.useRef<{ id: string; at: number } | null>(null);
  /** The LAST field was a picker and a choice was just made — the next Enter saves. */
  const chosenLast = React.useRef<HTMLElement | null>(null);
  /**
   * A picker that just closed on a CLICKED choice. Enter on it next means
   * "done here, move on" — reopening it (what a button does with Enter) is
   * what made every dropdown feel like a dead end.
   */
  const pickedByPointer = React.useRef<{ el: HTMLElement; at: number } | null>(null);
  /** Search boxes the user has arrowed through — Enter there is a real choice. */
  const navigated = React.useRef<WeakSet<HTMLElement>>(new WeakSet());
  const cleanup = React.useRef<(() => void) | null>(null);

  /** Press the dialog's save button; `andNew` opens a fresh form once it closes. */
  const submit = React.useCallback((root: HTMLElement, andNew: boolean) => {
    // A form with its own "Save & add another" button already knows how.
    const saveNew = andNew ? saveNewButtonIn(root) : null;
    if (saveNew) {
      pendingNew.current = null;
      saveNew.click();
      return true;
    }
    const button = submitButtonIn(root);
    if (!button) return false;
    const id = root.dataset.addNew;
    pendingNew.current = andNew && id ? { id, at: Date.now() } : null;
    button.click();
    return true;
  }, []);

  const attach = React.useCallback((root: HTMLDivElement) => {
    // Remember how the last thing happened — a picker closed by Enter moves on,
    // one closed by Escape or a click stays put.
    const onKey = (e: KeyboardEvent) => {
      if (["Shift", "Control", "Meta", "Alt"].includes(e.key)) return;
      lastInput.current = { kind: e.key, at: Date.now() };
      const target = e.target as HTMLElement;
      const justChosen = chosenLast.current;
      chosenLast.current = null;
      const clicked = pickedByPointer.current;
      pickedByPointer.current = null;

      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && target instanceof HTMLElement && target.hasAttribute("cmdk-input")) {
        navigated.current.add(target);
      }

      // A plain dropdown opened with no value chosen has nothing highlighted,
      // and Enter there did nothing at all. Same rule as an empty search box:
      // close it, leave it empty, move on.
      if (
        e.key === "Enter" && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        target instanceof HTMLElement && !root.contains(target)
      ) {
        const list = target.closest<HTMLElement>("[role='listbox']");
        if (list && !list.querySelector("[role='option'][data-highlighted]")) {
          const trigger = Array.from(root.querySelectorAll<HTMLElement>("[aria-expanded='true']")).find(
            (t) => t.getAttribute("aria-controls") === list.id || (!!list.id && document.getElementById(t.getAttribute("aria-controls") ?? "")?.contains(list)),
          );
          if (trigger && isPicker(trigger) && !trigger.closest("[data-enter-chain='off']")) {
            e.preventDefault();
            e.stopPropagation();
            if (trigger === armed.current) armed.current = null;
            target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
            advanceWhenSettled(trigger, root, (next) => {
              if (next) { if (isPicker(next)) armed.current = next; }
              else chosenLast.current = trigger;
            });
            return;
          }
        }
      }

      // ⚠️ Enter in a search dropdown's box with NOTHING typed and no arrowing
      // is "move on", not "take the first row". Taking it made Enter-ing
      // through a form pick the first person on the ledger, add the first
      // product to a purchase, and clear a product's shelf (its first row is
      // "Not on a shelf"). The dropdown closes, the value stays as it was.
      if (
        e.key === "Enter" && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        target instanceof HTMLInputElement && target.hasAttribute("cmdk-input") &&
        target.value.trim() === "" && !navigated.current.has(target)
      ) {
        const trigger = Array.from(root.querySelectorAll<HTMLElement>("[aria-expanded='true']")).find((t) => {
          const id = t.getAttribute("aria-controls");
          const popup = id ? document.getElementById(id) : null;
          return !!popup && popup.contains(target);
        });
        if (trigger && isPicker(trigger) && !trigger.closest("[data-enter-chain='off']")) {
          e.preventDefault();
          e.stopPropagation();
          if (trigger === armed.current) armed.current = null;
          // Close it the way Escape would (the observer then sees an Escape
          // and leaves it alone), and move on ourselves.
          target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
          advanceWhenSettled(trigger, root, (next) => {
            if (next) { if (isPicker(next)) armed.current = next; }
            else chosenLast.current = trigger;
          });
          return;
        }
      }

      // ⚠️ The list is open but focus stayed on its button (a Radix Select
      // moves focus in on the next frame, which a busy or background window
      // may not have yet). The Enter would go to the button and pick nothing,
      // so pick the highlighted — else the current — option ourselves.
      if (
        e.key === "Enter" && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
        target instanceof HTMLElement && root.contains(target) && isPicker(target) &&
        target.getAttribute("aria-expanded") === "true" && !target.closest("[data-enter-chain='off']")
      ) {
        const listId = target.getAttribute("aria-controls");
        const list = listId ? document.getElementById(listId) : null;
        const option = list?.querySelector<HTMLElement>("[role='option'][data-highlighted]") ??
          list?.querySelector<HTMLElement>("[role='option'][data-state='checked']") ??
          list?.querySelector<HTMLElement>("[role='option']:not([data-disabled])");
        if (option) {
          e.preventDefault();
          e.stopPropagation();
          option.focus();
          option.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
          return;
        }
      }

      // Enter on a picker is handled here, in the capture phase: a Radix Select
      // button claims Enter for itself (to open) before the dialog's own
      // handler would ever hear it.
      if (
        e.key === "Enter" && !e.isComposing && !e.altKey &&
        target instanceof HTMLElement && root.contains(target) && isPicker(target) &&
        !target.closest("[data-enter-chain='off']") && target.getAttribute("aria-expanded") !== "true"
      ) {
        const take = () => { e.preventDefault(); e.stopPropagation(); };
        if (e.ctrlKey || e.metaKey) {
          if (submit(root, e.shiftKey)) take();
        } else if (e.shiftKey) {
          take();
          moveFrom(target, root, -1);
        } else if (justChosen === target) {
          // The last field is a picker and a choice was just made: save.
          if (submit(root, false)) take();
        } else if (clicked && clicked.el === target && Date.now() - clicked.at < 60_000) {
          // A choice was just clicked here: Enter moves on, like after typing.
          take();
          if (!moveFrom(target, root, 1)) submit(root, false);
        } else {
          // Let it open as usual; once a choice is made by Enter, move on.
          armed.current = target;
        }
        return;
      }
      // Typing in the form again after pressing save & new means the save
      // failed and they're fixing it — don't reopen a blank form later.
      if (pendingNew.current && root.contains(e.target as Node)) pendingNew.current = null;
    };
    const onPointer = (e: PointerEvent) => {
      lastInput.current = { kind: "pointer", at: Date.now() };
      chosenLast.current = null;
      if (pendingNew.current && root.contains(e.target as Node)) pendingNew.current = null;
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        const el = m.target as HTMLElement;
        if (m.oldValue !== "true" || el.getAttribute("aria-expanded") !== "false") continue;
        // ⚠️ ANY picker in the form, not only one the chain opened itself: a
        // dropdown opened by a click (or by Enter on it) and chosen with Enter
        // used to leave focus sitting on it, and the next Enter reopened it.
        if (!isPicker(el) || el.hasAttribute("cmdk-input") || el.closest("[data-enter-chain='off']")) continue;
        if (el === armed.current) armed.current = null;
        const { kind, at } = lastInput.current;
        if (kind === "pointer" && Date.now() - at < 2000) {
          pickedByPointer.current = { el, at: Date.now() };
          continue;
        }
        if (kind !== "Enter" || Date.now() - at > 2000) continue;
        advanceWhenSettled(el, root, (next) => {
          // Landed on another picker: it opened itself, so watch it close too.
          if (next) { if (isPicker(next)) armed.current = next; }
          else chosenLast.current = el;
        });
      }
    });
    observer.observe(root, { subtree: true, attributes: true, attributeFilter: ["aria-expanded"], attributeOldValue: true });

    cleanup.current = () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      observer.disconnect();
    };
  }, [submit]);

  const ref = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        if (rootRef.current !== node) {
          cleanup.current?.();
          attach(node);
        }
        rootRef.current = node;
      } else {
        rootRef.current = null;
        // A ref callback also runs with null when only the ref changed, and is
        // then called again with the same node straight away. Only a dialog
        // that is really gone opens the next form.
        setTimeout(() => {
          if (rootRef.current) return;
          cleanup.current?.();
          cleanup.current = null;
          const pending = pendingNew.current;
          pendingNew.current = null;
          if (pending && Date.now() - pending.at < 20000) runAddNew(pending.id);
        }, 0);
      }
      setRef(forwarded, node);
    },
    [attach, forwarded],
  );

  const onKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const root = e.currentTarget;
    const target = e.target as HTMLElement;
    // Keys from a dropdown's list or a nested dialog bubble here through the
    // React tree, but they belong to that popup, not to this form.
    if (!root.contains(target)) return;
    if (target.closest("[data-enter-chain='off']")) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.altKey || !hasFields(root)) return;
      if (submit(root, e.shiftKey)) e.preventDefault();
      return;
    }
    if (e.altKey) return;
    // Enter is a new line in a notes box — unless nothing has been written in
    // it, when a new line means nothing and they're just moving past.
    const editable = target instanceof HTMLTextAreaElement || target.isContentEditable;
    const blank = target instanceof HTMLTextAreaElement ? target.value.trim() === "" : !target.textContent?.trim();
    if (editable && !blank) return;
    // Pickers were dealt with in the capture phase; buttons, switches and
    // checkboxes keep Enter's usual meaning.
    if (!editable && !isTextEntry(target)) return;

    e.preventDefault();
    if (e.shiftKey) {
      moveFrom(target, root, -1);
      return;
    }
    const next = moveFrom(target, root, 1);
    if (next) {
      if (isPicker(next)) armed.current = next;
      return;
    }
    submit(root, false);
  }, [submit]);

  return { setContent: ref, onKeyDown };
}

/** Hand a node to a ref the caller passed in, whichever kind it is. */
function setRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * A picker has just closed on a choice. Its popup hands focus back to the
 * trigger as it goes — moving on before that would be undone a moment later —
 * so wait for the focus to come home, then step to the next field.
 *
 * Driven by the focus event rather than animation frames: frames stall in a
 * background window, and a quick second Enter would then land on the trigger
 * before the chain had moved, reopening the dropdown instead.
 */
function advanceWhenSettled(trigger: HTMLElement, root: HTMLElement, done: (next: HTMLElement | null) => void) {
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (advance: boolean) => {
    if (finished) return;
    finished = true;
    root.removeEventListener("focusin", onFocusIn);
    clearTimeout(timer);
    if (advance && root.isConnected) done(moveFrom(trigger, root, 1));
  };
  const onFocusIn = (e: FocusEvent) => {
    if (e.target === trigger) finish(true);
    // Radix parks focus on the dialog itself on the way back; that isn't a choice.
    else if (e.target !== root) finish(false);
  };
  if (document.activeElement === trigger) return finish(true);
  root.addEventListener("focusin", onFocusIn);
  // Fallback, checked a few times: focus can stay in the closing list for a
  // while (its exit animation), and some popups hand it nowhere at all.
  let checks = 0;
  const check = () => {
    const active = document.activeElement;
    if (!active || active === document.body || active === root || active === trigger) return finish(true);
    // Clicked into another field meanwhile — leave them there.
    if (root.contains(active)) return finish(false);
    // Still inside the closing popup. Up to ~6s: an exit animation on a slow
    // shop PC (or a background window) can run well past a second, and giving
    // up early left the chain parked on the dropdown it had just chosen from.
    if (++checks >= 20) return finish(false);
    timer = setTimeout(check, 300);
  };
  timer = setTimeout(check, 300);
}
