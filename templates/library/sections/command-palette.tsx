/** @flowcode-library command-palette · Command palette: search, groups, keyboard and the empty result (Small components)
 * Catalog ID: p.command-palette (pattern)
 * Function: The command palette pattern (p.command-palette) that opens on Ctrl+K; the reference sheet shows it open with grouped results, keyboard use, marked matches and an empty result that says what it searched.
 * Use it as: import { CommandPalette } from "./command-palette"; <CommandPalette groups={[{ name: "Go to", items: [{ id, label, icon?, keys? }] }]} onSelect={(item, group) => ...} onClose? placeholder? searched? autoFocus? />
 * Built from: c.text-field.outlined, c.button.tertiary
 * Look: A bordered panel with a search field on top, grouped results (icon, marked match, shortcut at the right) and a footer of key hints; the arrow keys move the highlight while focus stays in the field.
 * Tokens: --color-surface --color-border --color-text --color-text-muted --color-accent --radius-lg --space-3 --space-4 --text-md --focus-ring
 * Use cases: a power-user shortcut; jump to a record; run an action by name; a docs search; an admin console
 * Jobs to be done: get anywhere by typing; run a command without finding the menu; see what the shortcut is
 * Keywords: command palette, command k, quick search, fuzzy, keyboard, shortcut, results, recent
 */
/**
 * The box that opens on Ctrl+K and gets you anywhere. It is a listbox under a text field, which means the field keeps
 * focus the whole time and the arrow keys move a highlight rather than the focus itself - that is what makes typing
 * and choosing work at the same time.
 *
 * It works here. Open it, type, use the arrows, press Enter. The match is drawn in the result, results stay grouped,
 * each one shows its shortcut where it has one, and an empty search says what it looked through rather than going
 * blank.
 *
 * Make it the app's own: replace the commands. Keep the recent list for an empty query; a palette that starts blank
 * teaches nobody what it can do.
 */
/**
 * How to try it
 * - Press Ctrl+K anywhere on the page, or the button.
 * - Type: the list narrows, the match is marked, and results stay grouped.
 * - Arrow keys move the highlight while focus stays in the field; Enter runs; Escape closes.
 * - Type something that matches nothing: it says what it looked through.
 *
 * Dependencies: React (useEffect, useId, useMemo, useState), and the library's own inline icon set ("./icons"), which is a
 * table of SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The
 * styles are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs
 * in a built app exactly as it runs here.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";

// ── p.command-palette: the search box and its grouped results. Built from c.text-field and c.button. ──

export type PaletteItem = { id: string; label: string; icon?: string; keys?: string };
export type PaletteGroup = { name: string; items: PaletteItem[] };

type PaletteProps = {
  /** Results in the order shown; each group gets a heading. */
  groups: PaletteGroup[];
  /** Called with the item and its group name when one is chosen (Enter or click). */
  onSelect: (item: PaletteItem, group: string) => void;
  /** Called on Escape or the close button. Leave out to hide the close button. */
  onClose?: () => void;
  placeholder?: string;
  /** Said under "Nothing matches" so an empty result names what was searched. */
  searched?: string;
  /** Focus the field when it first appears. */
  autoFocus?: boolean;
  className?: string;
};

