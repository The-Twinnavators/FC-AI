/** @flowcode-library form-filters · Search and filter bar (Forms)
 * Catalog ID: p.filter-panel (pattern)
 * Function: The search and filter panel (p.filter-panel) over an in-memory list: search with highlighting, select filters, quick toggles, removable chips, a screen-reader count and an empty state.
 * Use it as: import { FilterPanel } from "./form-filters"; <FilterPanel title lede? searchLabel searchPlaceholder? noun="classes" selects?={[{ id, label, allLabel, options: string[] }]} quick?={[{ id, label }]} items={[{ id, icon?, title, meta?: string[], price?, status?, open?, values?: { selectId: value }, flags?: [quickIds] }]} empty={{ title, text, action }} />
 * Built from: c.text-field.outlined, c.select.outlined, c.chip.filter, c.chip.input, c.button.tertiary, c.button.secondary, c.empty-state.no-results
 * Look: A search box with select filters and quick toggle chips above a result list; each active filter shows as a removable chip with Clear all, matches are highlighted, and a live count and empty state follow.
 * Tokens: --color-accent --color-border --color-surface --color-text-muted --color-success --space-2 --space-3 --space-4 --radius-lg --control-sm --focus-ring
 * Use cases: search and filter; product filters; listing search; job search; property search; catalog filtering; directory search; advanced search
 * Jobs to be done: narrow down to what i want; search by keyword and category; clear filters and start over; see how many results match
 * Keywords: form, search, filter, chips
 */
/**
 * Form: search and filter bar over a list. A search box, two selects and quick filter buttons narrow a small list
 * kept in memory; each active filter shows as a removable chip, with Clear all. The count updates for screen readers
 * and an empty state offers a way back when nothing matches. Use it above any browsable list: classes, products,
 * bookings. Make it the app's own: replace SAMPLE's items and filter options with the PRD's data and keep the
 * filters people actually use.
 */
import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { EmptyState } from "./empty-states";
import { Select } from "./dropdowns-states";
import { TextField } from "./text-fields-states";

// ── p.filter-panel: a search box, select filters and quick toggles over a list, with removable active-filter chips and a live count. ──

export type FilterItem = {
  id: string | number;
  /** An icon name from ./icons. */
  icon?: string;
  /** The bold first line; the search match is highlighted in it. */
  title: string;
  /** Small parts of the second line, joined with dots; the search match is highlighted in them too. */
  meta?: string[];
  /** Right side, top: the price or count. */
  price?: string;
  /** Right side, under it: a status in words. */
  status?: string;
  /** Colors the status as good (true) or muted (false). */
  open?: boolean;
  /** This item's value for each select filter, by the filter's id. */
  values?: Record<string, string>;
  /** Quick filters this item matches, by their ids. */
  flags?: string[];
};
export type FilterSelect = { id: string; label: string; /** The first option, meaning no filter ("All categories"). */ allLabel: string; options: string[] };
export type FilterQuick = { id: string; label: string };

export type FilterPanelProps = {
  title: string;
  lede?: string;
  searchLabel: string;
  searchPlaceholder?: string;
  /** Select filters, each narrowing by the item's value for that id. */
  selects?: FilterSelect[];
  /** Toggle buttons; an item must carry every switched-on flag. */
  quick?: FilterQuick[];
  items: FilterItem[];
  /** What the items are, plural and lower case ("classes"); used in the count and the labels. */
  noun: string;
  empty: { title: string; text: string; action: string };
  className?: string;
};

function Cross() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

