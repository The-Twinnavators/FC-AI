/** @flowcode-library dropdowns-states · Dropdowns: select, combo box and the open menu (Forms)
 * Catalog ID: c.select (component)
 * Function: The native select (c.select; the combo box and open menus on the sheet are custom, not part of the export) with a reference sheet showing a select and a combo box in every state, a select with a prompt and labeled options, and four open menus.
 * Use it as: import { Select } from "./dropdowns-states"; <Select version?="default"|"classic" options={["A", "B"] or [{ value, label, disabled? }]} placeholder? variant?="outlined"|"filled"|"underlined" invalid? disabled? id? defaultValue? value? onChange?/>
 * Variants: c.select.outlined - the default field in a form: a bordered box on the surface color; c.select.filled - a quiet field on a tinted background with no visible border; c.select.underlined - a dense field in a toolbar or table: only a bottom line
 * Look: A native select styled like the text fields, with a chevron 8px from the right edge; accent focus ring, danger border when invalid, dimmed when disabled.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-danger --color-text-muted --focus-ring --space-2
 * Also: c.combobox (component)
 *   Use it as: import { Combobox } from "./dropdowns-states"; <Combobox version?="default"|"classic" variant?="listbox"|"search" options={[{ value, label, detail?, avatar?: { name, src? }, disabled? }]} multiple? value?/defaultValue? (string, or string[] when multiple) onChange?(value) placeholder? emptyText? invalid? disabled? inline? id? label?/>
 *   Variants: c.combobox.listbox - pick from a short or medium list of rich options (avatar and detail line per option): a button showing the choice that opens a styled list; arrows, Home/End, Enter, Escape and type-a-letter jump; c.combobox.search - pick from a long list by typing: a text field that narrows the list by label or detail as you type and says when nothing matches; focus stays in the field, arrows move the highlight
 *   Look: A bordered field (a button for listbox, a text input for search) with a chevron at the right edge and a floating list under it; each option can have an avatar, a second muted detail line and a tick when chosen; the highlighted option has an accent tint, unavailable options are dimmed. With multiple the list stays open and toggles options; with inline the list is drawn open in the page.
 * Use cases: country picker; status filter; assignee picker; sort order; settings choice; category select; searchable dropdown; form selects; timezone picker; settings options
 * Jobs to be done: choose one from many; find an option by typing; see what is chosen now; pick an option from a long list; find my option by typing; choose a category for my item
 * Keywords: select, dropdown, combo box, menu, option, disabled, listbox, combobox, searchable select, type-ahead, native select
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
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type SelectHTMLAttributes } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Avatar } from "./avatars-variants";

// ── c.select: the native select. Every piece's dropdown fields are this; c.combobox below is the custom one. ──

export type SelectVariant = "outlined" | "filled" | "underlined";
export type SelectOption = { value: string; label: string; disabled?: boolean };
/** default = the text-field-matched select; classic = the form-panel select drawn like the custom list's button (c.select@classic). */
export type DropdownVersion = "default" | "classic";

// Written out in full (not built from the variant name) so a build finds every class the select needs.
const VARIANT: Record<SelectVariant, string> = {
  outlined: "fl-ctl-field--outlined",
  filled: "fl-ctl-field--filled",
  underlined: "fl-ctl-field--underlined",
};

type SelectOwn = {
  /** "classic" draws the native select like the custom list's button (variant is ignored). */
  version?: DropdownVersion;
  variant?: SelectVariant;
  /** The choices: plain strings, or { value, label } when the stored value differs from the words shown. */
  options: (string | SelectOption)[];
  /** A first, unchosen prompt such as "Choose a room". Shown until something is picked; it cannot be picked again. */
  placeholder?: string;
  /** Draw the error state; pair it with a message under the field. */
  invalid?: boolean;
  /** Goes on the select itself, e.g. is-focus to draw the focus ring. */
  className?: string;
};

