/** @flowcode-library lookup-home-magazine · Look-up Home: magazine (Industry sites)
 * Catalog ID: p.lookup-home.magazine (pattern)
 * Function: A look-up app's Home page in the online magazine (t.site-magazine) design: the same sections and styles, filled from the app's own data (entries, categories, ratings, saves, places) through the look-up data layer. FlowCode offers it as a Home concept.
 * Use it as: import { LookupHomeMagazine } from "./lookup-home-magazine"; <LookupHomeMagazine lookup={lookup} product promise? onOpen?={(id) => ...} onCategory?={(name) => ...} onSearch?={(q) => ...} onBrowse?={() => ...} />
 * Built from: c.button.primary, c.button.secondary, c.empty-state
 * Look: The magazine's front page: a sticky side column with search, sections, most liked and saved; the most liked entry as the cover story; section tiles; a feed of entry cards with save; a browse band.
 * Use cases: guide home; editorial product finder; library catalog home; reviews home
 * Jobs to be done: see the most liked first; browse by section; search for something; come back to what i saved
 * Keywords: home, magazine, editorial, look-up, catalog, sidebar
 */
/**
 * Look-up Home, magazine design: the Home page body of a look-up app (find a thing and where to get it), laid out as the
 * user's "Online magazine" front page (site-magazine.tsx, adapted from HTML5 UP "Editorial", CC BY 3.0). The product is
 * the masthead and its promise the tagline; a sticky sidebar holds the search, the categories as sections, the most
 * liked entries as "Most read" and the visitor's saved entries; the most liked entry is the cover story; the categories
 * are section tiles with counts; the entries are the feed of story cards, each with a save toggle; a "Browse everything"
 * band closes the page. On tablets and phones the sidebar folds behind a button, as in the source; Escape closes it.
 * The app's frame (top bar, account, footer) comes from LookupFrame, so this piece has none of its own.
 * Everything reads the look-up store live (useCatalog), so a save made anywhere shows here at once.
 */
import { useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { TextField } from "./text-fields-states";
import { EmptyState } from "./empty-states";
import { toast, Toaster } from "./app-data";
import type { LookupStore } from "./lookup-data";
import { useCatalog, str } from "./lookup-catalog";
import { sampleLookup } from "./lookup-sample";

export interface LookupHomeProps {
  lookup: LookupStore;
  product: string;
  promise?: string;
  onOpen?: (id: string) => void;
  onCategory?: (name: string) => void;
  onSearch?: (q: string) => void;
  onBrowse?: () => void;
}

/** How many story cards the feed shows before the "Browse everything" band. */
const FEED_SIZE = 8;

export function LookupHomeMagazine({ lookup, product, promise, onOpen, onCategory, onSearch, onBrowse }: LookupHomeProps) {
  const { state, e, entries, categories } = useCatalog(lookup);
  const uid = useId();
  const ids = { side: `${uid}-side`, search: `${uid}-search`, cover: `${uid}-cover`, sections: `${uid}-sections`, feed: `${uid}-feed`, most: `${uid}-most`, saved: `${uid}-saved`, browse: `${uid}-browse` };
  const [sidebar, setSidebar] = useState(false);
  const [query, setQuery] = useState("");
  const sideBtn = useRef<HTMLButtonElement>(null);
  const cfg = lookup.config;
  const plural = e.plural.toLowerCase();

  const titleOf = (r: { id: string; [k: string]: unknown }) => str(r[e.titleField]) || r.id;
  const subOf = (r: { [k: string]: unknown }) => (e.subtitleField ? str(r[e.subtitleField]) : "");
  const catOf = (r: { [k: string]: unknown }) => categories.find((c) => c.name === str(r[cfg.categoryField]));

  const byLikes = useMemo(() => [...entries].sort((a, b) => lookup.likes(b.id).count - lookup.likes(a.id).count), [entries, lookup, state]);
  const cover = byLikes[0];
  const mostRead = byLikes.slice(0, 5);
  const feed = useMemo(() => entries.filter((r) => r.id !== cover?.id).slice(0, FEED_SIZE), [entries, cover]);
  const saved = useMemo(() => state.saved.map((id) => entries.find((r) => r.id === id)).filter((r): r is (typeof entries)[number] => Boolean(r)), [state.saved, entries]);

  const open = (id: string) => {
    setSidebar(false);
    onOpen?.(id);
  };
  const pickCategory = (name: string) => {
    setSidebar(false);
    onCategory?.(name);
  };
  const submit = (ev: FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSidebar(false);
    onSearch?.(q);
  };
  const sideKeys = (ev: KeyboardEvent<HTMLElement>) => {
    if (ev.key === "Escape" && sidebar) {
      setSidebar(false);
      sideBtn.current?.focus();
    }
  };

  const rating = (id: string) => {
    const sum = lookup.summary(id);
    return sum.count ? (
      <>
        <Icon name="star" filled /> {`${sum.average.toFixed(1)} (${sum.count} ${sum.count === 1 ? "rating" : "ratings"})`}
      </>
    ) : (
      "No ratings yet"
    );
  };

  const coverName = cover ? titleOf(cover) : "";
  const coverSub = cover ? subOf(cover) : "";
  const coverCat = cover ? catOf(cover) : undefined;

  return (
    <div className="fl-st fl-st-mag fl-lhm" data-fl="p.lookup-home.magazine">
      <div className="fl-st-mag-layout">
        <div className="fl-st-mag-main">
          <header className="fl-st-mag-head">
            <div className="fl-st-mag-brand">
              <h1 className="fl-lhm-h1">
                <strong>{product}</strong>
              </h1>
              {promise ? <span>{promise}</span> : null}
            </div>
            <Button ref={sideBtn} variant="secondary" className="fl-st-mag-sidebtn" aria-expanded={sidebar} aria-controls={ids.side} aria-label="Sections and search" onClick={() => setSidebar((o) => !o)}>
              <Icon name="menu" />
              <span aria-hidden="true">Sections & search</span>
            </Button>
          </header>

          {cover ? (
            <section className="fl-st-mag-banner" aria-labelledby={ids.cover}>
              <div className="fl-st-mag-banner__text">
                <p className="fl-eyebrow">{coverCat ? `Most liked · ${coverCat.name}` : "Most liked"}</p>
                <h2 id={ids.cover} className="fl-title fl-title--xl">
                  <button type="button" className="fl-lhm-link" onClick={() => open(cover.id)}>
                    {coverName}
                  </button>
                </h2>
                {promise || coverSub ? <p className="fl-lede">{promise || coverSub}</p> : null}
                <p className="fl-meta">
                  {promise && coverSub ? <>{coverSub} · </> : null}
                  {rating(cover.id)}
                </p>
                {onOpen ? (
                  <div className="fl-actions">
                    <Button variant="primary" icon="arrow" iconAt="end" onClick={() => open(cover.id)} aria-label={`Open ${coverName}`}>
                      Open
                    </Button>
                  </div>
                ) : null}
              </div>
              <div className="fl-cat-pic fl-lhm-cover" data-tone={coverCat?.tone ?? 0} aria-hidden="true">
                <Icon name={coverCat?.icon ?? "image"} />
              </div>
            </section>
          ) : null}

          {categories.length ? (
            <section className="fl-st-mag-block" aria-labelledby={ids.sections}>
              <h2 id={ids.sections} className="fl-st-mag-rule">
                Sections
              </h2>
              <div className="fl-grid fl-grid--4">
                {categories.map((c) => (
                  <button key={c.name} type="button" className="fl-st-mag-section" onClick={() => pickCategory(c.name)}>
                    <span className="fl-icon">
                      <Icon name={c.icon} />
                    </span>
                    <strong>{c.name}</strong>
                    <Badge tone="info">{`${c.count} ${c.count === 1 ? e.label.toLowerCase() : plural}`}</Badge>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="fl-st-mag-block" aria-labelledby={ids.feed}>
            <div className="fl-st-mag-rulebar">
              <h2 id={ids.feed} className="fl-st-mag-rule">
                {`More ${plural}`}
              </h2>
              {onBrowse && entries.length > feed.length + 1 ? (
                <Button variant="tertiary" size={32} onClick={onBrowse}>
                  {`See all ${entries.length}`}
                </Button>
              ) : null}
            </div>
            {feed.length ? (
              <div className="fl-st-mag-posts">
                {feed.map((r) => {
                  const name = titleOf(r);
                  const sub = subOf(r);
                  const c = catOf(r);
                  const mine = lookup.saves(r.id).mine;
                  return (
                    <article key={r.id} className="fl-st-mag-post">
                      <div className="fl-cat-pic fl-lhm-pic" data-tone={c?.tone ?? 0} aria-hidden="true">
                        <Icon name={c?.icon ?? "image"} />
                      </div>
                      <p className="fl-eyebrow">{c?.name ?? e.label}</p>
                      <h3>
                        <button type="button" className="fl-lhm-link" onClick={() => open(r.id)}>
                          {name}
                        </button>
                      </h3>
                      {sub ? <p className="fl-text">{sub}</p> : <span />}
                      <div className="fl-st-mag-post__foot">
                        <span className="fl-meta">{rating(r.id)}</span>
                        <Button variant="secondary" size={32} icon="bookmark" pressed={mine} aria-label={`Save ${name}`} onClick={() => lookup.toggleSave(r.id)}>
                          Save
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState variant="first-use" title={`No ${plural} yet.`}>
                {`When ${plural} are added, they show here.`}
              </EmptyState>
            )}
          </section>

          {onBrowse ? (
            <section className="fl-st-mag-block fl-st-mag-news fl-bg-dots" aria-labelledby={ids.browse}>
              <div className="fl-head" style={{ marginBottom: "var(--space-5)" }}>
                <h2 id={ids.browse} className="fl-title fl-title--md">
                  Browse everything
                </h2>
                <p className="fl-text">{`All ${entries.length} ${entries.length === 1 ? e.label.toLowerCase() : plural} in ${categories.length} ${categories.length === 1 ? "section" : "sections"}, with filters and where to get each one.`}</p>
              </div>
              <div className="fl-actions">
                <Button variant="primary" icon="arrow" iconAt="end" onClick={onBrowse}>
                  {`Browse all ${plural}`}
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <aside id={ids.side} className={`fl-st-mag-side${sidebar ? " is-open" : ""}`} aria-label="Search and sections" onKeyDown={sideKeys}>
          <form className="fl-st-mag-search" role="search" onSubmit={submit}>
            <label htmlFor={ids.search} className="fl-sr">
              {`Search ${plural}`}
            </label>
            <TextField id={ids.search} type="search" placeholder={`Search ${plural}`} value={query} onChange={(ev) => setQuery(ev.target.value)} />
          </form>
          <nav aria-label="Sections">
            <h2 className="fl-st-mag-rule">Sections</h2>
            <ul className="fl-st-mag-menu">
              {onBrowse ? (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      setSidebar(false);
                      onBrowse();
                    }}
                  >
                    {`All ${plural}`} <span>{entries.length}</span>
                  </button>
                </li>
              ) : null}
              {categories.map((c) => (
                <li key={c.name}>
                  <button type="button" onClick={() => pickCategory(c.name)}>
                    {c.name} <span>{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <section aria-labelledby={ids.most}>
            <h2 id={ids.most} className="fl-st-mag-rule">
              Most read
            </h2>
            {mostRead.length ? (
              <ol className="fl-st-mag-most">
                {mostRead.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="fl-lhm-link" onClick={() => open(r.id)}>
                      {titleOf(r)}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="fl-note">{`No ${plural} yet.`}</p>
            )}
          </section>
          <section aria-labelledby={ids.saved}>
            <h2 id={ids.saved} className="fl-st-mag-rule">
              Saved
            </h2>
            {saved.length ? (
              <ul className="fl-st-mag-most">
                {saved.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="fl-lhm-link" onClick={() => open(r.id)}>
                      {titleOf(r)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fl-note">{`Nothing saved yet. Use Save on any ${e.label.toLowerCase()} to keep it here.`}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// flowcode:sample
export default function LookupHomeMagazineSheet() {
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Look-up Home, magazine</h3>
        <p className="fl-ctl-btn-what">The Home page of a look-up app as an editorial front page: search and sections in a sticky sidebar, the most liked book as the cover story, genres as section tiles and a feed of books to save. Save a book and it appears under Saved.</p>
        <LookupHomeMagazine
          lookup={sampleLookup}
          product="Storytime Finder"
          promise="Find a children's book and the library near you that has it."
          onOpen={(id) => toast(`The page for ${id} opens here.`, "info")}
          onCategory={(name) => toast(`The catalog opens filtered to ${name}.`, "info")}
          onSearch={(q) => toast(`The catalog opens with results for “${q}”.`, "info")}
          onBrowse={() => toast("The full catalog opens here.", "info")}
        />
      </div>
      <Toaster />
    </section>
  );
}
