/** @flowcode-library skip-links · Skip links (Tabs, breadcrumbs and paging)
 * Catalog ID: c.skip-links (component)
 * Function: The skip links (c.skip-links): a bar of "Skip to" links that stays out of sight until the first Tab press, then slides in so keyboard and screen reader users can jump straight to the main content, the navigation, search or the footer; the target takes focus and briefly shows where it is.
 * Use it as: import { SkipLinks } from "./skip-links"; <SkipLinks links={[{ href: "#main", label: "Main content" }, { href: "#nav", label: "Navigation" }]} label?="Skip to" contained? flash?={true} /> as the first thing in the page's body; give each target the matching id.
 * Look: Hidden at rest. On focus a slim bar drops from the top edge: a small uppercase "Skip to" label and the links in the accent color, the focused one ringed. The section it jumps to gets a short accent outline that fades.
 * Tokens: --color-surface --color-text --color-text-muted --color-accent --color-border --space-1 --space-2 --space-3 --space-4 --radius-md --text-xs --text-sm --weight-semibold --focus-ring --duration-base --duration-slow --ease-out --easing
 * Use cases: accessibility; keyboard navigation; skip to content; every website; app shell; long navigation; screen reader support; WCAG bypass blocks
 * Jobs to be done: skip the menu and get to the content; jump to search with the keyboard; reach the footer quickly; meet accessibility requirements
 * Keywords: skip link, skip to content, accessibility, a11y, keyboard, bypass blocks, wcag, landmark, focus
 */
/**
 * Skip links: the first stop of the Tab key on every page. At rest the bar sits just above the top edge, invisible;
 * the first Tab slides it into view and it leaves again when focus moves on. Each link moves focus (not just the scroll
 * position) to its target, so the next Tab continues from there; a target that can't take focus is made focusable for
 * it, and it shows a short outline so sighted keyboard users see where they landed. Smooth scrolling and the slide turn
 * into an instant jump and a fade when the person prefers reduced motion. Make it the app's own: put it first in the
 * page, point the links at the app's own landmarks (main, navigation, search, footer) and keep the list short.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its skip links with a title.
 */
/**
 * How to try it
 * - Press Show skip links (or Tab from it into the sample page): the bar slides in at the page's top.
 * - Press Tab to move along the links and Enter on Main content: focus lands on the article and it flashes.
 * - Press Tab again: the next stop is the first link inside the article, not the menu.
 * - Try Search: the search box takes focus, ready to type.
 *
 * Dependencies: React (useRef, type MouseEvent) only. Nothing else: no package to install and nothing fetched at run
 * time. The styles are the library's own fl- classes in templates/library/css/skiplinks.css.
 */
import { useRef, type MouseEvent } from "react";

// ── c.skip-links: the bar of "Skip to" links that appears on the first Tab. ──

export type SkipLink = {
  /** "#main": the id of the element to jump to. */
  href: string;
  label: string;
};

export type SkipLinksProps = {
  links: SkipLink[];
  /** The bar's name and its small title: "Skip to". */
  label?: string;
  /** Sit at the top of the nearest positioned box instead of the window (for previews and embedded frames). */
  contained?: boolean;
  /** Outline the target briefly after the jump; on by default. */
  flash?: boolean;
  className?: string;
};

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

export function SkipLinks({ links, label = "Skip to", contained, flash = true, className }: SkipLinksProps) {
  const nav = useRef<HTMLElement>(null);

  const jump = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    const target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (!target) return;
    e.preventDefault();
    // A landmark like <main> can't take focus on its own: tabindex -1 lets it, without adding it to the Tab order.
    if (!target.matches(FOCUSABLE)) {
      target.setAttribute("tabindex", "-1");
      target.classList.add("fl-skip-target");
    }
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    if (flash) {
      target.classList.remove("fl-skip-flash");
      // Restart the outline if the same target is chosen twice in a row.
      void target.offsetWidth;
      target.classList.add("fl-skip-flash");
      target.addEventListener("animationend", () => target.classList.remove("fl-skip-flash"), { once: true });
    }
  };

  return (
    <nav ref={nav} className={["fl-skip", contained ? "fl-skip--contained" : "", className ?? ""].filter(Boolean).join(" ")} aria-label={label} data-fl="c.skip-links">
      <span className="fl-skip-title" aria-hidden="true">
        {label}:
      </span>
      <ul className="fl-skip-list">
        {links.map((link) => (
          <li key={link.href}>
            <a className="fl-skip-link" href={link.href} onClick={(e) => jump(e, link.href)}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// flowcode:sample
const SAMPLE = {
  label: "Skip to",
  links: [
    { href: "#fl-skip-demo-main", label: "Main content" },
    { href: "#fl-skip-demo-search", label: "Search" },
    { href: "#fl-skip-demo-nav", label: "Navigation" },
    { href: "#fl-skip-demo-footer", label: "Footer" },
  ],
  brand: "Fieldnotes",
  nav: ["Journal", "Guides", "Gear", "Trips", "Community", "Shop", "About"],
  heading: "Packing light for a week on the trail",
  paragraphs: [
    "A lighter pack starts with the three heaviest things you carry: shelter, sleep system and pack. Trim those first and every mile gets easier.",
    "Lay everything out on the floor, then weigh it. Anything you didn't use on your last two trips goes back on the shelf.",
  ],
  related: ["Choosing a sleeping pad", "Water filters compared", "A first-aid kit that fits in a pocket"],
  footer: ["Contact", "Privacy", "Accessibility"],
};

export default function SkipLinksSheet() {
  const frame = useRef<HTMLDivElement>(null);
  const show = () => frame.current?.querySelector<HTMLElement>(".fl-skip-link")?.focus();
  return (
    <section className="fl-section fl-section--canvas" aria-label="Skip links">
      <div className="fl-wrap">
        <div className="fl-skip-demo-bar">
          <p>Tab into the page below to reveal the bar.</p>
          <button type="button" className="fl-skip-demo-show" onClick={show}>
            Show skip links
          </button>
        </div>
        <div className="fl-skip-demo" ref={frame}>
          <SkipLinks links={SAMPLE.links} label={SAMPLE.label} contained />
          <header className="fl-skip-demo-head">
            <strong>{SAMPLE.brand}</strong>
            <nav id="fl-skip-demo-nav" aria-label="Main">
              <ul>
                {SAMPLE.nav.map((n) => (
                  <li key={n}>
                    <a href="#fl-skip-demo-main">{n}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <label className="fl-skip-demo-search">
              <span className="fl-sr">Search</span>
              <input id="fl-skip-demo-search" type="search" placeholder="Search guides" />
            </label>
          </header>
          <main id="fl-skip-demo-main" className="fl-skip-demo-main">
            <h3>{SAMPLE.heading}</h3>
            {SAMPLE.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul>
              {SAMPLE.related.map((r) => (
                <li key={r}>
                  <a href="#fl-skip-demo-main">{r}</a>
                </li>
              ))}
            </ul>
          </main>
          <footer id="fl-skip-demo-footer" className="fl-skip-demo-foot">
            {SAMPLE.footer.map((f) => (
              <a key={f} href="#fl-skip-demo-footer">
                {f}
              </a>
            ))}
          </footer>
        </div>
      </div>
    </section>
  );
}