export function Select({ version = "default", variant = "outlined", options, placeholder, invalid, className, ...rest }: SelectOwn & Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof SelectOwn>) {
  const classic = version === "classic";
  const cls = classic ? ["fl-in-trigger", className ?? ""].filter(Boolean).join(" ") :  ["fl-input", "fl-ctl-field", VARIANT[variant], invalid ? "is-invalid" : "", className ?? ""].filter(Boolean).join(" ");
  // A placeholder starts the field unchosen unless the caller sets a value.
  const start = placeholder && rest.value === undefined && rest.defaultValue === undefined ? { defaultValue: "" } : {};
  const Wrap = classic ? "div" : "span";
  return (
    <Wrap className={classic ? "fl-in-native" : "fl-ctl-select"} data-fl={classic ? "c.select@classic" : `c.select.${variant}`}>
      <select {...start} {...rest} className={cls} aria-invalid={invalid || undefined}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} disabled={"disabled" in opt ? opt.disabled : undefined}>
              {opt.label}
            </option>
          );
        })}
      </select>
      {classic ? <Chevron /> : <Icon name="chevron-down" />}
    </Wrap>
  );
}

// ── c.combobox: a styled listbox (variant listbox) or a type-to-filter field (variant search). ──

export type ComboboxVariant = "listbox" | "search";
export type ComboOption = { value: string; label: string; detail?: string; avatar?: { name: string; src?: string }; disabled?: boolean };

type ComboboxProps = {
  /** "classic" draws the form-panel look: an initial-letter avatar chip, a magnifier in the search field. */
  version?: DropdownVersion;
  /** listbox: a button that opens a styled list, with type-ahead. search: an input that narrows the list as you type. */
  variant?: ComboboxVariant;
  /** The choices; plain strings work when value and label are the same. */
  options: (string | ComboOption)[];
  /** Chosen value (a string, or string[] with multiple). Leave out to let the box keep its own. */
  value?: string | string[];
  defaultValue?: string | string[];
  /** Called with the chosen value (string, or string[] with multiple; "" when nothing is chosen). */
  onChange?: (value: string | string[]) => void;
  /** Choose several: the list stays open and each option toggles. */
  multiple?: boolean;
  placeholder?: string;
  /** Said when typing matches nothing (search). */
  emptyText?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Draw the list always open, in the page flow, instead of floating under the field. */
  inline?: boolean;
  /** Goes on the field, so a <label htmlFor> can name it. */
  id?: string;
  /** The id of the error message under the field, read out with it when invalid. */
  describedBy?: string;
  /** The list's accessible name. */
  label?: string;
  /** Goes on the field itself, e.g. is-focus to draw the focus ring. */
  className?: string;
};

const asList = (v: string | string[] | undefined) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : [v]);

