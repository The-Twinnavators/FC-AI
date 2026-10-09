/** @flowcode-library input-select · Selects (Forms)
 * Use cases: country picker; category select; searchable dropdown; form selects; timezone picker; assignee picker; settings options
 * Jobs to be done: pick an option from a long list; find my option by typing; choose a category for my item
 * Keywords: select, dropdown, listbox, combobox, searchable select, type-ahead, native select
 */
/**
 * Input: selects. Three ways to pick from a list: a custom select (a button that opens a listbox; arrow keys, Home,
 * End, type a letter to jump, Enter to pick, Escape to close), a native select styled to match it, and a searchable
 * select that filters as you type and says when nothing matches. A save button checks a choice was made. Use the
 * native one by default and the custom or searchable ones when options need detail or the list is long. Make it the
 * app's own: replace SAMPLE with the real options.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Book a session",
  lede: "Pick a teacher, a room and the class you're joining.",
  teacher: {
    label: "Teacher",
    placeholder: "Choose a teacher",
    options: [
      { id: "ana", label: "Ana Ferreira", meta: "Wheel and glazing" },
      { id: "ben", label: "Ben Okafor", meta: "Hand building" },
      { id: "cleo", label: "Cleo Marsh", meta: "Beginners" },
      { id: "dev", label: "Dev Patel", meta: "Raku firing" },
      { id: "erin", label: "Erin Walsh", meta: "Sculpture" },
    ],
  },
  room: {
    label: "Room",
    placeholder: "Choose a room",
    options: ["Front studio", "Kiln room", "Garden shed", "Upstairs loft"],
  },
  klass: {
    label: "Class",
    placeholder: "Search classes",
    empty: "No classes match. Try a shorter word.",
    options: [
      "Beginners wheel, Monday 6pm",
      "Beginners wheel, Wednesday 10am",
      "Hand building, Tuesday 7pm",
      "Glazing workshop, Thursday 6pm",
      "Raku evening, Friday 7pm",
      "Family clay, Saturday 10am",
      "Sculpture club, Saturday 2pm",
      "Open studio, Sunday 11am",
    ],
  },
  submit: "Save booking",
  required: (what: string) => `Choose a ${what.toLowerCase()}.`,
  done: "Booking saved. We've added it to your calendar on this device.",
};

function Chevron() {
  return (
    <svg className="fl-in-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* Custom listbox select: the button holds focus and points at the active option with aria-activedescendant. */
