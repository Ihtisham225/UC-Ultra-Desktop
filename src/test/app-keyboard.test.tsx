import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { isTypingTarget, matchAppShortcut } from "@/lib/shortcuts";
import { registerAddNew, registeredAddNew, runAddNew } from "@/lib/add-new";
import { navPages, newActions, type NavContext } from "@/lib/app-nav";
import { pageFor } from "@/lib/recent-pages";
import { submitButtonIn } from "@/lib/form-keys";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * The app driven from the keyboard, outside the till: Go to / Add new /
 * shortcut sheet / sidebar keys, the Add new hand-off, which pages and forms a
 * user is offered, and the Enter-driven forms every dialog carries.
 */

const key = (over: Partial<Parameters<typeof matchAppShortcut>[0]>) => ({
  key: "", code: "", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over,
});

describe("matchAppShortcut", () => {
  it("opens Go to, Add new, the sheet and the sidebar on Ctrl — and Cmd on a Mac", () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(matchAppShortcut(key({ key: "g", code: "KeyG", ...mod }))).toBe("goTo");
      expect(matchAppShortcut(key({ key: "e", code: "KeyE", ...mod }))).toBe("addNew");
      expect(matchAppShortcut(key({ key: "/", code: "Slash", ...mod }))).toBe("shortcuts");
      expect(matchAppShortcut(key({ key: "b", code: "KeyB", ...mod }))).toBe("sidebar");
    }
  });

  it("matches the physical key, so an Urdu or Arabic layout still works", () => {
    expect(matchAppShortcut(key({ key: "ع", code: "KeyE", ctrlKey: true }))).toBe("addNew");
  });

  it("never needs a key a browser keeps for itself", () => {
    // Ctrl+N / T / W never reach a web page — the whole reason E and G were chosen.
    for (const letter of ["n", "t", "w"]) {
      expect(matchAppShortcut(key({ key: letter, code: `Key${letter.toUpperCase()}`, ctrlKey: true }))).toBeNull();
    }
  });

  it("ignores bare, shifted and Alt versions", () => {
    expect(matchAppShortcut(key({ key: "g", code: "KeyG" }))).toBeNull();
    expect(matchAppShortcut(key({ key: "G", code: "KeyG", ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(matchAppShortcut(key({ key: "e", code: "KeyE", ctrlKey: true, altKey: true }))).toBeNull();
  });
});

describe("isTypingTarget", () => {
  it("is true in a text box and false on a checkbox or a button", () => {
    const text = document.createElement("input");
    const check = Object.assign(document.createElement("input"), { type: "checkbox" });
    expect(isTypingTarget(text)).toBe(true);
    expect(isTypingTarget(document.createElement("textarea"))).toBe(true);
    expect(isTypingTarget(check)).toBe(false);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
  });
});

describe("the Add new registry", () => {
  it("runs a registered handler and forgets it once unregistered", () => {
    const open = vi.fn();
    const off = registerAddNew({ product: open });
    expect(registeredAddNew()).toContain("product");
    expect(runAddNew("product")).toBe(true);
    expect(open).toHaveBeenCalledOnce();
    off();
    expect(runAddNew("product")).toBe(false);
  });

  it("keeps a page's newer handler when an older copy cleans up late", () => {
    // A page that remounts registers again before the old cleanup runs.
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = registerAddNew({ expense: first });
    const offSecond = registerAddNew({ expense: second });
    offFirst();
    expect(runAddNew("expense")).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    offSecond();
  });
});

const ctx = (over: Partial<NavContext> = {}): NavContext => {
  const role = over.role ?? "owner";
  const manage = role === "owner" || role === "manager";
  return {
    t: (k) => k,
    craft: false,
    oil: false,
    lab: false,
    role,
    hasPerm: () => manage,
    investorsEnabled: false,
    perms: {
      canManageProducts: manage, canManagePurchases: manage, canManageExpenses: manage,
      canManageSuppliers: manage, canManageStaff: role === "owner",
    },
    ...over,
  };
};

describe("what Go to and Add new offer", () => {
  it("gives every Add new item a page the same user can open", () => {
    for (const c of [ctx(), ctx({ craft: true }), ctx({ oil: true }), ctx({ role: "cashier" }), ctx({ lab: true })]) {
      const reachable = new Set(navPages(c).map((p) => p.to));
      for (const a of newActions(c)) expect(reachable, `${a.id} → ${a.to}`).toContain(a.to);
    }
  });

  it("uses each Add new id once", () => {
    const ids = newActions(ctx({ oil: true, lab: true, investorsEnabled: true })).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the till and the catalogue away from a handicraft shop", () => {
    const pages = navPages(ctx({ craft: true })).map((p) => p.to);
    expect(pages).not.toContain("/pos");
    expect(pages).not.toContain("/products");
    expect(pages).toContain("/daybook");
    const ids = newActions(ctx({ craft: true })).map((a) => a.id);
    expect(ids).not.toContain("sale");
    expect(ids).toContain("making-challan");
  });

  it("keeps money and staff screens from a cashier", () => {
    const pages = navPages(ctx({ role: "cashier" })).map((p) => p.to);
    for (const to of ["/payroll", "/staff", "/expenses", "/activity"]) expect(pages).not.toContain(to);
    const ids = newActions(ctx({ role: "cashier" })).map((a) => a.id);
    for (const id of ["expense", "payroll-payment", "staff", "product"]) expect(ids).not.toContain(id);
  });
});

describe("pageFor", () => {
  it("files a sub-page under its nav entry, and never /lab under /lab-results", () => {
    const pages = ["/lab", "/lab-results", "/payroll"];
    expect(pageFor("/payroll/abc", pages)).toBe("/payroll");
    expect(pageFor("/lab-results", pages)).toBe("/lab-results");
    expect(pageFor("/elsewhere", pages)).toBeNull();
  });
});

// ---------------------------------------------------------------- the forms

let rects: PropertyDescriptor | undefined;
beforeAll(() => {
  // jsdom lays nothing out, so every element would read as invisible.
  rects = Object.getOwnPropertyDescriptor(Element.prototype, "getClientRects");
  Element.prototype.getClientRects = function () {
    return [{ width: 1, height: 1 }] as unknown as DOMRectList;
  };
  window.HTMLElement.prototype.scrollIntoView = function () {};
});
afterAll(() => {
  if (rects) Object.defineProperty(Element.prototype, "getClientRects", rects);
});

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const render = (ui: React.ReactElement) => act(() => root.render(ui));
const q = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const press = (el: Element, init: KeyboardEventInit = {}) => {
  const e = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init });
  act(() => { el.dispatchEvent(e); });
  return e;
};

