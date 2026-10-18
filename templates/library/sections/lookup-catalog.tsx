/** @flowcode-library lookup-catalog · Look-up catalog: search, categories, filters and where to find it (Tables and lists)
 * Catalog ID: p.lookup-catalog (pattern)
 * Function: The look-up catalog (p.lookup-catalog): the browse screen of a "find it and where to get it" app (products and the stores that carry them, books and the libraries that hold them, clinics and their services). A grid of cards with a picture, the category, ratings and a save toggle, and on each card where to get it near the person's ZIP code or at their chosen place; a search with suggestions as people type, category and facet filters, "Available near me" (asks for a ZIP code inline), sorting, removable filter chips, a live count and Show more. Also exports CategoryIndex (every category as a tile with a count) and CatalogSearch (the compact top-bar search). Built on the look-up data layer (createLookup from ./lookup-data beside the app's store).
 * Use it as: import { LookupCatalog, CategoryIndex, CatalogSearch } from "./lookup-catalog"; <LookupCatalog lookup={lookup} title? description? category? query? onOpen?={(id) => go("book", id)} onCategory?={(name) => ...} onSearch?={(q) => ...} pageSize?={12} facets?={["ages"]} badgeField?="award" tagsField?="tags" dateField?="published" imageField?="image" loading? only?={savedIds} toolbar?={false} layout?="grid"|"rows" empty?={{ title: "Nothing saved yet", text: "Tap the bookmark on anything to keep it here.", action?: { label: "Browse", onClick } }} />; <CategoryIndex lookup={lookup} onCategory={(name) => ...} description? selected? layout?="tiles"|"chips"|"rail" />; <LookupSpotlight lookup={lookup} onOpen?={(id) => ...} label? />; <CatalogSearch lookup={lookup} onSearch={(q) => ...} onOpen={(id) => ...} onCategory? placeholder? tagsField? />
 * Variants: p.lookup-catalog.grid - the full catalog: search with suggestions, filters, near me, sort and a grid of cards that say where each one is; p.lookup-catalog.categories - the way in: every category as a tinted tile with an icon and how many there are; p.lookup-catalog.search - the compact search for an app's top bar, with the same suggestions (entries open, categories filter)
 * Built from: c.button, c.search.bar, c.select, c.chip.input, c.empty-state
 * Look: A toolbar with a rounded search field and its suggestion list, a row of selects and a "Available near me" pill, removable filter chips with Clear all and a count; below, a grid of cards with a tinted picture tile, a small save button on its corner, the category in small caps, the title (matched letters marked), the author, a star rating and a pin line saying which places near the ZIP code have it.
 * Tokens: --surface-bg --surface-border --surface-shadow --surface-blur --surface-radius --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-danger --radius-md --radius-lg --pill-radius --control-sm --space-2 --space-3 --space-4 --text-sm --text-xs --duration-fast --focus-ring
 * Use cases: library catalog; product finder; store locator catalog; clinic and services directory; parts catalog; menu with where to buy; book finder; pharmacy stock look-up
 * Jobs to be done: find something by name; browse a category; see if it is near me; see which place has it; save it for later; narrow down by age, size or type
 * Keywords: catalog, browse, search, suggestions, autocomplete, categories, filters, facets, near me, ZIP code, availability, where to buy, stores, libraries, save, ratings
 */
/**
 * Look-up catalog: the browse screen of a look-up app, where people find a thing and where to get it. Everything reads
 * the look-up store live (useLookup), so a save, a rating or a new ZIP code made on any other page shows here at once.
 * The search suggests entries, categories, authors and themes as people type; the arrow keys move through them, Enter
 * picks one (an entry opens, a category filters), Escape closes the list and then clears. "Available near me" filters to
 * what the places near the person's ZIP code have, or what their chosen place has; with no ZIP code yet it asks for one
 * right there. Cards are one button each (Tab reaches the title and the save toggle), and the save toggle keeps its
 * size, so nothing moves when it changes.
 *
 * Written for FlowCode; the search follows the WAI-ARIA combobox pattern (no code from it).
 * Make it the app's own: build your look-up store with createLookup (your entries, places, ZIP code areas and the
 * category field) and pass it here; name the badge, tags, date and facet fields your entries have; onOpen goes to the
 * entry's page.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { fieldOf, toast, Toaster, type EntityDef, type RecordData } from "./app-data";
import { useLookup, type LookupStore } from "./lookup-data";
import { sampleLookup } from "./lookup-sample";

// ── Helpers ──

/** Animations of the results moving now (interrupted by the next change, cancelled when the catalog goes away). */
let moving: Animation[] = [];
const ms = (v: string, fallback: number) => (/ms$/.test(v.trim()) ? parseFloat(v) : /s$/.test(v.trim()) ? parseFloat(v) * 1000 : fallback);
/**
 * Results keep their identity while they move (a filter, the sort, "near me"). The new results are on screen in the
 * very next frame; then each card that stays glides from where it was and new cards fade in (a FLIP with the Web
 * Animations API, on the compositor). Same contract as the app's lib/motion.ts moveItems(), written here so the piece
 * stays self-contained: a newer change interrupts from where the cards are, nothing waits for an animation, reduced
 * motion only fades, animation off and long lists (over 24 cards) just update.
 */
