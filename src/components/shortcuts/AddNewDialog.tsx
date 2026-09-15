import { useState, useSyncExternalStore } from "react";
import { CornerDownLeft } from "lucide-react";
import { CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { NewAction } from "@/lib/app-nav";
import { registeredAddNew, subscribeAddNew } from "@/lib/add-new";
import { appShortcutLabel } from "@/lib/shortcuts";
import { CommandPopup, Kbd, PopupCommand } from "./CommandPopup";

const noIds: string[] = [];
let cachedKey = "";
let cachedIds: string[] = noIds;
/** Stable snapshot for useSyncExternalStore — a new array each call would loop. */
const snapshot = () => {
  const ids = registeredAddNew();
  const key = ids.join("|");
  if (key !== cachedKey) {
    cachedKey = key;
    cachedIds = ids;
  }
  return cachedIds;
};

interface Props {
  actions: NewAction[];
  onPick: (action: NewAction) => void;
}

/**
 * Ctrl/Cmd+E — start a new record of any kind.
 *
 * What the page on screen can create is listed first and highlighted, so on
 * Products, Ctrl/Cmd+E then Enter is a new product. Choosing opens the owning
 * page with its form already open (see hooks/useAddNew).
 */
export function AddNewDialog({
  open, onOpenChange, isMac, onCloseAutoFocus, ...list
}: Props & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMac: boolean;
  onCloseAutoFocus: (e: Event) => void;
}) {
  return (
    <CommandPopup
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
      title="Add new"
      description="Choose what to create and press Enter to open its form."
      footer={
        <>
          <span className="flex items-center gap-1.5">
            <Kbd>↑</Kbd><Kbd>↓</Kbd> move <Kbd><CornerDownLeft className="size-3" /></Kbd> open form <Kbd>Esc</Kbd> close
          </span>
          <span className="flex items-center gap-1.5">Add new <Kbd>{appShortcutLabel("addNew", isMac)}</Kbd></span>
        </>
      }
    >
      <AddNewList {...list} />
    </CommandPopup>
  );
}

/** Mounted only while the popup is open, so the search and highlight start fresh. */
function AddNewList({ actions, onPick }: Props) {
  const onPage = useSyncExternalStore(subscribeAddNew, snapshot, () => noIds);
  const here = actions.filter((a) => onPage.includes(a.id));
  const elsewhere = actions.filter((a) => !onPage.includes(a.id));

  const [search, setSearch] = useState("");
  // Highlight the first thing this page makes, so Enter alone creates it.
  const [value, setValue] = useState(() => (here[0] ? itemValue(here[0]) : ""));

  const typing = search.trim().length > 0;

  const item = (a: NewAction) => (
    <CommandItem
      key={a.id}
      value={itemValue(a)}
      keywords={a.keywords}
      onSelect={() => onPick(a)}
      className="gap-3 px-3 py-2.5 mx-1 rounded-md"
    >
      <span className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <a.icon className="size-4 text-primary" />
      </span>
      <span className="flex-1 min-w-0 truncate font-medium">{a.label}</span>
    </CommandItem>
  );

  return (
    <PopupCommand value={value} onValueChange={setValue}>
      <CommandInput value={search} onValueChange={setSearch} placeholder="Add new…" />
      <CommandList className="max-h-[min(60vh,440px)] pb-2">
        <CommandEmpty>Nothing called “{search}” to add.</CommandEmpty>
        {typing ? (
          <CommandGroup heading="Add new">{actions.map(item)}</CommandGroup>
        ) : (
          <>
            {here.length > 0 && <CommandGroup heading="On this page">{here.map(item)}</CommandGroup>}
            {elsewhere.length > 0 && (
              <CommandGroup heading={here.length ? "Everything else" : "Add new"}>{elsewhere.map(item)}</CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </PopupCommand>
  );
}

function itemValue(a: NewAction) {
  return `${a.label} ${a.id}`;
}
