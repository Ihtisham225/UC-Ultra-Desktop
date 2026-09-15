import { Arrow, Key, Row, Section } from "@/components/shortcuts/guide-parts";
import { BROWSER_RESERVED, shortcutLabel, type PosShortcut } from "@/lib/pos-shortcuts";
import { useIsMac } from "@/hooks/useIsMac";

/**
 * The till's keyboard shortcuts, explained for the counter.
 *
 * Every combination shown comes from `shortcutLabel` in lib/pos-shortcuts —
 * the same file that matches the keys — so this page can't describe a
 * shortcut that no longer works. Only the Enter chain is written out by hand;
 * its order is `STEP` in lib/checkout-keys.
 */

/**
 * `platform` decides how Ctrl/Cmd+W and Ctrl/Cmd+N are described: a browser
 * keeps those keys for itself (close tab, new window) and never lets a page
 * have them, so on the web they're marked as desktop-app only rather than
 * listed as if they worked.
 */
export function PosShortcutsGuide({ platform }: { platform: "web" | "desktop" }) {
  const isMac = useIsMac();
  const k = (s: PosShortcut) => <Key>{shortcutLabel(s, isMac)}</Key>;
  const reservedNote = (s: PosShortcut) =>
    platform === "web" && BROWSER_RESERVED.includes(s)
      ? `Desktop app only. In a browser ${shortcutLabel(s, isMac)} ${s === "whatsapp" ? "closes the tab" : "opens a new window"}, and a web page can't stop that — use the button.`
      : undefined;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        The point of sale can be run entirely from the keyboard. Nothing here needs switching on — these work on the
        POS screen for everyone.
        {platform === "web" ? " Two receipt shortcuts only work in the desktop app; they're marked below." : ""}
        {isMac ? " You're on a Mac, so Ctrl is ⌘ Command." : ""}
      </p>

      <Section title="Ringing up items" hint="On the POS screen. The cursor starts in the search box.">
        <Row
          keys={<><Key>type</Key><Arrow /><Key>Enter</Key></>}
          action="Add the product to the cart"
          detail="Adds the first match, or the exact barcode, and moves to its quantity."
        />
        <Row
          keys={<><Key>quantity</Key><Arrow /><Key>Enter</Key></>}
          action="Set the quantity and move to the price"
          detail="Decimals are fine — 3.5 litres."
        />
        <Row
          keys={<><Key>price</Key><Arrow /><Key>Enter</Key></>}
          action="Keep or change the price, then back to search"
          detail="Press Enter without typing to keep the price as it is."
        />
        <Row keys={k("checkout")} action="Open checkout" />
        <Row
          keys={k("clearCart")}
          action="Clear the cart"
          detail="Asks first. Enter keeps the cart; Tab to “Clear cart”, then Enter, to empty it."
        />
      </Section>

      <Section title="In checkout" hint="Enter moves to the next box, in this order.">
        <Row
          keys={<Key>Enter</Key>}
          action="Customer → Vehicle → Discount → Amount paid → Account → Notes"
          detail="The vehicle only appears for oil shops, and a lab sale asks for the patient instead of the customer."
        />
        <Row
          keys={<><Key>type</Key><Arrow /><Key>Enter</Key></>}
          action="Pick a customer"
          detail="Type to search by name or phone. Choose “Add as a new customer” if they aren't on the list, or “Walk-in” for none."
        />
        <Row keys={<><Key>↑</Key><Key>↓</Key></>} action="Change the account" detail="Enter on the account keeps the one shown and moves on." />
        <Row keys={<Key>Enter</Key>} action="On the notes: place the order" />
        <Row keys={k("checkout")} action="Place the order from anywhere in checkout" />
        <Row keys={<Key>Esc</Key>} action="Close checkout without selling" detail="The cart is kept, and the cursor goes back to search." />
      </Section>

      <Section title="On the receipt" hint="After the sale, while the receipt is on screen.">
        <Row keys={k("print")} action="Print the receipt" />
        <Row
          keys={k("whatsapp")}
          action="Send it on WhatsApp"
          detail={reservedNote("whatsapp") ?? "Needs the customer's phone number, and a Pro plan."}
        />
        <Row
          keys={k("newSale")}
          action="Start a new sale"
          detail={reservedNote("newSale") ?? "Closes the receipt and puts the cursor back in search."}
        />
      </Section>
    </div>
  );
}