/** Wraps the matched part of a label in <mark> so people see why a row is there. */
function highlight(text: string, q: string): ReactNode {
  const query = q.trim();
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="fl-frm-hit">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

export function FilterPanel({ title, lede, searchLabel, searchPlaceholder, selects = [], quick = [], items, noun, empty, className }: FilterPanelProps) {
  const uid = useId();
  const searchId = `${uid}-search`;
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [on, setOn] = useState<string[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (q && !`${it.title} ${(it.meta ?? []).join(" ")}`.toLowerCase().includes(q)) return false;
      for (const s of selects) if (chosen[s.id] && it.values?.[s.id] !== chosen[s.id]) return false;
      for (const id of on) if (!it.flags?.includes(id)) return false;
      return true;
    });
  }, [items, selects, query, chosen, on]);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (query.trim()) chips.push({ key: "q", label: `"${query.trim()}"`, remove: () => setQuery("") });
  for (const s of selects) if (chosen[s.id]) chips.push({ key: s.id, label: chosen[s.id], remove: () => setChosen((c) => ({ ...c, [s.id]: "" })) });
  on.forEach((id) => chips.push({ key: id, label: quick.find((x) => x.id === id)?.label ?? id, remove: () => setOn((s) => s.filter((x) => x !== id)) }));

  const focusSearch = () => document.getElementById(searchId)?.focus();
  const clearAll = () => {
    setQuery("");
    setChosen({});
    setOn([]);
    focusSearch();
  };
  const toggleQuick = (id: string) => setOn((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <section className={["fl-section", className ?? ""].filter(Boolean).join(" ")} aria-labelledby={`${uid}-title`} data-fl="p.filter-panel">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>

        <form role="search" aria-label={`Filter ${noun}`} onSubmit={(e) => e.preventDefault()}>
          <div className="fl-frm-bar" style={{ "--fl-frm-cols": `minmax(0, 1fr)${" minmax(0, 12rem)".repeat(selects.length)}` } as CSSProperties}>
            <div className="fl-field">
              <label htmlFor={searchId}>{searchLabel}</label>
              <div className="fl-frm-search">
                <SearchGlyph />
                <TextField
                  id={searchId}
                  type="search"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && query) {
                      e.preventDefault();
                      setQuery("");
                    }
                  }}
                  autoComplete="off"
                />
                {query && (
                  <button
                    type="button"
                    className="fl-frm-clear-x"
                    onClick={() => {
                      setQuery("");
                      focusSearch();
                    }}
                  >
                    <Cross />
                    <span className="fl-sr">Clear search</span>
                  </button>
                )}
              </div>
            </div>
            {selects.map((s) => (
              <div className="fl-field" key={s.id}>
                <label htmlFor={`${uid}-${s.id}`}>{s.label}</label>
                <Select
                  id={`${uid}-${s.id}`}
                  value={chosen[s.id] ?? ""}
                  onChange={(e) => setChosen((c) => ({ ...c, [s.id]: e.target.value }))}
                  options={[{ value: "", label: s.allLabel }, ...s.options.map((o) => ({ value: o, label: o }))]}
                />
              </div>
            ))}
          </div>
          {quick.length > 0 && (
            <div className="fl-frm-quick" role="group" aria-label="Quick filters">
              {quick.map((q) => (
                <Chip key={q.id} variant="filter" selected={on.includes(q.id)} onClick={() => toggleQuick(q.id)}>
                  {q.label}
                </Chip>
              ))}
            </div>
          )}
        </form>

        {chips.length > 0 && (
          <div className="fl-frm-chipbar">
            <span className="fl-meta" id={`${uid}-active`}>
              Active filters:
            </span>
            <ul className="fl-frm-chips" aria-labelledby={`${uid}-active`}>
              {chips.map((c) => (
                <li key={c.key}>
                  <Chip variant="input" onRemove={c.remove} removeLabel={`Remove filter ${c.label}`}>
                    {c.label}
                  </Chip>
                </li>
              ))}
            </ul>
            <Button variant="tertiary" size={32} onClick={clearAll}>
              Clear all
            </Button>
          </div>
        )}

        <p className="fl-frm-count" role="status" aria-live="polite">
          {results.length === items.length ? `All ${results.length} ${noun}` : `${results.length} of ${items.length} ${noun}`}
        </p>

        {results.length > 0 ? (
          <ul className="fl-frm-results" aria-label={Noun}>
            {results.map((it) => (
              <li key={it.id}>
                <span className="fl-icon" aria-hidden="true">
                  <Icon name={it.icon ?? "layers"} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong>{highlight(it.title, query)}</strong>
                  {it.meta?.length ? (
                    <span className="fl-meta">
                      {it.meta.map((m, i) => (
                        <span key={i}>
                          {i > 0 ? " · " : ""}
                          {highlight(m, query)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span style={{ display: "grid", justifyItems: "end", textAlign: "right" }}>
                  {it.price ? <span className="fl-frm-price">{it.price}</span> : null}
                  {it.status ? (
                    <span className="fl-frm-status" data-open={it.open}>
                      {it.status}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState variant="no-results" title={empty.title} headingLevel={3} action={<Button variant="secondary" onClick={clearAll}>{empty.action}</Button>}>
            {empty.text}
          </EmptyState>
        )}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: FilterPanelProps = {
  title: "Find a class",
  lede: "Search this term's classes by name, teacher or day.",
  searchLabel: "Search classes",
  searchPlaceholder: "Try 'wheel' or 'Priya'",
  noun: "classes",
  selects: [
    { id: "category", label: "Category", allLabel: "All categories", options: ["Pottery", "Painting", "Printmaking", "Textiles"] },
    { id: "day", label: "Day", allLabel: "Any day", options: ["Weekdays", "Weekends"] },
  ],
  quick: [
    { id: "open", label: "Spaces left" },
    { id: "beginner", label: "Beginner friendly" },
  ],
  items: [
    { id: 1, icon: "layers", title: "Wheel throwing basics", meta: ["Pottery", "Priya Shah", "Tue 18:30", "Beginner friendly"], price: "$45", status: "Spaces left", open: true, values: { category: "Pottery", day: "Weekdays" }, flags: ["open", "beginner"] },
    { id: 2, icon: "layers", title: "Hand-built planters", meta: ["Pottery", "Tom Becker", "Sat 10:00", "Beginner friendly"], price: "$40", status: "Spaces left", open: true, values: { category: "Pottery", day: "Weekends" }, flags: ["open", "beginner"] },
    { id: 3, icon: "sparkle", title: "Watercolour landscapes", meta: ["Painting", "Ana Lima", "Thu 19:00", "Beginner friendly"], price: "$35", status: "Full, join waitlist", open: false, values: { category: "Painting", day: "Weekdays" }, flags: ["beginner"] },
    { id: 4, icon: "sparkle", title: "Oil portraits", meta: ["Painting", "Ana Lima", "Sun 14:00"], price: "$55", status: "Spaces left", open: true, values: { category: "Painting", day: "Weekends" }, flags: ["open"] },
    { id: 5, icon: "bolt", title: "Lino cut cards", meta: ["Printmaking", "Priya Shah", "Wed 18:00", "Beginner friendly"], price: "$30", status: "Spaces left", open: true, values: { category: "Printmaking", day: "Weekdays" }, flags: ["open", "beginner"] },
    { id: 6, icon: "bolt", title: "Screen printing tote bags", meta: ["Printmaking", "Jordan Ellis", "Sat 13:00"], price: "$50", status: "Full, join waitlist", open: false, values: { category: "Printmaking", day: "Weekends" }, flags: [] },
    { id: 7, icon: "heart", title: "Natural dye workshop", meta: ["Textiles", "Mei Tanaka", "Sun 10:00", "Beginner friendly"], price: "$60", status: "Spaces left", open: true, values: { category: "Textiles", day: "Weekends" }, flags: ["open", "beginner"] },
    { id: 8, icon: "layers", title: "Glaze chemistry", meta: ["Pottery", "Tom Becker", "Mon 19:00"], price: "$65", status: "Spaces left", open: true, values: { category: "Pottery", day: "Weekdays" }, flags: ["open"] },
  ],
  empty: { title: "No classes match", text: "Try a different word, or remove a filter to see more of the timetable.", action: "Clear all filters" },
};

export default function FormFilters() {
  return <FilterPanel {...SAMPLE} />;
}
