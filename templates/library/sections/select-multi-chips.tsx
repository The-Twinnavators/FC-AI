/** @flowcode-library select-multi-chips · Multi-select with chips (Forms)
 * Catalog ID: c.multi-select (component)
 * Function: The multi-select (c.multi-select): a field that holds several choices as removable chips, with a search box inside it, a checklist that filters as you type, a limit, a Clear button and full keyboard use; the reference sheet shows a project's skills with a required check and a limit of five.
 * Use it as: import { MultiSelect } from "./select-multi-chips"; <MultiSelect label="Skills" options={[{ value, label, detail?, disabled? }]} value?/defaultValue?={["design"]} onChange?={(values) => ...} placeholder? hint? max?={5} error?="Pick at least one" disabled? id? labels?={{ clear, empty, limit, added, removed, chosen }} />
 * Built from: c.chip.input, c.button.tertiary
 * Look: A bordered field with the chosen items as small pills with an x, a search box after them and a chevron 8px from the right edge; under it a floating checklist with a tick, the name and a muted detail line, the highlighted row tinted; a count and Clear sit beside the label, and an error line slides open under the field.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-accent --color-text --color-text-muted --color-danger --space-1 --space-2 --space-3 --radius-md --text-xs --text-sm --duration-fast --duration-base --ease-out --ease-spring --focus-ring
 * Use cases: pick several skills; tag a post; choose team members; filter by several categories; assign labels; choose interests; select regions; pick product tags
 * Jobs to be done: choose several options from a long list; find an option by typing; see everything I picked at a glance; take one choice back off
 * Keywords: multi-select, multiple select, chips, tags, tag input, combobox, listbox, search, form
 */
/**
 * Multi-select with chips. Each chosen option becomes a chip in the field (c.chip.input), so the person always sees what
 * they picked and can take one off with its x. Typing in the field filters the checklist; arrow keys move through it,
 * Enter ticks or unticks the highlighted option, Backspace in an empty search removes the last chip, and Escape closes
 * the list. A limit (max) dims the rest of the list once it is reached and says so. Use it for skills, tags, team
 * members or any filter that takes several values. Make it the app's own: replace SAMPLE with the app's own options
 * and save the chosen values through onChange.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): the "Multiple Select Options" form element.
 */
/**
 * How to try it
 * - Click the field or tab to it and type "de": the list narrows to matching skills.
 * - Use the arrow keys and Enter to tick skills; each becomes a chip. Backspace on an empty search takes the last one off.
 * - Tick five and the rest of the list dims; press Clear to start over, then Save with nothing chosen to see the error.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's chip ("./chips-tags"), button
 * ("./buttons-variants") and inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at
 * run time. The styles are the library's own fl- classes in templates/library/css, and the sample data is in the file.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Icon } from "./icons";

// ── c.multi-select: chips in the field, a filtering checklist under it. ──

export type MultiOption = { value: string; label: string; /** A muted second line, such as a group or a count. */ detail?: string; disabled?: boolean };

export type MultiSelectProps = {
  label: string;
  options: MultiOption[];
  /** Chosen values. Leave out (or use defaultValue) to let the field keep its own. */
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  /** A muted line under the field. */
  hint?: string;
  /** Most options that may be chosen. */
  max?: number;
  /** An error to show under the field; the field is marked invalid while it is set. */
  error?: string;
  disabled?: boolean;
  id?: string;
  labels?: { clear?: string; empty?: string; limit?: string; added?: string; removed?: string; chosen?: string };
};

