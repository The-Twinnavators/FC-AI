/** @flowcode-library menubar · Menubar (Navigation)
 * Catalog ID: c.menubar (component)
 * Function: A desktop-style menubar (File, Edit, View, Format, Help) with one Tab stop, arrow keys across and down, typeahead, checks, options and submenus, shown on a note editor whose menus really change the note.
 * Use it as: import { Menubar } from "./menubar"; <Menubar label="Note" menus={[{ id: "file", label: "File", items: MenuEntry[] }]} onSelect={(entry, menuId, keepOpen) => ...} />  // MenuEntry from ./context-menu (actions, check, radio, label, separator, sub)
 * Built from: c.context-menu
 * Look: A slim bar of plain words; the open one sits on a soft fill under one sliding highlight, and its list drops from under it with icons, key hints, check marks and submenus.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --surface-shadow-overlay --radius-sm --radius-md --space-1 --space-2 --space-3 --text-sm --duration-fast --duration-base --ease-out --ease-spring --focus-ring
 * Use cases: document editor; design tool; admin console; desktop-style web app; spreadsheet; code playground; note app
 * Jobs to be done: find a command by browsing the menus; change view options; export my work; use the app without a mouse
 * Keywords: menubar, menu bar, file menu, submenu, keyboard, desktop app
 */
/**
 * Menubar: a row of menus like a desktop app's. One Tab stop: Left and Right move along the bar (and, while a menu is
 * open, open the next one), Down, Enter or Space open a menu at its first item and Up at its last, Home and End jump,
 * and a letter jumps to the menu that starts with it. Inside a menu everything the context menu does works: arrows,
 * typeahead, Right into a submenu and Left out of it, Enter to choose, Space to tick without closing, Escape back to the
 * bar. With one menu open, pointing at another opens it. One highlight slides between the open menus.
 * Make it the app's own: replace SAMPLE with the app's own menus and wire onSelect to its commands; keep each menu under
 * a dozen items and put rarely used ones in submenus.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its menubar's anatomy (menus, items, check and radio
 * items, shortcuts and submenus), rewritten without its dependencies.
 */