function Chevron() {
  return (
    <svg className="fl-in-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Combobox({ version = "default", variant = "listbox", options, value, defaultValue, onChange, multiple, placeholder, emptyText = "Nothing matches that", invalid, disabled, inline, id, describedBy, label, className }: ComboboxProps) {
  const auto = useId();
  const fid = id ?? `cb${auto.replace(/:/g, "")}`;
  const search = variant === "search";
  const classic = version === "classic";
  const opts: ComboOption[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const [inner, setInner] = useState<string[]>(asList(defaultValue));
  const sel = value !== undefined ? asList(value) : inner;
  const one = multiple ? undefined : opts.find((o) => o.value === sel[0]);
  const [open, setOpen] = useState(false);
  const isOpen = Boolean(inline) || open;
  const [query, setQuery] = useState(one?.label ?? "");
  const [active, setActive] = useState(() => Math.max(0, opts.findIndex((o) => o.value === sel[0])));
  const root = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: "", at: 0 });

  // Search narrows by what is typed, unless the text is just the chosen option's own label.
  const q = query.trim().toLowerCase();
  const narrowed = search && q !== "" && !(one && q === one.label.toLowerCase());
  const items = narrowed ? opts.filter((o) => o.label.toLowerCase().includes(q) || (o.detail ?? "").toLowerCase().includes(q)) : opts;
  const optId = (i: number) => `${fid}-opt-${i}`;
  const clamp = (n: number) => Math.max(0, Math.min(items.length - 1, n));
  // The next enabled option from a position, in a direction; stays put at either end.
  const step = (from: number, dir: 1 | -1) => {
    for (let n = from + dir; n >= 0 && n < items.length; n += dir) if (!items[n].disabled) return n;
    return clamp(from);
  };

  // Closed and single: the field shows the chosen label again.
  useEffect(() => {
    if (search && !multiple && !isOpen) setQuery(one?.label ?? "");
  }, [search, multiple, isOpen, one?.label]);
  // New matches: the highlight goes to the first enabled one.
  useEffect(() => {
    if (search) setActive(Math.max(0, items.findIndex((o) => !o.disabled)));
  }, [query, search]); // eslint-disable-line react-hooks/exhaustive-deps
  // A click outside a floating list closes it.
  useEffect(() => {
    if (!open || inline) return;
    const away = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open, inline]);
  // Keep the highlighted option in view in a long list.
  useEffect(() => {
    if (isOpen) document.getElementById(optId(active))?.scrollIntoView?.({ block: "nearest" });
  }, [isOpen, active]); // eslint-disable-line react-hooks/exhaustive-deps

  function commit(next: string[]) {
    if (value === undefined) setInner(next);
    onChange?.(multiple ? next : next[0] ?? "");
  }
  function openAt(i: number) {
    setActive(clamp(i));
    setOpen(true);
  }
  function choose(i: number) {
    const o = items[i];
    if (!o || o.disabled) return;
    if (multiple) {
      commit(sel.includes(o.value) ? sel.filter((v) => v !== o.value) : [...sel, o.value]);
      return;
    }
    commit([o.value]);
    setQuery(o.label);
    setOpen(false);
  }

  function onKey(e: ReactKeyboardEvent<HTMLElement>) {
    if (disabled) return;
    const cur = Math.max(0, items.findIndex((o) => sel.includes(o.value)));
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!isOpen) openAt(cur);
        else setActive(step(active, e.key === "ArrowDown" ? 1 : -1));
        return;
      case "Home":
      case "End":
        // In the search field these keep moving the caret.
        if (isOpen && !search) {
          e.preventDefault();
          setActive(e.key === "Home" ? step(-1, 1) : step(items.length, -1));
        }
        return;
      case "Enter":
      case " ":
        if (search && (e.key === " " || !isOpen)) return;
        e.preventDefault();
        if (isOpen) choose(active);
        else openAt(cur);
        return;
      case "Escape":
        if (isOpen && !inline) {
          e.preventDefault();
          setOpen(false);
        } else if (search && query) {
          e.preventDefault();
          setQuery("");
          if (!inline && !multiple) commit([]);
        }
        return;
      case "Tab":
        if (open && !inline) {
          if (!multiple && !search) choose(active);
          setOpen(false);
        }
        return;
    }
    // Type-ahead on the list: letters typed within half a second build a search string.
    if (!search && e.key.length === 1 && /\S/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 500 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.at = now;
      const from = isOpen ? active : cur;
      const order = [...items.slice(from + 1), ...items.slice(0, from + 1)];
      const hit = order.find((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (hit) {
        if (isOpen) setActive(items.indexOf(hit));
        else if (!multiple) commit([hit.value]);
      }
    }
  }

  // classic: a small initial-letter chip stands in for the avatar picture.
  const chip = (o: ComboOption) =>
    classic ? (
      <span className="fl-person__avatar fl-in-mini" aria-hidden="true">
        {(o.avatar?.name ?? o.label).slice(0, 1)}
      </span>
    ) : (
      <Avatar name={o.avatar!.name} src={o.avatar!.src} size={24} decorative />
    );
  const content = (o: ComboOption, plain: boolean) =>
    plain && !o.avatar && !o.detail ? (
      o.label
    ) : (
      <>
        {o.avatar ? chip(o) : null}
        <span className="fl-in-option__text">
          <span>{o.label}</span>
          {o.detail ? <span className="fl-meta">{o.detail}</span> : null}
        </span>
      </>
    );

  const common = {
    id: fid,
    role: "combobox" as const,
    "aria-expanded": isOpen,
    "aria-controls": isOpen ? `${fid}-list` : undefined,
    "aria-activedescendant": isOpen && items[active] ? optId(active) : undefined,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? describedBy : undefined,
    disabled,
    onKeyDown: onKey,
  };
  const extra = className ? ` ${className}` : "";

  let field = null;
  if (search) {
    field = (
      <span className={classic ? "fl-in-search" : "fl-ctl-combo"}>
        {classic ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m20 20-4-4" />
          </svg>
        ) : null}
        <input
          {...common}
          type="text"
          autoComplete="off"
          aria-autocomplete="list"
          className={classic ? `fl-input${extra}` : `fl-input fl-ctl-field fl-ctl-field--outlined${invalid ? " is-invalid" : ""}${extra}`}
          placeholder={placeholder}
          value={query}
          onFocus={() => !inline && !disabled && setOpen(true)}
          onClick={() => !inline && !disabled && setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!inline) setOpen(true);
          }}
        />
        {classic ? <Chevron /> : <Icon name={inline ? "search" : "chevron-down"} />}
      </span>
    );
  } else if (!inline) {
    const shown = multiple ? sel.length > 0 : Boolean(one);
    field = (
      <>
        <button
          {...common}
          type="button"
          aria-haspopup="listbox"
          className={`fl-in-trigger${shown ? "" : " fl-in-trigger--empty"}${extra}`}
          onClick={() => (open ? setOpen(false) : openAt(Math.max(0, items.findIndex((o) => sel.includes(o.value)))))}
        >
          <span className="fl-in-trigger__value">
            {multiple ? (
              sel.length ? `${sel.length} chosen` : placeholder ?? "Choose"
            ) : one ? (
              <>
                {one.avatar ? chip(one) : null}
                {one.label}
              </>
            ) : (
              placeholder ?? "Choose"
            )}
          </span>
        </button>
        <Chevron />
      </>
    );
  }

  const list = isOpen ? (
    <ul
      id={`${fid}-list`}
      role="listbox"
      aria-label={label ?? placeholder ?? "Options"}
      aria-multiselectable={multiple || undefined}
      className={inline ? "fl-ctl-menu" : "fl-in-listbox"}
      {...(inline && !search ? { tabIndex: disabled ? -1 : 0, "aria-activedescendant": items[active] ? optId(active) : undefined, onKeyDown: onKey } : {})}
    >
      {items.length === 0 ? (
        inline ? (
          <li aria-disabled className="is-disabled">
            <span className="fl-ctl-menu-tick" />
            {emptyText}
          </li>
        ) : (
          <li className="fl-in-noresult" role="option" aria-disabled="true" aria-selected={false}>
            {emptyText}
          </li>
        )
      ) : (
        items.map((o, i) => {
          const on = sel.includes(o.value);
          const props = {
            id: optId(i),
            role: "option" as const,
            "aria-selected": on,
            "aria-disabled": o.disabled || undefined,
            onMouseEnter: () => !o.disabled && setActive(i),
            onClick: () => choose(i),
          };
          return inline ? (
            <li key={o.value} {...props} className={`${i === active ? "is-hover" : ""}${o.disabled ? " is-disabled" : ""}`.trim() || undefined}>
              {multiple ? (
                <input type="checkbox" className="fl-ctl-check fl-ctl-check--16" tabIndex={-1} aria-hidden checked={on} readOnly style={{ pointerEvents: "none" }} />
              ) : (
                <span className="fl-ctl-menu-tick">{on ? <Icon name="check" /> : null}</span>
              )}
              {content(o, true)}
            </li>
          ) : (
            <li key={o.value} {...props} className={`fl-in-option${i === active ? " fl-in-option--active" : ""}`} onMouseDown={(e) => e.preventDefault()}>
              {content(o, false)}
              {on ? (
                <span className="fl-in-option__check" aria-hidden="true">
                  <Icon name="check" />
                </span>
              ) : null}
            </li>
          );
        })
      )}
    </ul>
  ) : null;

  return (
    <div ref={root} className={inline ? "fl-ctl-combo-open" : "fl-in-select"} data-fl={classic ? "c.combobox@classic" : `c.combobox.${variant}`}>
      {field}
      {list}
      {inline && multiple ? (
        <div className="fl-ctl-menu-foot">
          <span className="fl-ctl-matrix-what">
            {sel.length} of {opts.length} chosen
          </span>
          <Button variant="tertiary" size={32} disabled={!sel.length || disabled} onClick={() => commit([])}>
            Clear
          </Button>
        </div>
      ) : null}
      <p className="fl-sr" aria-live="polite">
        {isOpen ? (items.length ? `${items.length} options available` : emptyText) : ""}
      </p>
    </div>
  );
}

