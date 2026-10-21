/** @flowcode-library navigation-menu · Mega menu navigation (Navigation)
 * Catalog ID: p.mega-menu (pattern)
 * Function: A site header whose top items open wide panels of described links and a featured card in one shared, resizing viewport (hover or click, arrow keys, Escape), folding into a menu with expandable sections on a phone.
 * Use it as: import { NavigationMenu } from "./navigation-menu"; <NavigationMenu label="Main" brand={{ name, href }} items={[{ id, label, href? } | { id, label, columns: [{ title, links: [{ label, href, text?, icon?, badge? }] }], feature?: { eyebrow, title, text, href, cta } }]} current?="id" actions?={<Button…/>} onNavigate?={(link, event) => ...} />
 * Built from: c.button.primary, c.button.tertiary, c.badge.status
 * Look: A white header bar: the brand, plain top items with small chevrons and one accent line that slides under the open item, then sign-in and a main action; under it a single raised panel of icon-led links with one-line descriptions and a tinted featured card, which grows or shrinks and slides sideways as you move between items.
 * Tokens: --color-surface --color-surface-sunken --color-secondary-surface --color-border --color-text --color-text-muted --color-accent --surface-shadow-overlay --radius-md --radius-lg --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --duration-fast --duration-base --ease-out --ease-spring --enter-distance --focus-ring
 * Use cases: saas website header; product site with many pages; marketing site navigation; docs and resources hub; ecommerce category menu; agency site; developer platform
 * Jobs to be done: see everything the product does at a glance; get to the right page in one move; find guides and help; browse the site on my phone
 * Keywords: mega menu, navigation menu, header, navbar, dropdown navigation, mobile menu
 */
/**
 * Mega menu: the WAI-ARIA disclosure navigation pattern. Each top item with links is a button (aria-expanded) that shows
 * its panel; items without one are plain links. Point at an item to open it (closing again when the pointer leaves),
 * or click to keep it open; Left and Right move along the top items, Down or Tab goes into the open panel, Up and Down
 * move between its links, Tab past the last link continues along the bar, and Escape closes the panel and returns to
 * its button. A press outside or focus leaving the header closes it. All panels share one viewport: it eases to the new
 * panel's height and the content slides in from the side you moved toward, while one accent line moves under the open
 * item (or the current section). Under 48rem wide the bar folds into a menu button and a sheet of expandable sections.
 * Make it the app's own: replace SAMPLE with the site's sections, links and one featured item per panel; keep each
 * description under ten words and panels to two or three columns.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its navigation menu (trigger, content, link and viewport),
 * rewritten without its dependencies.
 */
