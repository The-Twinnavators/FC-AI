/** @flowcode-library shortcuts-sheet · Keyboard shortcuts sheet (Dialogs and drawers)
 * Catalog ID: p.shortcuts-sheet (pattern)
 * Function: Keyboard shortcuts sheet (p.shortcuts-sheet): a dialog listing an app's keyboard shortcuts, opened from a button or by pressing ? anywhere; search by action or key with the matches marked, a Mac / Windows switch (picked from the device to start) that redraws every key as ⌘ ⌥ ⇧ or Ctrl Alt Shift, groups that fold, key sequences shown as "then", a no-match state with Clear search, and try-it: pressing a listed shortcut while the sheet is open lights up its row and says what it does; Escape or Close returns focus to where it was.
 * Use it as: import { ShortcutsSheet } from "./shortcuts-sheet"; <ShortcutsSheet title shortcuts={[{ id, action, keys: "Mod+K" | "G B" (a space is "then"), group }]} groups?={["General", ...]} platform?="mac"|"other" hotkey?="?" labels?={{ open, search, mac, other, then, noMatch, clear, close, tryIt, ... }} />
 * Built from: c.button.tertiary, c.text-field.outlined
 * Look: A quiet Keyboard shortcuts button with a ? key cap; the sheet is a white dialog (up to 40rem) with the title and a close button, a search box beside a Mac / Windows switch with a sliding thumb, and two columns of groups: a small group heading with a count and a fold chevron, then rows with the action on the left and raised key caps on the right; a row lights up in accent when its shortcut is pressed.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --font-mono --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-hover --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: keyboard shortcuts; hotkeys help; shortcut cheat sheet; power user help; accessibility help; editor shortcuts
 * Jobs to be done: find the shortcut for something I do often; learn an app's shortcuts on my own computer's keys; check what a key does by pressing it; open the list from anywhere without the mouse
 * Keywords: keyboard shortcuts, hotkeys, cheat sheet, key caps, command, ctrl, cmd, mac, windows, help dialog
 */
/**
 * Shortcuts sheet: a native modal <dialog> (focus stays inside, Escape closes, the page behind is inert). Keys are
 * written once with Mod for the platform's main modifier (⌘ on Mac, Ctrl elsewhere), plus Alt, Shift, Enter, Esc
 * and arrows; the switch redraws them. ? opens the sheet unless focus is in a text field. While the sheet is open,
 * pressing a listed shortcut lights its row (it doesn't run the action: this is the help, not the app). Groups fold
 * with grid rows and are inert while folded; search results glide into place; the dialog rises in and the switch
 * thumb slides. With motion off it all simply changes.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its menubar shortcuts, dialog and kbd styling, and
 * HyperUI (MIT, Copyright (c) Mark Mead): its modals and description lists.
 */
