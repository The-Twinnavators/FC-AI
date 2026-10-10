/** @flowcode-library dropdowns-states · Dropdowns: select, combo box and the open menu (Forms)
 * Use cases: country picker; status filter; assignee picker; sort order; settings choice
 * Jobs to be done: choose one from many; find an option by typing; see what is chosen now
 * Keywords: select, dropdown, combo box, menu, option, disabled
 */
/**
 * A select for a short list, a combo box when the list is long enough to need typing, and the open menu itself with a
 * chosen option and a hovered one. The open menus are drawn inline rather than floating, so they can be read here.
 *
 * All three menus work: the listbox takes arrow keys, Home, End and Enter; the multi-select keeps a count; the
 * overflow menu opens from its own button, skips the disabled item on the way past, and closes on Escape.
 *
 * Make it the app's own: replace the options. Keep the chosen option marked with a tick, not with color alone.
 */
/**
 * How to try it
 * - Open any select or type in any combo box in the matrix.
 * - "Choose one": arrow keys and Home/End move the highlight, Enter chooses, and the tick follows.
 * - "Choose several": the count follows the boxes, and Clear empties them.
 * - "Combo box, open": type and the list narrows; an empty result says so.
 * - "Overflow menu": the kebab opens and closes it, arrows skip the disabled item, Escape shuts it.
 *
 * Dependencies: React (useEffect, useState), and the library's own inline icon set ("./icons"), which is a table of SVG
 * paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are
 * the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built
 * app exactly as it runs here.
 */
import { useEffect, useState } from "react";
import { Icon } from "./icons";

type Action = { id: string; label: string; icon: string; keys: string; disabled?: boolean; danger?: boolean };

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "select", label: "Select", what: "A short list, chosen from a menu" },
    { id: "combo", label: "Combo box", what: "Long lists: type to narrow" },
  ],
  states: [
    { id: "rest", label: "Enabled", what: "Nothing selected yet" },
    { id: "focus", label: "Focused", what: "Ready for the keyboard" },
    { id: "chosen", label: "Selected", what: "Has a value" },
    { id: "invalid", label: "Error", what: "Rejected, with the reason" },
    { id: "disabled", label: "Disabled", what: "Not available" },
  ],
  options: ["Any status", "Enquiry", "Booked", "Shot", "Delivered"],
  multi: [
    { id: "m1", label: "Enquiry", on: true },
    { id: "m2", label: "Booked", on: true },
    { id: "m3", label: "Shot", on: false },
    { id: "m4", label: "Delivered", on: false },
  ],
  actions: [
    { id: "a1", label: "Rename", icon: "pencil", keys: "F2" },
    { id: "a2", label: "Duplicate", icon: "plus", keys: "" },
    { id: "a3", label: "Download", icon: "download", keys: "" },
    { id: "a4", label: "Move to folder", icon: "layers", keys: "", disabled: true },
    { id: "a5", label: "Delete", icon: "trash", keys: "", danger: true },
  ] as Action[],
};