/**
 * How to try it
 * - Point at Product, then slide to Resources: the panel resizes and slides, and the accent line follows.
 * - Tab to Product, press Down: focus goes to the first link; Up and Down move; Escape comes back.
 * - Pick a link: the line under the header says where it would go.
 * - Make the window narrow: the menu folds behind one button with expandable sections.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's own Button and Badge, and its
 * inline icon set ("./icons"), which is a table of SVG paths rather than an icon package. Nothing else — no package to
 * install and nothing fetched at run time. The styles are the library's own fl- classes in templates/library/css, and the
 * sample data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

// ── p.mega-menu: top items, one shared viewport for their panels, and a folded phone menu. ──

export type MegaLink = { label: string; href: string; text?: string; icon?: string; badge?: string };
export type MegaColumn = { title: string; links: MegaLink[] };
export type MegaFeature = { eyebrow: string; title: string; text: string; href: string; cta: string };
export type MegaItem = { id: string; label: string; href?: string; columns?: MegaColumn[]; feature?: MegaFeature };

export function NavigationMenu({ items, label = "Main", brand, current, actions, onNavigate, className }: {
  items: MegaItem[];
  label?: string;
  brand: { name: string; href: string };
  /** The id of the section the page is in: its item is marked and the line rests under it. */
  current?: string;
  actions?: ReactNode;
  onNavigate?: (link: { label: string; href: string }, e: ReactMouseEvent<HTMLAnchorElement>) => void;
  className?: string;
}) {
  const uid = useId();
  const nav = useRef<HTMLElement>(null);
  const panelBox = useRef<HTMLDivElement>(null);
  const tops = useRef<Array<HTMLElement | null>>([]);
  const [open, setOpen] = useState<{ id: string; via: "hover" | "press"; dir: number } | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [line, setLine] = useState<{ x: number; w: number; ready: boolean } | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const timer = useRef(0);
  const focusIn = useRef(false);
  const sheetBtn = useRef<HTMLButtonElement>(null);

  const index = (id: string) => items.findIndex((x) => x.id === id);
  const openItem = open ? items.find((x) => x.id === open.id) : undefined;

  const show = (id: string, via: "hover" | "press") => {
    window.clearTimeout(timer.current);
    setOpen((o) => ({ id, via, dir: o ? Math.sign(index(id) - index(o.id)) : 0 }));
  };
  const hide = (refocus = false) => {
    window.clearTimeout(timer.current);
    if (refocus && open) tops.current[index(open.id)]?.focus();
    setOpen(null);
  };

  useEffect(() => {
    const el = nav.current?.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setNarrow((e?.contentRect.width ?? 1000) < 768));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setOpen(null);
    setSheet(false);
  }, [narrow]);

  // The shared viewport takes the open panel's height, so moving between panels eases from one size to the other.
  useLayoutEffect(() => {
    const el = panelBox.current;
    if (!open || !el) return setHeight(null);
    setHeight(el.offsetHeight);
    if (focusIn.current) {
      focusIn.current = false;
      el.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    }
  }, [open?.id]);

  // The accent line: under the open item, else the current section.
  useLayoutEffect(() => {
    const at = open ? index(open.id) : current ? index(current) : -1;
    const el = at >= 0 ? tops.current[at] : null;
    if (!el || narrow) return setLine((v) => (v ? { ...v, w: 0, ready: false } : null));
    setLine((v) => ({ x: el.offsetLeft, w: el.offsetWidth, ready: !!v && v.w > 0 }));
  }, [open?.id, current, narrow]);

  useEffect(() => {
    if (!open && !sheet) return;
    const onDown = (e: PointerEvent) => {
      if (nav.current && !nav.current.contains(e.target as Node)) {
        setOpen(null);
        setSheet(false);
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open !== null, sheet]);

  const panelLinks = () => [...(panelBox.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])];

  const onTopKey = (e: ReactKeyboardEvent<HTMLElement>, i: number) => {
    const it = items[i]!;
    const n = items.length;
    const move = (k: number) => {
      e.preventDefault();
      tops.current[(k + n) % n]?.focus();
      if (open) setOpen(null);
    };
    if (e.key === "ArrowRight") return move(i + 1);
    if (e.key === "ArrowLeft") return move(i - 1);
    if (e.key === "Home") return move(0);
    if (e.key === "End") return move(n - 1);
    if (!it.columns) return;
    if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey && open?.id === it.id)) {
      e.preventDefault();
      if (open?.id === it.id) return panelLinks()[0]?.focus();
      // Focus goes in once the panel is on the page (the layout effect below).
      focusIn.current = true;
      show(it.id, "press");
    }
  };
  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const links = panelLinks();
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    const at = open ? index(open.id) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      links[Math.min(links.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (i <= 0) tops.current[at]?.focus();
      else links[i - 1]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      links[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      links[links.length - 1]?.focus();
    } else if (e.key === "Tab") {
      // The panel sits after the bar in the page, so Tab is steered: back to the button before the first link, on to
      // the next top item after the last.
      if (e.shiftKey && i === 0) {
        e.preventDefault();
        tops.current[at]?.focus();
      } else if (!e.shiftKey && i === links.length - 1) {
        e.preventDefault();
        const next = tops.current[at + 1];
        setOpen(null);
        if (next) next.focus();
        else nav.current?.querySelector<HTMLElement>(".fl-mega-actions a, .fl-mega-actions button")?.focus();
      }
    }
  };

  const follow = (link: { label: string; href: string }) => (e: ReactMouseEvent<HTMLAnchorElement>) => {
    onNavigate?.(link, e);
    setOpen(null);
    setSheet(false);
  };

  const panel = (it: MegaItem) => (
    <div className="fl-mega-grid" style={{ gridTemplateColumns: `repeat(${it.columns!.length}, minmax(0, 1fr))${it.feature ? " minmax(14rem, 0.9fr)" : ""}` }}>
      {it.columns!.map((col) => (
        <div key={col.title} className="fl-mega-col">
          <p className="fl-mega-col-title" id={`${uid}-${it.id}-${col.title}`}>
            {col.title}
          </p>
          <ul aria-labelledby={`${uid}-${it.id}-${col.title}`}>
            {col.links.map((l, k) => (
              <li key={l.href} style={{ "--i": k } as CSSProperties}>
                <a className="fl-mega-link" href={l.href} onClick={follow(l)}>
                  {l.icon ? (
                    <span className="fl-mega-icon" aria-hidden="true">
                      <Icon name={l.icon} />
                    </span>
                  ) : null}
                  <span className="fl-mega-link-text">
                    <span className="fl-mega-link-label">
                      {l.label}
                      {l.badge ? (
                        <Badge variant="status" tone="info">
                          {l.badge}
                        </Badge>
                      ) : null}
                    </span>
                    {l.text ? <span className="fl-mega-link-desc">{l.text}</span> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {it.feature ? (
        <a className="fl-mega-feature" href={it.feature.href} onClick={follow({ label: it.feature.title, href: it.feature.href })}>
          <span className="fl-mega-feature-eyebrow">{it.feature.eyebrow}</span>
          <strong>{it.feature.title}</strong>
          <span>{it.feature.text}</span>
          <span className="fl-mega-feature-cta">
            {it.feature.cta}
            <Icon name="arrow" />
          </span>
        </a>
      ) : null}
    </div>
  );

  return (
    <nav
      ref={nav}
      aria-label={label}
      className={["fl-mega", narrow ? "fl-mega--narrow" : "", className].filter(Boolean).join(" ")}
      data-fl="p.mega-menu"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        if (open) {
          e.preventDefault();
          hide(true);
        } else if (sheet) {
          e.preventDefault();
          setSheet(false);
          sheetBtn.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (e.relatedTarget && nav.current?.contains(e.relatedTarget as Node)) return;
        if (e.relatedTarget) {
          setOpen(null);
          setSheet(false);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        // Leaving cancels a panel about to open, and closes one opened by pointing.
        window.clearTimeout(timer.current);
        if (open?.via !== "hover") return;
        timer.current = window.setTimeout(() => setOpen(null), 250);
      }}
      onPointerEnter={() => window.clearTimeout(timer.current)}
    >
      <div className="fl-mega-bar">
        <a className="fl-mega-brand" href={brand.href} onClick={follow({ label: brand.name, href: brand.href })}>
          <span className="fl-mega-mark" aria-hidden="true" />
          {brand.name}
        </a>

        {narrow ? (
          <button
            ref={sheetBtn}
            type="button"
            className="fl-mega-burger"
            aria-expanded={sheet}
            aria-controls={`${uid}-sheet`}
            onClick={() => setSheet((v) => !v)}
          >
            <Icon name={sheet ? "close" : "menu"} />
            <span>Menu</span>
          </button>
        ) : (
          <>
            <ul className="fl-mega-list">
              {items.map((it, i) =>
                it.columns ? (
                  <li key={it.id}>
                    <button
                      ref={(el) => {
                        tops.current[i] = el;
                      }}
                      type="button"
                      className="fl-mega-top"
                      aria-expanded={open?.id === it.id}
                      aria-controls={open?.id === it.id ? `${uid}-panel` : undefined}
                      data-current={current === it.id || undefined}
                      onClick={() => (open?.id === it.id && open.via === "press" ? hide() : show(it.id, "press"))}
                      onPointerEnter={(e) => {
                        if (e.pointerType !== "mouse" || (open && open.via === "press" && open.id === it.id)) return;
                        window.clearTimeout(timer.current);
                        timer.current = window.setTimeout(() => show(it.id, open?.via === "press" ? "press" : "hover"), open ? 0 : 80);
                      }}
                      onKeyDown={(e) => onTopKey(e, i)}
                    >
                      {it.label}
                      <span className="fl-mega-chev" aria-hidden="true">
                        <Icon name="chevron-down" />
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={it.id}>
                    <a
                      ref={(el) => {
                        tops.current[i] = el;
                      }}
                      className="fl-mega-top"
                      href={it.href ?? "#"}
                      aria-current={current === it.id ? "page" : undefined}
                      onClick={follow({ label: it.label, href: it.href ?? "#" })}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse" && open?.via === "hover") {
                          window.clearTimeout(timer.current);
                          timer.current = window.setTimeout(() => setOpen(null), 120);
                        }
                      }}
                      onKeyDown={(e) => onTopKey(e, i)}
                    >
                      {it.label}
                    </a>
                  </li>
                ),
              )}
              {line ? <li aria-hidden="true" className="fl-mega-line" data-ready={line.ready || undefined} style={{ translate: `${line.x}px 0`, width: line.w, opacity: line.w ? 1 : 0 }} /> : null}
            </ul>
            {actions ? <div className="fl-mega-actions">{actions}</div> : null}
          </>
        )}
      </div>

      {!narrow && openItem?.columns ? (
        <div className="fl-mega-viewport" style={height !== null ? { height } : undefined}>
          <div
            ref={panelBox}
            key={openItem.id}
            id={`${uid}-panel`}
            className="fl-mega-panel"
            data-dir={open!.dir > 0 ? "next" : open!.dir < 0 ? "prev" : undefined}
            onKeyDown={onPanelKey}
          >
            {panel(openItem)}
          </div>
        </div>
      ) : null}

      {narrow && sheet ? (
        <div id={`${uid}-sheet`} className="fl-mega-sheet">
          <ul className="fl-mega-sections">
            {items.map((it) =>
              it.columns ? (
                <li key={it.id}>
                  <button type="button" className="fl-mega-section" aria-expanded={section === it.id} aria-controls={`${uid}-sec-${it.id}`} onClick={() => setSection((s) => (s === it.id ? null : it.id))}>
                    {it.label}
                    <span className="fl-mega-chev" aria-hidden="true">
                      <Icon name="chevron-down" />
                    </span>
                  </button>
                  <div id={`${uid}-sec-${it.id}`} className="fl-mega-section-body" hidden={section !== it.id}>
                    {it.columns.map((col) => (
                      <div key={col.title}>
                        <p className="fl-mega-col-title">{col.title}</p>
                        <ul>
                          {col.links.map((l) => (
                            <li key={l.href}>
                              <a className="fl-mega-link fl-mega-link--compact" href={l.href} onClick={follow(l)}>
                                {l.icon ? (
                                  <span className="fl-mega-icon" aria-hidden="true">
                                    <Icon name={l.icon} />
                                  </span>
                                ) : null}
                                <span className="fl-mega-link-label">{l.label}</span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ) : (
                <li key={it.id}>
                  <a className="fl-mega-section" href={it.href ?? "#"} aria-current={current === it.id ? "page" : undefined} onClick={follow({ label: it.label, href: it.href ?? "#" })}>
                    {it.label}
                  </a>
                </li>
              ),
            )}
          </ul>
          {actions ? <div className="fl-mega-sheet-actions">{actions}</div> : null}
        </div>
      ) : null}
    </nav>
  );
}

// ── The reference sheet: a studio software site's header. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Header",
  title: "Mega menu",
  lede: "Point at Product or Resources, or tab to them and press Down.",
  brand: { name: "Kilnworks", href: "#home" },
  items: [
    {
      id: "product",
      label: "Product",
      columns: [
        {
          title: "Run the studio",
          links: [
            { label: "Class booking", href: "#booking", text: "Sell seats and keep a waitlist", icon: "calendar" },
            { label: "Kiln log", href: "#kiln", text: "Track every firing and shelf", icon: "bolt" },
            { label: "Member portal", href: "#members", text: "Passes, hours and shelf space", icon: "users" },
          ],
        },
        {
          title: "Sell",
          links: [
            { label: "Online shop", href: "#shop", text: "Pots, gift cards and kits", icon: "cart" },
            { label: "Point of sale", href: "#pos", text: "Take payment at the counter", icon: "chart" },
            { label: "Reports", href: "#reports", text: "Sales, classes and clay use", icon: "layers", badge: "New" },
          ],
        },
      ],
      feature: { eyebrow: "New", title: "Firing reports", text: "See which glazes and cones work best, from your own kiln log.", href: "#firing-reports", cta: "See what's new" },
    },
    {
      id: "solutions",
      label: "Solutions",
      columns: [
        {
          title: "By studio",
          links: [
            { label: "Community studios", href: "#community", text: "Members, shelves and open hours", icon: "home" },
            { label: "Teaching studios", href: "#teaching", text: "Courses, terms and waitlists", icon: "bookmark" },
            { label: "Solo makers", href: "#solo", text: "Shop and commissions in one place", icon: "user" },
          ],
        },
      ],
    },
    {
      id: "resources",
      label: "Resources",
      columns: [
        {
          title: "Learn",
          links: [
            { label: "Guides", href: "#guides", text: "Set up classes in an afternoon", icon: "folder" },
            { label: "Webinars", href: "#webinars", text: "Live sessions every month", icon: "play" },
          ],
        },
        {
          title: "Help",
          links: [
            { label: "Help center", href: "#help", text: "Answers to common questions", icon: "help" },
            { label: "Changelog", href: "#changelog", text: "What changed this month", icon: "refresh", badge: "3 new" },
            { label: "Status", href: "#status", text: "Uptime and incidents", icon: "shield" },
          ],
        },
      ],
      feature: { eyebrow: "Guide", title: "Move from spreadsheets", text: "Bring members, passes and class history over in one import.", href: "#import-guide", cta: "Read the guide" },
    },
    { id: "pricing", label: "Pricing", href: "#pricing" },
    { id: "customers", label: "Customers", href: "#customers" },
  ] as MegaItem[],
  current: "pricing",
  signIn: "Sign in",
  start: "Start free",
};

export default function NavigationMenuPreview() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  const go = (link: { label: string; href: string }, e: ReactMouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setSaid(`Would open ${link.label} (${link.href}).`);
  };
  return (
    <section className="fl-section" aria-labelledby="navigation-menu-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="navigation-menu-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-mega-demo">
          <NavigationMenu
            brand={d.brand}
            items={d.items}
            current={d.current}
            onNavigate={go}
            actions={
              <>
                <Button variant="tertiary" size={40} href="#sign-in" onClick={(e) => (e.preventDefault(), setSaid("Would open Sign in."))}>
                  {d.signIn}
                </Button>
                <Button size={40} href="#start" onClick={(e) => (e.preventDefault(), setSaid("Would open the free trial."))}>
                  {d.start}
                </Button>
              </>
            }
          />
          <div className="fl-mega-page">
            <p className="fl-mega-status" role="status">
              {said || "The page under the header."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
