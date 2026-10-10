/** @flowcode-library command-palette · Command palette: search, groups, keyboard and the empty result (Small components)
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
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";

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

export default function CommandPalette() {
  const d = SAMPLE;
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const [ran, setRan] = useState("");
  const field = useRef<HTMLInputElement>(null);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? d.items.filter((i) => i.label.toLowerCase().includes(t)) : d.items;
  }, [q, d.items]);

  const groups = useMemo(() => {
    const out: { name: string; items: typeof d.items }[] = [];
    for (const i of hits) {
      const last = out[out.length - 1];
      if (last && last.name === i.group) last.items.push(i);
      else out.push({ name: i.group, items: [i] });
    }
    return out;
  }, [hits]);

  useEffect(() => setAt(0), [q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        window.setTimeout(() => field.current?.focus(), 0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (n: number) => {
    const item = hits[n];
    if (!item) return;
    setRan(`${item.group}: ${item.label}`);
    setOpen(false);
    setQ("");
  };

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-cmd-open">
        <button
          type="button"
          className="fl-btn fl-btn--secondary fl-ctl-btn--40"
          onClick={() => {
            setOpen(true);
            window.setTimeout(() => field.current?.focus(), 0);
          }}
        >
          <Icon name="search" /> Search or run a command
          <kbd className="fl-ctl-menu-keys">Ctrl K</kbd>
        </button>
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          {ran ? `Ran: ${ran}` : "Ctrl+K opens it from anywhere on this page."}
        </span>
      </div>

      {open ? (
        <div className="fl-ctl-cmd">
          <div className="fl-ctl-cmd-field">
            <Icon name="search" />
            <label className="fl-sr" htmlFor="cmd-q">
              Search or run a command
            </label>
            <input
              id="cmd-q"
              ref={field}
              className="fl-input"
              role="combobox"
              aria-expanded
              aria-controls="cmd-list"
              aria-activedescendant={hits[at] ? `cmd-${hits[at].id}` : undefined}
              aria-autocomplete="list"
              placeholder="Type a command, or part of a name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setAt((n) => (e.key === "ArrowDown" ? Math.min(hits.length - 1, n + 1) : Math.max(0, n - 1)));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  run(at);
                }
              }}
            />
            <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32" aria-label="Close" onClick={() => setOpen(false)}>
              <Icon name="close" />
            </button>
          </div>

          <div className="fl-ctl-cmd-list" id="cmd-list" role="listbox" aria-label="Commands">
            {groups.length ? (
              groups.map((g) => (
                <div key={g.name} className="fl-ctl-cmd-group" role="group" aria-label={g.name}>
                  <p className="fl-ctl-cmd-head">{g.name}</p>
                  <ul>
                    {g.items.map((i) => {
                      const n = hits.indexOf(i);
                      return (
                        <li
                          key={i.id}
                          id={`cmd-${i.id}`}
                          role="option"
                          aria-selected={n === at}
                          className={n === at ? "is-on" : undefined}
                          onMouseEnter={() => setAt(n)}
                          onClick={() => run(n)}
                        >
                          <Icon name={i.icon} />
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
                <span className="fl-ctl-matrix-what">
                  Looked through {d.items.length} commands, your sections and your recent shoots. Try a shorter word.
                </span>
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
              {hits.length} of {d.items.length}
            </span>
          </div>
        </div>
      ) : null}

      <div className="fl-ctl-sizes">
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
