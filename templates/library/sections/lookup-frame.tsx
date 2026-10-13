/** @flowcode-library lookup-frame · Look-up frame: top bar with search and ZIP code, bottom bar on phones (Navigation)
 * Catalog ID: p.lookup-frame (pattern)
 * Function: The look-up frame (p.lookup-frame): the shell of a look-up app (find it and where to get it), with its places, a search, the ZIP code and chosen place, the account with a one-tap demo sign in and Saved, a bottom bar on phones, the first-visit ZIP prompt and a clear page for what the prototype doesn't build. Built on the look-up data layer (lookup-data.tsx beside app-data.tsx): pass the app's lookup (createLookup with the app's store, its places, ZIP code areas and which places carry what).
 * Use it as: import { LookupFrame, NotInPrototype } from "./lookup-frame"; <LookupFrame lookup={lookup} product="Shelf Finder" links={[{ id: "home", label: "Home", icon: "home", mobile: true }, { id: "events", label: "Story time", available: false }]} current={screen} onNavigate={go} savedId?="saved" search={<CatalogSearch … />} place={<PlaceBadge lookup={lookup} />} prompt={<ZipPrompt lookup={lookup} />} footer? fixed?>{page}</LookupFrame>
 * Built from: c.bottom-nav, c.button
 * Look: A top bar with the product's mark and name, its main places, a search box, the ZIP code chip and the account; on phones the places move to a bottom bar within thumb reach and the search drops under the bar. Places the prototype doesn't build open a clear page that says so.
 * Tokens: --color-bg --header-bg --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --radius-md --radius-sm --pill-radius --surface-blur --surface-shadow-overlay --page-backdrop --focus-ring
 * Use cases: product finder; store locator app; library finder; clinic finder; restaurant guide; directory app; information app
 * Jobs to be done: get to any part of the app; search from anywhere; set where I am; see what I saved
 * Keywords: app shell, top bar, bottom bar, consumer app, directory, finder, look-up app, navigation
 */
/**
 * Look-up frame: the shell of a look-up app (find it and where to get it). A top bar with the product, its main places,
 * a search slot and a place slot (the ZIP code and chosen place), and the account (one-tap demo sign in, Saved, sign
 * out); on phones the places move to a bottom bar within thumb reach. A slot under the bar holds the first-visit ZIP
 * prompt. Places the prototype doesn't build open a clear "Not in this prototype" page. Toasts appear on the page.
 *
 * Written for FlowCode, on the look-up data layer (lookup-data.tsx). Make it the app's own: pass the product name, its
 * places, and the search and place pieces (CatalogSearch from ./lookup-catalog, PlaceBadge and ZipPrompt from
 * ./place-finder) as slots.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Toaster } from "./app-data";
import { BottomNav } from "./bottom-nav";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { useLookup, type LookupStore } from "./lookup-data";
import { sampleLookup } from "./lookup-sample";

export interface LookupLink {
  id: string;
  label: string;
  /** An icon name from ./icons. */
  icon?: string;
  /** false: a real part of the product this prototype doesn't build. */
  available?: boolean;
  /** Shown in the phone's bottom bar (the first five that say so, or the first five). */
  mobile?: boolean;
}

export interface LookupFrameProps {
  lookup: LookupStore;
  product: string;
  /** A short mark beside the name (the first letter when left out). */
  logo?: ReactNode;
  links: LookupLink[];
  current: string;
  onNavigate: (id: string) => void;
  /** The search box (CatalogSearch). */
  search?: ReactNode;
  /** The ZIP code and chosen place (PlaceBadge). */
  place?: ReactNode;
  /** Under the bar: the first-visit ZIP prompt (ZipPrompt). */
  prompt?: ReactNode;
  /** Where Saved lives (its id in links), for the account menu. */
  savedId?: string;
  children: ReactNode;
  /** One line at the foot of the page. */
  footer?: ReactNode;
  /** The bottom bar pinned to the window (false inside a preview). */
  fixed?: boolean;
}

