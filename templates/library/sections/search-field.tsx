/** @flowcode-library search-field · Search: a bar with suggestions, or an inline filter (Forms)
 * Catalog ID: c.search (component)
 * Function: The search field (c.search): a search bar with recent searches and suggestions that mark what was typed, worked fully from the keyboard, or a compact filter that says how many match.
 * Use it as: import { SearchField } from "./search-field"; <SearchField variant?="bar"|"inline" label="Search recipes" placeholder? value={text} onChange={setText} onSearch?={(text) => ...} suggestions?={string[]} recent?={string[]} onRemoveRecent?={(text) => ...} count?={matches.length} />
 * Variants: c.search.bar - the app's main search: a rounded bar that opens recent searches when empty and suggestions as people type, the typed part marked; ↑ ↓ Enter and Esc work; c.search.inline - filtering a list already on the screen: a compact field with a clear button that says how many match
 * Look: A soft rounded bar with a search icon, placeholder and a clear button; open, it joins a panel of suggestions below with the matched letters in bold and a clock icon beside recent searches.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --control-lg --control-md --pill-radius --radius-lg --surface-shadow-overlay --duration-base --focus-ring
 * Use cases: product search; recipe search; search the help centre; find a customer; filter a list; site search; search a catalog
 * Jobs to be done: find something by name; get back to what I searched before; narrow a list down
 * Keywords: search, search bar, suggestions, autocomplete, recent searches, filter, find
 */