// ── c.combobox@classic and c.select@classic in use: the booking form's three selects (input-select wraps this). ──

export type ClassicSelectsProps = {
  title: string;
  lede: string;
  teacher: { label: string; placeholder: string; options: { id: string; label: string; meta: string }[] };
  room: { label: string; placeholder: string; options: string[] };
  klass: { label: string; placeholder: string; empty: string; options: string[] };
  submit: string;
  required: (what: string) => string;
  done: string;
};

export function ClassicSelects(d: ClassicSelectsProps) {
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
  const err = (key: string, text?: string) =>
    text ? (
      <span id={`${uid}-${key}-err`} className="fl-in-error">
        {text}
      </span>
    ) : null;

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
              <label htmlFor={`${uid}-teacher`}>{d.teacher.label}</label>
              <Combobox
                version="classic"
                id={`${uid}-teacher`}
                label={d.teacher.label}
                placeholder={d.teacher.placeholder}
                options={d.teacher.options.map((o) => ({ value: o.id, label: o.label, detail: o.meta, avatar: { name: o.label } }))}
                value={teacher}
                invalid={!!errors.teacher}
                describedBy={`${uid}-teacher-err`}
                onChange={(v) => {
                  setTeacher(v as string);
                  clear("teacher");
                }}
              />
              {err("teacher", errors.teacher)}
            </div>
            <div className="fl-field">
              <label htmlFor={`${uid}-room`}>{d.room.label}</label>
              <Select
                version="classic"
                id={`${uid}-room`}
                placeholder={d.room.placeholder}
                options={d.room.options}
                value={room}
                invalid={!!errors.room}
                aria-describedby={errors.room ? `${uid}-room-err` : undefined}
                onChange={(e) => {
                  setRoom(e.target.value);
                  clear("room");
                }}
              />
              {err("room", errors.room)}
            </div>
            <div className="fl-field fl-in-selects__wide">
              <label htmlFor={`${uid}-class`}>{d.klass.label}</label>
              <Combobox
                version="classic"
                variant="search"
                id={`${uid}-class`}
                label={d.klass.label}
                placeholder={d.klass.placeholder}
                emptyText={d.klass.empty}
                options={d.klass.options}
                value={klass}
                invalid={!!errors.klass}
                describedBy={`${uid}-class-err`}
                onChange={(v) => {
                  setKlass(v as string);
                  clear("klass");
                }}
              />
              {err("klass", errors.klass)}
            </div>
          </div>
          {done ? (
            <p className="fl-done" role="status">
              {d.done}
            </p>
          ) : null}
          <div className="fl-actions">
            <Button onClick={save}>{d.submit}</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

type Action = { id: string; label: string; icon: string; keys: string; disabled?: boolean; danger?: boolean };

// flowcode:sample
const SAMPLE = {
  classic: {
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
    room: { label: "Room", placeholder: "Choose a room", options: ["Front studio", "Kiln room", "Garden shed", "Upstairs loft"] },
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
  },
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
  people: [
    { value: "ana", label: "Ana Ferreira", detail: "Wheel and glazing", avatar: { name: "Ana Ferreira" } },
    { value: "ben", label: "Ben Okafor", detail: "Hand building", avatar: { name: "Ben Okafor" } },
    { value: "cleo", label: "Cleo Marsh", detail: "Beginners", avatar: { name: "Cleo Marsh" } },
    { value: "dev", label: "Dev Patel", detail: "Raku firing (on leave)", avatar: { name: "Dev Patel" }, disabled: true },
    { value: "erin", label: "Erin Walsh", detail: "Sculpture", avatar: { name: "Erin Walsh" } },
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
  return <Combobox inline label="Status" options={SAMPLE.options} defaultValue="Booked" onChange={(v) => say(`Status: ${v}`)} />;
}

/** Choose several: a tick-box per option, a count, and a Clear that empties them. */
function ChooseSeveral({ say }: { say: (s: string) => void }) {
  const all = SAMPLE.multi;
  return (
    <Combobox
      inline
      multiple
      label="Statuses"
      options={all.map((m) => ({ value: m.id, label: m.label }))}
      defaultValue={all.filter((m) => m.on).map((m) => m.id)}
      onChange={(v) => say(`${(v as string[]).length} of ${all.length} chosen`)}
    />
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
        <Button
          variant="tertiary"
          size={32}
          icon="more"
          iconOnly
          className={open ? "is-hover" : undefined}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          More actions
        </Button>
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
      <div className="fl-ctl-matrix-wrap fl-ctl-spec fl-ctl-spec--wide">
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
                  return (
                    <td key={k.id} data-state={k.label}>
                      <label className="fl-sr" htmlFor={id}>
                        Status, {k.label}, {s.label}
                      </label>
                      {k.id === "select" ? (
                        <Select
                          id={id}
                          className={s.id === "focus" ? "is-focus" : undefined}
                          options={d.options}
                          disabled={s.id === "disabled"}
                          defaultValue={s.id === "chosen" ? "Booked" : "Any status"}
                          invalid={invalid}
                          onChange={(e) => setSaid(`Status: ${e.target.value}`)}
                        />
                      ) : (
                        <Combobox
                          variant="search"
                          id={id}
                          className={s.id === "focus" ? "is-focus" : undefined}
                          options={d.options}
                          placeholder="Search statuses"
                          disabled={s.id === "disabled"}
                          defaultValue={s.id === "chosen" ? "Booked" : undefined}
                          invalid={invalid}
                          label="Statuses found"
                          onChange={(v) => setSaid(`Status: ${v || "none"}`)}
                        />
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

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>With a prompt, and options that differ from the words</h3>
        <p className="fl-ctl-btn-what">
          A placeholder is the first line, shown until something is picked and not pickable afterward. Options can carry a
          value apart from their label, and one can be unavailable.
        </p>
        <div className="fl-ctl-live-form">
          <p>
            <label htmlFor="dd-room">Room</label>
            <Select
              id="dd-room"
              placeholder="Choose a room"
              options={[
                { value: "front", label: "Front studio" },
                { value: "kiln", label: "Kiln room" },
                { value: "shed", label: "Garden shed" },
                { value: "loft", label: "Upstairs loft (full)", disabled: true },
              ]}
              onChange={(e) => setSaid(`Room: ${e.target.value}`)}
            />
          </p>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Combobox with avatars and detail lines</h3>
        <p className="fl-ctl-btn-what">
          Each option can carry an avatar and a second line. The listbox takes type-ahead (press a letter), the search field
          narrows by name or detail, and an unavailable option is skipped by the arrow keys.
        </p>
        <div className="fl-ctl-live-form">
          <p>
            <label htmlFor="dd-teacher">Teacher (listbox)</label>
            <Combobox id="dd-teacher" placeholder="Choose a teacher" label="Teachers" options={d.people} onChange={(v) => setSaid(`Teacher: ${v}`)} />
          </p>
          <p>
            <label htmlFor="dd-teacher-search">Teacher (search)</label>
            <Combobox id="dd-teacher-search" variant="search" placeholder="Search teachers" label="Teachers found" options={d.people} onChange={(v) => setSaid(`Teacher: ${v || "none"}`)} />
          </p>
          <p>
            <label htmlFor="dd-teacher-multi">Teachers (several)</label>
            <Combobox id="dd-teacher-multi" multiple placeholder="Choose teachers" label="Teachers" options={d.people} onChange={(v) => setSaid(`${(v as string[]).length} teachers chosen`)} />
          </p>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide">
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
            <div>
              <label className="fl-sr" htmlFor="dd-combo-open">
                Search statuses
              </label>
              <Combobox inline variant="search" id="dd-combo-open" label="Statuses found" className="fl-ctl-field--32" placeholder="Type to narrow" options={d.options} onChange={(v) => setSaid(`Status: ${v}`)} />
            </div>
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

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>Version: classic (c.select@classic, c.combobox@classic)</h3>
        <p className="fl-ctl-btn-what">
          The form-panel look: a custom list whose options carry an initial-letter chip and a detail line, a native select drawn
          to match it, and a search field with a magnifier that narrows as you type. Saving checks each was chosen.
        </p>
        <ClassicSelects {...d.classic} />
      </div>
    </section>
  );
}