function Form({ onSave, extra, contentProps = {} }: {
  onSave: () => void;
  extra?: React.ReactNode;
  contentProps?: Record<string, string>;
}) {
  return (
    <Dialog open>
      <DialogContent {...contentProps}>
        <DialogTitle>Form</DialogTitle>
        <input id="name" />
        <input id="amount" type="number" />
        {extra}
        <textarea id="notes" />
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button id="save" onClick={onSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Enter in a dialog", () => {
  it("walks the boxes in page order and saves past the last one", () => {
    const onSave = vi.fn();
    render(<Form onSave={onSave} />);
    q<HTMLInputElement>("#name").focus();
    press(q("#name"));
    expect(document.activeElement?.id).toBe("amount");
    press(q("#amount"));
    expect(document.activeElement?.id).toBe("notes");
    // An empty notes box is only being passed through.
    press(q("#notes"));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("goes back a box on Shift+Enter", () => {
    render(<Form onSave={vi.fn()} />);
    q<HTMLInputElement>("#amount").focus();
    press(q("#amount"), { shiftKey: true });
    expect(document.activeElement?.id).toBe("name");
  });

  it("is a new line in a notes box that has something in it — and Ctrl/Cmd+Enter still saves", () => {
    const onSave = vi.fn();
    render(<Form onSave={onSave} />);
    const notes = q<HTMLTextAreaElement>("#notes");
    notes.value = "bilty 42";
    notes.focus();
    const e = press(notes);
    expect(e.defaultPrevented).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    press(notes, { metaKey: true });
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("steps over boxes that can't be typed in", () => {
    render(<Form onSave={vi.fn()} extra={<><input id="ro" readOnly /><input id="off" disabled /><div data-enter-skip><input id="skip" /></div></>} />);
    q<HTMLInputElement>("#amount").focus();
    press(q("#amount"));
    expect(document.activeElement?.id).toBe("notes");
  });

  it("leaves Enter to a box that already handles it", () => {
    const onSave = vi.fn();
    render(
      <Form
        onSave={onSave}
        extra={<input id="tag" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} />}
      />,
    );
    q<HTMLInputElement>("#tag").focus();
    press(q("#tag"));
    expect(document.activeElement?.id).toBe("tag");
  });

  it("does nothing in a dialog that runs its own keys", () => {
    const onSave = vi.fn();
    render(<Form onSave={onSave} contentProps={{ "data-enter-chain": "off" }} />);
    q<HTMLInputElement>("#name").focus();
    press(q("#name"));
    expect(document.activeElement?.id).toBe("name");
    press(q("#name"), { ctrlKey: true });
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("the button Enter saves with", () => {
  const box = (html: string) => {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el;
  };

  it("is never a destructive one", () => {
    expect(submitButtonIn(box(`<div data-dialog-footer><button data-variant="outline">Cancel</button><button data-variant="destructive">Delete</button></div>`))).toBeNull();
  });

  it("prefers an explicit data-enter-submit, then the footer's primary button", () => {
    expect(submitButtonIn(box(`<div data-dialog-footer><button data-variant="outline">No</button><button id="p" data-variant="default">Save</button></div>`))?.id).toBe("p");
    expect(submitButtonIn(box(`<button id="x" data-enter-submit>Go</button><div data-dialog-footer><button data-variant="default">Save</button></div>`))?.id).toBe("x");
  });

  it("skips a disabled button", () => {
    expect(submitButtonIn(box(`<div data-dialog-footer><button data-variant="default" disabled>Saving…</button></div>`))).toBeNull();
  });
});

describe("Ctrl/Cmd+Shift+Enter", () => {
  function Page() {
    const [open, setOpen] = useState(true);
    const [count, setCount] = useState(0);
    return (
      <>
        <span id="opened">{count}</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent data-add-new="expense">
            <DialogTitle>New expense</DialogTitle>
            <input id="amount" />
            <DialogFooter>
              <Button id="save" onClick={() => setOpen(false)}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Registrar onNew={() => { setCount((c) => c + 1); setOpen(true); }} />
      </>
    );
  }
  function Registrar({ onNew }: { onNew: () => void }) {
    // Registered straight away, as useAddNew does from an effect.
    useState(() => registerAddNew({ expense: () => onNew() }));
    return null;
  }

  it("saves, and opens a fresh form once the dialog has closed", async () => {
    vi.useFakeTimers();
    try {
      render(<Page />);
      q<HTMLInputElement>("#amount").focus();
      press(q("#amount"), { ctrlKey: true, shiftKey: true });
      await act(async () => { vi.runAllTimers(); });
      expect(q("#opened").textContent).toBe("1");
      expect(document.querySelector("#amount")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("useAddNew on the HashRouter", () => {
  it("opens the form once for ?new=, clears the param through the router, and registers the handler", async () => {
    const { MemoryRouter, Routes, Route, useLocation } = await import("react-router-dom");
    const { useAddNew } = await import("@/hooks/useAddNew");
    const open = vi.fn();
    let where = "";

    function Products() {
      useAddNew({ product: open, brand: false });
      where = useLocation().search;
      return null;
    }

    render(
      <MemoryRouter initialEntries={["/products?new=product&q=oil"]}>
        <Routes><Route path="/products" element={<Products />} /></Routes>
      </MemoryRouter>,
    );

    expect(open).toHaveBeenCalledTimes(1);
    // Only its own param goes; the page's other query survives.
    expect(where).toBe("?q=oil");
    // A handler given as `false` is not offered.
    expect(registeredAddNew()).toContain("product");
    expect(registeredAddNew()).not.toContain("brand");
    expect(runAddNew("product")).toBe(true);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
