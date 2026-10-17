/** @flowcode-library lookup-home-storefront · Look-up Home: storefront (Industry sites)
 * Catalog ID: p.lookup-home.storefront (pattern)
 * Function: A look-up app's Home page in the storefront (t.app-storefront) design: the same sections and styles, filled from the app's own data (entries, categories, ratings, saves, places) through the look-up data layer. FlowCode offers it as a Home concept.
 * Use it as: import { LookupHomeStorefront } from "./lookup-home-storefront"; <LookupHomeStorefront lookup={lookup} product promise? onOpen?={(id) => ...} onCategory?={(name) => ...} onSearch?={(q) => ...} onBrowse?={() => ...} />
 * Built from: c.tabs, c.button.primary, c.button.secondary
 * Look: The storefront's bold promo banner with the product's name and a Browse everything button, a search field, category tabs over a four-column grid of the most liked entries with drawn tiles, ratings and a save toggle.
 * Use cases: shop home; product finder home; grocery finder; catalog home
 * Jobs to be done: see what people like most; browse by category; search for something; save it for later
 * Keywords: home, storefront, shop, look-up, catalog, promo
 */
/**
 * Look-up Home in the storefront design: the Home page body of a "find it and where to get it" app, following the shop
 * home screen (app-storefront.tsx). The bold accent promo banner names the product and its promise with a "Browse
 * everything" button, a search field sends what was typed on Enter, the category tabs filter the grid in place (arrow
 * keys, Home and End move between them, as in the shop) and offer the whole category below the grid, and the product
 * grid shows the eight most liked entries with the shop's drawn art, the maker, the rating and a save toggle where the
 * shop had add-to-bag. The app's frame (top bar, account, footer) comes from LookupFrame, so the shop's own header, bag
 * and footer are left out, and there are no prices because look-up entries have none.
 */