/**
 * Search: a search field that helps people get to what they meant. "bar" is a rounded bar that opens suggestions as
 * people type (recent searches when it's empty, each removable), with the typed part of each suggestion marked; the
 * arrow keys move through them, Enter searches, Escape closes and then clears. "inline" is a compact field that filters
 * a list as people type and says how many match. Both have a clear button and a search role.
 * Written for FlowCode; the behaviour follows the search guidance in Material 3 and the WAI-ARIA combobox pattern (no
 * code from either).
 * Make it the app's own: replace SAMPLE with your suggestions (from your data) and send the search where it belongs.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";

export type SearchVariant = "bar" | "inline";
const FL: Record<SearchVariant, string> = { bar: "c.search.bar", inline: "c.search.inline" };

/** The text with the typed part marked (first match, any case). */
export function Marked({ text, query }: { text: string; query: string }): ReactNode {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="fl-srch-mark">{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

export function SearchField({
  variant = "bar",
  label,
  placeholder,
  value,
  onChange,
  onSearch,
  suggestions = [],
  recent = [],
  onRemoveRecent,
  count,
}: {
  variant?: SearchVariant;
  /** Names the field for screen readers (and the search landmark). */
  label: string;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  /** Enter, or a suggestion picked. */
  onSearch?: (text: string) => void;
  /** bar: what matches the text so far (already filtered by the app, or filtered here when it isn't). */
  suggestions?: string[];
  /** bar: shown when the field is empty. */
  recent?: string[];
  onRemoveRecent?: (text: string) => void;
  /** inline: how many results match, said after each change. */
  count?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const q = value.trim();
  const shown = variant !== "bar" ? [] : q ? suggestions.filter((s) => s.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : recent.slice(0, 6);
  const showingRecent = !q && shown.length > 0;
  const listOpen = variant === "bar" && open && shown.length > 0;

  useEffect(() => setActive(-1), [value]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const run = (text: string) => {
    onChange(text);
    onSearch?.(text);
    setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!listOpen) {
        setOpen(true);
        return;
      }
      e.preventDefault();
      // Past the last suggestion (or above the first) goes back to the text the person typed.
      setActive((a) => {
        const next = a + (e.key === "ArrowDown" ? 1 : -1);
        return next >= shown.length ? -1 : next < -1 ? shown.length - 1 : next;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(active >= 0 && shown[active] ? shown[active]! : value);
    } else if (e.key === "Escape") {
      // First Escape closes the list; the next clears the field.
      if (listOpen) setOpen(false);
      else if (value) onChange("");
      else return;
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const activeId = listOpen && active >= 0 && active < shown.length ? `${id}-o${active}` : undefined;

  return (
    <div ref={wrap} className={`fl-srch fl-srch--${variant}${listOpen ? " is-open" : ""}`} role="search" aria-label={label} data-fl={FL[variant]}>
      <div className="fl-srch__field">
        <span className="fl-srch__icon" aria-hidden="true">
          <Icon name="search" />
        </span>
        <input
          ref={input}
          className="fl-srch__input"
          type="search"
          aria-label={label}
          placeholder={placeholder ?? label}
          value={value}
          enterKeyHint="search"
          autoComplete="off"
          {...(variant === "bar" ? { role: "combobox", "aria-expanded": listOpen, "aria-controls": `${id}-list`, "aria-autocomplete": "list" as const, "aria-activedescendant": activeId } : {})}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        {value ? (
          <button
            type="button"
            className="fl-srch__clear"
            aria-label="Clear the search"
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>
      {variant === "inline" && count !== undefined ? (
        <p className="fl-srch__count" role="status" aria-live="polite">
          {q ? (count === 0 ? `Nothing matches “${q}”.` : `${count} match${count === 1 ? "" : "es"} for “${q}”`) : `${count} in all`}
        </p>
      ) : null}
      {listOpen ? (
        <div className="fl-srch__pop">
          {showingRecent ? <p className="fl-srch__group">Recent searches</p> : null}
          <ul id={`${id}-list`} className="fl-srch__list" role="listbox" aria-label={showingRecent ? "Recent searches" : `Suggestions for ${q}`}>
            {shown.map((s, i) => (
              <li key={s} id={`${id}-o${i}`} role="option" aria-selected={i === active} className={`fl-srch__opt${i === active ? " is-active" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => run(s)} onMouseEnter={() => setActive(i)}>
                <span className="fl-srch__opt-icon" aria-hidden="true">
                  <Icon name={showingRecent ? "clock" : "search"} />
                </span>
                <span className="fl-srch__opt-text">
                  <Marked text={s} query={q} />
                </span>
                {showingRecent && onRemoveRecent ? (
                  <button
                    type="button"
                    className="fl-srch__remove"
                    tabIndex={-1}
                    aria-label={`Remove ${s} from recent searches`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRecent(s);
                    }}
                  >
                    <Icon name="close" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** When the filter changes, the chips that stay glide to their new places and the ones that come back fade in (FLIP with Web Animations). */
function useChipGlide(order: string) {
  const list = useRef<HTMLUListElement>(null);
  const places = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const chips = [...el.querySelectorAll<HTMLElement>(":scope > [data-chip]")];
    const now = new Map(chips.map((c) => {
      const r = c.getBoundingClientRect();
      return [c.dataset.chip!, { x: r.left - box.left, y: r.top - box.top }] as const;
    }));
    const before = places.current;
    places.current = now;
    const still = document.documentElement.dataset.motion === "off" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!before.size || still) return;
    const css = getComputedStyle(el);
    const duration = parseFloat(css.getPropertyValue("--duration-base")) || 200;
    const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
    for (const c of chips) {
      const a = before.get(c.dataset.chip!);
      const b = now.get(c.dataset.chip!)!;
      if (!a) {
        c.animate([{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], { duration, easing });
        continue;
      }
      if (Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1) continue;
      c.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: "none" }], { duration, easing });
    }
  }, [order]);
  return list;
}

// flowcode:sample
const SAMPLE = {
  bar: { label: "Search recipes", placeholder: "Search recipes, ingredients or cuisines" },
  suggestions: ["Overnight oats", "Oat milk pancakes", "Oatcakes with cheese", "Green shakshuka", "Shakshuka with feta", "Lentil soup", "Red lentil dal", "Tahini dressing", "Tahini brownies", "Rye bread"],
  recent: ["lentil soup", "tahini", "quick breakfast"],
  inline: { label: "Filter ingredients", placeholder: "Filter ingredients" },
  ingredients: ["Oats", "Oat milk", "Rye flour", "Red lentils", "Green lentils", "Tahini", "Sesame seeds", "Feta", "Eggs", "Spinach", "Chickpeas", "Cumin"],
};

export default function SearchFieldSheet() {
  const d = SAMPLE;
  const [text, setText] = useState("");
  const [recent, setRecent] = useState(d.recent);
  const [searched, setSearched] = useState("");
  const [filter, setFilter] = useState("");
  const matches = d.ingredients.filter((i) => i.toLowerCase().includes(filter.trim().toLowerCase()));
  const chips = useChipGlide(matches.join("|"));
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Bar: suggestions as you type</h3>
        <p className="fl-ctl-btn-what">Focus it to see recent searches (each can be removed); type to see suggestions with your text marked. ↑ ↓ move, Enter searches, Esc closes and then clears.</p>
        <SearchField
          label={d.bar.label}
          placeholder={d.bar.placeholder}
          value={text}
          onChange={setText}
          suggestions={d.suggestions}
          recent={recent}
          onRemoveRecent={(s) => setRecent((r) => r.filter((x) => x !== s))}
          onSearch={(s) => {
            if (!s.trim()) return;
            setSearched(s);
            setRecent((r) => [s.toLowerCase(), ...r.filter((x) => x !== s.toLowerCase())].slice(0, 5));
          }}
        />
        <p className="fl-ctl-status" role="status">
          {searched ? `Searched for “${searched}”.` : "Nothing searched yet."}
        </p>
      </div>
      <div className="fl-ctl-spec">
        <h3>Inline: filters a list as you type</h3>
        <p className="fl-ctl-btn-what">For a list already on the screen. No suggestions; it says how many match.</p>
        <SearchField variant="inline" label={d.inline.label} placeholder={d.inline.placeholder} value={filter} onChange={setFilter} count={matches.length} />
        <ul ref={chips} className="fl-srch-results">
          {matches.map((m) => (
            <li key={m} data-chip={m}>
              <Marked text={m} query={filter.trim()} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