/**
 * How to try it
 * - Tab to "File", press Down: the menu opens at New note. Right moves to Edit, then View.
 * - In View, press Space on "Show word count": the count hides while the menu stays.
 * - Format › Font › Serif changes the note's type; File › Open recent loads another note.
 * - Edit › Clear note, then Edit › Undo brings it back.
 *
 * Dependencies: React (useEffect, useLayoutEffect, useRef, useState), the library's own menu list from "./context-menu",
 * and its inline icon set ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no
 * package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { MenuPanel, type MenuCloseReason, type MenuEntry } from "./context-menu";
import { Icon } from "./icons";

// ── c.menubar: one Tab stop, menus that open from it, and one highlight that slides between them. ──

export type MenubarMenu = { id: string; label: string; items: MenuEntry[] };

export function Menubar({ menus, label, onSelect, className }: {
  menus: MenubarMenu[];
  label: string;
  onSelect: (entry: MenuEntry, menuId: string, keepOpen: boolean) => void;
  className?: string;
}) {
  const uid = useId();
  const bar = useRef<HTMLUListElement>(null);
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<{ i: number; focus?: "first" | "last"; key: number } | null>(null);
  const [ind, setInd] = useState<{ x: number; y: number; w: number; h: number; ready: boolean } | null>(null);
  const n = menus.length;

  const focusTrigger = (i: number) => {
    const k = (i + n) % n;
    setActive(k);
    triggers.current[k]?.focus();
    return k;
  };
  const openMenu = (i: number, focus?: "first" | "last") => {
    const k = (i + n) % n;
    setActive(k);
    setOpen({ i: k, focus, key: Date.now() });
  };
  const close = (how: MenuCloseReason) => {
    const i = open?.i ?? active;
    setOpen(null);
    if (how === "escape" || how === "pick") triggers.current[i]?.focus();
  };

  // The highlight follows the open menu; it appears without sliding, then slides from one menu to the next.
  useLayoutEffect(() => {
    if (!open) return setInd((v) => (v ? { ...v, ready: false, w: 0 } : v));
    const li = triggers.current[open.i]?.parentElement;
    if (!li) return;
    setInd((v) => ({ x: li.offsetLeft, y: li.offsetTop, w: li.offsetWidth, h: li.offsetHeight, ready: !!v && v.w > 0 }));
  }, [open?.i, open === null]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (bar.current && !bar.current.contains(e.target as Node)) close("outside");
    };
    const onResize = () => close("outside");
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open !== null]);

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const go = (k: number) => {
      e.preventDefault();
      const to = focusTrigger(k);
      if (open) openMenu(to);
    };
    switch (e.key) {
      case "ArrowRight":
        return go(i + 1);
      case "ArrowLeft":
        return go(i - 1);
      case "Home":
        return go(0);
      case "End":
        return go(n - 1);
      case "ArrowDown":
      case "Enter":
      case " ":
        e.preventDefault();
        return openMenu(i, "first");
      case "ArrowUp":
        e.preventDefault();
        return openMenu(i, "last");
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(null);
        }
        return;
      case "Tab":
        if (open) setOpen(null);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      for (let k = 1; k <= n; k++) {
        const m = menus[(i + k) % n]!;
        if (m.label.toLowerCase().startsWith(ch)) return go(i + k);
      }
    }
  };

  return (
    <ul ref={bar} role="menubar" aria-label={label} className={["fl-mb", className].filter(Boolean).join(" ")} data-fl="c.menubar">
      {ind ? <li role="none" aria-hidden="true" className="fl-mb-ind" data-ready={ind.ready || undefined} style={{ translate: `${ind.x}px ${ind.y}px`, width: ind.w, height: ind.h, opacity: ind.w ? 1 : 0 }} /> : null}
      {menus.map((m, i) => {
        const isOpen = open?.i === i;
        return (
          <li key={m.id} role="none" className="fl-mb-li">
            <button
              ref={(el) => {
                triggers.current[i] = el;
              }}
              id={`${uid}-${m.id}`}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={isOpen ? `${uid}-${m.id}-menu` : undefined}
              tabIndex={i === active ? 0 : -1}
              className="fl-mb-trigger"
              onClick={() => (isOpen ? setOpen(null) : openMenu(i))}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse" && open && !isOpen) {
                  focusTrigger(i);
                  openMenu(i);
                }
              }}
              onKeyDown={(e) => onTriggerKey(e, i)}
            >
              {m.label}
            </button>
            {isOpen ? (
              <MenuPanel
                key={open.key}
                id={`${uid}-${m.id}-menu`}
                labelledBy={`${uid}-${m.id}`}
                label={m.label}
                items={m.items}
                fit
                className="fl-mb-panel"
                focusAt={open.focus}
                onPick={(entry, keep) => {
                  onSelect(entry, m.id, keep);
                  if (!keep) close("pick");
                }}
                onClose={close}
                onSide={(dir) => {
                  const to = focusTrigger(i + dir);
                  openMenu(to, "first");
                }}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// ── The reference sheet: a note editor whose menus change the note. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Editor",
  title: "A note with real menus",
  lede: "Tab to the bar and use the arrow keys, or click a menu.",
  notes: [
    { id: "walk", title: "Studio walk-through", text: "Kiln room first, then the glaze shelves.\nShow the new wheel and the drying racks.\nEnd at the shop with the spring mugs." },
    { id: "order", title: "Clay order", text: "Stoneware, 4 bags.\nPorcelain, 2 bags.\nAsk about the speckled buff before Friday." },
    { id: "class", title: "Saturday class plan", text: "Warm-up: pinch pots, 15 minutes.\nDemo: pulling a handle.\nEveryone glazes one piece to take home." },
  ],
  zooms: [90, 100, 125],
  fonts: [
    { id: "sans", label: "Sans" },
    { id: "serif", label: "Serif" },
    { id: "mono", label: "Mono" },
  ],
  exports: ["PDF", "Markdown", "Plain text"],
};

const FONT: Record<string, string> = { sans: "var(--font-sans)", serif: "var(--font-display)", mono: "var(--font-mono)" };

export default function MenubarPreview() {
  const d = SAMPLE;
  const [title, setTitle] = useState(d.notes[0]!.title);
  const [text, setText] = useState(d.notes[0]!.text);
  const [history, setHistory] = useState<Array<{ title: string; text: string }>>([]);
  const [bold, setBold] = useState(false);
  const [italic, setItalic] = useState(false);
  const [count, setCount] = useState(true);
  const [spell, setSpell] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [font, setFont] = useState("sans");
  const [said, setSaid] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const titleField = useRef<HTMLInputElement>(null);

  const keep = () => setHistory((h) => [...h.slice(-9), { title, text }]);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const menus: MenubarMenu[] = [
    {
      id: "file",
      label: "File",
      items: [
        { id: "new", label: "New note", icon: "plus", keys: "Ctrl+N" },
        { kind: "sub", id: "recent", label: "Open recent", icon: "clock", items: d.notes.map((n) => ({ id: `open:${n.id}`, label: n.title })) },
        { id: "rename", label: "Rename", icon: "pencil" },
        { kind: "separator", id: "s1" },
        { kind: "sub", id: "export", label: "Export as", icon: "download", items: d.exports.map((x) => ({ id: `export:${x}`, label: x })) },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { id: "undo", label: "Undo", icon: "refresh", keys: "Ctrl+Z", disabled: history.length === 0 },
        { kind: "separator", id: "s1" },
        { id: "select", label: "Select all", keys: "Ctrl+A" },
        { id: "copy", label: "Copy all", icon: "copy" },
        { kind: "separator", id: "s2" },
        { id: "clear", label: "Clear note", icon: "trash", danger: true },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { kind: "check", id: "count", label: "Show word count", checked: count },
        { kind: "check", id: "spell", label: "Check spelling", checked: spell },
        { kind: "separator", id: "s1" },
        { kind: "label", id: "zoom-label", label: "Zoom" },
        ...d.zooms.map((z) => ({ kind: "radio" as const, id: `zoom:${z}`, label: `${z}%`, checked: zoom === z })),
      ],
    },
    {
      id: "format",
      label: "Format",
      items: [
        { kind: "check", id: "bold", label: "Bold", checked: bold, keys: "Ctrl+B" },
        { kind: "check", id: "italic", label: "Italic", checked: italic, keys: "Ctrl+I" },
        { kind: "separator", id: "s1" },
        { kind: "sub", id: "font", label: "Font", items: d.fonts.map((f) => ({ kind: "radio" as const, id: `font:${f.id}`, label: f.label, checked: font === f.id })) },
      ],
    },
    {
      id: "help",
      label: "Help",
      items: [
        { id: "keys", label: "Keyboard help", icon: "help" },
        { id: "about", label: "About Notes", icon: "info" },
      ],
    },
  ];

  const onSelect = (entry: MenuEntry) => {
    const id = entry.id;
    const name = "label" in entry ? entry.label : id;
    if (id === "new") {
      keep();
      setTitle("Untitled note");
      setText("");
      setSaid("New note started.");
      return requestAnimationFrame(() => area.current?.focus());
    }
    if (id.startsWith("open:")) {
      const note = d.notes.find((x) => `open:${x.id}` === id);
      if (!note) return;
      keep();
      setTitle(note.title);
      setText(note.text);
      return setSaid(`Opened ${note.title}.`);
    }
    if (id === "rename") return requestAnimationFrame(() => titleField.current?.select());
    if (id.startsWith("export:")) return setSaid(`Exported ${title} as ${name}.`);
    if (id === "undo") {
      const last = history[history.length - 1];
      if (!last) return;
      setHistory((h) => h.slice(0, -1));
      setTitle(last.title);
      setText(last.text);
      return setSaid("Undone.");
    }
    if (id === "select") return requestAnimationFrame(() => area.current?.select());
    if (id === "copy") {
      void navigator.clipboard?.writeText(text).catch(() => undefined);
      return setSaid("Note copied.");
    }
    if (id === "clear") {
      keep();
      setText("");
      return setSaid("Note cleared. Edit › Undo brings it back.");
    }
    if (id === "count") return setCount((v) => !v);
    if (id === "spell") {
      setSpell((v) => !v);
      return setSaid(spell ? "Spell check off." : "Spell check on.");
    }
    if (id.startsWith("zoom:")) {
      setZoom(Number(id.slice(5)));
      return setSaid(`Zoom ${id.slice(5)}%.`);
    }
    if (id === "bold") return setBold((v) => !v);
    if (id === "italic") return setItalic((v) => !v);
    if (id.startsWith("font:")) {
      setFont(id.slice(5));
      return setSaid(`Font: ${name}.`);
    }
    if (id === "keys") return setSaid("Arrow keys move, Enter chooses, Space ticks, Escape goes back.");
    if (id === "about") return setSaid("Notes, a menubar sample.");
  };

  return (
    <section className="fl-section" aria-labelledby="menubar-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="menubar-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <div className="fl-mb-app">
          <div className="fl-mb-top">
            <span className="fl-mb-logo" aria-hidden="true">
              <Icon name="pencil" />
            </span>
            <Menubar label="Note" menus={menus} onSelect={onSelect} />
          </div>
          <div className="fl-mb-doc">
            <input ref={titleField} className="fl-mb-title" aria-label="Note title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea
              ref={area}
              className="fl-mb-text"
              aria-label="Note"
              value={text}
              spellCheck={spell}
              placeholder="Start typing…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (!(e.ctrlKey || e.metaKey)) return;
                const k = e.key.toLowerCase();
                if (k === "b") (e.preventDefault(), setBold((v) => !v));
                else if (k === "i") (e.preventDefault(), setItalic((v) => !v));
              }}
              style={{ fontFamily: FONT[font], fontWeight: bold ? "var(--weight-bold)" : undefined, fontStyle: italic ? "italic" : undefined, fontSize: `calc(var(--text-md) * ${zoom / 100})` }}
            />
          </div>
          <div className="fl-mb-foot">
            <p className="fl-mb-status" role="status">
              {said}
            </p>
            {count ? <span className="fl-mb-count">{words === 1 ? "1 word" : `${words} words`}</span> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
