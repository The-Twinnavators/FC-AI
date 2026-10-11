/** @flowcode-library top-nav-variants · Top nav: app bar, marketing header and the phone menu (Navigation)
 * Catalog ID: p.top-nav (pattern)
 * Function: The top navigation bar (p.top-nav) in three shapes, marketing header, app bar and phone menu, with its folding menu, search and account popover.
 * Use it as: import { TopNav } from "./top-nav-variants"; <TopNav variant?="marketing"|"app"|"phone" brand="Name" links={[{ label, icon? }]} current?="Label" actions?={[{ label, variant?, onClick? }]} search?="Placeholder" account?={{ initials, items }} onSelect?={(label) => ...} />
 * Variants: p.top-nav.marketing - a public site header: the brand, a few links, then sign-in and one main action; the links fold behind a menu button when the bar runs out of room; p.top-nav.app - a signed-in app bar: the brand, icon links for the sections, a search field and an avatar that opens the account menu; p.top-nav.phone - a phone header: the brand and one menu button; links and the main action sit in a sheet below when open
 * Built from: c.button.tertiary, c.button.primary
 * Look: A full-width bar with the brand mark at the left, links beside it and actions or an account avatar at the right; below its own width it folds the links behind one menu button; a skip link appears on focus.
 * Tokens: --color-accent --color-border --color-on-accent --color-surface --color-surface-sunken --color-text --duration-fast --easing --focus-ring --radius-lg --radius-md --shadow-lg --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-sm
 * Use cases: app shell header; marketing site header; signed-in bar; search in the bar; mobile menu
 * Jobs to be done: get to the main areas; find what I am looking for; sign in or reach my account
 * Keywords: top nav, app bar, header, navbar, sticky, hamburger, mobile menu, skip link
 */
/**
 * The bar across the top, in the three shapes an app needs: a marketing header with a sign-up, an app bar for people
 * already signed in, and the phone version where everything but the logo folds behind one button.
 *
 * All three fold. When a bar runs out of room its links go behind one button rather than wrapping into a block, and
 * each bar measures its own width rather than the window's, so it behaves the same in a narrow card as on a page.
 *
 * The menu buttons work, the account menu opens and closes on Escape, and the first thing in the tab order is a skip
 * link, because a nav full of links is the thing keyboard users most need to get past.
 *
 * Make it the app's own: replace the links and the logo. Keep the current page marked with aria-current.
 */
/**
 * How to try it
 * - Press a section in the app bar; press the avatar for the account menu, and Escape or a press outside to close it.
 * - Narrow the piece: the links in both top bars fold behind one button, measured against the bar's own width rather than
 *   the window's.
 * - Tab into any bar: the first stop is the skip link, which appears only when it has focus.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's own inline icon set ("./icons"), which is a table
 * of SVG paths rather than an icon package, and the library's Button ("./buttons-variants"). Nothing else — no package to
 * install and nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the
 * sample data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "./icons";
import { Button, type ButtonVariant } from "./buttons-variants";

// ── p.top-nav: the bar across the top. Built from c.button; the menu, fold and account popover live inside it. ──

export type TopNavVariant = "marketing" | "app" | "phone";
export type TopNavLink = { label: string; icon?: string };
export type TopNavAction = { label: string; variant?: ButtonVariant; onClick?: () => void };
export type TopNavProps = {
  /** marketing: links and actions; app: links, search and account menu; phone: everything folded behind one button. */
  variant?: TopNavVariant;
  brand: string;
  links: TopNavLink[];
  /** Label of the current link; marked with aria-current. */
  current?: string;
  /** Buttons at the end of the bar (marketing) or at the foot of the menu (phone). The last one is the main action. */
  actions?: TopNavAction[];
  /** App bar only: placeholder text for the search field. Left out, there is no search. */
  search?: string;
  /** App bar only: the avatar initials and the items of the account menu (the last one is styled as dangerous). */
  account?: { initials: string; items: string[] };
  /** Called with a link label, an action label or an account menu item when one is chosen. */
  onSelect?: (label: string) => void;
  className?: string;
};