export function MultiSelect({ label, options, value, defaultValue, onChange, placeholder = "Search", hint, max, error, disabled, id: given, labels = {} }: MultiSelectProps) {
  const l = { clear: "Clear", empty: "Nothing matches that", limit: "Limit reached", added: "added", removed: "removed", chosen: "chosen", ...labels };
  const auto = useId();
  const id = given ?? auto;
  const [own, setOwn] = useState<string[]>(defaultValue ?? []);
  const chosen = value ?? own;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [said, setSaid] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !q || o.label.toLowerCase().includes(q) || (o.detail ?? "").toLowerCase().includes(q));
  }, [options, query]);
  const full = max !== undefined && chosen.length >= max;
  const blocked = (o: MultiOption) => !!o.disabled || (full && !chosen.includes(o.value));

  // Keep the highlighted row in range as the list narrows, and scrolled into view.
  useEffect(() => {
    if (active > shown.length - 1) setActive(Math.max(shown.length - 1, 0));
  }, [shown.length, active]);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const set = (next: string[]) => {
    if (value === undefined) setOwn(next);
    onChange?.(next);
  };
  const toggle = (o: MultiOption) => {
    if (blocked(o)) return;
    const on = chosen.includes(o.value);
    const next = on ? chosen.filter((v) => v !== o.value) : [...chosen, o.value];
    set(next);
    setFresh(on ? null : o.value);
    setSaid(`${o.label} ${on ? l.removed : l.added}. ${next.length} ${l.chosen}.`);
    // The search clears, so the whole list is back: keep the highlight on the option just picked.
    setQuery("");
    setActive(Math.max(0, options.indexOf(o)));
  };
  const remove = (v: string) => {
    const o = options.find((x) => x.value === v);
    const next = chosen.filter((x) => x !== v);
    set(next);
    setSaid(`${o?.label ?? v} ${l.removed}. ${next.length} ${l.chosen}.`);
    input.current?.focus();
  };
  const clear = () => {
    set([]);
    setSaid(`${l.clear}. 0 ${l.chosen}.`);
    input.current?.focus();
  };
  const move = (step: number) => {
    if (!shown.length) return;
    setOpen(true);
    setActive((a) => (open ? (a + step + shown.length) % shown.length : 0));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(Math.max(shown.length - 1, 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const o = shown[active];
      if (o) toggle(o);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      } else if (query) setQuery("");
    } else if (e.key === "Backspace" && !query && chosen.length) {
      remove(chosen[chosen.length - 1]);
    } else if (e.key === "Tab") setOpen(false);
  };

  const descr = [hint ? `${id}-hint` : "", error ? `${id}-err` : "", full ? `${id}-limit` : ""].filter(Boolean).join(" ") || undefined;
  const activeId = open && shown[active] ? `${id}-o${options.indexOf(shown[active])}` : undefined;

  return (
    <div
      className={`fl-ms${open ? " is-open" : ""}${error ? " is-invalid" : ""}${disabled ? " is-disabled" : ""}`}
      data-fl="c.multi-select"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <div className="fl-ms-top">
        <label id={`${id}-label`} htmlFor={id}>
          {label}
        </label>
        <span className="fl-ms-count">
          {chosen.length}
          {max !== undefined ? ` / ${max}` : ""}
          <span className="fl-sr"> {l.chosen}</span>
        </span>
        {chosen.length > 0 && !disabled ? (
          <Button variant="tertiary" size={24} onClick={clear} aria-label={`${l.clear} ${label}`}>
            {l.clear}
          </Button>
        ) : null}
      </div>

      <div className="fl-ms-box">
      <div
        className="fl-ms-field"
        onMouseDown={(e) => {
          if (disabled || (e.target as HTMLElement).closest("button")) return;
          if (e.target !== input.current) e.preventDefault();
          input.current?.focus();
          setOpen((o) => !o || e.target === input.current);
        }}
      >
        {chosen.length > 0 ? (
          <ul className="fl-ms-chips" aria-label={`${label}, ${l.chosen}`}>
            {chosen.map((v) => {
              const o = options.find((x) => x.value === v);
              return (
                <li key={v} className={fresh === v ? "is-new" : undefined}>
                  <Chip variant="input" size={24} disabled={disabled} onRemove={() => remove(v)} removeLabel={`Remove ${o?.label ?? v}`}>
                    {o?.label ?? v}
                  </Chip>
                </li>
              );
            })}
          </ul>
        ) : null}
        <input
          ref={input}
          id={id}
          className="fl-ms-input"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-describedby={descr}
          aria-invalid={error ? true : undefined}
          placeholder={chosen.length ? "" : placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
        <svg className="fl-ms-chev" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>

      {open ? (
        <ul ref={list} id={`${id}-list`} className="fl-ms-list" role="listbox" aria-multiselectable="true" aria-labelledby={`${id}-label`}>
          {shown.length === 0 ? (
            <li className="fl-ms-none" role="presentation">
              {l.empty}
            </li>
          ) : (
            shown.map((o, i) => {
              const on = chosen.includes(o.value);
              const off = blocked(o);
              return (
                <li
                  key={o.value}
                  id={`${id}-o${options.indexOf(o)}`}
                  data-i={i}
                  role="option"
                  aria-selected={on}
                  aria-disabled={off || undefined}
                  className={`fl-ms-opt${i === active ? " is-active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setActive(i)}
                  onClick={() => toggle(o)}
                >
                  <span className="fl-ms-tick" aria-hidden="true">
                    {on ? <Icon name="check" /> : null}
                  </span>
                  <span className="fl-ms-text">
                    <span>{o.label}</span>
                    {o.detail ? <small>{o.detail}</small> : null}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
      </div>

      {hint ? (
        <p id={`${id}-hint`} className="fl-ms-hint">
          {full ? <span id={`${id}-limit`}>{l.limit}. </span> : null}
          {hint}
        </p>
      ) : full ? (
        <p id={`${id}-limit`} className="fl-ms-hint">
          {l.limit}.
        </p>
      ) : null}
      <div className="fl-ms-msg" data-open={error ? "true" : "false"} inert={!error}>
        <div>
          <p id={`${id}-err`} className="fl-ms-err">
            <Icon name="alert" />
            {error}
          </p>
        </div>
      </div>
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Project skills",
  lede: "Pick the skills this project needs. We match people who have them.",
  label: "Skills",
  hint: "Choose up to five.",
  max: 5,
  required: "Pick at least one skill.",
  saveLabel: "Save skills",
  savedText: "Skills saved",
  defaultValue: ["ux-research", "react"],
  options: [
    { value: "ux-research", label: "UX research", detail: "Design" },
    { value: "ui-design", label: "UI design", detail: "Design" },
    { value: "design-systems", label: "Design systems", detail: "Design" },
    { value: "copywriting", label: "Copywriting", detail: "Content" },
    { value: "react", label: "React", detail: "Engineering" },
    { value: "typescript", label: "TypeScript", detail: "Engineering" },
    { value: "node", label: "Node.js", detail: "Engineering" },
    { value: "data-viz", label: "Data visualization", detail: "Data" },
    { value: "sql", label: "SQL", detail: "Data" },
    { value: "accessibility", label: "Accessibility", detail: "Quality" },
    { value: "qa", label: "Test planning", detail: "Quality" },
    { value: "pm", label: "Product management", detail: "Product", disabled: true },
  ] as MultiOption[],
};

export default function SelectMultiChips() {
  const d = SAMPLE;
  const [skills, setSkills] = useState<string[]>(d.defaultValue);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState("");
  const error = tried && skills.length === 0 ? d.required : undefined;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!skills.length) {
      setSaved("");
      document.getElementById("fl-ms-demo")?.focus();
      return;
    }
    const names = skills.map((v) => d.options.find((o) => o.value === v)?.label ?? v);
    setSaved(`${d.savedText}: ${names.join(", ")}.`);
  };
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="fl-ms-demo-title">
      <div className="fl-wrap fl-wrap--narrow">
        <form className="fl-ms-demo" onSubmit={submit} noValidate>
          <div>
            <h2 id="fl-ms-demo-title">{d.title}</h2>
            <p>{d.lede}</p>
          </div>
          <MultiSelect
            id="fl-ms-demo"
            label={d.label}
            options={d.options}
            value={skills}
            onChange={(v) => {
              setSkills(v);
              setSaved("");
            }}
            hint={d.hint}
            max={d.max}
            error={error}
          />
          <div className="fl-ms-demo-foot">
            <Button type="submit" size={40}>
              {d.saveLabel}
            </Button>
            <p role="status" aria-live="polite">
              {saved}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