function continuity(list: HTMLElement | null, update: () => void) {
  const root = document.documentElement;
  const off = root.dataset.motion === "off" || !list || list.children.length > 24 || typeof Element.prototype.animate !== "function";
  if (off) {
    update();
    return;
  }
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Where each card is now, mid-move included, before the running move stops.
  const first = new Map<string, DOMRect>();
  for (const el of Array.from(list.children) as HTMLElement[]) if (el.dataset.key) first.set(el.dataset.key, el.getBoundingClientRect());
  for (const m of moving) m.cancel();
  moving = [];
  flushSync(update);
  const css = getComputedStyle(root);
  const slow = ms(css.getPropertyValue("--duration-slow"), 320);
  const base = ms(css.getPropertyValue("--duration-base"), 200);
  const easing = css.getPropertyValue("--ease-out").trim() || "ease-out";
  for (const el of Array.from(list.children) as HTMLElement[]) {
    const was = el.dataset.key ? first.get(el.dataset.key) : undefined;
    if (!was) {
      moving.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: base, easing }));
      continue;
    }
    if (reduced) continue;
    const now = el.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    moving.push(el.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: slow, easing }));
  }
}

type SortKey = "liked" | "rated" | "newest" | "az";

/** "library" → "libraries", "store" → "stores", "branch" → "branches". */
export const pluralOf = (word: string) => (/[^aeiou]y$/i.test(word) ? `${word.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`);

const ICONS = ["image", "sparkle", "layers", "star", "globe", "heart", "bolt", "folder"];
export const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));

/** The look-up's entity, entries and categories (with counts), following the stores. */
/** The catalog data every look-up piece reads: the entity, its entries (not drafts), categories with counts, tones and icons, and place names. */
export function useCatalog(lookup: LookupStore) {
  const state = useLookup(lookup);
  const cfg = lookup.config;
  const e = lookup.app.entity(cfg.entries);
  const records = lookup.app.get().records[cfg.entries] ?? [];
  const entries = useMemo(() => records.filter((r) => !r.draft), [records]);
  const categories = useMemo(() => {
    const declared = fieldOf(e, cfg.categoryField)?.options ?? [];
    const seen = [...new Set(entries.map((r) => str(r[cfg.categoryField])).filter(Boolean))];
    const names = [...declared, ...seen.filter((s) => !declared.includes(s))];
    return names.map((name, i) => ({ name, count: entries.filter((r) => str(r[cfg.categoryField]) === name).length, tone: i % 6, icon: ICONS[i % ICONS.length]! }));
  }, [e, cfg.categoryField, entries]);
  const placeEntity = lookup.app.entity(cfg.places);
  const placeName = (id?: string) => {
    if (!id) return "";
    const p = (lookup.app.get().records[cfg.places] ?? []).find((x) => x.id === id);
    return p ? str(p[placeEntity.titleField]) || p.id : id;
  };
  return { state, e, entries, categories, placeName, placeWord: cfg.placeWord ?? "place" };
}

/** The text with the typed part marked (first match, any case). */
function Hl({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="fl-cat-hit">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/** A bookmark (saved) glyph in the icons' style. */
function Bookmark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

/** A native select with the chevron drawn 8px from its right edge. */
function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <span className={`fl-cat-select${value ? " is-set" : ""}`}>
      <label className="fl-sr" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(ev) => onChange(ev.target.value)}>
        {children}
      </select>
      <Icon name="chevron-down" />
    </span>
  );
}

// ── Suggestions (shared by the catalog's search and the compact search) ──

type Suggestion = { key: string; kind: "entry" | "category" | "subtitle" | "tag"; label: string; value: string; note: string };

function useSuggestions(lookup: LookupStore, q: string, tagsField?: string): Suggestion[] {
  const { e, entries, categories } = useCatalog(lookup);
  const cfg = lookup.config;
  return useMemo(() => {
    const t = q.trim().toLowerCase();
    const catLabel = fieldOf(e, cfg.categoryField)?.label ?? "Category";
    if (!t) return categories.filter((c) => c.count).slice(0, 6).map((c) => ({ key: `c:${c.name}`, kind: "category" as const, label: c.name, value: c.name, note: `${catLabel} · ${c.count}` }));
    const rank = (s: string) => (s.toLowerCase().startsWith(t) ? 0 : 1);
    const out: Suggestion[] = [];
    for (const c of categories) if (c.name.toLowerCase().includes(t)) out.push({ key: `c:${c.name}`, kind: "category", label: c.name, value: c.name, note: catLabel });
    const titles = entries.filter((r) => str(r[e.titleField]).toLowerCase().includes(t)).sort((a, b) => rank(str(a[e.titleField])) - rank(str(b[e.titleField])));
    for (const r of titles.slice(0, 5)) out.push({ key: `e:${r.id}`, kind: "entry", label: str(r[e.titleField]), value: r.id, note: e.label });
    if (e.subtitleField) {
      const subLabel = fieldOf(e, e.subtitleField)?.label ?? "";
      const subs = [...new Set(entries.map((r) => str(r[e.subtitleField!])).filter((s) => s.toLowerCase().includes(t)))];
      for (const s of subs.slice(0, 3)) out.push({ key: `s:${s}`, kind: "subtitle", label: s, value: s, note: subLabel });
    }
    if (tagsField) {
      const tagLabel = fieldOf(e, tagsField)?.label ?? "Tag";
      const words = [...new Set(entries.flatMap((r) => str(r[tagsField]).split(",").map((w) => w.trim().toLowerCase())).filter((w) => w && w.includes(t)))].sort((a, b) => rank(a) - rank(b));
      for (const w of words.slice(0, 3)) out.push({ key: `t:${w}`, kind: "tag", label: w, value: w, note: tagLabel });
    }
    return out.slice(0, 8);
  }, [q, e, cfg.categoryField, entries, categories, tagsField]);
}

