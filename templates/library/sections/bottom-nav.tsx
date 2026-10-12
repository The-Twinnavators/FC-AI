/** @flowcode-library bottom-nav · Bottom navigation bar: the phone app's main places (Tabs, breadcrumbs and paging)
 * Catalog ID: c.bottom-nav (component)
 * Function: The bottom navigation bar (c.bottom-nav): three to five main places of a phone app within thumb reach, the current one marked, counts and dots for something new, clear of the home bar.
 * Use it as: import { BottomNav } from "./bottom-nav"; <BottomNav variant?="labels"|"active-label" items={[{ id, label, icon (from ./icons), badge?: number|true, href? }]} current="home" onNavigate={(id) => ...} label?="Main" fixed?={true} />  // three to five places; pinned to the bottom with the phone's safe-area inset
 * Variants: c.bottom-nav.labels - the usual phone app bar: every place shows its icon and label, the current one on a tinted pill; c.bottom-nav.active-label - four or five places with clear icons: only the current place shows its label, the rest are icons (still named for screen readers)
 * Look: A bar along the bottom of a phone screen with three to five evenly spaced icons and short labels; the current place's icon sits on a soft accent pill, and a red count or dot marks one with something new.
 * Tokens: --header-bg --color-surface --color-surface-sunken --color-border --color-accent --color-danger --color-on-accent --color-text --color-text-muted --pill-radius --duration-base --press-scale --focus-ring
 * Use cases: mobile app navigation; phone app main sections; bottom tab bar; app home, search and profile; a PWA on phones
 * Jobs to be done: move between the app's main places; see where I am; see where something new is waiting
 * Keywords: bottom navigation, tab bar, bottom tabs, navigation bar, mobile navigation, phone app, app bar
 */
/**
 * Bottom navigation bar: the three to five main places of a phone app, along the bottom where a thumb reaches them.
 * Each is an icon with a label (or, in "active-label", only the current one's label shows); the current place sits on
 * a pill and is marked for screen readers; a count or a dot says something new is waiting there. It keeps clear of the
 * phone's home bar (safe-area inset).
 * Written for FlowCode; the behaviour follows the navigation bar guidance in Material 3 (no code from it).
 * Make it the app's own: replace SAMPLE with the app's own places (no more than five) and wire onNavigate to its routes.
 */
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";

export type BottomNavVariant = "labels" | "active-label";
export type BottomNavItem = {
  id: string;
  label: string;
  /** An icon name from ./icons. */
  icon: string;
  /** A count (99+ above 99), or true for a dot. */
  badge?: number | boolean;
  /** A link instead of a button. */
  href?: string;
};
const FL: Record<BottomNavVariant, string> = { labels: "c.bottom-nav.labels", "active-label": "c.bottom-nav.active-label" };

export function BottomNav({
  variant = "labels",
  items,
  current,
  onNavigate,
  label = "Main",
  fixed = true,
}: {
  variant?: BottomNavVariant;
  /** Three to five places; more belong in a menu. */
  items: BottomNavItem[];
  current: string;
  onNavigate?: (id: string) => void;
  label?: string;
  /** Pinned to the bottom of the window (the usual); false keeps it in the flow (inside a frame, a preview). */
  fixed?: boolean;
}) {
  return (
    <nav className={`fl-mob-nav fl-mob-nav--${variant}${fixed ? " fl-mob-nav--fixed" : ""}`} aria-label={label} data-fl={FL[variant]}>
      <ul>
        {items.slice(0, 5).map((it) => {
          const on = it.id === current;
          const badge = typeof it.badge === "number" && it.badge > 0 ? (it.badge > 99 ? "99+" : String(it.badge)) : it.badge === true ? "" : undefined;
          const body: ReactNode = (
            <>
              <span className="fl-mob-nav__pill" aria-hidden="true">
                <Icon name={it.icon} />
                {badge !== undefined ? <span className={`fl-mob-nav__badge${badge === "" ? " fl-mob-nav__badge--dot" : ""}`}>{badge}</span> : null}
              </span>
              <span className="fl-mob-nav__label">{it.label}</span>
              {badge !== undefined ? <span className="fl-sr">{badge === "" ? ", something new" : `, ${badge} new`}</span> : null}
            </>
          );
          return (
            <li key={it.id}>
              {it.href ? (
                <a className="fl-mob-nav__item" href={it.href} aria-current={on ? "page" : undefined} onClick={() => onNavigate?.(it.id)}>
                  {body}
                </a>
              ) : (
                <button type="button" className="fl-mob-nav__item" aria-current={on ? "page" : undefined} onClick={() => onNavigate?.(it.id)}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// flowcode:sample
const SAMPLE = {
  app: "Pantry",
  items: [
    { id: "home", label: "Home", icon: "home" },
    { id: "search", label: "Search", icon: "search" },
    { id: "list", label: "List", icon: "cart", badge: 3 },
    { id: "saved", label: "Saved", icon: "heart" },
    { id: "you", label: "You", icon: "user", badge: true },
  ] as BottomNavItem[],
  screens: {
    home: ["This week's picks", "Oat milk is back in stock", "Three recipes from your list"],
    search: ["Search 4,000 products", "Recent: rye bread, tahini"],
    list: ["Oat milk ×2", "Rye bread", "Tahini"],
    saved: ["Overnight oats", "Green shakshuka"],
    you: ["Delivery address", "Allergies: sesame", "Something new: your order is on its way"],
  } as Record<string, string[]>,
};

export default function BottomNavSheet() {
  const d = SAMPLE;
  const [at, setAt] = useState("home");
  const [at2, setAt2] = useState("list");
  const title = d.items.find((i) => i.id === at)?.label ?? "";
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec">
        <h3>Labels on every place</h3>
        <p className="fl-ctl-btn-what">The usual: icon and label for each, the current one on a pill. Tap through; the screen above changes.</p>
        <div className="fl-mob-phone">
          <div className="fl-mob-phone__screen" aria-live="polite">
            <p className="fl-mob-phone__title">{title}</p>
            <ul className="fl-mob-phone__rows">
              {(d.screens[at] ?? []).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
          <BottomNav items={d.items} current={at} onNavigate={setAt} label={`${d.app} sections`} fixed={false} />
        </div>
      </div>
      <div className="fl-ctl-spec">
        <h3>Only the current label</h3>
        <p className="fl-ctl-btn-what">Quieter, for four or five places whose icons are clear on their own. Every icon still has its name for screen readers.</p>
        <div className="fl-mob-phone fl-mob-phone--short">
          <BottomNav variant="active-label" items={d.items} current={at2} onNavigate={setAt2} label={`${d.app} sections, compact`} fixed={false} />
        </div>
        <ul className="fl-mob-notes">
          <li>Three to five places. More go in a menu or a "More" place.</li>
          <li>A count says how many are waiting; a dot says something is, without a number.</li>
          <li>Pinned to the bottom, it pads for the phone's home bar.</li>
        </ul>
      </div>
    </section>
  );
}