function ListboxSelect({
  id,
  labelId,
  placeholder,
  options,
  value,
  error,
  errorId,
  onChange,
}: {
  id: string;
  labelId: string;
  placeholder: string;
  options: { id: string; label: string; meta: string }[];
  value: string;
  error: string;
  errorId: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", at: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openAt(i: number) {
    setActive(Math.max(0, Math.min(options.length - 1, i)));
    setOpen(true);
  }

  function choose(i: number) {
    onChange(options[i].id);
    setOpen(false);
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>) {
    const current = Math.max(0, options.findIndex((o) => o.id === value));
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openAt(current);
        else setActive((a) => Math.min(options.length - 1, a + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openAt(current);
        else setActive((a) => Math.max(0, a - 1));
        return;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(options.length - 1);
        }
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(active);
        else openAt(current);
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        if (open) choose(active);
        return;
    }
    // Type-ahead: letters typed within half a second build a search string.
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 500 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.at = now;
      const from = open ? active : current;
      const order = [...options.slice(from + 1), ...options.slice(0, from + 1)];
      const hit = order.find((o) => o.label.toLowerCase().startsWith(typed.current.text)) ?? options.find((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit) {
        const i = options.indexOf(hit);
        if (open) setActive(i);
        else onChange(hit.id);
      }
    }
  }

  return (
    <div className="fl-in-select" ref={wrapRef}>
      <button
        id={id}
        type="button"
        className={`fl-in-trigger${selected ? "" : " fl-in-trigger--empty"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${labelId} ${id}`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
        onClick={() => (open ? setOpen(false) : openAt(Math.max(0, options.findIndex((o) => o.id === value))))}
        onKeyDown={onKey}
      >
        <span className="fl-in-trigger__value">
          {selected ? (
            <>
              <span className="fl-person__avatar fl-in-mini" aria-hidden="true">
                {selected.label.slice(0, 1)}
              </span>
              {selected.label}
            </>
          ) : (
            placeholder
          )}
        </span>
        <Chevron />
      </button>
      {open && (
        <ul id={`${id}-list`} ref={listRef} className="fl-in-listbox" role="listbox" aria-labelledby={labelId} tabIndex={-1}>
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${id}-opt-${i}`}
              data-i={i}
              role="option"
              aria-selected={o.id === value}
              className={`fl-in-option${i === active ? " fl-in-option--active" : ""}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span className="fl-person__avatar fl-in-mini" aria-hidden="true">
                {o.label.slice(0, 1)}
              </span>
              <span className="fl-in-option__text">
                <span>{o.label}</span>
                <span className="fl-meta">{o.meta}</span>
              </span>
              {o.id === value && (
                <span className="fl-in-option__check" aria-hidden="true">
                  <Icon name="check" />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Searchable select: an input with a filtered listbox (combobox pattern). */
function SearchSelect({
  id,
  placeholder,
  empty,
  options,
  value,
  error,
  errorId,
  onChange,
}: {
  id: string;
  placeholder: string;
  empty: string;
  options: string[];
  value: string;
  error: string;
  errorId: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q && q !== value.toLowerCase() ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [query, options, value]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, value]);

  function choose(o: string) {
    onChange(o);
    setQuery(o);
    setOpen(false);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(matches.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      if (open && matches[active]) {
        e.preventDefault();
        choose(matches[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery(value);
      } else if (query) {
        setQuery("");
        onChange("");
      }
    }
  }

  return (
    <div className="fl-in-select" ref={wrapRef}>
      <div className="fl-in-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          id={id}
          className="fl-input"
          type="text"
          role="combobox"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-opt-${active}` : undefined}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (value) onChange("");
          }}
          onKeyDown={onKey}
        />
        <Chevron />
      </div>
      {open && (
        <ul id={`${id}-list`} className="fl-in-listbox" role="listbox" aria-label="Classes">
          {matches.length === 0 ? (
            <li className="fl-in-noresult" role="option" aria-disabled="true" aria-selected={false}>
              {empty}
            </li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o === value}
                className={`fl-in-option${i === active ? " fl-in-option--active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <span className="fl-in-option__text">
                  <span>{o}</span>
                </span>
                {o === value && (
                  <span className="fl-in-option__check" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
      <p className="fl-sr" aria-live="polite">
        {open ? (matches.length ? `${matches.length} classes available` : empty) : ""}
      </p>
    </div>
  );
}

export default function InputSelect() {
  const d = SAMPLE;
  const uid = useId();
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [klass, setKlass] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  function clear(key: string) {
    setDone(false);
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function save() {
    const next: Record<string, string> = {};
    if (!teacher) next.teacher = d.required(d.teacher.label);
    if (!room) next.room = d.required(d.room.label);
    if (!klass) next.klass = d.required(d.klass.label);
    setErrors(next);
    setDone(Object.keys(next).length === 0);
  }

  return (
    <section className="fl-section fl-section--tint" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card fl-in-panel">
          <div className="fl-in-selects">
            <div className="fl-field">
              <label id={`${uid}-teacher-label`} htmlFor={`${uid}-teacher`}>
                {d.teacher.label}
              </label>
              <ListboxSelect
                id={`${uid}-teacher`}
                labelId={`${uid}-teacher-label`}
                placeholder={d.teacher.placeholder}
                options={d.teacher.options}
                value={teacher}
                error={errors.teacher ?? ""}
                errorId={`${uid}-teacher-err`}
                onChange={(v) => {
                  setTeacher(v);
                  clear("teacher");
                }}
              />
              {errors.teacher && (
                <span id={`${uid}-teacher-err`} className="fl-in-error">
                  {errors.teacher}
                </span>
              )}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-room`}>{d.room.label}</label>
              <div className="fl-in-native">
                <select
                  id={`${uid}-room`}
                  className="fl-in-trigger"
                  value={room}
                  aria-invalid={!!errors.room || undefined}
                  aria-describedby={errors.room ? `${uid}-room-err` : undefined}
                  onChange={(e) => {
                    setRoom(e.target.value);
                    clear("room");
                  }}
                >
                  <option value="" disabled>
                    {d.room.placeholder}
                  </option>
                  {d.room.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
              {errors.room && (
                <span id={`${uid}-room-err`} className="fl-in-error">
                  {errors.room}
                </span>
              )}
            </div>
            <div className="fl-field fl-in-selects__wide">
              <label htmlFor={`${uid}-class`}>{d.klass.label}</label>
              <SearchSelect
                id={`${uid}-class`}
                placeholder={d.klass.placeholder}
                empty={d.klass.empty}
                options={d.klass.options}
                value={klass}
                error={errors.klass ?? ""}
                errorId={`${uid}-class-err`}
                onChange={(v) => {
                  setKlass(v);
                  clear("klass");
                }}
              />
              {errors.klass && (
                <span id={`${uid}-class-err`} className="fl-in-error">
                  {errors.klass}
                </span>
              )}
            </div>
          </div>
          {done && (
            <p className="fl-done" role="status">
              {d.done}
            </p>
          )}
          <div className="fl-actions">
            <button type="button" className="fl-btn fl-btn--primary" onClick={save}>
              {d.submit}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
