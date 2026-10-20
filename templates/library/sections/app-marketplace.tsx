/** @flowcode-library app-marketplace · Marketplace browse (App screens)
 * Catalog ID: t.app-marketplace (template)
 * Function: An app screen: a two-sided marketplace's browse page where many sellers list items, with search and location, category chips, a working filter sidebar, sort, a live result count and listing cards with seller ratings, verified badges and save toggles.
 * Use it as: Copy app-marketplace.tsx (FlowCode brings the components it uses); replace SAMPLE with the marketplace's own categories, listings and sellers, load listings from the app's data, and keep saved listings in the user's account.
 * Built from: c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.chip.filter, c.slider.range, c.checkbox, c.radio, c.choice-group.pill, c.select.outlined, c.badge.status, c.empty-state.no-results
 * Look: A top bar with a big search, location, Sign in and List an item; a row of category chips; a filter sidebar (price range, condition, distance, seller rating) beside a sortable grid of listing cards with drawn pictures, price, place, seller rating, verified badges and a save heart.
 * Use cases: marketplace; two-sided marketplace; classifieds; peer-to-peer marketplace; secondhand marketplace; listings browse; rental listings; local services marketplace
 * Jobs to be done: find an item for sale near me; narrow listings by price, condition and distance; compare sellers by rating; save listings to look at later; list something to sell
 * Keywords: app, marketplace, listings, classifieds, search, filters, sellers, two-sided
 */
/**
 * App screen: a two-sided marketplace's browse page, where many sellers list things and buyers look for them nearby. A
 * top bar with the brand, a big search with a location field, Sign in and "List an item"; category chips with their
 * counts; a filter sidebar (price range, condition, distance, seller rating, verified sellers only) that filters the
 * listings as you change it; a sort control and a result count that updates; and a grid of listing cards with a drawn
 * picture, title, price, place, how long ago it was posted, the seller's rating and a "Verified seller" badge where it
 * applies, and a save (heart) toggle. No matches shows an empty state with a way back. On narrow widths the filters fold
 * into a panel above the results, opened with a Filters button.
 * Use it as the home or browse screen of a peer-to-peer marketplace (secondhand goods, rentals, local services). Make it
 * the app's own: replace SAMPLE with the marketplace's real categories, listings and sellers, load listings from the
 * app's data, and keep saved listings in the user's account instead of this screen's memory.
 */
/**
 * Assembled from: top bar (inline: brand, c.text-field search and location, c.button.tertiary Sign in, c.button.primary
 * List an item) > category row (c.chip.filter) > filter sidebar (c.slider.range filled, c.checkbox, c.choice-group.pill,
 * c.radio, c.button.tertiary Clear) > results head (c.select sort, live count) > listing grid (inline cards, c.badge.status
 * verified, c.button.tertiary heart toggle) > c.empty-state for no matches.
 */
import { useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { Chip } from "./chips-tags";
import { TextField } from "./text-fields-states";
import { Select } from "./dropdowns-states";
import { Checkbox, ChoiceGroup, Radio } from "./checkboxes-radios";
import { Slider } from "./sliders-states";
import { EmptyState } from "./empty-states";

// flowcode:sample
const SAMPLE = {
  brand: "Swapyard",
  mark: "S",
  searchLabel: "Search listings",
  searchPlaceholder: "Search 12,000 listings",
  locationLabel: "Location",
  location: "Portland, OR",
  searchAction: "Search",
  signIn: "Sign in",
  listItem: "List an item",
  categoriesLabel: "Categories",
  filtersTitle: "Filters",
  showFilters: "Filters",
  clearAll: "Clear all",
  priceLabel: "Price",
  priceMax: 1000,
  conditionLabel: "Condition",
  conditions: ["New", "Like new", "Good", "Fair"],
  distanceLabel: "Distance",
  distances: [
    { value: "5", label: "5 mi" },
    { value: "10", label: "10 mi" },
    { value: "25", label: "25 mi" },
    { value: "any", label: "Any" },
  ],
  ratingLabel: "Seller rating",
  ratings: [
    { value: "4.5", label: "4.5 and up" },
    { value: "4", label: "4.0 and up" },
    { value: "any", label: "Any rating" },
  ],
  verifiedOnly: "Verified sellers only",
  verifiedHint: "ID and payment checked by Swapyard",
  verified: "Verified seller",
  sortLabel: "Sort by",
  sorts: [
    { value: "best", label: "Best match" },
    { value: "newest", label: "Newest first" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "nearest", label: "Nearest first" },
  ],
  save: "Save",
  noMatchTitle: "No listings match",
  noMatchText: "Try a wider distance or price, or clear the filters to see everything near you.",
  categories: ["All", "Furniture", "Electronics", "Bikes", "Home & garden", "Music", "Clothing"],
  listings: [
    { id: "l1", title: "Mid-century walnut armchair", category: "Furniture", price: 240, condition: "Like new", miles: 3.2, place: "Hawthorne", posted: 45, seller: "Dana Whitfield", rating: 4.9, reviews: 128, verified: true, hue: 20 },
    { id: "l2", title: "Trek FX 2 hybrid bike, 54 cm frame", category: "Bikes", price: 380, condition: "Good", miles: 6.8, place: "Sellwood", posted: 180, seller: "Marcus Bell", rating: 4.7, reviews: 36, verified: true, hue: 200 },
    { id: "l3", title: "MacBook Air M2, 13-inch, 256 GB", category: "Electronics", price: 720, condition: "Like new", miles: 11.5, place: "Beaverton", posted: 70, seller: "Priya Nair", rating: 4.8, reviews: 61, verified: true, hue: 240 },
    { id: "l4", title: "Fender Frontman 25R guitar amp", category: "Music", price: 95, condition: "Good", miles: 4.1, place: "Alberta Arts", posted: 1500, seller: "Jonah Price", rating: 4.3, reviews: 9, verified: false, hue: 340 },
    { id: "l5", title: "Monstera, 4 ft, in a glazed ceramic pot", category: "Home & garden", price: 65, condition: "Good", miles: 2.4, place: "Pearl District", posted: 300, seller: "Lena Ortiz", rating: 5.0, reviews: 22, verified: true, hue: 130 },
    { id: "l6", title: "Patagonia Nano Puff jacket, women's M", category: "Clothing", price: 85, condition: "Like new", miles: 8.9, place: "Lake Oswego", posted: 120, seller: "Hannah Cho", rating: 4.6, reviews: 14, verified: false, hue: 280 },
    { id: "l7", title: "Solid oak dining table, seats six", category: "Furniture", price: 450, condition: "Fair", miles: 18.3, place: "Gresham", posted: 2900, seller: "Rob Delgado", rating: 4.1, reviews: 7, verified: false, hue: 40 },
    { id: "l8", title: "Sony WH-1000XM5 headphones, sealed", category: "Electronics", price: 210, condition: "New", miles: 5.6, place: "Downtown", posted: 20, seller: "Andre Kim", rating: 4.9, reviews: 203, verified: true, hue: 220 },
    { id: "l9", title: "Kids' 20-inch bike with training wheels", category: "Bikes", price: 60, condition: "Good", miles: 13.7, place: "Milwaukie", posted: 360, seller: "Teresa Young", rating: 3.8, reviews: 5, verified: false, hue: 170 },
  ],
};

type Listing = (typeof SAMPLE.listings)[number];

const SEARCH = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4";
const PIN = "M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const ago = (min: number) => (min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} hr ago` : `${Math.round(min / 1440)} days ago`);

/** A simple line drawing for each category, so a listing has a picture without any image file. */
const ART: Record<string, string> = {
  Furniture: "M32 26h36v28H32zM28 54h44v8H28zM32 62v14M68 62v14",
  Electronics: "M26 30h48v32H26zM18 70h64l-4-8H22z",
  Bikes: "M30 66a12 12 0 1 0 0.1 0zM70 66a12 12 0 1 0 0.1 0zM30 66l12-24h18l10 24M42 42l14 24h14M56 34h8",
  "Home & garden": "M36 56h28l-4 22H40zM50 56V36M50 44c-8-10-17-7-17-7s4 10 17 9M50 40c6-10 17-9 17-9s-2 11-17 11",
  Music: "M34 22h32v56H34zM50 62a9 9 0 1 0 0.1 0zM50 34a5 5 0 1 0 0.1 0z",
  Clothing: "M38 24 24 34l6 12 8-4v34h24V42l8 4 6-12-14-10c-2 6-7 8-12 8s-10-2-12-8z",
};

function ListingArt({ l }: { l: Listing }) {
  return (
    <div className="fl-mkt-art" style={{ ["--fl-mkt-hue" as string]: `${l.hue}deg` }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d={ART[l.category] ?? ART.Furniture} />
      </svg>
    </div>
  );
}

const PRICE_ALL: [number, number] = [0, SAMPLE.priceMax];

export default function AppMarketplace() {
  const d = SAMPLE;
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState(d.location);
  const [category, setCategory] = useState("All");
  const [price, setPrice] = useState<[number, number]>(PRICE_ALL);
  const [conditions, setConditions] = useState<string[]>([]);
  const [distance, setDistance] = useState("any");
  const [rating, setRating] = useState("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState("best");
  const [saved, setSaved] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sliderKey, setSliderKey] = useState(0);
  const [say, setSay] = useState("");

  const q = query.trim().toLowerCase();
  const near = place.trim() || d.location;

  // Everything but the category, so each chip can show how many it would leave.
  const base = d.listings.filter(
    (l) =>
      (!q || `${l.title} ${l.category} ${l.seller} ${l.place}`.toLowerCase().includes(q)) &&
      l.price >= price[0] &&
      l.price <= price[1] &&
      (conditions.length === 0 || conditions.includes(l.condition)) &&
      (distance === "any" || l.miles <= Number(distance)) &&
      (rating === "any" || l.rating >= Number(rating)) &&
      (!verifiedOnly || l.verified),
  );
  const shown = base.filter((l) => category === "All" || l.category === category);
  const sorted = [...shown].sort((a, b) =>
    sort === "newest" ? a.posted - b.posted : sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "nearest" ? a.miles - b.miles : 0,
  );
  const active =
    (price[0] !== PRICE_ALL[0] || price[1] !== PRICE_ALL[1] ? 1 : 0) + conditions.length + (distance !== "any" ? 1 : 0) + (rating !== "any" ? 1 : 0) + (verifiedOnly ? 1 : 0);

  function clearAll() {
    setQuery("");
    setCategory("All");
    setPrice(PRICE_ALL);
    setConditions([]);
    setDistance("any");
    setRating("any");
    setVerifiedOnly(false);
    setSliderKey((k) => k + 1);
    setSay("Filters cleared.");
  }

  function toggleSave(l: Listing) {
    const on = !saved.includes(l.id);
    setSaved((s) => (on ? [...s, l.id] : s.filter((x) => x !== l.id)));
    setSay(on ? `Saved ${l.title}.` : `Removed ${l.title} from saved.`);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSay(`${shown.length} ${shown.length === 1 ? "listing" : "listings"} near ${near}.`);
  }

  return (
    <div className="fl-mkt-app">
      <header className="fl-mkt-top">
        <a className="fl-mkt-brand" href="#home">
          <span className="fl-mkt-mark" aria-hidden="true">
            {d.mark}
          </span>
          <span className="fl-mkt-brand__name">{d.brand}</span>
        </a>
        <form className="fl-mkt-search" role="search" onSubmit={onSearch}>
          <div className="fl-mkt-search__field fl-mkt-search__field--q">
            <label htmlFor="fl-mkt-q" className="fl-sr">
              {d.searchLabel}
            </label>
            <Glyph d={SEARCH} />
            <TextField id="fl-mkt-q" type="search" size={44} placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="fl-mkt-search__field fl-mkt-search__field--loc">
            <label htmlFor="fl-mkt-loc" className="fl-sr">
              {d.locationLabel}
            </label>
            <Glyph d={PIN} />
            <TextField id="fl-mkt-loc" size={44} autoComplete="address-level2" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <Button type="submit" size={44} icon="search" iconOnly className="fl-mkt-search__go">
            {d.searchAction}
          </Button>
        </form>
        <div className="fl-mkt-top__end">
          <Button variant="tertiary" size={40} href="#sign-in">
            {d.signIn}
          </Button>
          <Button size={40} icon="plus" href="#list-an-item">
            {d.listItem}
          </Button>
        </div>
      </header>

      <nav className="fl-mkt-cats" aria-label={d.categoriesLabel}>
        {d.categories.map((c) => {
          const n = c === "All" ? base.length : base.filter((l) => l.category === c).length;
          return (
            <Chip key={c} selected={category === c} onClick={() => setCategory(c)}>
              {c} <span className="fl-mkt-cats__n">{n}</span>
            </Chip>
          );
        })}
      </nav>

      <div className="fl-mkt-body">
        <aside className="fl-mkt-filters" data-open={filtersOpen} aria-labelledby="fl-mkt-filters-title">
          <div className="fl-mkt-filters__head">
            <h2 id="fl-mkt-filters-title" className="fl-mkt-h2">
              {d.filtersTitle}
              {active ? <span className="fl-mkt-filters__n"> ({active})</span> : null}
            </h2>
            <Button variant="tertiary" size={32} onClick={clearAll} disabled={!active && !q && category === "All"}>
              {d.clearAll}
            </Button>
            <span className="fl-mkt-filters__toggle">
              <Button variant="secondary" size={32} icon="filter" aria-expanded={filtersOpen} aria-controls="fl-mkt-filters-body" onClick={() => setFiltersOpen((o) => !o)}>
                {filtersOpen ? "Hide filters" : d.showFilters}
              </Button>
            </span>
          </div>
          <div id="fl-mkt-filters-body" className="fl-mkt-filters__body">
            <div className="fl-mkt-group">
              <Slider
                key={sliderKey}
                variant="range"
                version="filled"
                fields
                prefix="$"
                label={d.priceLabel}
                min={0}
                max={d.priceMax}
                step={10}
                minGap={10}
                value={price}
                format={money}
                onChange={setPrice}
              />
            </div>
            <fieldset className="fl-mkt-group">
              <legend className="fl-mkt-legend">{d.conditionLabel}</legend>
              {d.conditions.map((c) => (
                <Checkbox
                  key={c}
                  label={c}
                  checked={conditions.includes(c)}
                  onChange={() => setConditions((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}
                />
              ))}
            </fieldset>
            <div className="fl-mkt-group">
              <ChoiceGroup variant="pill" label={`${d.distanceLabel} from ${near}`} name="fl-mkt-distance" options={d.distances} value={distance} onChange={(v) => setDistance(v as string)} />
            </div>
            <fieldset className="fl-mkt-group">
              <legend className="fl-mkt-legend">{d.ratingLabel}</legend>
              {d.ratings.map((r) => (
                <Radio key={r.value} name="fl-mkt-rating" value={r.value} label={r.label} checked={rating === r.value} onChange={() => setRating(r.value)} />
              ))}
            </fieldset>
            <div className="fl-mkt-group">
              <Checkbox label={d.verifiedOnly} description={d.verifiedHint} checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
            </div>
          </div>
        </aside>

        <main className="fl-mkt-results" aria-labelledby="fl-mkt-results-title">
          <div className="fl-mkt-results__head">
            <div>
              <h1 id="fl-mkt-results-title" className="fl-mkt-h1">
                {category === "All" ? "Listings" : category} near {near}
              </h1>
              <p className="fl-meta" aria-live="polite">
                {sorted.length} {sorted.length === 1 ? "result" : "results"}
                {q ? ` for “${query.trim()}”` : ""}
                {saved.length ? ` · ${saved.length} saved` : ""}
              </p>
            </div>
            <div className="fl-mkt-sort">
              <label htmlFor="fl-mkt-sort" className="fl-mkt-sort__label">
                {d.sortLabel}
              </label>
              <Select id="fl-mkt-sort" options={d.sorts} value={sort} onChange={(e) => setSort(e.target.value)} />
            </div>
          </div>

          <p className="fl-sr" aria-live="polite">
            {say}
          </p>

          {sorted.length === 0 ? (
            <div className="fl-mkt-empty">
              <EmptyState
                variant="no-results"
                title={d.noMatchTitle}
                headingLevel={2}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    {d.clearAll}
                  </Button>
                }
              >
                {d.noMatchText}
              </EmptyState>
            </div>
          ) : (
            <ul className="fl-mkt-grid">
              {sorted.map((l) => {
                const isSaved = saved.includes(l.id);
                return (
                  <li key={l.id}>
                    <article className="fl-mkt-card" aria-labelledby={`fl-mkt-t-${l.id}`}>
                      <ListingArt l={l} />
                      <span className="fl-mkt-card__save">
                        <Button variant="tertiary" size={32} icon="heart" iconOnly pressed={isSaved} onClick={() => toggleSave(l)} aria-label={`${d.save} ${l.title}`}>
                          {d.save}
                        </Button>
                      </span>
                      <div className="fl-mkt-card__body">
                        <p className="fl-mkt-card__price">{money(l.price)}</p>
                        <h3 id={`fl-mkt-t-${l.id}`} className="fl-mkt-card__title">
                          <a href={`#${l.id}`}>{l.title}</a>
                        </h3>
                        <p className="fl-mkt-card__meta">
                          <Icon name="pin" /> {l.place} · {l.miles} mi · {ago(l.posted)}
                        </p>
                        <p className="fl-mkt-card__meta">{l.condition}</p>
                      </div>
                      <div className="fl-mkt-card__seller">
                        <span className="fl-mkt-card__who">
                          <span className="fl-mkt-card__name">{l.seller}</span>
                          <span className="fl-mkt-card__rating">
                            <Icon name="star" filled />
                            <span>
                              {l.rating.toFixed(1)} <span className="fl-mkt-card__reviews">({l.reviews})</span>
                            </span>
                            <span className="fl-sr">
                              {" "}
                              stars from {l.reviews} reviews
                            </span>
                          </span>
                        </span>
                        {l.verified ? (
                          <Badge tone="success" className="fl-mkt-card__verified">
                            <Icon name="shield" /> {d.verified}
                          </Badge>
                        ) : null}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
