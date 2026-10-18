/** @flowcode-library lookup-home-listings · Look-up Home: listings (Industry sites)
 * Catalog ID: p.lookup-home.listings (pattern)
 * Function: A look-up app's Home page in the real-estate listings (t.site-real-estate) design: the same sections and styles, filled from the app's own data (entries, categories, ratings, saves, places) through the look-up data layer. FlowCode offers it as a Home concept.
 * Use it as: import { LookupHomeListings } from "./lookup-home-listings"; <LookupHomeListings lookup={lookup} product promise? onOpen?={(id) => ...} onCategory?={(name) => ...} onSearch?={(q) => ...} onBrowse?={() => ...} />
 * Built from: c.card, c.button.primary, c.text-field.outlined, c.select.outlined, c.avatar, c.empty-state
 * Look: The listings page: a hero with a search panel and a category select, proof points with real counts, sortable listing cards with ratings, where they're carried and save, the places as agent-style cards, and the ZIP prompt.
 * Use cases: store finder home; product finder home; directory home; where to buy
 * Jobs to be done: search by name or category; see the places near me; sort by what matters; save it for later
 * Keywords: home, listings, directory, look-up, stores, search
 */
/**
 * Look-up Home in the listings design: the Home page body of a "find it and where to get it" app, following the
 * real-estate agency page (site-real-estate.tsx, layout after HTML5 UP "Dopetrope", CC BY 3.0). A hero with the
 * product's promise and a search panel (text and category), three proof points counted from the data, listing cards
 * with sort and save, the places that carry the entries as agent-style cards, and the first-visit ZIP prompt where the
 * source had its valuation form. Everything reads the look-up store live, so a save or a new ZIP code shows at once.
 * The app frame (top bar, account, footer) comes from LookupFrame, so this piece draws no header or footer.
 */
import { useId, useMemo, useState, type FormEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Avatar } from "./avatars-variants";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";
import { Select } from "./dropdowns-states";
import { EmptyState } from "./empty-states";
import { toast, Toaster, type RecordData } from "./app-data";
import { formatMiles, pluralOf, type LookupStore } from "./lookup-data";
import { sampleLookup } from "./lookup-sample";
import { useCatalog, str } from "./lookup-catalog";
import { ZipPrompt } from "./place-finder";

export interface LookupHomeProps {
  lookup: LookupStore;
  /** The product's name: the hero heading. */
  product: string;
  /** One line on what it does for people: the hero text. */
  promise?: string;
  onOpen?: (id: string) => void;
  onCategory?: (name: string) => void;
  onSearch?: (q: string) => void;
  onBrowse?: () => void;
}

type SortKey = "liked" | "rated" | "az";

/** Listing cards shown on Home before "See all". */
const SHOWN = 6;