/** Choose one: a listbox with a roving active option and a tick on the chosen one. */
function ChooseOne({ say }: { say: (s: string) => void }) {
  const opts = SAMPLE.options;
  const [chosen, setChosen] = useState("Booked");
  const [active, setActive] = useState(opts.indexOf("Booked"));
  const pick = (n: number) => {
    setChosen(opts[n]);
    say(`Status: ${opts[n]}`);
  };
  return (
    <ul
      className="fl-ctl-menu"
      role="listbox"
      aria-label="Status"
      tabIndex={0}
      aria-activedescendant={`dd-one-${active}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
          e.preventDefault();
          setActive((n) => (e.key === "ArrowDown" ? Math.min(opts.length - 1, n + 1) : e.key === "ArrowUp" ? Math.max(0, n - 1) : e.key === "Home" ? 0 : opts.length - 1));
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pick(active);
        }
      }}
    >
      {opts.map((o, n) => (
        <li
          key={o}
          id={`dd-one-${n}`}
          role="option"
          aria-selected={o === chosen}
          className={n === active ? "is-hover" : undefined}
          onMouseEnter={() => setActive(n)}
          onClick={() => pick(n)}
        >
          <span className="fl-ctl-menu-tick">{o === chosen ? <Icon name="check" /> : null}</span>
          {o}
        </li>
      ))}
    </ul>
  );
}

/** Choose several: checkboxes, a count, and a Clear that empties them. */
function ChooseSeveral({ say }: { say: (s: string) => void }) {
  const all = SAMPLE.multi;
  const [on, setOn] = useState<string[]>(all.filter((m) => m.on).map((m) => m.id));
  const toggle = (id: string, label: string) => {
    const next = on.includes(id) ? on.filter((x) => x !== id) : [...on, id];
    setOn(next);
    say(`${label} ${on.includes(id) ? "off" : "on"}, ${next.length} of ${all.length} chosen`);
  };
  return (
    <div className="fl-ctl-menu" role="group" aria-label="Statuses">
      <ul>
        {all.map((m) => (
          <li key={m.id}>
            <label className="fl-ctl-menu-check">
              <input type="checkbox" className="fl-ctl-check fl-ctl-check--16" checked={on.includes(m.id)} onChange={() => toggle(m.id, m.label)} />
              {m.label}
            </label>
          </li>
        ))}
      </ul>
      <div className="fl-ctl-menu-foot">
        <span className="fl-ctl-matrix-what">
          {on.length} of {all.length} chosen
        </span>
        <button
          type="button"
          className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--32"
          disabled={!on.length}
          onClick={() => {
            setOn([]);
            say("Statuses cleared");
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

/** An overflow menu that opens from its own button and skips what it cannot do. */
function OverflowMenu({ say }: { say: (s: string) => void }) {
  const items = SAMPLE.actions;
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const step = (dir: number) => {
    let n = active;
    for (let i = 0; i < items.length; i += 1) {
      n = (n + dir + items.length) % items.length;
      if (!items[n].disabled) break;
    }
    setActive(n);
  };

  const run = (a: Action) => {
    if (a.disabled) return;
    setOpen(false);
    say(a.danger ? `${a.label} would ask before it does anything` : `${a.label}: done`);
  };

  return (
    <>
      <span className="fl-ctl-icon-row">
        <button
          type="button"
          className={`fl-btn fl-ctl-btn--tertiary fl-ctl-btn--icon fl-ctl-btn--32${open ? " is-hover" : ""}`}
          aria-label="More actions"
          aria-expanded={open}
          aria-haspopup="menu"
          title="More actions"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="more" />
        </button>
      </span>
      {open ? (
        <ul
          className="fl-ctl-menu fl-ctl-menu--actions"
          role="menu"
          aria-label="Actions"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              step(e.key === "ArrowDown" ? 1 : -1);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              run(items[active]);
            }
          }}
        >
          {items.map((a, n) => (
            <li
              key={a.id}
              role="menuitem"
              aria-disabled={a.disabled || undefined}
              tabIndex={-1}
              className={`${a.danger ? "is-danger" : ""}${a.disabled ? " is-disabled" : ""}${n === active ? " is-hover" : ""}`}
              onMouseEnter={() => !a.disabled && setActive(n)}
              onClick={() => run(a)}
            >
              <Icon name={a.icon} />
              {a.label}
              {a.keys ? <kbd className="fl-ctl-menu-keys">{a.keys}</kbd> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="fl-ctl-matrix-what">Closed. Press the button to open it again.</p>
      )}
    </>
  );
}

export default function DropdownsStates() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">A select and a combo box in each state</caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              {d.kinds.map((k) => (
                <th key={k.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{k.label}</span>
                  <span className="fl-ctl-matrix-what">{k.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.states.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{s.label}</span>
                  <span className="fl-ctl-matrix-what">{s.what}</span>
                </th>
                {d.kinds.map((k) => {
                  const id = `dd-${k.id}-${s.id}`;
                  const invalid = s.id === "invalid";
                  const cls = `fl-input fl-ctl-field fl-ctl-field--outlined${s.id === "focus" ? " is-focus" : ""}${invalid ? " is-invalid" : ""}`;
                  return (
                    <td key={k.id} data-state={k.label}>
                      <label className="fl-sr" htmlFor={id}>
                        Status, {k.label}, {s.label}
                      </label>
                      {k.id === "select" ? (
                        <span className="fl-ctl-select">
                          <select
                            id={id}
                            className={cls}
                            disabled={s.id === "disabled"}
                            defaultValue={s.id === "chosen" ? "Booked" : "Any status"}
                            aria-invalid={invalid || undefined}
                            onChange={(e) => setSaid(`Status: ${e.target.value}`)}
                          >
                            {d.options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                          <Icon name="chevron-down" />
                        </span>
                      ) : (
                        <Combo id={id} cls={cls} state={s.id} invalid={invalid} say={setSaid} />
                      )}
                      {invalid ? <span className="fl-ctl-field-msg">Choose a status to carry on</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Menus, open</h3>
        <p className="fl-ctl-btn-what">
          Three shapes behind the same control. Choose one marks with a tick; choosing several needs checkboxes because a
          tick cannot say "not this one"; an overflow menu is a list of actions, not of values.
        </p>
        <div className="fl-ctl-menu-grid">
          <div>
            <p className="fl-ctl-matrix-kind">Choose one</p>
            <p className="fl-ctl-matrix-what">The selected option ticked, the one under the pointer highlighted. Arrow keys move, Enter chooses.</p>
            <ChooseOne say={setSaid} />
          </div>

          <div>
            <p className="fl-ctl-matrix-kind">Choose several</p>
            <p className="fl-ctl-matrix-what">Checkboxes, and a count of what is on, so the menu can be read at a glance.</p>
            <ChooseSeveral say={setSaid} />
          </div>

          <div>
            <p className="fl-ctl-matrix-kind">Combo box, open</p>
            <p className="fl-ctl-matrix-what">Type and the list narrows. An empty result says so rather than showing nothing.</p>
            <ComboOpen say={setSaid} />
          </div>

          <div>
            <p className="fl-ctl-matrix-kind">Overflow menu</p>
            <p className="fl-ctl-matrix-what">Actions on one thing, opened from the kebab button. Deleting sits apart.</p>
            <OverflowMenu say={setSaid} />
          </div>
        </div>
        <p className="fl-ctl-status" role="status" aria-live="polite">
          {said || "Nothing chosen yet."}
        </p>
      </div>
    </section>
  );
}

/** The combo box as it sits in a form: typeable, and it says whether it has narrowed anything. */
function Combo({ id, cls, state, invalid, say }: { id: string; cls: string; state: string; invalid: boolean; say: (s: string) => void }) {
  const [text, setText] = useState(state === "chosen" ? "Booked" : "");
  const hits = SAMPLE.options.filter((o) => o.toLowerCase().includes(text.trim().toLowerCase()));
  return (
    <span className="fl-ctl-combo">
      <input
        id={id}
        className={cls}
        role="combobox"
        aria-expanded={Boolean(text) && hits.length > 0}
        aria-autocomplete="list"
        placeholder="Search statuses"
        value={text}
        disabled={state === "disabled"}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const found = SAMPLE.options.filter((o) => o.toLowerCase().includes(e.target.value.trim().toLowerCase()));
          say(e.target.value ? `${found.length} status${found.length === 1 ? "" : "es"} match "${e.target.value}"` : "Nothing typed");
        }}
      />
      <Icon name="chevron-down" />
    </span>
  );
}

/** The same combo box with its list open, narrowing as you type. Inline, so it can be read here. */
function ComboOpen({ say }: { say: (s: string) => void }) {
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState("");
  const hits = SAMPLE.options.filter((o) => o.toLowerCase().includes(text.trim().toLowerCase()));
  return (
    <div className="fl-ctl-combo-open">
      <label className="fl-sr" htmlFor="dd-combo-open">
        Search statuses
      </label>
      <span className="fl-ctl-combo">
        <input
          id="dd-combo-open"
          className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32"
          role="combobox"
          aria-expanded
          aria-controls="dd-combo-open-list"
          aria-autocomplete="list"
          placeholder="Type to narrow"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Icon name="search" />
      </span>
      <ul className="fl-ctl-menu" id="dd-combo-open-list" role="listbox" aria-label="Statuses found">
        {hits.length ? (
          hits.map((o) => (
            <li
              key={o}
              role="option"
              aria-selected={o === chosen}
              onClick={() => {
                setChosen(o);
                setText(o);
                say(`Status: ${o}`);
              }}
            >
              <span className="fl-ctl-menu-tick">{o === chosen ? <Icon name="check" /> : null}</span>
              {o}
            </li>
          ))
        ) : (
          <li aria-disabled className="is-disabled">
            <span className="fl-ctl-menu-tick" />
            Nothing matches that
          </li>
        )}
      </ul>
    </div>
  );
}
