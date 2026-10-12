/** @flowcode-library breadcrumbs-variants · Breadcrumbs: full, folded and with a menu (Tabs, breadcrumbs and paging)
 * Catalog ID: c.breadcrumbs (component)
 * Function: The one breadcrumb trail (c.breadcrumbs); this sheet shows the full, folded, home-icon and back-one-level trails and two text sizes.
 * Use it as: import { Breadcrumbs } from "./breadcrumbs-variants"; <Breadcrumbs items={[{ label, href? }]} label="Breadcrumb" variant?="full"|"folded"|"back" size?={14|16} homeIcon? />
 * Variants: c.breadcrumbs.full - every level, when they fit: a chevron-separated trail ending in the current page; c.breadcrumbs.folded - a long trail: the middle levels fold behind a button that opens them; c.breadcrumbs.back - a phone: a single link up one level with an arrow
 * Look: A single line of small muted links separated by chevrons, ending in the current page in semibold with no link.
 * Tokens: --color-text --color-text-muted --weight-semibold --space-1 --space-2
 * Use cases: nested folders; project then run then step; settings sections; catalog categories; breadcrumb navigation; category hierarchy; folder path; docs navigation; product category trail; nested settings; file browser path
 * Jobs to be done: see where I am; go back up one level; jump to the top; see where i am in the site; go back up a level; find my way through nested pages
 * Keywords: breadcrumb, trail, hierarchy, path, overflow, current page, breadcrumbs, navigation, responsive
 */
/**
 * Where you are, and the way back up. Long trails fold in the middle rather than wrapping, because the first and
 * last levels are the ones people need. The last item is the page you are on, so it is not a link.
 *
 * Make it the app's own: replace the levels. Keep aria-current on the last one.
 */
/**
 * How to try it
 * - Press the folded trail's button: the levels it hid open.
 * - "Fold it back" puts them away again.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState } from "react";
import { Icon } from "./icons";

// ── c.breadcrumbs: the one trail. The last item is the current page, so it is never a link. ──

export type BreadcrumbsVariant = "full" | "folded" | "back";
export type BreadcrumbItem = { label: string; href?: string };

// Written out in full so a build finds every class the trail needs.
const SIZE: Record<14 | 16, string> = { 14: "fl-ctl-crumbs--14", 16: "fl-ctl-crumbs--16" };

type BreadcrumbsProps = {
  /** Top level first, the current page last. */
  items: BreadcrumbItem[];
  /** The name screen readers give the trail. */
  label?: string;
  /** full (default), folded (middle levels behind a button) or back (one link up a level). */
  variant?: BreadcrumbsVariant;
  /** Text size in px; the surrounding text size when left out. */
  size?: 14 | 16;
  /** Draw the first level as a house icon (its label stays as the accessible name). */
  homeIcon?: boolean;
  className?: string;
};

export function Breadcrumbs({ items, label = "Breadcrumb", variant = "full", size, homeIcon, className }: BreadcrumbsProps) {
  const [open, setOpen] = useState(false);
  const cls = ["fl-ctl-crumbs", size ? SIZE[size] : "", className ?? ""].filter(Boolean).join(" ");
  const own = { className: cls, "aria-label": label, "data-fl": `c.breadcrumbs.${variant}` };

  if (variant === "back") {
    const up = items[items.length - 2] ?? items[0];
    return (
      <nav {...own}>
        <ol>
          <li>
            <a href={up?.href ?? "#top"}>
              <Icon name="arrow" /> {up?.label}
            </a>
          </li>
        </ol>
      </nav>
    );
  }

  // Folded: keep the first level and the last two; the ones between wait behind a button until it is pressed.
  const fold = variant === "folded" && !open && items.length > 3;
  const shown: (BreadcrumbItem | null)[] = fold ? [items[0]!, null, ...items.slice(-2)] : items;
  return (
    <nav {...own}>
      <ol>
        {shown.map((it, n) => (
          <li key={(it?.label ?? "more") + n}>
            {n > 0 ? <Icon name="chevron-down" /> : null}
            {n === shown.length - 1 ? (
              <span aria-current="page">{it?.label}</span>
            ) : it === null ? (
              <button type="button" className="fl-ctl-crumb-more" aria-expanded={false} aria-label="Show the levels in between" onClick={() => setOpen(true)}>
                {"…"}
              </button>
            ) : (
              <a href={it.href ?? "#top"} aria-label={homeIcon && n === 0 ? it.label : undefined}>
                {homeIcon && n === 0 ? <Icon name="home" /> : it.label}
              </a>
            )}
          </li>
        ))}
      </ol>
      {variant === "folded" && open ? (
        <button type="button" className="fl-ctl-crumb-more fl-ctl-crumb-fold" aria-expanded onClick={() => setOpen(false)}>
          Fold it back
        </button>
      ) : null}
    </nav>
  );
}

// flowcode:sample
const SAMPLE = {
  full: ["Projects", "Northlight", "Riverside wedding", "Delivery"].map((label) => ({ label })),
  sizes: [14 as const, 16 as const],
};

export default function BreadcrumbsVariants() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-crumb-list">
        <li>
          <p className="fl-ctl-matrix-kind">Full trail</p>
          <p className="fl-ctl-matrix-what">Every level, when they fit.</p>
          <Breadcrumbs items={d.full} label="Full trail" />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">Folded</p>
          <p className="fl-ctl-matrix-what">The middle levels behind a button, when they do not. Press it to open them.</p>
          <Breadcrumbs items={d.full} label="Folded trail" variant="folded" />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">Home icon</p>
          <p className="fl-ctl-matrix-what">The first level as a house, for a trail that starts at the home page.</p>
          <Breadcrumbs items={[{ label: "Home" }, ...d.full.slice(1)]} label="Home trail" homeIcon />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">On a phone</p>
          <p className="fl-ctl-matrix-what">Just the way back up one level, which is all there is room for.</p>
          <Breadcrumbs items={d.full} label="Back" variant="back" />
        </li>
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Sizes</h3>
        <p className="fl-ctl-btn-what">A breadcrumb is a label, not a control, so it runs at text sizes.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((px) => (
            <li key={px}>
              <Breadcrumbs items={d.full} label={`${px} px trail`} size={px} />
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