export function LookupHomeListings({ lookup, product, promise, onOpen, onCategory, onSearch, onBrowse }: LookupHomeProps) {
  const { state, e, entries, categories } = useCatalog(lookup);
  const cfg = lookup.config;
  const uid = useId();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<SortKey>("liked");

  const plural = e.plural.toLowerCase();
  const one = e.label.toLowerCase();
  const noun = (n: number) => `${n} ${n === 1 ? one : plural}`;
  const placeEntity = lookup.app.entity(cfg.places);
  const placeOne = (cfg.placeWord ?? placeEntity.label).toLowerCase();
  const placeMany = placeEntity.plural.toLowerCase();
  const placeNoun = (n: number) => `${n} ${n === 1 ? placeOne : placeMany}`;
  const places = (lookup.app.get().records[cfg.places] ?? []).filter((p) => !p.draft);
  const catLabel = e.fields.find((f) => f.key === cfg.categoryField)?.label ?? "Category";
  const title = (r: RecordData) => str(r[e.titleField]) || r.id;
  const placeIds = (r: RecordData) => (Array.isArray(r[cfg.placesField]) ? (r[cfg.placesField] as unknown[]).map(String) : []);

  // What the search panel would show: the live count on its button, like the source's "Show 6 homes".
  const t = q.trim().toLowerCase();
  const matching = useMemo(
    () =>
      entries.filter((r) => {
        if (cat && str(r[cfg.categoryField]) !== cat) return false;
        if (!t) return true;
        return [e.titleField, e.subtitleField, cfg.categoryField].some((k) => k && str(r[k]).toLowerCase().includes(t));
      }).length,
    [entries, cat, t, e, cfg.categoryField],
  );

  const sorted = useMemo(() => {
    const by: Record<SortKey, (a: RecordData, b: RecordData) => number> = {
      liked: (a, b) => lookup.likes(b.id).count - lookup.likes(a.id).count,
      rated: (a, b) => {
        const sa = lookup.summary(a.id);
        const sb = lookup.summary(b.id);
        return sb.average - sa.average || sb.count - sa.count;
      },
      az: () => 0,
    };
    return [...entries].sort((a, b) => by[sort](a, b) || title(a).localeCompare(title(b), undefined, { sensitivity: "base", numeric: true }));
    // state follows every like, rating and save in the look-up store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, sort, state]);
  const visible = sorted.slice(0, SHOWN);

  // The places, nearest first once there is a ZIP code; each with how many entries it carries.
  const placeCards = useMemo(() => {
    const near = state.zip ? lookup.nearby(state.zip) : [];
    const miles = new Map(near.map((n) => [n.place.id, n.miles]));
    const list = state.zip && near.length ? [...near.map((n) => n.place), ...places.filter((p) => !miles.has(p.id))] : places;
    return list.slice(0, 4).map((p) => ({
      id: p.id,
      name: str(p[placeEntity.titleField]) || p.id,
      sub: placeEntity.subtitleField ? str(p[placeEntity.subtitleField]) : "",
      area: cfg.placeZipField ? lookup.area(str(p[cfg.placeZipField]))?.label ?? "" : "",
      carries: entries.filter((r) => lookup.carries(p.id, r.id)).length,
      miles: miles.get(p.id),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, entries, places.length]);

  const submit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const v = q.trim();
    if (v) onSearch?.(v);
    else if (cat) onCategory?.(cat);
    else onBrowse?.();
  };

  const proof = [
    { icon: "layers", value: String(entries.length), label: `${entries.length === 1 ? one : plural} to look up` },
    { icon: "folder", value: String(categories.length), label: `${categories.length === 1 ? catLabel.toLowerCase() : pluralOf(catLabel.toLowerCase())} to browse` },
    { icon: "pin", value: String(places.length), label: `${places.length === 1 ? placeOne : placeMany} that carry them` },
  ];

  return (
    <div className="fl-st fl-st-estate fl-lhl" data-fl="p.lookup-home.listings">
      <section className="fl-section fl-bg-split fl-st-estate-hero" aria-labelledby={`${uid}-hero`}>
        <div className="fl-wrap">
          <div className="fl-head">
            <h1 id={`${uid}-hero`} className="fl-title fl-title--xl">
              {product}
            </h1>
            {promise ? <p className="fl-lede">{promise}</p> : null}
          </div>
          <form className="fl-st-estate-search" role="search" aria-label={`Search ${plural}`} onSubmit={submit}>
            <div className="fl-st-estate-fields fl-lhl-fields">
              <div className="fl-field">
                <label htmlFor={`${uid}-q`}>{`Search ${plural}`}</label>
                <TextField id={`${uid}-q`} type="search" name="q" autoComplete="off" placeholder={`Name or ${catLabel.toLowerCase()}`} value={q} onChange={(ev) => setQ(ev.target.value)} />
              </div>
              <div className="fl-field">
                <label htmlFor={`${uid}-cat`}>{catLabel}</label>
                <Select
                  id={`${uid}-cat`}
                  value={cat}
                  onChange={(ev) => setCat(ev.target.value)}
                  options={[{ value: "", label: `Every ${catLabel.toLowerCase()}` }, ...categories.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))]}
                />
              </div>
              <Button variant="primary" type="submit" icon="search">
                {`Show ${noun(matching)}`}
              </Button>
            </div>
          </form>
        </div>
      </section>

      <section className="fl-st-estate-proof" aria-label={`${product} in numbers`}>
        <div className="fl-wrap fl-grid fl-grid--3">
          {proof.map((p) => (
            <div key={p.icon} className="fl-st-estate-proofbox">
              <span className="fl-icon">
                <Icon name={p.icon} />
              </span>
              <div className="fl-stat">
                <strong>{p.value}</strong>
                <span>{p.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="fl-section" aria-labelledby={`${uid}-list`}>
        <div className="fl-wrap">
          <div className="fl-st-estate-listhead">
            <div>
              <h2 id={`${uid}-list`} className="fl-title">
                {sort === "liked" ? `Most liked ${plural}` : sort === "rated" ? `Top rated ${plural}` : e.plural}
              </h2>
              <p className="fl-meta" aria-live="polite">
                {noun(entries.length)}
                {state.saved.length ? ` · ${state.saved.length} saved` : ""}
              </p>
            </div>
            <div className="fl-field fl-st-estate-sort">
              <label htmlFor={`${uid}-sort`}>Sort by</label>
              <Select
                id={`${uid}-sort`}
                value={sort}
                onChange={(ev) => setSort(ev.target.value as SortKey)}
                options={[
                  { value: "liked", label: "Most liked" },
                  { value: "rated", label: "Top rated" },
                  { value: "az", label: "A to Z" },
                ]}
              />
            </div>
          </div>
          {visible.length ? (
            <ul className="fl-grid fl-grid--3 fl-st-estate-list">
              {visible.map((r) => {
                const name = title(r);
                const sub = e.subtitleField ? str(r[e.subtitleField]) : "";
                const catName = str(r[cfg.categoryField]);
                const c = categories.find((x) => x.name === catName);
                const sum = lookup.summary(r.id);
                const likes = lookup.likes(r.id);
                const saved = lookup.saves(r.id).mine;
                const held = placeIds(r).length;
                const near = state.zip ? lookup.carriers(r.id).length : null;
                return (
                  <li key={r.id} style={{ display: "grid" }}>
                    <Card variant="surface" className="fl-st-estate-card">
                      <div className={`fl-st-estate-card__img fl-lhl-art fl-st-tone-${(c?.tone ?? 0) + 1}`} aria-hidden="true">
                        <Icon name={c?.icon ?? "image"} />
                      </div>
                      <p className="fl-st-estate-price">
                        {sum.count ? (
                          <>
                            <span className="fl-sr">{`Rated ${sum.average.toFixed(1)} out of 5 from ${sum.count} ${sum.count === 1 ? "rating" : "ratings"}`}</span>
                            <span aria-hidden="true" className="fl-lhl-rating">
                              <Icon name="star" filled />
                              <b>{sum.average.toFixed(1)}</b> / 5 ({sum.count})
                            </span>
                          </>
                        ) : (
                          <span>No ratings yet</span>
                        )}
                      </p>
                      <h3>
                        {onOpen ? (
                          <button type="button" className="fl-lhl-open" onClick={() => onOpen(r.id)}>
                            {name}
                          </button>
                        ) : (
                          name
                        )}
                      </h3>
                      {sub ? (
                        <p className="fl-meta">
                          <Icon name="user" /> {sub}
                        </p>
                      ) : null}
                      <ul className="fl-st-estate-facts">
                        {catName ? <li>{catName}</li> : null}
                        <li>{`${likes.count} ${likes.count === 1 ? "like" : "likes"}`}</li>
                        <li>{`At ${placeNoun(held)}`}</li>
                      </ul>
                      <div className="fl-st-estate-card__foot">
                        {near !== null ? (
                          <p className={`fl-lhl-where${near ? " is-on" : ""}`}>
                            <Icon name={near ? "pin" : "info"} />
                            {near ? `${placeNoun(near)} near ${state.zip}` : `None near ${state.zip}`}
                          </p>
                        ) : (
                          <span />
                        )}
                        <Button variant="secondary" size={32} icon="bookmark" pressed={saved} aria-label={`Save ${name}`} onClick={() => lookup.toggleSave(r.id)}>
                          {saved ? "Saved" : "Save"}
                        </Button>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState variant="first-use" title={`No ${plural} yet`}>
              {`When ${plural} are added they show here, with the ${placeMany} that carry them.`}
            </EmptyState>
          )}
          {onBrowse && entries.length > visible.length ? (
            <div className="fl-lhl-more">
              <Button variant="secondary" size={40} icon="arrow" iconAt="end" onClick={onBrowse}>
                {`See all ${noun(entries.length)}`}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {placeCards.length ? (
        <section className="fl-section fl-section--tint" aria-labelledby={`${uid}-places`}>
          <div className="fl-wrap">
            <div className="fl-head">
              <h2 id={`${uid}-places`} className="fl-title">
                {state.zip ? `${placeEntity.plural} near ${state.zip}` : placeEntity.plural}
              </h2>
              <p className="fl-lede">{`Each card says how many ${plural} the ${placeOne} carries.`}</p>
            </div>
            <ul className="fl-grid fl-grid--4 fl-st-estate-agents">
              {placeCards.map((p) => (
                <li key={p.id} style={{ display: "grid" }}>
                  <Card variant="surface">
                    <Avatar name={p.name} size={64} decorative />
                    <h3>{p.name}</h3>
                    {p.sub || p.area ? (
                      <p className="fl-meta">
                        <Icon name="pin" /> {[p.sub, p.area].filter(Boolean).join(" · ")}
                      </p>
                    ) : null}
                    <p className="fl-text">
                      {`Carries ${noun(p.carries)}`}
                      {p.miles !== undefined && Number.isFinite(p.miles) ? ` · ${formatMiles(p.miles)} away` : ""}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {!state.zipAsked ? (
        <section className="fl-section" aria-label="Your ZIP code">
          <div className="fl-wrap">
            <ZipPrompt lookup={lookup} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

// flowcode:sample
export default function LookupHomeListingsSheet() {
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Look-up Home: listings</h3>
        <p className="fl-ctl-btn-what">
          The Home page body in the listings design: search by name and genre, real counts, the most liked books with sort and save, the libraries that hold them, and the ZIP code prompt on a first visit.
        </p>
        <LookupHomeListings
          lookup={sampleLookup}
          product="Storytime Finder"
          promise="Find a children's book and the libraries near you that have it."
          onOpen={(id) => toast(`The page for ${id} opens here.`, "info")}
          onCategory={(name) => toast(`The catalog opens on ${name}.`, "info")}
          onSearch={(q) => toast(`The catalog opens with “${q}”.`, "info")}
          onBrowse={() => toast("The full catalog opens here.", "info")}
        />
      </div>
      <Toaster />
    </section>
  );
}