/** The search field with its suggestion list (a combobox): ↑ ↓ move, Enter picks or searches, Esc closes then clears. */
function SuggestField({
  lookup,
  value,
  onChange,
  onPick,
  onSubmit,
  label,
  placeholder,
  tagsField,
  compact,
}: {
  lookup: LookupStore;
  value: string;
  onChange: (v: string) => void;
  onPick: (s: Suggestion) => void;
  onSubmit?: (v: string) => void;
  label: string;
  placeholder?: string;
  tagsField?: string;
  compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = useSuggestions(lookup, value, tagsField);
  const shown = open && items.length > 0;
  useEffect(() => setActive(-1), [value]);
  const pick = (s: Suggestion) => {
    setOpen(false);
    setActive(-1);
    onPick(s);
  };
  const onKey = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (!items.length) return;
      const step = ev.key === "ArrowDown" ? 1 : -1;
      // -1 is the field itself, so moving past either end comes back to what was typed.
      const n = items.length + 1;
      setActive((a) => ((((a + 1 + step) % n) + n) % n) - 1);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (shown && active >= 0 && items[active]) pick(items[active]!);
      else {
        setOpen(false);
        onSubmit?.(value.trim());
      }
    } else if (ev.key === "Escape") {
      if (shown) {
        ev.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (value) {
        ev.preventDefault();
        onChange("");
      }
    }
  };
  const activeId = shown && active >= 0 ? `${id}-opt-${active}` : undefined;
  return (
    <div className={`fl-cat-search${compact ? " fl-cat-search--compact" : ""}`} role="search">
      <div className="fl-cat-search-field">
        <Icon name="search" />
        <label className="fl-sr" htmlFor={`${id}-in`}>
          {label}
        </label>
        <input
          ref={input}
          id={`${id}-in`}
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          role="combobox"
          aria-expanded={shown}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          onChange={(ev) => {
            onChange(ev.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
        />
        {value ? (
          <button
            type="button"
            className="fl-cat-search-clear"
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
      <ul id={`${id}-list`} className="fl-cat-search-pop" role="listbox" aria-label={value.trim() ? `Suggestions for ${value.trim()}` : "Browse by category"} hidden={!shown}>
        {items.map((s, i) => (
          <li
            key={s.key}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className={`fl-cat-search-opt${i === active ? " is-active" : ""}`}
            onMouseDown={(ev) => ev.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(s)}
          >
            <span className="fl-cat-search-optic" aria-hidden="true">
              <Icon name={s.kind === "entry" ? "arrow" : s.kind === "category" ? "folder" : s.kind === "subtitle" ? "user" : "search"} />
            </span>
            <span className="fl-cat-search-optlabel">
              <Hl text={s.label} q={value.trim()} />
            </span>
            <span className="fl-cat-search-optnote">{s.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── The ZIP code ask ──

function ZipAsk({ lookup, onDone, onCancel }: { lookup: LookupStore; onDone: () => void; onCancel: () => void }) {
  const id = useId();
  const [zip, setZip] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  const placeWord = lookup.config.placeWord ?? "place";
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const r = lookup.setZip(zip);
    if (!r.ok) {
      setMsg({ text: r.message, bad: true });
      field.current?.focus();
      return;
    }
    const z = zip.trim();
    const a = lookup.area(z);
    if (!a) {
      setMsg({ text: `There are no ${pluralOf(placeWord)} near ${z} in this prototype yet. Try ${lookup.config.areas.map((x) => x.zip).join(", ")}.`, bad: true });
      return;
    }
    const n = lookup.nearby(z).length;
    toast(`${n} ${n === 1 ? placeWord : pluralOf(placeWord)} near ${z} (${a.label}).`);
    onDone();
  };
  return (
    <form className="fl-cat-zip" onSubmit={submit} noValidate>
      <label className="fl-cat-zip-label" htmlFor={id}>
        Your ZIP code, to see what {pluralOf(placeWord)} near you have
      </label>
      <div className="fl-cat-zip-row">
        <input
          ref={field}
          id={id}
          className="fl-cat-zip-input"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="94110"
          value={zip}
          aria-invalid={msg?.bad || undefined}
          aria-describedby={msg ? `${id}-msg` : undefined}
          onChange={(ev) => {
            setZip(ev.target.value.replace(/\D/g, "").slice(0, 5));
            setMsg(null);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") onCancel();
          }}
        />
        <Button size={32} type="submit">
          Show near me
        </Button>
        <Button size={32} variant="tertiary" type="button" onClick={onCancel}>
          Not now
        </Button>
      </div>
      {msg ? (
        <p id={`${id}-msg`} className={`fl-cat-zip-msg${msg.bad ? " is-bad" : ""}`} role={msg.bad ? "alert" : "status"}>
          {msg.text}
        </p>
      ) : null}
    </form>
  );
}

// ── The catalog ──

export type LookupCatalogProps = {
  lookup: LookupStore;
  /** The heading; the entries' plural when left out. */
  title?: string;
  description?: string;
  /** Start in (and follow) this category. */
  category?: string;
  /** Start with (and follow) this search. */
  query?: string;
  onOpen?: (id: string) => void;
  onCategory?: (name: string) => void;
  onSearch?: (q: string) => void;
  /** Cards before "Show more" (12 when left out). */
  pageSize?: number;
  /** More select fields to filter by (ages, size, type). */
  facets?: string[];
  /** A short field shown as a badge line (an award, a certification). */
  badgeField?: string;
  /** A comma-separated text field whose words are suggested and searched (themes, tags). */
  tagsField?: string;
  /** A date field for "Newest". */
  dateField?: string;
  /** A picture address field ("image" when left out). */
  imageField?: string;
  /** Show the loading skeleton. */
  loading?: boolean;
  /** Show only these entry ids (a Saved page); search, filters and sort work over them. */
  only?: string[];
  /** The empty state when there is nothing to show at all (before any filter). */
  empty?: { title: string; text: string; action?: { label: string; onClick: () => void } };
  /**
   * The search, filter and sort bar (shown when left out). false for a showcase on a page that already has a search,
   * such as "Most liked" on a landing page under its hero search.
   */
  toolbar?: boolean;
  /** "grid": picture cards in columns (the default); "rows": wide rows, the picture beside the words, two to a line. */
  layout?: "grid" | "rows";
};

export function LookupCatalog({ lookup, title, description, category: catProp, query: qProp, onOpen, onCategory, onSearch, pageSize = 12, facets = [], badgeField, tagsField, dateField, imageField = "image", loading, only, empty, toolbar = true, layout = "grid" }: LookupCatalogProps) {
  const { state, e, entries: all, categories, placeName, placeWord } = useCatalog(lookup);
  const onlyKey = only ? only.join("|") : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const entries = useMemo(() => (only ? all.filter((r) => only.includes(r.id)) : all), [all, onlyKey]);
  const cfg = lookup.config;
  const headId = useId();
  const [q, setQ] = useState(qProp ?? "");
  const [cat, setCat] = useState(catProp ?? "");
  const [facetVals, setFacetVals] = useState<Record<string, string>>({});
  const [near, setNear] = useState(false);
  const [askZip, setAskZip] = useState(false);
  const [sort, setSort] = useState<SortKey>("liked");
  const [shown, setShown] = useState(pageSize);
  const grid = useRef<HTMLUListElement>(null);
  const nearBtn = useRef<HTMLButtonElement>(null);
  const focusFrom = useRef<number | null>(null);

  useEffect(() => setQ(qProp ?? ""), [qProp]);
  useEffect(() => setCat(catProp ?? ""), [catProp]);
  const changeQ = (v: string) => {
    setQ(v);
    onSearch?.(v);
  };
  const changeCat = (v: string) => {
    continuity(grid.current, () => setCat(v));
    onCategory?.(v);
  };
  // Without a ZIP code there is nothing to be near: the filter goes off.
  useEffect(() => {
    if (!state.zip) setNear(false);
  }, [state.zip]);

  const plural = e.plural.toLowerCase();
  const noun = (n: number) => `${n} ${n === 1 ? e.label.toLowerCase() : plural}`;
  const t = q.trim().toLowerCase();

  const results = useMemo(() => {
    const textKeys = [e.titleField, e.subtitleField, cfg.categoryField, tagsField, badgeField].filter(Boolean) as string[];
    const list = entries.filter((r) => {
      if (t && !textKeys.some((k) => str(r[k]).toLowerCase().includes(t))) return false;
      if (cat && str(r[cfg.categoryField]) !== cat) return false;
      for (const f of facets) if (facetVals[f] && str(r[f]) !== facetVals[f]) return false;
      if (near && state.zip) {
        if (state.placeId ? !lookup.carries(state.placeId, r.id) : lookup.carriers(r.id).length === 0) return false;
      }
      return true;
    });
    const title = (r: RecordData) => str(r[e.titleField]);
    const by: Record<SortKey, (a: RecordData, b: RecordData) => number> = {
      liked: (a, b) => lookup.likes(b.id).count - lookup.likes(a.id).count,
      rated: (a, b) => {
        const sa = lookup.summary(a.id);
        const sb = lookup.summary(b.id);
        return sb.average - sa.average || sb.count - sa.count;
      },
      newest: (a, b) => str(dateField ? b[dateField] : "").localeCompare(str(dateField ? a[dateField] : "")),
      az: () => 0,
    };
    return [...list].sort((a, b) => by[sort](a, b) || title(a).localeCompare(title(b), undefined, { sensitivity: "base", numeric: true }));
    // state follows every change in the look-up store (likes, ratings, ZIP code, place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, t, cat, facetVals, near, sort, state, e, cfg.categoryField, facets.join(), tagsField, badgeField, dateField]);

  // A new search or filter starts at the top again.
  useEffect(() => setShown(pageSize), [t, cat, facetVals, near, sort, pageSize]);
  // After "Show more", focus goes to the first new card.
  useEffect(() => {
    if (focusFrom.current === null) return;
    const btn = grid.current?.querySelectorAll<HTMLElement>(".fl-cat-card")[focusFrom.current]?.querySelector<HTMLElement>(".fl-cat-open, .fl-cat-save");
    focusFrom.current = null;
    btn?.focus();
  }, [shown]);

  const facetDefs = facets.map((k) => {
    const f = fieldOf(e, k);
    const opts = f?.options ?? [...new Set(entries.map((r) => str(r[k])).filter(Boolean))].sort();
    return { key: k, label: f?.label ?? k, opts };
  });
  const catLabel = fieldOf(e, cfg.categoryField)?.label ?? "Category";
  const place = placeName(state.placeId);
  const nearLabel = state.zip ? (state.placeId ? `At ${place}` : `Near ${state.zip}`) : "Available near me";

  const active: { key: string; label: string; remove: () => void }[] = [];
  if (q.trim()) active.push({ key: "q", label: `“${q.trim()}”`, remove: () => changeQ("") });
  if (cat) active.push({ key: "cat", label: cat, remove: () => changeCat("") });
  for (const f of facetDefs) if (facetVals[f.key]) active.push({ key: `f:${f.key}`, label: `${f.label}: ${facetVals[f.key]}`, remove: () => setFacetVals((v) => ({ ...v, [f.key]: "" })) });
  if (near && state.zip) active.push({ key: "near", label: state.placeId ? `At ${place}` : `Near ${state.zip}`, remove: () => setNear(false) });
  const clearAll = () => {
    changeQ("");
    changeCat("");
    setFacetVals({});
    setNear(false);
  };

  const toggleNear = () => {
    if (!state.zip) {
      setAskZip((v) => !v);
      return;
    }
    continuity(grid.current, () => setNear((v) => !v));
  };
  // Nothing left half-moved when the catalog goes away mid-move.
  useEffect(
    () => () => {
      for (const m of moving) m.cancel();
      moving = [];
    },
    [],
  );

  const visible = results.slice(0, shown);
  const left = results.length - visible.length;

  return (
    <section className="fl-cat-root" data-fl="p.lookup-catalog.grid" aria-labelledby={headId}>
      <header className="fl-cat-head">
        <h2 id={headId} className="fl-cat-title">
          {title ?? e.plural}
        </h2>
        {description ? <p className="fl-cat-lede">{description}</p> : null}
      </header>

      {toolbar ? (
      <div className="fl-cat-toolbar">
        <SuggestField
          lookup={lookup}
          value={q}
          onChange={changeQ}
          label={`Search ${plural}`}
          placeholder={`Search ${plural} by name or ${catLabel.toLowerCase()}`}
          tagsField={tagsField}
          onSubmit={(v) => changeQ(v)}
          onPick={(s) => {
            if (s.kind === "category") {
              changeCat(s.value);
              changeQ("");
            } else if (s.kind === "entry") {
              if (onOpen) onOpen(s.value);
              else changeQ(s.label);
            } else changeQ(s.value);
          }}
        />
        <div className="fl-cat-filters">
          <Select label={catLabel} value={cat} onChange={changeCat}>
            <option value="">{`Every ${catLabel.toLowerCase()}`}</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {`${c.name} (${entries.filter((r) => str(r[cfg.categoryField]) === c.name).length})`}
              </option>
            ))}
          </Select>
          {facetDefs.map((f) => (
            <Select key={f.key} label={f.label} value={facetVals[f.key] ?? ""} onChange={(v) => continuity(grid.current, () => setFacetVals((x) => ({ ...x, [f.key]: v })))}>
              <option value="">{`${f.label}: any`}</option>
              {f.opts.map((o) => (
                <option key={o} value={o}>
                  {`${f.label}: ${o}`}
                </option>
              ))}
            </Select>
          ))}
          <button ref={nearBtn} type="button" className="fl-cat-near" aria-pressed={near && !!state.zip} aria-expanded={!state.zip ? askZip : undefined} onClick={toggleNear}>
            <Icon name="pin" />
            {near && state.zip ? nearLabel : state.zip ? `Available near ${state.zip}` : "Available near me"}
          </button>
          {state.zip && !askZip ? (
            <button type="button" className="fl-cat-zipchange" onClick={() => setAskZip(true)}>
              Change ZIP
            </button>
          ) : null}
          <Select label="Sort by" value={sort} onChange={(v) => continuity(grid.current, () => setSort(v as SortKey))}>
            <option value="liked">Sort: most liked</option>
            <option value="rated">Sort: top rated</option>
            {dateField ? <option value="newest">Sort: newest</option> : null}
            <option value="az">Sort: A to Z</option>
          </Select>
        </div>
      </div>
      ) : null}

      {askZip ? (
        <ZipAsk
          lookup={lookup}
          onCancel={() => {
            setAskZip(false);
            nearBtn.current?.focus();
          }}
          onDone={() => {
            setAskZip(false);
            setNear(true);
            nearBtn.current?.focus();
          }}
        />
      ) : null}

      <div className="fl-cat-status">
        {active.length ? (
          <ul className="fl-cat-active" aria-label="Filters on">
            {active.map((a) => (
              <li key={a.key} className="fl-cat-chip">
                <span>{a.label}</span>
                <button type="button" className="fl-cat-chip-x" aria-label={`Remove the ${a.label} filter`} onClick={a.remove}>
                  <Icon name="close" />
                </button>
              </li>
            ))}
            {active.length > 1 ? (
              <li>
                <button type="button" className="fl-cat-clear" onClick={clearAll}>
                  Clear all
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
        <p className="fl-cat-count" aria-live="polite">
          {loading ? `Loading ${plural}…` : entries.length ? noun(results.length) : ""}
        </p>
      </div>

      {loading ? (
        <ul className={`fl-cat-grid fl-cat-grid--${layout}`} aria-busy="true" aria-label={`Loading ${plural}`}>
          {Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
            <li key={i} className="fl-cat-card fl-cat-card--skeleton" aria-hidden="true">
              <span className="fl-cat-pic fl-cat-bone" />
              <span className="fl-cat-body">
                <span className="fl-cat-bone fl-cat-bone--short" />
                <span className="fl-cat-bone" />
                <span className="fl-cat-bone fl-cat-bone--mid" />
              </span>
            </li>
          ))}
        </ul>
      ) : !entries.length ? (
        <div className="fl-cat-empty">
          <span className="fl-cat-empty-icon" aria-hidden="true">
            <Icon name="folder" />
          </span>
          <p className="fl-cat-empty-title">{empty?.title ?? `No ${plural} yet`}</p>
          <p className="fl-cat-empty-text">{empty?.text ?? `When ${plural} are added they show here, with the ${pluralOf(placeWord)} that have them.`}</p>
          {empty?.action ? (
            <Button size={32} variant="secondary" onClick={empty.action.onClick}>
              {empty.action.label}
            </Button>
          ) : null}
        </div>
      ) : !results.length ? (
        <div className="fl-cat-empty">
          <span className="fl-cat-empty-icon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <p className="fl-cat-empty-title">{`No ${plural} match`}</p>
          <p className="fl-cat-empty-text">
            {near && state.zip ? `Nothing that matches is at ${state.placeId ? place : `the ${pluralOf(placeWord)} near ${state.zip}`}. ` : ""}
            Check the spelling, try a {catLabel.toLowerCase()} below, or clear the filters.
          </p>
          <div className="fl-cat-empty-cats">
            {categories
              .filter((c) => c.name !== cat && entries.some((r) => str(r[cfg.categoryField]) === c.name))
              .slice(0, 6)
              .map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="fl-cat-catchip"
                  onClick={() => {
                    clearAll();
                    changeCat(c.name);
                  }}
                >
                  {c.name}
                </button>
              ))}
          </div>
          <Button size={32} variant="secondary" icon="close" onClick={clearAll}>
            Clear all filters
          </Button>
        </div>
      ) : (
        <>
          <ul ref={grid} className={`fl-cat-grid fl-cat-grid--${layout}`} data-layout={layout} aria-label={title ?? e.plural}>
            {visible.map((r) => (
              <Card key={r.id} lookup={lookup} e={e} r={r} q={q.trim()} badgeField={badgeField} imageField={imageField} categories={categories} onOpen={onOpen} placeName={placeName} />
            ))}
          </ul>
          {left > 0 ? (
            <div className="fl-cat-more">
              <Button
                size={40}
                variant="secondary"
                onClick={() => {
                  focusFrom.current = visible.length;
                  setShown((n) => n + pageSize);
                }}
              >
                {`Show more (${left} left)`}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Card({
  lookup,
  e,
  r,
  q,
  badgeField,
  imageField,
  categories,
  onOpen,
  placeName,
}: {
  lookup: LookupStore;
  e: EntityDef;
  r: RecordData;
  q: string;
  badgeField?: string;
  imageField: string;
  categories: { name: string; tone: number; icon: string }[];
  onOpen?: (id: string) => void;
  placeName: (id?: string) => string;
}) {
  const st = lookup.get();
  const cfg = lookup.config;
  const placeWord = cfg.placeWord ?? "place";
  const name = str(r[e.titleField]) || r.id;
  const sub = e.subtitleField ? str(r[e.subtitleField]) : "";
  const catName = str(r[cfg.categoryField]);
  const c = categories.find((x) => x.name === catName);
  const img = str(r[imageField]);
  const badge = badgeField ? str(r[badgeField]) : "";
  const sum = lookup.summary(r.id);
  const likes = lookup.likes(r.id);
  const saved = lookup.saves(r.id).mine;

  let where: { text: string; on: boolean } | null = null;
  if (st.zip) {
    if (st.placeId) {
      const at = lookup.carries(st.placeId, r.id);
      where = { text: `${at ? "At" : "Not at"} ${placeName(st.placeId)}`, on: at };
    } else {
      const n = lookup.carriers(r.id).length;
      if (n) where = { text: `At ${n} ${n === 1 ? placeWord : pluralOf(placeWord)} near ${st.zip}`, on: true };
      else {
        const far = lookup.nearestCarrier(r.id);
        where = { text: far && Number.isFinite(far.miles) ? `Not near ${st.zip} (nearest ${Math.round(far.miles)} mi)` : `Not at any ${placeWord} near ${st.zip}`, on: false };
      }
    }
  }

  return (
    <li className="fl-cat-card" data-key={r.id}>
      <div className="fl-cat-pic" data-tone={c?.tone ?? 0}>
        {img ? <img src={img} alt="" loading="lazy" /> : <Icon name={c?.icon ?? "image"} />}
      </div>
      <button type="button" className="fl-cat-save" aria-pressed={saved} aria-label={`Save ${name}`} title={saved ? "Saved" : "Save"} onClick={() => lookup.toggleSave(r.id)}>
        <Bookmark on={saved} />
      </button>
      <div className="fl-cat-body">
        {catName ? <p className="fl-cat-kind">{catName}</p> : null}
        <h3 className="fl-cat-name">
          {onOpen ? (
            <button type="button" className="fl-cat-open" onClick={() => onOpen(r.id)}>
              <Hl text={name} q={q} />
            </button>
          ) : (
            <Hl text={name} q={q} />
          )}
        </h3>
        {sub ? <p className="fl-cat-sub">{sub}</p> : null}
        {badge ? (
          <p className="fl-cat-badge">
            <Icon name="star" />
            {badge}
          </p>
        ) : null}
        <p className="fl-cat-meta">
          {sum.count ? (
            <span className="fl-cat-stars" aria-label={`Rated ${sum.average.toFixed(1)} out of 5 from ${sum.count} ${sum.count === 1 ? "rating" : "ratings"}`}>
              <Icon name="star" filled />
              <span aria-hidden="true">{`${sum.average.toFixed(1)} (${sum.count})`}</span>
            </span>
          ) : (
            <span className="fl-cat-stars fl-cat-stars--none">No ratings yet</span>
          )}
          <span className="fl-cat-likes" aria-label={`${likes.count} likes`}>
            <Icon name="heart" filled={likes.mine} />
            <span aria-hidden="true">{likes.count}</span>
          </span>
        </p>
        {where ? (
          <p className={`fl-cat-where${where.on ? " is-on" : ""}`}>
            <Icon name={where.on ? "pin" : "info"} />
            {where.text}
          </p>
        ) : null}
      </div>
    </li>
  );
}

// ── Category index ──

/** layout: "tiles" (a grid of tiles, the default), "chips" (one wrapping row of pills), "rail" (large tiles in one row that scrolls sideways). */
export function CategoryIndex({ lookup, onCategory, description, selected, layout = "tiles" }: { lookup: LookupStore; onCategory: (name: string) => void; description?: string; selected?: string; layout?: "tiles" | "chips" | "rail" }) {
  const { e, categories } = useCatalog(lookup);
  const plural = e.plural.toLowerCase();
  return (
    <div className="fl-cat-index" data-fl="p.lookup-catalog.categories">
      {description ? <p className="fl-cat-lede">{description}</p> : null}
      <ul className={`fl-cat-tiles fl-cat-tiles--${layout}`} data-layout={layout} aria-label={`${e.plural} by category`}>
        {categories.map((c) => (
          <li key={c.name}>
            <button type="button" className="fl-cat-tile" aria-pressed={selected !== undefined ? selected === c.name : undefined} onClick={() => onCategory(c.name)}>
              <span className="fl-cat-tile-icon" data-tone={c.tone} aria-hidden="true">
                <Icon name={c.icon} />
              </span>
              <span className="fl-cat-tile-name">{c.name}</span>
              <span className="fl-cat-tile-count">{c.count ? `${c.count} ${c.count === 1 ? e.label.toLowerCase() : plural}` : `No ${plural} yet`}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Spotlight ──

/** The most liked entry, large: a picture, its category, name and maker, its rating and an Open action. */
export function LookupSpotlight({ lookup, onOpen, label = "Most liked this week" }: { lookup: LookupStore; onOpen?: (id: string) => void; label?: string }) {
  const { e, entries, categories } = useCatalog(lookup);
  const top = useMemo(() => [...entries].sort((a, b) => lookup.likes(b.id).count - lookup.likes(a.id).count)[0], [entries, lookup]);
  if (!top) return null;
  const name = str(top[e.titleField]) || top.id;
  const sub = e.subtitleField ? str(top[e.subtitleField]) : "";
  const catName = str(top[lookup.config.categoryField]);
  const c = categories.find((x) => x.name === catName);
  const sum = lookup.summary(top.id);
  return (
    <article className="fl-cat-spot" data-fl="p.lookup-catalog.spotlight" aria-label={`${label}: ${name}`}>
      <div className="fl-cat-pic fl-cat-spot-pic" data-tone={c?.tone ?? 0}>
        <Icon name={c?.icon ?? "image"} />
      </div>
      <div className="fl-cat-spot-body">
        <p className="fl-cat-kind">{label}</p>
        <h2 className="fl-cat-spot-name">{name}</h2>
        {sub ? <p className="fl-cat-sub">{sub}</p> : null}
        <p className="fl-cat-meta">
          {sum.count ? (
            <span className="fl-cat-stars">
              <Icon name="star" filled />
              {`${sum.average.toFixed(1)} from ${sum.count} ${sum.count === 1 ? "rating" : "ratings"}`}
            </span>
          ) : (
            <span className="fl-cat-stars fl-cat-stars--none">No ratings yet</span>
          )}
        </p>
        {onOpen ? (
          <div className="fl-cat-spot-act">
            <Button size={40} variant="primary" onClick={() => onOpen(top.id)}>
              {`Open ${name}`}
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

// ── Compact search ──

export function CatalogSearch({ lookup, onSearch, onOpen, onCategory, placeholder, tagsField }: { lookup: LookupStore; onSearch: (q: string) => void; onOpen: (id: string) => void; onCategory?: (name: string) => void; placeholder?: string; tagsField?: string }) {
  const e = lookup.app.entity(lookup.config.entries);
  const [q, setQ] = useState("");
  return (
    <div className="fl-cat-compact" data-fl="p.lookup-catalog.search">
      <SuggestField
        lookup={lookup}
        compact
        tagsField={tagsField}
        value={q}
        onChange={setQ}
        label={`Search ${e.plural.toLowerCase()}`}
        placeholder={placeholder ?? `Search ${e.plural.toLowerCase()}`}
        onSubmit={(v) => {
          if (v) onSearch(v);
        }}
        onPick={(s) => {
          if (s.kind === "entry") {
            setQ("");
            onOpen(s.value);
          } else if (s.kind === "category") {
            setQ("");
            if (onCategory) onCategory(s.value);
            else onSearch(s.value);
          } else {
            setQ(s.value);
            onSearch(s.value);
          }
        }}
      />
    </div>
  );
}

// ── The reference sheet ──

function ZipDemo({ lookup }: { lookup: LookupStore }) {
  const st = useLookup(lookup);
  const bernal = "LIB-1002";
  return (
    <div className="fl-cat-demo" role="group" aria-label="Try a ZIP code">
      <span className="fl-cat-demo-label">Try it from</span>
      {["94110", "78704"].map((z) => (
        <button key={z} type="button" className="fl-cat-demo-btn" aria-pressed={st.zip === z} onClick={() => lookup.setZip(z)}>
          {z}
        </button>
      ))}
      <button type="button" className="fl-cat-demo-btn" aria-pressed={st.placeId === bernal} disabled={st.zip !== "94110"} onClick={() => lookup.choosePlace(st.placeId === bernal ? undefined : bernal)}>
        Bernal Heights Branch
      </button>
      <button type="button" className="fl-cat-demo-btn" aria-pressed={!st.zip} onClick={() => lookup.clearZip()}>
        No ZIP code
      </button>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Children's books",
  description: "Find a book and the libraries near you that have it.",
  facets: ["ages"],
  badgeField: "award",
  tagsField: "tags",
  dateField: "published",
};

export default function LookupCatalogSheet() {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [tiles, setTiles] = useState<"tiles" | "chips" | "rail">("tiles");
  const [rows, setRows] = useState<"grid" | "rows">("grid");
  const catalog = useRef<HTMLDivElement>(null);
  const pick = <T extends string>(label: string, options: T[], value: T, set: (v: T) => void) => (
    <div className="fl-cat-demo" role="group" aria-label={label}>
      <span className="fl-cat-demo-label">{label}</span>
      {options.map((o) => (
        <button key={o} type="button" className="fl-cat-demo-btn" aria-pressed={value === o} onClick={() => set(o)}>
          {o[0]!.toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  );
  const toCatalog = () => catalog.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Category index</h3>
        <p className="fl-ctl-btn-what">Every genre with how many books it has, as tiles, a row of chips or a rail that scrolls sideways. Pick one and the catalog below filters to it.</p>
        {pick("Layout", ["tiles", "chips", "rail"], tiles, setTiles)}
        <CategoryIndex
          lookup={sampleLookup}
          layout={tiles}
          selected={cat}
          onCategory={(name) => {
            setCat(name === cat ? "" : name);
            if (name !== cat) toCatalog();
          }}
        />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide" ref={catalog}>
        <h3>Catalog</h3>
        <p className="fl-ctl-btn-what">Search with suggestions (try “sp” or “space”), filter by genre and ages, sort, save. Pick a ZIP code to see which libraries near it have each book, then choose a branch.</p>
        <ZipDemo lookup={sampleLookup} />
        <LookupCatalog
          lookup={sampleLookup}
          title={SAMPLE.title}
          description={SAMPLE.description}
          category={cat}
          query={q}
          onCategory={setCat}
          onSearch={setQ}
          onOpen={(id) => toast(`The page for ${id} opens here.`, "info")}
          facets={SAMPLE.facets}
          badgeField={SAMPLE.badgeField}
          tagsField={SAMPLE.tagsField}
          dateField={SAMPLE.dateField}
          pageSize={8}
          layout={rows}
        />
        {pick("Cards", ["grid", "rows"], rows, setRows)}
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Spotlight</h3>
        <p className="fl-ctl-btn-what">The most liked book, large, for the opening of a landing page beside its promise.</p>
        <LookupSpotlight lookup={sampleLookup} onOpen={(id) => toast(`The page for ${id} opens here.`, "info")} />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Compact search</h3>
        <p className="fl-ctl-btn-what">For an app's top bar: the same suggestions; a book opens, a genre or a search fills the catalog above.</p>
        <div className="fl-cat-topbar">
          <span className="fl-cat-topbar-name">Storytime Finder</span>
          <CatalogSearch
            lookup={sampleLookup}
            placeholder="Search books"
            tagsField={SAMPLE.tagsField}
            onOpen={(id) => toast(`The page for ${id} opens here.`, "info")}
            onCategory={(name) => {
              setCat(name);
              setQ("");
              toCatalog();
            }}
            onSearch={(v) => {
              setQ(v);
              toCatalog();
            }}
          />
        </div>
      </div>
      <Toaster />
    </section>
  );
}
