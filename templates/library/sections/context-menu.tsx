/** @flowcode-library context-menu · Context menu (Dialogs and drawers)
 * Catalog ID: c.context-menu (component)
 * Function: A right-click menu (also long-press, Shift+F10 and the Menu key) with actions, checks, options and submenus, full arrow-key, typeahead and Escape handling, shown on a file browser with rename, move, delete and undo.
 * Use it as: import { ContextMenu, type MenuEntry } from "./context-menu"; <ContextMenu label="File actions" items={(target) => MenuEntry[]} onSelect={(entry, target, keepOpen) => ...}><div data-menu-target="id" tabIndex={0}>…</div></ContextMenu>  // MenuEntry: { id, label, icon?, keys?, danger?, disabled? } | { kind: "check", id, label, checked } | { kind: "radio", id, label, checked } | { kind: "label", id, label } | { kind: "separator", id } | { kind: "sub", id, label, icon?, items }; items may be a function of the right-clicked element's data-menu-target (null for the empty area). Also exports MenuPanel, the menu list c.menubar uses.
 * Look: A raised white list at the pointer with small icons, right-aligned key hints, check marks and dots for chosen options, a quiet group label, thin rules and a red Delete; submenus open beside their row with a chevron, and every list rises in with a short fade.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-danger-surface --color-accent --surface-shadow-overlay --radius-sm --radius-md --space-1 --space-2 --space-3 --text-xs --text-sm --duration-fast --duration-base --ease-out --enter-distance --focus-ring
 * Use cases: file browser; right-click actions; canvas or editor menu; table row actions; desktop-style web app; image gallery actions; kanban card menu
 * Jobs to be done: act on the thing under my pointer; rename, duplicate or delete a file quickly; move a file to another folder; change how the list is sorted
 * Keywords: context menu, right click, menu, submenu, long press, keyboard
 */
/**
 * Context menu: the menu that opens where you right-click. Press and hold on a touch screen, or press Shift+F10 or the
 * Menu key on a focused item, and it opens at that item. Inside, the arrow keys move (wrapping), Home and End jump,
 * typing a letter jumps to the next item that starts with it, Right or Enter opens a submenu and Left closes it, Enter
 * chooses, Space ticks a check or option without closing, Escape closes one level, and Tab closes the whole menu. Focus
 * goes back to the item the menu was opened on. A press outside, scrolling or resizing the window closes it too.
 * Which items show can depend on what was clicked: `items` may be a function of the target's data-menu-target value
 * (null for the empty area). Make it the app's own: replace SAMPLE with the app's own things and actions, keep Delete
 * last and offer Undo after it.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its context menu's anatomy (items, check and radio items,
 * group labels, separators, shortcuts and submenus), rewritten without its dependencies.
 */
/**
 * How to try it
 * - Right-click a file (or focus it and press Shift+F10): the file's menu opens at the pointer.
 * - Arrow keys move; Right opens "Move to"; type "d" to jump to Duplicate; Escape closes one level.
 * - Right-click the empty area: sort the files or hide their sizes; Space ticks without closing.
 * - Delete a file, then press Undo in the line under the grid.
 *
 * Dependencies: React (useEffect, useLayoutEffect, useRef, useState), the library's own Button, and its inline icon set
 * ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to install and
 * nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the sample data
 * is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── The menu list (shared with c.menubar): one level of role="menu", with its submenus nested inside. ──

export type MenuEntry =
  | { kind?: "item"; id: string; label: string; icon?: string; keys?: string; danger?: boolean; disabled?: boolean }
  | { kind: "check"; id: string; label: string; checked: boolean; keys?: string; disabled?: boolean }
  | { kind: "radio"; id: string; label: string; checked: boolean; disabled?: boolean }
  | { kind: "label"; id: string; label: string }
  | { kind: "separator"; id: string }
  | { kind: "sub"; id: string; label: string; icon?: string; items: MenuEntry[]; disabled?: boolean };

/** How a menu closed: Escape, Tab, a choice, or a press outside. */
export type MenuCloseReason = "escape" | "tab" | "pick" | "outside";