export function TopNav({ variant = "marketing", brand, links, current, actions = [], search, account, onSelect, className }: TopNavProps) {
  const uid = useId();
  const linksId = `${uid}-links`;
  const [here, setHere] = useState(current);
  const [folded, setFolded] = useState(false);
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const say = (s: string) => onSelect?.(s);
  const extra = className ? ` ${className}` : "";
  const fl = `p.top-nav.${variant}`;

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [menu]);

  const brandEl = (
    <a className="fl-ctl-nav-brand" href="#top">
      <span className="fl-ctl-nav-mark" aria-hidden="true">
        <Icon name="bolt" />
      </span>
      {brand}
    </a>
  );
  const go = (l: TopNavLink) => (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setHere(l.label);
    setFolded(false);
    say(l.label);
  };
  const toggleLabel = folded ? "Close the menu" : "Open the menu";

  if (variant === "phone") {
    const main = actions[actions.length - 1];
    return (
      <div className={`fl-ctl-nav-phone${extra}`} data-fl={fl}>
        <header className="fl-ctl-nav fl-ctl-nav--phone">
          {brandEl}
          <Button variant="tertiary" size={40} icon={folded ? "close" : "menu"} iconOnly aria-expanded={folded} aria-controls={linksId} onClick={() => setFolded((v) => !v)}>
            {toggleLabel}
          </Button>
        </header>
        <div className={`fl-ctl-nav-sheet${folded ? " is-open" : ""}`} id={linksId} hidden={!folded}>
          <ul>
            {links.map((l) => (
              <li key={l.label}>
                <a href="#top" aria-current={l.label === here ? "page" : undefined} onClick={go(l)}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          {main ? (
            <Button size={44} variant={main.variant ?? "primary"} onClick={() => (main.onClick?.(), say(main.label))}>
              {main.label}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const isApp = variant === "app";
  return (
    <div className={`fl-ctl-nav-wrap${folded ? " is-open" : ""}${extra}`} data-fl={fl}>
      <header className={`fl-ctl-nav fl-ctl-nav--${isApp ? "app" : "marketing"}`}>
        {isApp ? null : (
          <a className="fl-ctl-nav-skip" href="#top">
            Skip to content
          </a>
        )}
        {brandEl}
        <nav aria-label={isApp ? "Sections" : "Site"} className="fl-ctl-nav-links" id={linksId}>
          <ul>
            {links.map((l) => (
              <li key={l.label}>
                <a href="#top" aria-current={l.label === here ? "page" : undefined} className={l.label === here ? "is-on" : undefined} onClick={go(l)}>
                  {l.icon ? <Icon name={l.icon} /> : null}
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <span className="fl-ctl-nav-spacer" />
        {isApp && search ? (
          <span className="fl-ctl-combo fl-ctl-nav-search fl-ctl-nav-links">
            <label className="fl-sr" htmlFor={`${uid}-search`}>
              Search
            </label>
            <input id={`${uid}-search`} className="fl-input fl-ctl-field fl-ctl-field--outlined fl-ctl-field--32" type="search" placeholder={search} />
            <Icon name="search" />
          </span>
        ) : null}
        {isApp && account ? (
          <div className="fl-ctl-nav-account" ref={box}>
            <button type="button" className="fl-ctl-nav-avatar" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
              <span aria-hidden="true">{account.initials}</span>
              <span className="fl-sr">Your account</span>
            </button>
            {menu ? (
              <ul className="fl-ctl-menu fl-ctl-menu--actions fl-ctl-nav-menu" role="menu" aria-label="Your account">
                {account.items.map((a, n) => (
                  <li
                    key={a}
                    role="menuitem"
                    tabIndex={-1}
                    className={n === account.items.length - 1 ? "is-danger" : undefined}
                    onClick={() => {
                      setMenu(false);
                      say(a);
                    }}
                  >
                    {a}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {isApp ? null : (
          <span className="fl-ctl-nav-acts">
            {actions.map((a, n) => (
              <Button
                key={a.label}
                size={40}
                variant={a.variant ?? (n === actions.length - 1 ? "primary" : "tertiary")}
                onClick={() => (setFolded(false), a.onClick?.(), say(a.label))}
              >
                {a.label}
              </Button>
            ))}
          </span>
        )}
        <Button
          className="fl-ctl-nav-fold"
          variant="tertiary"
          size={40}
          icon={folded ? "close" : "menu"}
          iconOnly
          aria-expanded={folded}
          aria-controls={linksId}
          onClick={() => setFolded((v) => !v)}
        >
          {toggleLabel}
        </Button>
      </header>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  brand: "Northlight",
  marketing: [{ label: "Work" }, { label: "Studio" }, { label: "Pricing" }, { label: "Journal" }],
  app: [
    { label: "Shoots", icon: "image" },
    { label: "Clients", icon: "users" },
    { label: "Invoices", icon: "chart" },
    { label: "Settings", icon: "settings" },
  ],
  account: ["Your profile", "Studio settings", "Keyboard shortcuts", "Sign out"],
};

export default function TopNavVariants() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-nav-list">
        <li>
          <p className="fl-ctl-matrix-kind">Marketing header</p>
          <p className="fl-ctl-matrix-what">For people who are not signed in: a few links and one thing to do. Narrow it and the links fold behind the button.</p>
          <TopNav
            brand={d.brand}
            links={d.marketing}
            current="Work"
            actions={[{ label: "Sign in", variant: "tertiary" }, { label: "Start a project" }]}
            onSelect={(l) => setSaid(l === "Sign in" || l === "Start a project" ? l : `Went to ${l}`)}
          />
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">App bar</p>
          <p className="fl-ctl-matrix-what">For people already in: sections, a search, and the account menu. Press a section, or open the avatar.</p>
          <TopNav
            variant="app"
            brand={d.brand}
            links={d.app}
            current="Shoots"
            search="Search shoots"
            account={{ initials: "AM", items: d.account }}
            onSelect={(l) => setSaid(d.account.includes(l) ? l : `Went to ${l}`)}
          />
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">On a phone</p>
          <p className="fl-ctl-matrix-what">Everything but the logo folds behind one button, which says whether it is open.</p>
          <TopNav
            variant="phone"
            brand={d.brand}
            links={d.marketing}
            actions={[{ label: "Start a project" }]}
            onSelect={(l) => setSaid(l === "Start a project" ? "Sign up" : `Went to ${l}`)}
          />
        </li>
      </ul>

      <p className="fl-ctl-status" role="status" aria-live="polite">
        {said || "Press anything in the bars above."}
      </p>

      <div className="fl-ctl-sizes">
        <h3>The rules these follow</h3>
        <p className="fl-ctl-btn-what">
          The current section carries aria-current, not just a color. The first thing in the tab order is a skip link,
          hidden until it has focus. The menu button says aria-expanded. A sticky bar needs a background, or the page
          scrolls through it.
        </p>
      </div>
    </section>
  );
}