/**
 * How to try it
 * - Press ? (not in a text field): the sheet opens with the search focused. Escape closes it and focus returns.
 * - Type "task": only matching rows stay, with the words marked. Type "zzz" for the no-match state; Clear search.
 * - Switch to Windows: ⌘ becomes Ctrl, ⌥ becomes Alt. Fold Navigation with its heading.
 * - Tab out of the search and press Ctrl+K (or ⌘K): the Open command menu row lights up and it's announced.
 * - At 375px wide the groups stack in one column.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Button and TextField
 * ("./buttons-variants", "./text-fields-states") and its inline icon set ("./icons"). Nothing else: no package and
 * nothing fetched. The styles are the library's own fl- classes in templates/library/css/r6b-shortcuts-sheet.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── p.shortcuts-sheet: a searchable, platform-aware list of keyboard shortcuts. ──

export type Shortcut = { id: string; action: string; keys: string; group: string };
export type ShortcutPlatform = "mac" | "other";

export type ShortcutsSheetLabels = Partial<{
  open: string;
  hint: string;
  search: string;
  platform: string;
  mac: string;
  other: string;
  then: string;
  noMatch: string;
  clear: string;
  close: string;
  count: string;
  pressed: string;
  shown: string;
}>;

export type ShortcutsSheetProps = {
  title: string;
  shortcuts: Shortcut[];
  /** Group order; the shortcuts' own order of first appearance when left out. */
  groups?: string[];
  /** Which keys to draw first; read from the device when left out. */
  platform?: ShortcutPlatform;
  /** The key that opens the sheet from anywhere (not while typing); "?" when left out, "" for none. */
  hotkey?: string;
  labels?: ShortcutsSheetLabels;
};

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    // A closed dialog has no boxes: nothing to glide from.
    if (!el || !el.getClientRects().length) {
      last.current = new Map();
      return;
    }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    const now = new Map(nodes.map((n) => [n.dataset.flip!, n.getBoundingClientRect().top]));
    if (!motionOff() && last.current.size) {
      const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        if (was === undefined) n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: tokenMs("--duration-base", 200), easing: ease });
        else if (was !== now.get(n.dataset.flip!)) n.animate([{ translate: `0 ${was - now.get(n.dataset.flip!)!}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: ease });
      }
    }
    last.current = now;
  }, [key, box]);
}

const MAC: Record<string, string> = { mod: "⌘", alt: "⌥", shift: "⇧", ctrl: "⌃", enter: "↵", esc: "Esc", up: "↑", down: "↓", left: "←", right: "→", backspace: "⌫" };
const OTHER: Record<string, string> = { mod: "Ctrl", alt: "Alt", shift: "Shift", ctrl: "Ctrl", enter: "Enter", esc: "Esc", up: "↑", down: "↓", left: "←", right: "→", backspace: "Backspace" };
const SPOKEN: Record<string, string> = { "⌘": "Command", "⌥": "Option", "⇧": "Shift", "⌃": "Control", "↵": "Return", "↑": "Up arrow", "↓": "Down arrow", "←": "Left arrow", "→": "Right arrow", "⌫": "Delete" };

/** "Mod+Shift+K" → [["⌘","⇧","K"]]; "G B" → [["G"],["B"]] (a sequence). */
function chords(keys: string, p: ShortcutPlatform) {
  const map = p === "mac" ? MAC : OTHER;
  return keys
    .trim()
    .split(/\s+/)
    .map((c) => c.split("+").map((k) => map[k.toLowerCase()] ?? (k.length === 1 ? k.toUpperCase() : k)));
}
/** What a key press is, in the same words as a shortcut's keys ("Mod+K"), or null for a lone modifier. */
function pressName(e: KeyboardEvent, p: ShortcutPlatform) {
  if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return null;
  const parts: string[] = [];
  if (p === "mac" ? e.metaKey : e.ctrlKey) parts.push("Mod");
  if (p === "mac" && e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && (e.key.length > 1 || /^[a-z]$/i.test(e.key))) parts.push("Shift");
  const named: Record<string, string> = { Enter: "Enter", Escape: "Esc", ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", Backspace: "Backspace" };
  const base = named[e.key] ?? (e.altKey && /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : e.key.length === 1 ? e.key.toUpperCase() : e.key);
  parts.push(base);
  return parts.join("+").toLowerCase();
}
function detectPlatform(): ShortcutPlatform {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const s = nav.userAgentData?.platform ?? navigator.platform ?? navigator.userAgent;
  return /mac|iphone|ipad/i.test(s) ? "mac" : "other";
}
function mark(text: string, q: string): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function ShortcutsSheet({ title, shortcuts, groups, platform, hotkey = "?", labels = {} }: ShortcutsSheetProps) {
  const l = {
    open: "Keyboard shortcuts",
    hint: "Press {key} anytime",
    search: "Search shortcuts",
    platform: "Keys for",
    mac: "Mac",
    other: "Windows",
    then: "then",
    noMatch: "No shortcuts match “{q}”",
    clear: "Clear search",
    close: "Close",
    count: "{n} shortcuts",
    pressed: "{keys}: {action}",
    shown: "{n} shown",
    ...labels,
  };
  const id = useId();
  const dlg = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const seg = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [plat, setPlat] = useState<ShortcutPlatform>(platform ?? "other");
  const [q, setQ] = useState("");
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [lit, setLit] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [ind, setInd] = useState({ x: 0, w: 0 });
  const litTimer = useRef(0);
  const lastPress = useRef<{ name: string; t: number } | null>(null);

  useEffect(() => {
    if (!platform) setPlat(detectPlatform());
  }, [platform]);

  const show = () => {
    const d = dlg.current;
    if (!d || d.open) return;
    d.showModal();
    setOpen(true);
    window.setTimeout(() => document.getElementById(`${id}-q`)?.focus(), 0);
  };
  const hide = () => dlg.current?.close();

  // ? from anywhere (not while typing) opens the sheet.
  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== hotkey || e.ctrlKey || e.metaKey || e.altKey || dlg.current?.open) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")) return;
      e.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Try-it: a listed shortcut pressed while the sheet is open lights its row.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const name = pressName(e, plat);
      if (!name || name === "esc") return;
      const inField = e.target instanceof Element && e.target.closest("input, textarea");
      const hasMod = e.metaKey || e.ctrlKey || e.altKey;
      if (inField && !hasMod) return;
      if (!hasMod && ["tab", "enter", " "].includes(name)) return;
      const norm = (k: string) => k.trim().toLowerCase().replace(/\s+/g, " ");
      const prev = lastPress.current && Date.now() - lastPress.current.t < 1200 ? lastPress.current.name : null;
      lastPress.current = { name, t: Date.now() };
      const hit = (prev ? shortcuts.find((s) => norm(s.keys) === `${prev} ${name}`) : undefined) ?? shortcuts.find((s) => norm(s.keys) === name);
      if (!hit) return;
      e.preventDefault();
      setLit(hit.id);
      setFolded((f) => ({ ...f, [hit.group]: false }));
      setSaid(l.pressed.replace("{keys}", chords(hit.keys, plat).map((c) => c.join(plat === "mac" ? "" : "+")).join(` ${l.then} `)).replace("{action}", hit.action));
      window.clearTimeout(litTimer.current);
      litTimer.current = window.setTimeout(() => setLit(null), 1400);
      window.setTimeout(() => document.getElementById(`${id}-row-${hit.id}`)?.scrollIntoView({ block: "nearest", behavior: motionOff() ? "auto" : "smooth" }), 0);
    };
    const d = dlg.current;
    d?.addEventListener("keydown", onKey);
    return () => d?.removeEventListener("keydown", onKey);
  }, [open, plat, shortcuts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    const onClose = () => {
      setOpen(false);
      setLit(null);
      window.setTimeout(() => {
        if (document.activeElement === document.body || !document.activeElement) trigger.current?.focus();
      }, 0);
    };
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);
  useEffect(() => () => window.clearTimeout(litTimer.current), []);

  useLayoutEffect(() => {
    const el = seg.current?.querySelector<HTMLElement>("label:has(input:checked)");
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [plat, open]);

  const order = groups ?? [...new Set(shortcuts.map((s) => s.group))];
  const needle = q.trim().toLowerCase();
  const matches = (s: Shortcut) => {
    if (!needle) return true;
    const drawn = chords(s.keys, plat).flat().join(" ").toLowerCase();
    return s.action.toLowerCase().includes(needle) || s.keys.toLowerCase().includes(needle) || drawn.includes(needle) || s.group.toLowerCase().includes(needle);
  };
  const shown = shortcuts.filter(matches);
  useFlip(list, `${open}|${needle}|${plat}|${shown.map((s) => s.id).join(",")}|${Object.entries(folded).filter(([, v]) => v).map(([k]) => k).join(",")}`);

  const spoken = (keys: string) =>
    chords(keys, plat)
      .map((c) => c.map((k) => SPOKEN[k] ?? k).join(" "))
      .join(`, ${l.then} `);

  return (
    <div className="fl-kbsh" data-fl="p.shortcuts-sheet">
      <button ref={trigger} type="button" className="fl-kbsh-trigger" aria-haspopup="dialog" aria-keyshortcuts={hotkey || undefined} onClick={show}>
        <Icon name="bolt" />
        {l.open}
        {hotkey ? (
          <kbd className="fl-kbsh-cap" aria-hidden="true">
            {hotkey}
          </kbd>
        ) : null}
      </button>
      {hotkey ? <p className="fl-kbsh-hint">{l.hint.replace("{key}", hotkey)}</p> : null}

      <dialog ref={dlg} className="fl-kbsh-dialog" aria-labelledby={`${id}-title`} onClick={(e) => e.target === e.currentTarget && hide()}>
        <div className="fl-kbsh-panel">
          <header className="fl-kbsh-head">
            <h2 id={`${id}-title`}>{title}</h2>
            <span className="fl-kbsh-total">{needle ? l.shown.replace("{n}", String(shown.length)) : l.count.replace("{n}", String(shortcuts.length))}</span>
            <Button variant="tertiary" size={32} icon="close" iconOnly onClick={hide}>
              {l.close}
            </Button>
          </header>
          <div className="fl-kbsh-tools">
            <span className="fl-kbsh-search">
              <Icon name="search" />
              <TextField id={`${id}-q`} type="search" size={40} aria-label={l.search} placeholder={l.search} value={q} autoComplete="off" onChange={(e) => setQ(e.currentTarget.value)} />
            </span>
            <div className="fl-kbsh-seg" role="radiogroup" aria-label={l.platform} ref={seg} style={{ ["--ind-x" as string]: `${ind.x}px`, ["--ind-w" as string]: `${ind.w}px` }}>
              <i aria-hidden="true" />
              {(["mac", "other"] as const).map((p) => (
                <label key={p}>
                  <input type="radio" name={`${id}-plat`} value={p} checked={plat === p} onChange={() => setPlat(p)} />
                  {p === "mac" ? l.mac : l.other}
                </label>
              ))}
            </div>
          </div>

          <div className="fl-kbsh-body" ref={list}>
            {!shown.length ? (
              <div className="fl-kbsh-empty">
                <Icon name="search" />
                <p>{l.noMatch.replace("{q}", q.trim())}</p>
                <Button
                  variant="tertiary"
                  size={32}
                  onClick={() => {
                    setQ("");
                    document.getElementById(`${id}-q`)?.focus();
                  }}
                >
                  {l.clear}
                </Button>
              </div>
            ) : (
              order.map((g) => {
                const rows = shown.filter((s) => s.group === g);
                if (!rows.length) return null;
                const isFolded = Boolean(folded[g]) && !needle;
                return (
                  <section key={g} className="fl-kbsh-group" data-flip={`g-${g}`} aria-labelledby={`${id}-g-${g}`}>
                    <h3>
                      <button id={`${id}-g-${g}`} type="button" aria-expanded={!isFolded} aria-controls={`${id}-gl-${g}`} disabled={Boolean(needle)} onClick={() => setFolded({ ...folded, [g]: !folded[g] })}>
                        <span>{g}</span>
                        <span className="fl-kbsh-gcount">{rows.length}</span>
                        <Icon name="chevron-down" />
                      </button>
                    </h3>
                    <div id={`${id}-gl-${g}`} className={["fl-kbsh-fold", isFolded ? "" : "is-open"].filter(Boolean).join(" ")} inert={isFolded || undefined}>
                      <dl>
                        {rows.map((s) => (
                          <div key={s.id} id={`${id}-row-${s.id}`} data-flip={s.id} className={["fl-kbsh-row", lit === s.id ? "is-lit" : ""].filter(Boolean).join(" ")}>
                            <dt>{mark(s.action, q.trim())}</dt>
                            <dd aria-label={spoken(s.keys)}>
                              {chords(s.keys, plat).map((c, ci) => (
                                <span key={ci} className="fl-kbsh-chord" aria-hidden="true">
                                  {ci ? <span className="fl-kbsh-then">{l.then}</span> : null}
                                  {c.map((k, ki) => (
                                    <kbd key={ki} className="fl-kbsh-cap">
                                      {k}
                                    </kbd>
                                  ))}
                                </span>
                              ))}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </section>
                );
              })
            )}
          </div>
          <p className="fl-sr" role="status" aria-live="polite">
            {said}
          </p>
        </div>
      </dialog>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Keyboard shortcuts",
  groups: ["General", "Navigation", "Tasks", "Editing"],
  shortcuts: [
    { id: "k1", action: "Open command menu", keys: "Mod+K", group: "General" },
    { id: "k2", action: "Show keyboard shortcuts", keys: "?", group: "General" },
    { id: "k3", action: "Search", keys: "/", group: "General" },
    { id: "k4", action: "Toggle sidebar", keys: "Mod+\\", group: "General" },
    { id: "k5", action: "Go to inbox", keys: "G I", group: "Navigation" },
    { id: "k6", action: "Go to board", keys: "G B", group: "Navigation" },
    { id: "k7", action: "Go to calendar", keys: "G C", group: "Navigation" },
    { id: "k8", action: "Next item", keys: "J", group: "Navigation" },
    { id: "k9", action: "Previous item", keys: "K", group: "Navigation" },
    { id: "k10", action: "New task", keys: "C", group: "Tasks" },
    { id: "k11", action: "Assign task to me", keys: "I", group: "Tasks" },
    { id: "k12", action: "Mark task done", keys: "Mod+Enter", group: "Tasks" },
    { id: "k13", action: "Set due date", keys: "Shift+D", group: "Tasks" },
    { id: "k14", action: "Bold", keys: "Mod+B", group: "Editing" },
    { id: "k15", action: "Insert link", keys: "Mod+Shift+U", group: "Editing" },
    { id: "k16", action: "Move line up", keys: "Alt+Up", group: "Editing" },
    { id: "k17", action: "Undo", keys: "Mod+Z", group: "Editing" },
  ] as Shortcut[],
};

export default function ShortcutsSheetDemo() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ShortcutsSheet title={SAMPLE.title} groups={SAMPLE.groups} shortcuts={SAMPLE.shortcuts} />
      </div>
    </section>
  );
}
