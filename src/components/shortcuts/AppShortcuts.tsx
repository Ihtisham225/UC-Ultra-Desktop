import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMac } from "@/hooks/useIsMac";
import type { NavPage, NewAction } from "@/lib/app-nav";
import { NEW_PARAM, runAddNew } from "@/lib/add-new";
import { arrowsBelongElsewhere, focusRow, listRows, openRow, pageSearchInput } from "@/lib/list-keys";
import { pageFor, pushRecentPage } from "@/lib/recent-pages";
import { OPEN_POPUP_EVENT, isBare, isTypingTarget, matchAppShortcut, type ShortcutPopup } from "@/lib/shortcuts";
import { AddNewDialog } from "./AddNewDialog";
import { GoToDialog } from "./GoToDialog";
import { ShortcutsSheet } from "./ShortcutsSheet";

type Popup = ShortcutPopup | null;

/** A form or other window is open — the page's own, not one of ours. */
const pageDialogOpen = () =>
  !!document.querySelector("[role='dialog'][data-state='open']:not([data-app-popup]), [role='alertdialog'][data-state='open']");

/**
 * The app-wide keyboard: Go to, Add new, the shortcut sheet, the sidebar, and
 * the list keys. Mounted once, in the app layout. Keys are listed in lib/shortcuts.
 *
 * Listens in the bubble phase on window, so a page that handles a key itself
 * (the till, the receipt) gets it first and wins by calling preventDefault.
 */
export function AppShortcuts({
  pages, actions, onToggleSidebar, onToggleCalculator, onToggleTheme, calculatorOpen, platform,
}: {
  pages: NavPage[];
  actions: NewAction[];
  onToggleSidebar: () => void;
  onToggleCalculator: () => void;
  onToggleTheme: () => void;
  calculatorOpen: boolean;
  platform: "web" | "desktop";
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isMac = useIsMac();
  const [popup, setPopup] = useState<Popup>(null);
  /** What to do once the popup has finished closing — see onCloseAutoFocus. */
  const after = useRef<(() => void) | null>(null);

  // Remember where they've been, for the top of Go to.
  useEffect(() => {
    const page = pageFor(pathname, pages.map((p) => p.to));
    if (page) pushRecentPage(page);
  }, [pathname, pages]);

  const state = useRef({ popup, onToggleSidebar, onToggleCalculator, onToggleTheme, calculatorOpen });
  useEffect(() => {
    state.current = { popup, onToggleSidebar, onToggleCalculator, onToggleTheme, calculatorOpen };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const { popup: open, onToggleSidebar: toggleSidebar, calculatorOpen: calc } = state.current;
      const target = e.target as HTMLElement | null;

      const hit = matchAppShortcut(e);
      if (hit === "sidebar") {
        // Bold, in the rich-text editor.
        if (target?.isContentEditable) return;
        e.preventDefault();
        toggleSidebar();
        return;
      }
      // The calculator floats beside whatever is open and the theme is
      // cosmetic, so both work anywhere — over a form included.
      if (hit === "calculator") {
        e.preventDefault();
        state.current.onToggleCalculator();
        return;
      }
      if (hit === "theme") {
        e.preventDefault();
        state.current.onToggleTheme();
        return;
      }
      if (hit === "shortcuts") {
        e.preventDefault();
        setPopup((p) => (p === "shortcuts" ? null : "shortcuts"));
        return;
      }
      if (hit === "goTo" || hit === "addNew") {
        // Always taken, so the browser's find bar never opens instead.
        e.preventDefault();
        if (open === hit) return setPopup(null);
        // ⚠️ Not over an open form: going to another page would throw away
        // what has been typed into it. Esc first.
        if (!open && pageDialogOpen()) return;
        setPopup(hit);
        return;
      }

      // Bare keys below — never while typing, over a window, or on the calculator.
      if (!isBare(e) || open || calc || isTypingTarget(target) || pageDialogOpen()) return;

      if (e.key === "/") {
        const input = pageSearchInput();
        if (!input) return;
        e.preventDefault();
        input.focus();
        input.select();
        return;
      }

      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.shiftKey) {
        if (arrowsBelongElsewhere(target)) return;
        const rows = listRows(document.activeElement);
        if (!rows.length) return;
        const at = rows.indexOf(document.activeElement as HTMLTableRowElement);
        const next = at === -1
          ? (e.key === "ArrowDown" ? rows[0] : rows[rows.length - 1])
          : rows[Math.min(rows.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
        e.preventDefault();
        focusRow(next);
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && target instanceof HTMLTableRowElement && target.hasAttribute("data-kbd-row")) {
        if (openRow(target)) e.preventDefault();
      }
    };
    const onOpen = (e: Event) => setPopup((e as CustomEvent<Popup>).detail);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_POPUP_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_POPUP_EVENT, onOpen);
    };
  }, []);

  const close = (then: () => void) => {
    after.current = then;
    setPopup(null);
  };

  /** Runs once the popup is gone, so the page's form isn't fighting it for focus. */
  const onCloseAutoFocus = (e: Event) => {
    const then = after.current;
    // Switched straight to another popup: don't pull focus out of it.
    if (!then && state.current.popup) e.preventDefault();
    if (!then) return;
    after.current = null;
    e.preventDefault();
    then();
  };

  const setOpen = (which: ShortcutPopup) => (o: boolean) => setPopup(o ? which : null);

  return (
    <>
      <GoToDialog
        open={popup === "goTo"}
        onOpenChange={setOpen("goTo")}
        pages={pages}
        pathname={pathname}
        isMac={isMac}
        onGo={(to) => close(() => { if (to !== pathname) navigate(to); })}
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <AddNewDialog
        open={popup === "addNew"}
        onOpenChange={setOpen("addNew")}
        actions={actions}
        isMac={isMac}
        onPick={(a) =>
          close(() => {
            if (!runAddNew(a.id)) navigate(`${a.to}?${NEW_PARAM}=${encodeURIComponent(a.id)}`);
          })
        }
        onCloseAutoFocus={onCloseAutoFocus}
      />
      <ShortcutsSheet
        open={popup === "shortcuts"}
        onOpenChange={setOpen("shortcuts")}
        onPos={pathname === "/pos"}
        platform={platform}
      />
    </>
  );
}