/** The matched part of a label, marked so it can be seen without being announced twice. */
function Marked({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/** Keyboard: arrows move the highlight while focus stays in the field; Enter chooses; Escape closes. */
export function CommandPalette({ groups: all, onSelect, onClose, placeholder = "Type a command, or part of a name", searched, autoFocus, className }: PaletteProps) {
  const uid = useId();
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);

  const total = useMemo(() => all.reduce((n, g) => n + g.items.length, 0), [all]);
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.map((g) => ({ name: g.name, items: g.items.filter((i) => i.label.toLowerCase().includes(t)) })).filter((g) => g.items.length);
  }, [q, all]);
  const hits = useMemo(() => groups.flatMap((g) => g.items.map((item) => ({ item, group: g.name }))), [groups]);

  useEffect(() => setAt(0), [q]);

  const run = (n: number) => {
    const hit = hits[n];
    if (!hit) return;
    onSelect(hit.item, hit.group);
    setQ("");
  };

  return (
    <div className={`fl-ctl-cmd${className ? ` ${className}` : ""}`} data-fl="p.command-palette">
      <div className="fl-ctl-cmd-field">
        <Icon name="search" />
        <label className="fl-sr" htmlFor={`${uid}-q`}>
          Search or run a command
        </label>
        <TextField
          id={`${uid}-q`}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded
          aria-controls={`${uid}-list`}
          aria-activedescendant={hits[at] ? `${uid}-${hits[at].item.id}` : undefined}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setAt((n) => (e.key === "ArrowDown" ? Math.min(hits.length - 1, n + 1) : Math.max(0, n - 1)));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(at);
            } else if (e.key === "Escape") {
              onClose?.();
            }
          }}
        />
        {onClose ? (
          <Button variant="tertiary" size={32} icon="close" iconOnly onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>

      <div className="fl-ctl-cmd-list" id={`${uid}-list`} role="listbox" aria-label="Commands">
        {groups.length ? (
          groups.map((g) => (
            <div key={g.name} className="fl-ctl-cmd-group" role="group" aria-label={g.name}>
              <p className="fl-ctl-cmd-head">{g.name}</p>
              <ul>
                {g.items.map((i) => {
                  const n = hits.findIndex((h) => h.item === i);
                  return (
                    <li
                      key={i.id}
                      id={`${uid}-${i.id}`}
                      role="option"
                      aria-selected={n === at}
                      className={n === at ? "is-on" : undefined}
                      onMouseEnter={() => setAt(n)}
                      onClick={() => run(n)}
                    >
                      {i.icon ? <Icon name={i.icon} /> : null}
                      <span>
                        <Marked text={i.label} q={q.trim()} />
                      </span>
                      {i.keys ? <kbd className="fl-ctl-menu-keys">{i.keys}</kbd> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <div className="fl-ctl-cmd-none">
            <strong>Nothing matches "{q}"</strong>
            <span className="fl-ctl-matrix-what">{searched ?? `Looked through ${total} commands. Try a shorter word.`}</span>
          </div>
        )}
      </div>

      <div className="fl-ctl-cmd-foot">
        <span>
          <kbd className="fl-ctl-menu-keys">&uarr;</kbd>
          <kbd className="fl-ctl-menu-keys">&darr;</kbd> to move
        </span>
        <span>
          <kbd className="fl-ctl-menu-keys">Enter</kbd> to run
        </span>
        <span>
          <kbd className="fl-ctl-menu-keys">Esc</kbd> to close
        </span>
        <span className="fl-ctl-matrix-what">
          {hits.length} of {total}
        </span>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  items: [
    { id: "c1", group: "Go to", label: "Shoots", icon: "image", keys: "G then S" },
    { id: "c2", group: "Go to", label: "Clients", icon: "users", keys: "G then C" },
    { id: "c3", group: "Go to", label: "Invoices", icon: "chart", keys: "" },
    { id: "c4", group: "Go to", label: "Settings", icon: "settings", keys: "" },
    { id: "c5", group: "Do", label: "New shoot", icon: "plus", keys: "N" },
    { id: "c6", group: "Do", label: "Invite someone to the studio", icon: "mail", keys: "" },
    { id: "c7", group: "Do", label: "Export this month's invoices", icon: "download", keys: "" },
    { id: "c8", group: "Do", label: "Switch to the light theme", icon: "bolt", keys: "" },
    { id: "c9", group: "Recent shoots", label: "Riverside wedding", icon: "folder", keys: "" },
    { id: "c10", group: "Recent shoots", label: "Harbour engagement", icon: "folder", keys: "" },
    { id: "c11", group: "Recent shoots", label: "Vineyard anniversary", icon: "folder", keys: "" },
  ],
};

const SAMPLE_GROUPS: PaletteGroup[] = SAMPLE.items.reduce<PaletteGroup[]>((out, i) => {
  const last = out[out.length - 1];
  const item = { id: i.id, label: i.label, icon: i.icon, keys: i.keys };
  if (last && last.name === i.group) last.items.push(item);
  else out.push({ name: i.group, items: [item] });
  return out;
}, []);

export default function CommandPaletteSpecimen() {
  const d = SAMPLE;
  const [open, setOpen] = useState(true);
  const [ran, setRan] = useState("");
  // Bumped each time the palette is opened on purpose, so it remounts empty with the field focused.
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setOpened((k) => k + 1);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-cmd-open fl-ctl-spec">
        <Button
          variant="secondary"
          size={40}
          icon="search"
          onClick={() => {
            setOpen(true);
            setOpened((k) => k + 1);
          }}
        >
          Search or run a command
          <kbd className="fl-ctl-menu-keys">Ctrl K</kbd>
        </Button>
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          {ran ? `Ran: ${ran}` : "Ctrl+K opens it from anywhere on this page."}
        </span>
      </div>

      {open ? (
        <div className="fl-ctl-spec fl-ctl-spec--bare">
          <CommandPalette
            key={opened}
            groups={SAMPLE_GROUPS}
            autoFocus={opened > 0}
            searched={`Looked through ${d.items.length} commands, your sections and your recent shoots. Try a shorter word.`}
            onSelect={(item, group) => {
              setRan(`${group}: ${item.label}`);
              setOpen(false);
            }}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>What makes it usable</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Focus never leaves the field.</strong>
            <span className="fl-ctl-matrix-what">The arrows move aria-activedescendant, so you can keep typing while a result is highlighted.</span>
          </li>
          <li>
            <strong>An empty query still shows something.</strong>
            <span className="fl-ctl-matrix-what">Recent things and the commands people forget they have. A blank palette teaches nobody.</span>
          </li>
          <li>
            <strong>The shortcut is shown beside the command.</strong>
            <span className="fl-ctl-matrix-what">This is where most people learn the shortcuts, so this is where they have to be.</span>
          </li>
          <li>
            <strong>No results says what it searched.</strong>
            <span className="fl-ctl-matrix-what">Clear the query and type "zzz": it tells you what it looked through.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