import { useId, useMemo, useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";
import { Tabs } from "./tabs-variants";
import { EmptyState } from "./empty-states";
import { Icon } from "./icons";
import { toast, Toaster, type RecordData } from "./app-data";
import type { LookupStore } from "./lookup-data";
import { useCatalog, str } from "./lookup-catalog";
import { sampleLookup } from "./lookup-sample";

export interface LookupHomeProps {
  lookup: LookupStore;
  /** The app's name: the promo banner's heading. */
  product: string;
  /** One line on what the app does for people: the promo banner's text. */
  promise?: string;
  onOpen?: (id: string) => void;
  onCategory?: (name: string) => void;
  onSearch?: (q: string) => void;
  onBrowse?: () => void;
}

const ALL = "__all";
const SHOWN = 8;

/** A bookmark (saved) glyph in the icons' style. */
function Bookmark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function LookupHomeStorefront({ lookup, product, promise, onOpen, onCategory, onSearch, onBrowse }: LookupHomeProps) {
  const { state, e, entries, categories } = useCatalog(lookup);
  const catField = lookup.config.categoryField;
  const uid = useId();
  const [tab, setTab] = useState(ALL);
  const [query, setQuery] = useState("");
  const plural = e.plural.toLowerCase();
  const noun = (n: number) => `${n} ${n === 1 ? e.label.toLowerCase() : plural}`;

  // Most liked first; state follows every like and save in the look-up store.
  const ranked = useMemo(
    () => [...entries].sort((a, b) => lookup.likes(b.id).count - lookup.likes(a.id).count || str(a[e.titleField]).localeCompare(str(b[e.titleField]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, state, e.titleField],
  );

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const q = query.trim();
    if (q) onSearch?.(q);
  };

  function card(r: RecordData) {
    const name = str(r[e.titleField]) || r.id;
    const sub = e.subtitleField ? str(r[e.subtitleField]) : "";
    const c = categories.find((x) => x.name === str(r[catField]));
    const sum = lookup.summary(r.id);
    const saved = lookup.saves(r.id).mine;
    return (
      <li key={r.id} className="fl-as-product">
        <div className="fl-as-art fl-lhs-art" data-tone={c?.tone ?? 0} style={{ ["--fl-as-tilt" as string]: `${((c?.tone ?? 0) * 35 + 12) % 180}deg` }}>
          <Icon name={c?.icon ?? "image"} />
        </div>
        <button type="button" className="fl-cat-save" aria-pressed={saved} aria-label={`Save ${name}`} title={saved ? "Saved" : "Save"} onClick={() => lookup.toggleSave(r.id)}>
          <Bookmark on={saved} />
        </button>
        <div className="fl-as-product__body">
          <h3>
            {onOpen ? (
              <button type="button" className="fl-lhs-open" onClick={() => onOpen(r.id)}>
                {name}
              </button>
            ) : (
              name
            )}
          </h3>
          {sub ? <span className="fl-meta">{sub}</span> : null}
        </div>
        <p className="fl-lhs-rating">
          {sum.count ? (
            <span className="fl-cat-stars" aria-label={`Rated ${sum.average.toFixed(1)} out of 5 from ${sum.count} ${sum.count === 1 ? "rating" : "ratings"}`}>
              <Icon name="star" filled />
              <span aria-hidden="true">{`${sum.average.toFixed(1)} (${sum.count})`}</span>
            </span>
          ) : (
            <span className="fl-cat-stars fl-cat-stars--none">No ratings yet</span>
          )}
        </p>
      </li>
    );
  }

  /** One tab's panel: the count line, the most liked in it (or the empty state) and the way to the whole category. */
  function panel(cat: string) {
    const inCat = cat === ALL ? ranked : ranked.filter((r) => str(r[catField]) === cat);
    const shown = inCat.slice(0, SHOWN);
    return (
      <div>
        <p className="fl-meta" aria-live="polite" style={{ marginBlock: "0 var(--space-4)" }}>
          {inCat.length > shown.length ? `The ${shown.length} most liked of ${noun(inCat.length)}` : noun(inCat.length)}
        </p>
        {shown.length === 0 ? (
          <EmptyState variant="no-results" title={`No ${plural} in ${cat} yet`} headingLevel={2}>
            {`When ${plural} are added to ${cat} they show here.`}
          </EmptyState>
        ) : (
          <ul className="fl-as-products" aria-label={cat === ALL ? `Most liked ${plural}` : `Most liked in ${cat}`}>
            {shown.map(card)}
          </ul>
        )}
        {cat !== ALL && onCategory && inCat.length > 0 ? (
          <div className="fl-lhs-more">
            <Button variant="secondary" size={40} icon="arrow" iconAt="end" onClick={() => onCategory(cat)}>
              {`See all ${noun(inCat.length)} in ${cat}`}
            </Button>
          </div>
        ) : cat === ALL && onBrowse && inCat.length > shown.length ? (
          <div className="fl-lhs-more">
            <Button variant="secondary" size={40} icon="arrow" iconAt="end" onClick={onBrowse}>
              {`See all ${noun(inCat.length)}`}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fl-lhs fl-as-main fl-as-shopmain" data-fl="p.lookup-home.storefront">
      <section className="fl-as-promo" aria-labelledby={`${uid}-title`}>
        <div className="fl-as-promo__text">
          <p className="fl-as-promo__eyebrow">{`${categories.length} ${categories.length === 1 ? "category" : "categories"} · ${noun(entries.length)}`}</p>
          <h1 id={`${uid}-title`} className="fl-as-promo__title fl-lhs-promo-title">
            {product}
          </h1>
          {promise ? <p>{promise}</p> : null}
          {onBrowse ? (
            <Button variant="on-accent" icon="arrow" iconAt="end" onClick={onBrowse}>
              Browse everything
            </Button>
          ) : null}
        </div>
      </section>

      <div className="fl-as-pagehead">
        <div>
          <h2 className="fl-as-h1">{`Most liked ${plural}`}</h2>
          <p className="fl-text">{`What people here like most. Pick a category to narrow it down.`}</p>
        </div>
        <form className="fl-as-search fl-lhs-search" role="search" onSubmit={submit}>
          <label htmlFor={`${uid}-q`} className="fl-sr">
            {`Search ${plural}`}
          </label>
          <Icon name="search" />
          <TextField id={`${uid}-q`} type="search" placeholder={`Search ${plural}`} value={query} onChange={(ev) => setQuery(ev.target.value)} />
        </form>
      </div>

      <Tabs
        label="Categories"
        value={tab}
        onChange={setTab}
        tabs={[{ id: ALL, label: "All", panel: tab === ALL ? panel(ALL) : null }, ...categories.map((c) => ({ id: c.name, label: c.name, panel: tab === c.name ? panel(c.name) : null }))]}
      />
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  product: "Storytime Finder",
  promise: "Find a children's book and the libraries near you that have it on the shelf today.",
};

export default function LookupHomeStorefrontSheet() {
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Look-up Home, storefront</h3>
        <p className="fl-ctl-btn-what">
          The Home page body in the shop's design: the promo banner, a search (Enter sends it), category tabs that filter the most liked books in place (arrow keys move between them) with the whole category below, and a save toggle on every card.
        </p>
        <LookupHomeStorefront
          lookup={sampleLookup}
          product={SAMPLE.product}
          promise={SAMPLE.promise}
          onOpen={(id) => toast(`The page for ${id} opens here.`, "info")}
          onCategory={(name) => toast(`The catalog opens filtered to ${name}.`, "info")}
          onSearch={(q) => toast(`The catalog opens with the search “${q}”.`, "info")}
          onBrowse={() => toast("The full catalog opens here.", "info")}
        />
      </div>
      <Toaster />
    </section>
  );
}
