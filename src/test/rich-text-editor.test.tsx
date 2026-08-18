import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";

// Rendered with react-dom directly rather than @testing-library/react, which
// is missing its @testing-library/dom peer in this project.
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Controlled host, exactly how Settings uses the editor. */
function Host() {
  const [value, setValue] = useState("");
  return (
    <>
      <RichTextEditor value={value} onChange={setValue} />
      <output id="v">{value}</output>
    </>
  );
}

const box = () => container.querySelector('[contenteditable="true"]') as HTMLDivElement;
const emitted = () => container.querySelector("#v")!.textContent;

/**
 * Count writes to innerHTML made by the component itself.
 *
 * Asserting on the resulting markup is not enough: the browser re-normalises
 * whatever is written, so a rewritten box looks identical to an untouched one.
 * The caret jump is caused by the write happening at all — and jsdom has no
 * caret — so the write is what the test has to observe.
 */
function watchWrites(el: HTMLDivElement) {
  const proto = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")!;
  const state = { count: 0 };
  Object.defineProperty(el, "innerHTML", {
    configurable: true,
    get() { return proto.get!.call(this); },
    set(v: string) { state.count++; proto.set!.call(this, v); },
  });
  return state;
}

/** What the browser does when a key is pressed inside a contenteditable. */
function type(el: HTMLDivElement, html: string) {
  act(() => {
    const proto = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")!;
    proto.set!.call(el, html);              // the browser's own edit, not a component write
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("RichTextEditor", () => {
  it("does not rewrite the box while the user types", () => {
    act(() => root.render(<Host />));
    const el = box();

    // The sanitiser normalises what the browser produced (<br> → <br />), so
    // the value coming back differs textually from the DOM. The old code read
    // that as an outside change and reset innerHTML — which is what threw the
    // caret to the top on every keystroke.
    const writes = watchWrites(el);
    type(el, "Hello<br>");

    expect(emitted()).toBe("Hello<br />");
    // The component must not touch the box for a change that came from it.
    expect(writes.count).toBe(0);
  });

  it("survives a backspace without snapping back", () => {
    act(() => root.render(<Host />));
    const el = box();
    const writes = watchWrites(el);
    type(el, "abc");
    type(el, "ab");
    expect(writes.count).toBe(0);
    expect(emitted()).toBe("ab");
  });

  it("still accepts a value set from outside", () => {
    act(() => root.render(<RichTextEditor value="<b>one</b>" onChange={() => {}} />));
    expect(box().innerHTML).toBe("<b>one</b>");
    act(() => root.render(<RichTextEditor value="<b>two</b>" onChange={() => {}} />));
    expect(box().innerHTML).toBe("<b>two</b>");
  });
});
