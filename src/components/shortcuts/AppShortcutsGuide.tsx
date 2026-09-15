import { useIsMac } from "@/hooks/useIsMac";
import { appShortcutLabel, type ShortcutLabel } from "@/lib/shortcuts";
import { Arrow, Key, Row, Section } from "./guide-parts";

/**
 * The app-wide keyboard shortcuts, explained. Combinations come from
 * `appShortcutLabel` in lib/shortcuts — the file that matches the keys — so
 * this can't describe a shortcut that no longer works.
 */
export function AppShortcutsGuide() {
  const isMac = useIsMac();
  const k = (s: ShortcutLabel) => <Key>{appShortcutLabel(s, isMac)}</Key>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        The whole app can be run from the keyboard. Nothing needs switching on.
        {isMac ? " You're on a Mac, so Ctrl is ⌘ Command." : ""}
      </p>

      <Section title="Everywhere" hint="Works on every page.">
        <Row keys={k("goTo")} action="Go to a page" detail="Type part of the name, then Enter. Recently opened pages are at the top." />
        <Row
          keys={k("addNew")}
          action="Add something new"
          detail="A product, purchase, customer, expense… The current page's own form is highlighted, so Enter alone opens it."
        />
        <Row keys={k("search")} action="Search products, sales, customers and suppliers" />
        <Row keys={k("shortcuts")} action="Show these shortcuts" />
        <Row keys={k("sidebar")} action="Show or hide the sidebar" detail="On a wide screen." />
        <Row keys={<Key>Esc</Key>} action="Close a popup or form without saving" />
      </Section>

      <Section title="In a form" hint="Any form that opens in a window — adding a product, recording an expense, and so on.">
        <Row keys={<Key>Enter</Key>} action="Next box" detail="A dropdown opens as you reach it; pick with the arrows and Enter, and it moves on." />
        <Row keys={<Key>Shift+Enter</Key>} action="Previous box" />
        <Row keys={<><Key>Enter</Key><span className="text-xs text-muted-foreground">on the last box</span></>} action="Save" />
        <Row keys={k("saveNow")} action="Save now, from any box" detail="Also from a notes box, where Enter starts a new line." />
        <Row
          keys={k("saveNew")}
          action="Save, and start another"
          detail="For entering several in a row. If the save fails, the form stays open so you can fix it."
        />
      </Section>

      <Section title="On a list" hint="Pages with a table — products, sales, customers, expenses…">
        <Row keys={<Key>/</Key>} action="Jump to the search box" />
        <Row keys={<><Key>↑</Key><Key>↓</Key></>} action="Move through the rows" />
        <Row keys={<><Key>↓</Key><Arrow /><Key>Enter</Key></>} action="Open the highlighted row" detail="Opens its details, or its edit form when it has no details." />
      </Section>
    </div>
  );
}
