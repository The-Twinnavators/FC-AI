/** @flowcode-library dropdown-menu · Actions menu (Tabs, breadcrumbs and paging)
 * Use cases: row actions; file list actions; document list; item management; context menu; project list; record actions
 * Jobs to be done: rename or duplicate an item; delete something i no longer need; share a link to an item; undo a mistake quickly
 * Keywords: dropdown, menu, actions, kebab, keyboard
 */
/**
 * Actions menu: a "more" button on each row that opens a menu with icons, a separator and a destructive item. Arrow
 * keys, Home, End and the first letter move through it; Escape closes it and focus goes back to the button. Use it
 * when a row has more actions than fit as buttons.
 * Make it the app's own: replace SAMPLE with your records and swap the actions in `run` for your own.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Timetable",
  title: "Classes this month",
  classes: [
    { id: "c1", name: "Saturday wheel taster", meta: "Sat 10:00 · 6 of 8 places booked" },
    { id: "c2", name: "Glazing evening", meta: "Wed 18:30 · 4 of 10 places booked" },
    { id: "c3", name: "Kids' clay club", meta: "Sun 11:00 · Full" },
  ],
  copySuffix: " (copy)",
  emptyTitle: "No classes left",
  emptyText: "Everything was deleted. Bring the sample classes back to keep exploring.",
};

type Cls = { id: string; name: string; meta: string };
type Action = "rename" | "duplicate" | "link" | "delete";

const ICONS: Record<Action, string> = {
  rename: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  duplicate: "M8 8h12v12H8zM16 8V4H4v12h4",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  delete: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
};

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ITEMS: Array<{ id: Action; label: string; hint?: string; danger?: boolean; sepBefore?: boolean }> = [
  { id: "rename", label: "Rename", hint: "R" },
  { id: "duplicate", label: "Duplicate", hint: "D" },
  { id: "link", label: "Copy link", hint: "C" },
  { id: "delete", label: "Delete class", danger: true, sepBefore: true },
];

function RowMenu({ cls, onPick }: { cls: Cls; onPick: (a: Action, cls: Cls) => void }) {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(0);
  const wrap = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const items = useRef<Array<HTMLButtonElement | null>>([]);
  const id = `dropdown-menu-${cls.id}`;

  useEffect(() => {
    if (open) items.current[focus]?.focus();
  }, [open, focus]);

  // A click anywhere outside closes the menu without moving focus.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const openAt = (i: number) => {
    setFocus(i);
    setOpen(true);
  };
  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) button.current?.focus();
  };

  const onButtonKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAt(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt(ITEMS.length - 1);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const n = ITEMS.length;
    if (e.key === "ArrowDown") setFocus((f) => (f + 1) % n);
    else if (e.key === "ArrowUp") setFocus((f) => (f - 1 + n) % n);
    else if (e.key === "Home") setFocus(0);
    else if (e.key === "End") setFocus(n - 1);
    else if (e.key === "Escape") close(true);
    else if (e.key === "Tab") return setOpen(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const k = e.key.toLowerCase();
      const start = focus + 1;
      for (let j = 0; j < n; j++) {
        const idx = (start + j) % n;
        if (ITEMS[idx].label.toLowerCase().startsWith(k)) {
          setFocus(idx);
          break;
        }
      }
    } else return;
    e.preventDefault();
  };

  const pick = (a: Action) => {
    close(a !== "delete" && a !== "rename");
    onPick(a, cls);
  };

  return (
    <div className="fl-way-menu-wrap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="fl-way-icon-btn"
        id={`${id}-button`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Actions for ${cls.name}`}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onButtonKey}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      {open && (
        <ul className="fl-way-menu" role="menu" id={id} aria-labelledby={`${id}-button`} onKeyDown={onMenuKey}>
          {ITEMS.map((it, i) => [
            it.sepBefore ? <li key={`${it.id}-sep`} role="separator" className="fl-way-menu__sep" /> : null,
            <li key={it.id} role="none">
              <button
                ref={(el) => {
                  items.current[i] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={focus === i ? 0 : -1}
                className={`fl-way-menu__item${it.danger ? " fl-way-menu__item--danger" : ""}`}
                onClick={() => pick(it.id)}
                onPointerMove={() => focus !== i && setFocus(i)}
              >
                <Svg d={ICONS[it.id]} />
                {it.label}
                {it.hint && (
                  <kbd className="fl-way-menu__hint" aria-hidden="true">
                    {it.hint}
                  </kbd>
                )}
              </button>
            </li>,
          ])}
        </ul>
      )}
    </div>
  );
}

export default function DropdownMenu() {
  const d = SAMPLE;
  const [list, setList] = useState<Cls[]>(d.classes);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [deleted, setDeleted] = useState<{ cls: Cls; index: number } | null>(null);
  const undoRef = useRef<HTMLButtonElement | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (deleted) undoRef.current?.focus();
  }, [deleted]);

  const run = (a: Action, cls: Cls) => {
    if (a === "rename") {
      setRenaming(cls.id);
      setDraft(cls.name);
      setError("");
    } else if (a === "duplicate") {
      counter.current += 1;
      const copy = { ...cls, id: `${cls.id}-copy-${counter.current}`, name: cls.name + d.copySuffix };
      setList((l) => {
        const i = l.findIndex((c) => c.id === cls.id);
        return [...l.slice(0, i + 1), copy, ...l.slice(i + 1)];
      });
      setStatus(`Duplicated ${cls.name}.`);
    } else if (a === "link") {
      const text = `#class-${cls.id}`;
      try {
        void navigator.clipboard?.writeText(text);
        setStatus(`Link to ${cls.name} copied.`);
      } catch {
        setStatus("Could not copy the link. Your browser blocked the clipboard.");
      }
    } else {
      const index = list.findIndex((c) => c.id === cls.id);
      setList((l) => l.filter((c) => c.id !== cls.id));
      setDeleted({ cls, index });
      setStatus(`Deleted ${cls.name}.`);
    }
  };

  const saveName = (cls: Cls) => {
    const name = draft.trim();
    if (!name) {
      setError("Give the class a name.");
      return;
    }
    setList((l) => l.map((c) => (c.id === cls.id ? { ...c, name } : c)));
    setRenaming(null);
    setStatus(`Renamed to ${name}.`);
    requestAnimationFrame(() => document.getElementById(`dropdown-menu-${cls.id}-button`)?.focus());
  };

  const cancelRename = (cls: Cls) => {
    setRenaming(null);
    requestAnimationFrame(() => document.getElementById(`dropdown-menu-${cls.id}-button`)?.focus());
  };

  const undo = () => {
    if (!deleted) return;
    const { cls, index } = deleted;
    setList((l) => [...l.slice(0, index), cls, ...l.slice(index)]);
    setDeleted(null);
    setStatus(`Restored ${cls.name}.`);
    requestAnimationFrame(() => document.getElementById(`dropdown-menu-${cls.id}-button`)?.focus());
  };

  return (
    <section className="fl-section" aria-labelledby="dropdown-menu-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="dropdown-menu-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        {list.length === 0 ? (
          <div className="fl-way-empty">
            <p>
              <strong>{d.emptyTitle}</strong>
            </p>
            <p>{d.emptyText}</p>
            <button
              type="button"
              className="fl-btn fl-btn--primary"
              onClick={() => {
                setList(d.classes);
                setDeleted(null);
                setStatus("Sample classes restored.");
              }}
            >
              Restore classes
            </button>
          </div>
        ) : (
          <ul className="fl-way-list">
            {list.map((c) => (
              <li key={c.id}>
                <div className="fl-way-list__main">
                  {renaming === c.id ? (
                    <form
                      className="fl-way-rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveName(c);
                      }}
                    >
                      <label className="fl-sr" htmlFor={`dropdown-menu-name-${c.id}`}>
                        Class name
                      </label>
                      <input
                        id={`dropdown-menu-name-${c.id}`}
                        className="fl-input"
                        value={draft}
                        autoFocus
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `dropdown-menu-err-${c.id}` : undefined}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (error) setError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename(c);
                          }
                        }}
                      />
                      <button type="submit" className="fl-way-btn-sm">
                        Save
                      </button>
                      <button type="button" className="fl-way-btn-sm" onClick={() => cancelRename(c)}>
                        Cancel
                      </button>
                      {error && (
                        <p id={`dropdown-menu-err-${c.id}`} className="fl-way-error">
                          {error}
                        </p>
                      )}
                    </form>
                  ) : (
                    <p className="fl-way-list__title">{c.name}</p>
                  )}
                  <p className="fl-way-list__meta">{c.meta}</p>
                </div>
                {renaming !== c.id && <RowMenu cls={c} onPick={run} />}
              </li>
            ))}
          </ul>
        )}

        <div className="fl-way-undo" style={{ marginTop: "var(--space-3)" }}>
          <p className="fl-way-status" role="status" aria-live="polite">
            {status}
          </p>
          {deleted && (
            <button ref={undoRef} type="button" className="fl-way-btn-sm" onClick={undo}>
              Undo
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
