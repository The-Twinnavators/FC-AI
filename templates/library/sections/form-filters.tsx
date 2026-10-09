/** @flowcode-library form-filters · Search and filter bar (Forms)
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
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Find a class",
  lede: "Search this term's classes by name, teacher or day.",
  searchLabel: "Search classes",
  searchPlaceholder: "Try 'wheel' or 'Priya'",
  categories: ["Pottery", "Painting", "Printmaking", "Textiles"],
  days: ["Weekdays", "Weekends"],
  quick: [
    { id: "open", label: "Spaces left" },
    { id: "beginner", label: "Beginner friendly" },
  ],
  items: [
    { id: 1, name: "Wheel throwing basics", category: "Pottery", teacher: "Priya Shah", when: "Tue 18:30", weekend: false, price: "$45", open: true, beginner: true },
    { id: 2, name: "Hand-built planters", category: "Pottery", teacher: "Tom Becker", when: "Sat 10:00", weekend: true, price: "$40", open: true, beginner: true },
    { id: 3, name: "Watercolour landscapes", category: "Painting", teacher: "Ana Lima", when: "Thu 19:00", weekend: false, price: "$35", open: false, beginner: true },
    { id: 4, name: "Oil portraits", category: "Painting", teacher: "Ana Lima", when: "Sun 14:00", weekend: true, price: "$55", open: true, beginner: false },
    { id: 5, name: "Lino cut cards", category: "Printmaking", teacher: "Priya Shah", when: "Wed 18:00", weekend: false, price: "$30", open: true, beginner: true },
    { id: 6, name: "Screen printing tote bags", category: "Printmaking", teacher: "Jordan Ellis", when: "Sat 13:00", weekend: true, price: "$50", open: false, beginner: false },
    { id: 7, name: "Natural dye workshop", category: "Textiles", teacher: "Mei Tanaka", when: "Sun 10:00", weekend: true, price: "$60", open: true, beginner: true },
    { id: 8, name: "Glaze chemistry", category: "Pottery", teacher: "Tom Becker", when: "Mon 19:00", weekend: false, price: "$65", open: true, beginner: false },
  ],
  emptyTitle: "No classes match",
  emptyText: "Try a different word, or remove a filter to see more of the timetable.",
};

type QuickId = "open" | "beginner";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
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

export default function FormFilters() {
  const d = SAMPLE;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [day, setDay] = useState("");
  const [quick, setQuick] = useState<QuickId[]>([]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return d.items.filter((it) => {
      if (q && !`${it.name} ${it.teacher} ${it.when} ${it.category}`.toLowerCase().includes(q)) return false;
      if (category && it.category !== category) return false;
      if (day === "Weekends" && !it.weekend) return false;
      if (day === "Weekdays" && it.weekend) return false;
      if (quick.includes("open") && !it.open) return false;
      if (quick.includes("beginner") && !it.beginner) return false;
      return true;
    });
  }, [d.items, query, category, day, quick]);

  const chips: { key: string; label: string; remove: () => void }[] = [];
  if (query.trim()) chips.push({ key: "q", label: `"${query.trim()}"`, remove: () => setQuery("") });
  if (category) chips.push({ key: "c", label: category, remove: () => setCategory("") });
  if (day) chips.push({ key: "d", label: day, remove: () => setDay("") });
  quick.forEach((id) => chips.push({ key: id, label: d.quick.find((x) => x.id === id)?.label ?? id, remove: () => setQuick((s) => s.filter((x) => x !== id)) }));

  const clearAll = () => {
    setQuery("");
    setCategory("");
    setDay("");
    setQuick([]);
    document.getElementById("flt-search")?.focus();
  };
  const toggleQuick = (id: QuickId) => setQuick((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <section className="fl-section" aria-labelledby="form-filters-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id="form-filters-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>

        <form role="search" aria-label="Filter classes" onSubmit={(e) => e.preventDefault()}>
          <div className="fl-frm-bar">
            <div className="fl-field">
              <label htmlFor="flt-search">{d.searchLabel}</label>
              <div className="fl-frm-search">
                <SearchGlyph />
                <input
                  id="flt-search"
                  type="search"
                  className="fl-input"
                  placeholder={d.searchPlaceholder}
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
                  <button type="button" className="fl-frm-clear-x" onClick={() => { setQuery(""); document.getElementById("flt-search")?.focus(); }}>
                    <Cross />
                    <span className="fl-sr">Clear search</span>
                  </button>
                )}
              </div>
            </div>
            <div className="fl-field">
              <label htmlFor="flt-category">Category</label>
              <span className="fl-frm-select">
                <select id="flt-category" className="fl-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {d.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Chevron />
              </span>
            </div>
            <div className="fl-field">
              <label htmlFor="flt-day">Day</label>
              <span className="fl-frm-select">
                <select id="flt-day" className="fl-input" value={day} onChange={(e) => setDay(e.target.value)}>
                  <option value="">Any day</option>
                  {d.days.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
                <Chevron />
              </span>
            </div>
          </div>
          <div className="fl-frm-quick" role="group" aria-label="Quick filters">
            {d.quick.map((q) => (
              <button key={q.id} type="button" aria-pressed={quick.includes(q.id as QuickId)} onClick={() => toggleQuick(q.id as QuickId)}>
                {q.label}
              </button>
            ))}
          </div>
        </form>

        {chips.length > 0 && (
          <div className="fl-frm-chipbar">
            <span className="fl-meta" id="flt-active-label">
              Active filters:
            </span>
            <ul className="fl-frm-chips" aria-labelledby="flt-active-label">
              {chips.map((c) => (
                <li key={c.key} className="fl-frm-chip">
                  {c.label}
                  <button type="button" onClick={c.remove}>
                    <Cross />
                    <span className="fl-sr">Remove filter {c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="fl-frm-textbtn" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}

        <p className="fl-frm-count" role="status" aria-live="polite">
          {results.length === d.items.length ? `All ${results.length} classes` : `${results.length} of ${d.items.length} classes`}
        </p>

        {results.length > 0 ? (
          <ul className="fl-frm-results" aria-label="Classes">
            {results.map((it) => (
              <li key={it.id}>
                <span className="fl-icon" aria-hidden="true">
                  <Icon name={it.category === "Pottery" ? "layers" : it.category === "Painting" ? "sparkle" : it.category === "Printmaking" ? "bolt" : "heart"} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong>{highlight(it.name, query)}</strong>
                  <span className="fl-meta">
                    {it.category} · {highlight(it.teacher, query)} · {it.when}
                    {it.beginner ? " · Beginner friendly" : ""}
                  </span>
                </span>
                <span style={{ display: "grid", justifyItems: "end", textAlign: "right" }}>
                  <span className="fl-frm-price">{it.price}</span>
                  <span className="fl-frm-status" data-open={it.open}>
                    {it.open ? "Spaces left" : "Full, join waitlist"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="fl-frm-empty">
            <span className="fl-icon">
              <SearchGlyph />
            </span>
            <h3>{d.emptyTitle}</h3>
            <p className="fl-text">{d.emptyText}</p>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={clearAll}>
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