function Account({ lookup, savedId, onNavigate }: { lookup: LookupStore; savedId?: string; onNavigate: (id: string) => void }) {
  const st = useLookup(lookup);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>("button")?.focus();
    const off = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);
  if (!st.signedIn)
    return (
      <Button variant="secondary" size={32} onClick={() => lookup.signIn()}>
        Sign in
      </Button>
    );
  const name = lookup.me();
  const close = () => {
    setOpen(false);
    btn.current?.focus();
  };
  return (
    <div className="fl-lkf-account">
      <button ref={btn} type="button" className="fl-lkf-avatar" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        <span className="fl-sr">Account: {name}</span>
      </button>
      {open ? (
        <div
          ref={menu}
          id={id}
          className="fl-lkf-menu"
          role="menu"
          onKeyDown={(e) => {
            const items = [...(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
            const at = items.indexOf(document.activeElement as HTMLElement);
            if (e.key === "Escape") close();
            else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              items[(at + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
            }
          }}
        >
          <p className="fl-lkf-menu-who">Signed in as {name}</p>
          {savedId ? (
            <button type="button" role="menuitem" className="fl-lkf-menu-item" onClick={() => (close(), onNavigate(savedId))}>
              <Icon name="heart" /> Saved
            </button>
          ) : null}
          <button type="button" role="menuitem" className="fl-lkf-menu-item" onClick={() => (close(), lookup.signOut())}>
            <Icon name="arrow-left" /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The page a destination the prototype doesn't build opens. */
export function NotInPrototype({ label, onHome }: { label: string; onHome?: () => void }) {
  return (
    <div className="fl-lkf-later">
      <Icon name="layers" />
      <h1>{label}</h1>
      <p>This part of the product isn't in this prototype yet.</p>
      {onHome ? (
        <Button variant="secondary" size={40} onClick={onHome}>
          Back to the start
        </Button>
      ) : null}
    </div>
  );
}

export function LookupFrame({ lookup, product, logo, links, current, onNavigate, search, place, prompt, savedId, children, footer, fixed = true }: LookupFrameProps) {
  const st = useLookup(lookup);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  // Moving to another place puts focus at the top of the page (people using a screen reader hear where they are).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [current]);
  const visible = links.filter((l) => l.id !== savedId || st.signedIn);
  const mobile = (links.some((l) => l.mobile) ? links.filter((l) => l.mobile) : links).filter((l) => l.available !== false).slice(0, 5);
  const here = links.find((l) => l.id === current);
  const savedCount = st.saved.length;
  return (
    <div className={`fl-lkf${fixed ? " fl-lkf--fixed" : ""}`} data-fl="p.lookup-frame">
      <a className="fl-lkf-skip" href="#fl-lkf-main" onClick={(e) => (e.preventDefault(), mainRef.current?.focus())}>
        Skip to content
      </a>
      <header className="fl-lkf-bar">
        <button type="button" className="fl-lkf-brand" onClick={() => onNavigate(links[0]?.id ?? current)}>
          <span className="fl-lkf-logo" aria-hidden="true">
            {logo ?? product.slice(0, 1)}
          </span>
          <span className="fl-lkf-name">{product}</span>
        </button>
        <nav className="fl-lkf-links" aria-label={`${product} navigation`}>
          <ul>
            {visible.map((l) => (
              <li key={l.id}>
                <button type="button" className="fl-lkf-link" aria-current={l.id === current ? "page" : undefined} onClick={() => onNavigate(l.id)}>
                  {l.label}
                  {l.id === savedId && savedCount ? <span className="fl-lkf-count">{savedCount}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {search ? <div className="fl-lkf-search">{search}</div> : null}
        <div className="fl-lkf-end">
          {place}
          <Account lookup={lookup} savedId={savedId} onNavigate={onNavigate} />
        </div>
      </header>
      {prompt ? <div className="fl-lkf-prompt"><div className="fl-lkf-page-w">{prompt}</div></div> : null}
      <main ref={mainRef} id="fl-lkf-main" className="fl-lkf-main" tabIndex={-1}>
        <div className="fl-lkf-page">{here && here.available === false ? <NotInPrototype label={here.label} onHome={() => onNavigate(links[0]?.id ?? current)} /> : children}</div>
      </main>
      {footer ? <footer className="fl-lkf-foot">{footer}</footer> : null}
      <div className="fl-lkf-bottom">
        <BottomNav items={mobile.map((l) => ({ id: l.id, label: l.label, icon: l.icon ?? "dot", ...(l.id === savedId && savedCount ? { badge: savedCount } : {}) }))} current={current} onNavigate={onNavigate} fixed={fixed} label={`${product} places`} />
      </div>
      <Toaster />
    </div>
  );
}

// flowcode:sample
const SAMPLE_LINKS: LookupLink[] = [
  { id: "home", label: "Home", icon: "home", mobile: true },
  { id: "books", label: "Books", icon: "search", mobile: true },
  { id: "libraries", label: "Libraries", icon: "pin", mobile: true },
  { id: "lists", label: "Lists", icon: "check", mobile: true },
  { id: "saved", label: "Saved", icon: "heart", mobile: true },
  { id: "events", label: "Story time", icon: "calendar", available: false },
];

export default function LookupFrameSheet() {
  const [at, setAt] = useState("home");
  const st = useLookup(sampleLookup);
  const page = SAMPLE_LINKS.find((l) => l.id === at)!;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>A look-up app's frame</h3>
        <p className="fl-ctl-btn-what">The top bar holds the places, a search and the ZIP code; on a phone the places move to a bottom bar. Story time isn't built in this prototype, so it says so. Sign out and the account turns into a one-tap Sign in.</p>
        <div className="fl-lkf-demo">
          <LookupFrame
            lookup={sampleLookup}
            product="Shelf Finder"
            links={SAMPLE_LINKS}
            current={at}
            onNavigate={setAt}
            savedId="saved"
            fixed={false}
            search={<input className="fl-input fl-lkf-demo-search" type="search" placeholder="Search books, authors, themes" aria-label="Search books" />}
            place={<span className="fl-lkf-demo-place">{st.zip ? `Near ${st.zip}` : "Set your ZIP"}</span>}
            footer="Sample data. Library holdings change daily."
          >
            <div className="fl-lkf-demo-page">
              <h1>{page.label}</h1>
              <p>Each place's page renders here. Use the bar above, or the bottom bar at phone width.</p>
            </div>
          </LookupFrame>
        </div>
      </div>
    </section>
  );
}