type PanelProps = {
  items: MenuEntry[];
  label: string;
  /** A choice. keepOpen is true when Space ticked a check or option: the menu should stay. */
  onPick: (entry: MenuEntry, keepOpen: boolean) => void;
  onClose: (how: MenuCloseReason) => void;
  /** Left (-1) or Right (+1) past the menu's edge: a menubar moves to the next menu. */
  onSide?: (dir: -1 | 1) => void;
  /** Which item takes focus when the list opens; left out, focus stays where it is (a submenu opened by hover). */
  focusAt?: "first" | "last";
  /** A submenu: placed beside its row, flipped to the other side when it would leave the window. */
  nested?: boolean;
  /** A top-level list under a button: nudged left when it would leave the window. */
  fit?: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
  labelledBy?: string;
  panelRef?: (el: HTMLUListElement | null) => void;
};

const isPick = (e: MenuEntry) => e.kind !== "separator" && e.kind !== "label";
const ITEM_ROLE = { check: "menuitemcheckbox", radio: "menuitemradio" } as const;

/**
 * One menu level. Focus moves to the items themselves (each tabIndex -1), as the WAI-ARIA menu pattern asks. Keys are
 * handled here and stop here, so a submenu's keys never reach the level under it.
 */
export function MenuPanel({ items, label, onPick, onClose, onSide, focusAt, nested, fit, className, style, id, labelledBy, panelRef }: PanelProps) {
  const ref = useRef<HTMLUListElement | null>(null);
  const [sub, setSub] = useState<{ id: string; focus?: "first" | "last" } | null>(null);
  const [place, setPlace] = useState<CSSProperties>({});
  const typed = useRef({ text: "", at: 0 });
  const hoverTimer = useRef<number>(0);

  const rows = () => [...(ref.current?.querySelectorAll<HTMLElement>(":scope > li > [data-fl-item]:not([aria-disabled='true'])") ?? [])];
  const focusRow = (i: number) => {
    const list = rows();
    if (!list.length) return;
    list[(i + list.length) % list.length]?.focus();
  };
  const current = () => rows().indexOf(document.activeElement as HTMLElement);

  // Layout effect: focus lands before the next key press can arrive.
  useLayoutEffect(() => {
    if (focusAt === "first") focusRow(0);
    else if (focusAt === "last") focusRow(-1);
    else if (!nested) ref.current?.focus();
    return () => window.clearTimeout(hoverTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep it in the window. offsetWidth/Height ignore the entering scale, so the numbers are the settled size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (nested) {
      const row = el.parentElement as HTMLElement;
      const parent = row.parentElement as HTMLElement;
      const pr = parent.getBoundingClientRect();
      const top = row.offsetTop - 5;
      const shiftUp = Math.max(0, pr.top + top + h - (vh - 8));
      if (pr.right + w - 4 <= vw - 8) setPlace({ top: top - shiftUp, left: "calc(100% - 4px)" });
      else if (pr.left - w + 4 >= 8) setPlace({ top: top - shiftUp, right: "calc(100% - 4px)" });
      else setPlace({ top: row.offsetTop + row.offsetHeight, left: Math.max(8 - pr.left, (vw - w) / 2 - pr.left) });
    } else if (fit) {
      const r = el.getBoundingClientRect();
      const over = r.left + w - (vw - 8);
      if (over > 0) setPlace({ marginLeft: -Math.min(over, Math.max(0, r.left - 8)) });
    }
  }, [nested, fit]);

  const open = (entry: MenuEntry, focus?: "first" | "last") => {
    window.clearTimeout(hoverTimer.current);
    setSub({ id: entry.id, focus });
  };
  const activate = (entry: MenuEntry, viaSpace: boolean) => {
    if ("disabled" in entry && entry.disabled) return;
    if (entry.kind === "sub") return open(entry, "first");
    const keep = viaSpace && (entry.kind === "check" || entry.kind === "radio");
    onPick(entry, keep);
  };

  const onKey = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    // A submenu's keys are its own.
    if (e.target instanceof Node && (e.target as HTMLElement).closest("[role='menu']") !== ref.current) return;
    const i = current();
    const entry = i >= 0 ? items.filter(isPick).filter((x) => !("disabled" in x && x.disabled))[i] : undefined;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case "ArrowDown":
        stop();
        return focusRow(i < 0 ? 0 : i + 1);
      case "ArrowUp":
        stop();
        return focusRow(i < 0 ? -1 : i - 1);
      case "Home":
      case "PageUp":
        stop();
        return focusRow(0);
      case "End":
      case "PageDown":
        stop();
        return focusRow(-1);
      case "ArrowRight":
        stop();
        if (entry?.kind === "sub") return open(entry, "first");
        return onSide?.(1);
      case "ArrowLeft":
        stop();
        if (nested) return onClose("escape");
        return onSide?.(-1);
      case "Enter":
      case " ":
        stop();
        if (entry) activate(entry, e.key === " ");
        return;
      case "Escape":
        stop();
        return onClose("escape");
      case "Tab":
        e.stopPropagation();
        return onClose("tab");
    }
    // Typeahead: letters jump to the next item that starts with what was typed in the last half second.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      stop();
      const now = Date.now();
      const t = typed.current;
      t.text = now - t.at > 500 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = now;
      const list = rows();
      const from = t.text.length > 1 ? Math.max(0, i) : i + 1;
      for (let k = 0; k < list.length; k++) {
        const el = list[(from + k) % list.length]!;
        if ((el.dataset.text ?? "").toLowerCase().startsWith(t.text)) return el.focus();
      }
    }
  };

  return (
    <ul
      ref={(el) => {
        ref.current = el;
        panelRef?.(el);
      }}
      id={id}
      role="menu"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={["fl-cm-panel", nested ? "fl-cm-panel--sub" : "", className].filter(Boolean).join(" ")}
      style={{ ...style, ...place }}
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((entry) => {
        if (entry.kind === "separator") return <li key={entry.id} role="separator" className="fl-cm-sep" />;
        if (entry.kind === "label")
          return (
            <li key={entry.id} role="presentation" className="fl-cm-label">
              {entry.label}
            </li>
          );
        const disabled = "disabled" in entry && !!entry.disabled;
        const isSub = entry.kind === "sub";
        const subOpen = isSub && sub?.id === entry.id;
        const checked = entry.kind === "check" || entry.kind === "radio" ? entry.checked : undefined;
        return (
          <li key={entry.id} role="none" className="fl-cm-li">
            <div
              data-fl-item=""
              data-text={entry.label}
              role={entry.kind === "check" || entry.kind === "radio" ? ITEM_ROLE[entry.kind] : "menuitem"}
              aria-checked={checked}
              aria-disabled={disabled || undefined}
              aria-haspopup={isSub ? "menu" : undefined}
              aria-expanded={isSub ? subOpen : undefined}
              tabIndex={-1}
              className={["fl-cm-item", entry.kind !== "check" && entry.kind !== "radio" && entry.kind !== "sub" && entry.danger ? "fl-cm-item--danger" : "", subOpen ? "is-open" : ""].filter(Boolean).join(" ")}
              onClick={() => activate(entry, false)}
              onPointerMove={(e) => {
                if (e.pointerType !== "mouse" || disabled) return;
                const el = e.currentTarget;
                if (document.activeElement !== el) el.focus();
                if (isSub && !subOpen) {
                  window.clearTimeout(hoverTimer.current);
                  hoverTimer.current = window.setTimeout(() => setSub({ id: entry.id }), 120);
                } else if (!isSub && sub) {
                  window.clearTimeout(hoverTimer.current);
                  hoverTimer.current = window.setTimeout(() => setSub(null), 200);
                }
              }}
            >
              <span className="fl-cm-mark" aria-hidden="true">
                {entry.kind === "check" ? checked ? <Icon name="check" /> : null : entry.kind === "radio" ? checked ? <span className="fl-cm-dot" /> : null : "icon" in entry && entry.icon ? <Icon name={entry.icon} /> : null}
              </span>
              <span className="fl-cm-text">{entry.label}</span>
              {"keys" in entry && entry.keys ? <kbd className="fl-cm-keys">{entry.keys}</kbd> : null}
              {isSub ? (
                <span className="fl-cm-chev" aria-hidden="true">
                  <Icon name="chevron-right" />
                </span>
              ) : null}
            </div>
            {subOpen && entry.kind === "sub" ? (
              <MenuPanel
                key={entry.id}
                nested
                items={entry.items}
                label={entry.label}
                focusAt={sub?.focus}
                onPick={onPick}
                onSide={onSide ? (d) => d === 1 && onSide(1) : undefined}
                onClose={(how) => {
                  setSub(null);
                  if (how === "escape") (ref.current?.querySelector<HTMLElement>(`[aria-expanded="true"]`))?.focus();
                  else onClose(how);
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ── c.context-menu: the region, the pointer and keyboard ways in, and the menu placed at the point. ──

/**
 * c.context-menu: wraps a region. Right-click, a long press, Shift+F10 or the Menu key opens the menu; the element under
 * the pointer (or in focus) carrying data-menu-target names the target, null for the region itself. `items` can be a
 * list or a function of the target; `onSelect` gets the chosen entry and the target. Focus goes back where it was.
 */
export function ContextMenu({ items, label, onSelect, children, className, disabled }: {
  items: MenuEntry[] | ((target: string | null) => MenuEntry[]);
  label: string;
  onSelect: (entry: MenuEntry, target: string | null, keepOpen: boolean) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; target: string | null; key: number; fromKeys: boolean } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panel = useRef<HTMLUListElement | null>(null);
  const back = useRef<HTMLElement | null>(null);
  const press = useRef<{ timer: number; x: number; y: number; opened: boolean }>({ timer: 0, x: 0, y: 0, opened: false });

  const openAt = (x: number, y: number, from: HTMLElement | null, fromKeys: boolean) => {
    const hit = from?.closest<HTMLElement>("[data-menu-target]");
    back.current = (hit ?? (document.activeElement as HTMLElement | null)) || null;
    setPos(null);
    setMenu({ x, y, target: hit?.dataset.menuTarget ?? null, key: Date.now(), fromKeys });
  };
  const close = (how: MenuCloseReason) => {
    setMenu(null);
    if (how !== "outside") back.current?.focus();
  };

  // Placed at the point, then pulled back inside the window by its settled size.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!menu || !el) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    setPos({ left: Math.max(8, Math.min(menu.x, vw - el.offsetWidth - 8)), top: Math.max(8, Math.min(menu.y, vh - el.offsetHeight - 8)) });
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) close("outside");
    };
    const onAway = () => close("outside");
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onAway);
    window.addEventListener("blur", onAway);
    window.addEventListener("scroll", onAway, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onAway);
      window.removeEventListener("blur", onAway);
      window.removeEventListener("scroll", onAway, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);

  const list = menu ? (typeof items === "function" ? items(menu.target) : items) : [];

  return (
    <div
      className={["fl-cm-area", className].filter(Boolean).join(" ")}
      data-fl="c.context-menu"
      onContextMenu={(e) => {
        if (disabled || (panel.current && panel.current.contains(e.target as Node))) return;
        e.preventDefault();
        if (press.current.opened) return void (press.current.opened = false);
        openAt(e.clientX, e.clientY, e.target as HTMLElement, false);
      }}
      onKeyDown={(e) => {
        if (disabled || menu) return;
        if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
          e.preventDefault();
          const el = (e.target as HTMLElement).closest<HTMLElement>("[data-menu-target]") ?? (e.target as HTMLElement);
          const r = el.getBoundingClientRect();
          openAt(r.left + Math.min(24, r.width / 2), r.top + Math.min(r.height, 32), el, true);
        }
      }}
      // A long press on a touch screen (some phones never send contextmenu).
      onPointerDown={(e) => {
        if (disabled || e.pointerType !== "touch") return;
        const p = press.current;
        p.x = e.clientX;
        p.y = e.clientY;
        p.opened = false;
        const from = e.target as HTMLElement;
        window.clearTimeout(p.timer);
        p.timer = window.setTimeout(() => {
          p.opened = true;
          openAt(p.x, p.y, from, false);
        }, 500);
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (e.pointerType === "touch" && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) window.clearTimeout(p.timer);
      }}
      onPointerUp={() => window.clearTimeout(press.current.timer)}
      onPointerCancel={() => window.clearTimeout(press.current.timer)}
    >
      {children}
      {menu ? (
        <MenuPanel
          key={menu.key}
          panelRef={(el) => (panel.current = el)}
          items={list}
          label={label}
          focusAt={menu.fromKeys ? "first" : undefined}
          className="fl-cm-panel--float"
          style={pos ? { left: pos.left, top: pos.top } : { left: menu.x, top: menu.y }}
          onPick={(entry, keep) => {
            onSelect(entry, menu.target, keep);
            if (!keep) close("pick");
          }}
          onClose={close}
        />
      ) : null}
    </div>
  );
}

// ── The reference sheet: a file browser whose files and empty area have their own menus. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Files",
  title: "Spring launch",
  lede: "Right-click a file, or the space around them.",
  label: "Files in Spring launch",
  folders: ["Design", "Marketing", "Archive"],
  files: [
    { id: "f1", name: "Launch brief", kind: "doc", size: 48, edited: 6, starred: true },
    { id: "f2", name: "Hero photos", kind: "folder", size: 18400, edited: 2, starred: false },
    { id: "f3", name: "Pricing sheet", kind: "sheet", size: 112, edited: 1, starred: false },
    { id: "f4", name: "Press kit", kind: "folder", size: 9620, edited: 9, starred: false },
    { id: "f5", name: "Email copy", kind: "doc", size: 22, edited: 3, starred: true },
    { id: "f6", name: "Product video", kind: "video", size: 286000, edited: 12, starred: false },
  ],
  sorts: [
    { id: "name", label: "Name" },
    { id: "edited", label: "Last edited" },
    { id: "size", label: "Size" },
  ],
  hint: "Shift+F10 opens the menu from the keyboard.",
};

type File = (typeof SAMPLE.files)[number];
const KIND_ICON: Record<string, string> = { doc: "pencil", folder: "folder", sheet: "chart", video: "play" };
const sizeText = (kb: number) => (kb >= 1000 ? `${(kb / 1000).toFixed(kb >= 10000 ? 0 : 1)} MB` : `${kb} KB`);
const editedText = (d: number) => (d === 1 ? "Edited yesterday" : `Edited ${d} days ago`);

export default function ContextMenuPreview() {
  const d = SAMPLE;
  const [files, setFiles] = useState<File[]>(d.files);
  const [sort, setSort] = useState("name");
  const [sizes, setSizes] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [undo, setUndo] = useState<{ file: File; at: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  const sorted = [...files].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "edited" ? a.edited - b.edited : b.size - a.size));
  const focusFile = (id: string) => requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-menu-target="${id}"]`)?.focus());

  const fileItems = (f: File): MenuEntry[] => [
    { id: "open", label: "Open", icon: "external", keys: "Enter" },
    { id: "rename", label: "Rename", icon: "pencil", keys: "F2" },
    { id: "duplicate", label: "Duplicate", icon: "duplicate", keys: "Ctrl+D" },
    { kind: "check", id: "star", label: "Starred", checked: f.starred },
    { kind: "separator", id: "s1" },
    { kind: "sub", id: "move", label: "Move to", icon: "folder", items: d.folders.map((name) => ({ id: `move:${name}`, label: name, icon: "folder" })) },
    { kind: "sub", id: "share", label: "Share", icon: "share", items: [{ id: "copy-link", label: "Copy link", icon: "link" }, { id: "email", label: "Send by email", icon: "mail" }] },
    { kind: "separator", id: "s2" },
    { id: "delete", label: "Delete", icon: "trash", keys: "Del", danger: true },
  ];
  const areaItems: MenuEntry[] = [
    { id: "new-folder", label: "New folder", icon: "folder" },
    { id: "new-doc", label: "New document", icon: "plus" },
    { kind: "separator", id: "s1" },
    { kind: "label", id: "sort-label", label: "Sort by" },
    ...d.sorts.map((s) => ({ kind: "radio" as const, id: `sort:${s.id}`, label: s.label, checked: sort === s.id })),
    { kind: "separator", id: "s2" },
    { kind: "check", id: "sizes", label: "Show sizes", checked: sizes },
  ];

  const remove = (f: File) => {
    setFiles((list) => list.filter((x) => x.id !== f.id));
    setUndo({ file: f, at: Date.now() });
    setSaid(`Deleted ${f.name}.`);
    requestAnimationFrame(() => grid.current?.focus());
  };
  const addNew = (kind: "folder" | "doc") => {
    const id = `n${Date.now()}`;
    const name = kind === "folder" ? "New folder" : "Untitled document";
    setFiles((list) => [...list, { id, name, kind, size: kind === "folder" ? 0 : 1, edited: 0, starred: false }]);
    setRenaming(id);
    setSaid(`Added ${name}. Type a name and press Enter.`);
  };

  const onSelect = (entry: MenuEntry, target: string | null) => {
    const f = files.find((x) => x.id === target);
    const id = entry.id;
    if (id === "new-folder") return addNew("folder");
    if (id === "new-doc") return addNew("doc");
    if (id.startsWith("sort:")) {
      setSort(id.slice(5));
      return setSaid(`Sorted by ${"label" in entry ? entry.label.toLowerCase() : id.slice(5)}.`);
    }
    if (id === "sizes") {
      setSizes((v) => !v);
      return setSaid(sizes ? "Sizes hidden." : "Sizes shown.");
    }
    if (!f) return;
    if (id === "open") return setSaid(`Opened ${f.name}.`);
    if (id === "rename") return setRenaming(f.id);
    if (id === "duplicate") {
      const copy = { ...f, id: `c${Date.now()}`, name: `${f.name} copy`, edited: 0, starred: false };
      setFiles((list) => [...list, copy]);
      return setSaid(`Made ${copy.name}.`);
    }
    if (id === "star") {
      setFiles((list) => list.map((x) => (x.id === f.id ? { ...x, starred: !x.starred } : x)));
      return setSaid(f.starred ? `${f.name} unstarred.` : `${f.name} starred.`);
    }
    if (id.startsWith("move:")) {
      setFiles((list) => list.filter((x) => x.id !== f.id));
      setUndo({ file: f, at: Date.now() });
      return setSaid(`Moved ${f.name} to ${id.slice(5)}.`);
    }
    if (id === "copy-link") return setSaid(`Link to ${f.name} copied.`);
    if (id === "email") return setSaid(`Email draft for ${f.name} opened.`);
    if (id === "delete") return remove(f);
  };

  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="context-menu-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="context-menu-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <ContextMenu label="File actions" items={(t) => (t ? fileItems(files.find((f) => f.id === t) ?? files[0]!) : areaItems)} onSelect={onSelect}>
          <div ref={grid} className="fl-cm-files" role="group" aria-label={d.label} tabIndex={-1}>
            {sorted.length ? (
              sorted.map((f) => (
                <div
                  key={f.id}
                  className="fl-cm-file"
                  data-menu-target={f.id}
                  tabIndex={renaming === f.id ? -1 : 0}
                  aria-label={`${f.name}, ${editedText(f.edited)}${f.starred ? ", starred" : ""}. Shift+F10 for actions.`}
                  onDoubleClick={() => setSaid(`Opened ${f.name}.`)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter") setSaid(`Opened ${f.name}.`);
                    else if (e.key === "F2") setRenaming(f.id);
                    else if (e.key === "Delete") remove(f);
                  }}
                >
                  <span className={`fl-cm-file-icon fl-cm-file-icon--${f.kind}`} aria-hidden="true">
                    <Icon name={KIND_ICON[f.kind] ?? "folder"} />
                  </span>
                  {renaming === f.id ? (
                    <input
                      className="fl-cm-rename"
                      aria-label={`New name for ${f.name}`}
                      defaultValue={f.name}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = e.currentTarget.value.trim() || f.name;
                          setFiles((list) => list.map((x) => (x.id === f.id ? { ...x, name: v } : x)));
                          setRenaming(null);
                          setSaid(`Renamed to ${v}.`);
                          focusFile(f.id);
                        } else if (e.key === "Escape") {
                          setRenaming(null);
                          focusFile(f.id);
                        }
                      }}
                      onBlur={() => setRenaming(null)}
                    />
                  ) : (
                    <span className="fl-cm-file-name">
                      {f.name}
                      {f.starred ? (
                        <span className="fl-cm-star" aria-hidden="true">
                          <Icon name="star" filled />
                        </span>
                      ) : null}
                    </span>
                  )}
                  <span className="fl-cm-file-meta">
                    {editedText(f.edited)}
                    {sizes && f.size ? ` · ${sizeText(f.size)}` : ""}
                  </span>
                </div>
              ))
            ) : (
              <p className="fl-cm-empty">No files here. Right-click to add one.</p>
            )}
          </div>
        </ContextMenu>

        <div className="fl-cm-foot">
          <p className="fl-cm-status" role="status">
            {said}
          </p>
          {undo ? (
            <Button
              variant="tertiary"
              size={32}
              icon="refresh"
              onClick={() => {
                setFiles((list) => [...list, undo.file]);
                setSaid(`${undo.file.name} is back.`);
                focusFile(undo.file.id);
                setUndo(null);
              }}
            >
              Undo
            </Button>
          ) : (
            <span className="fl-cm-hint">{d.hint}</span>
          )}
        </div>
      </div>
    </section>
  );
}
