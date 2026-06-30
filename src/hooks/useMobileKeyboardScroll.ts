import { useEffect } from "react";

/**
 * Mobile keyboard UX:
 * - When an input/textarea/select gets focus, scroll it into view above the
 *   on-screen keyboard so the user can see what they're typing.
 * - Adds bottom padding equal to the keyboard height (visualViewport delta)
 *   so the page can still scroll while the keyboard is open.
 */
export function useMobileKeyboardScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (!isTouch) return;

    const isField = (el: EventTarget | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isField(e.target)) return;
      const el = e.target as HTMLElement;
      // Wait for the keyboard to open and viewport to resize
      window.setTimeout(() => {
        try {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          el.scrollIntoView();
        }
      }, 280);
    };

    const vv = window.visualViewport;
    const updateInset = () => {
      if (!vv) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--kb-inset", `${inset}px`);
      if (inset > 80) document.body.classList.add("kb-open");
      else document.body.classList.remove("kb-open");
    };

    document.addEventListener("focusin", onFocusIn);
    vv?.addEventListener("resize", updateInset);
    vv?.addEventListener("scroll", updateInset);
    updateInset();
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      vv?.removeEventListener("resize", updateInset);
      vv?.removeEventListener("scroll", updateInset);
      document.documentElement.style.removeProperty("--kb-inset");
      document.body.classList.remove("kb-open");
    };
  }, []);
}
