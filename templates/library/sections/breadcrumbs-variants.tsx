/** @flowcode-library breadcrumbs-variants · Breadcrumbs: full, folded and with a menu (Tabs, breadcrumbs and paging)
 * Catalog ID: c.breadcrumbs (component)
 * Function: The one breadcrumb trail (c.breadcrumbs); this sheet shows the full, folded, home-icon and back-one-level trails and two text sizes.
 * Use it as: import { Breadcrumbs } from "./breadcrumbs-variants"; <Breadcrumbs items={[{ label, href? }]} label="Breadcrumb" variant?="full"|"folded"|"back" size?={14|16} homeIcon? version?="responsive" movedTo? restoreLabel? />
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
import { useRef, useState, type MouseEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.breadcrumbs: the one trail. The last item is the current page, so it is never a link. ──

export type BreadcrumbsVariant = "full" | "folded" | "back";
export type BreadcrumbItem = { label: string; href?: string };
/** An alternative design of the whole trail (c.breadcrumbs@<version>); left out = the variant's look. */
export type BreadcrumbsVersion = "responsive";

// Written out in full so a build finds every class the trail needs.
const SIZE: Record<14 | 16, string> = { 14: "fl-ctl-crumbs--14", 16: "fl-ctl-crumbs--16" };

export type BreadcrumbsProps = {
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
  /** responsive: pressing a crumb goes up to that level and shortens the trail; the middle levels fold behind a button on phones. variant is ignored. */
  version?: BreadcrumbsVersion;
  /** responsive: the live-region words after going up a level ("Now on Products"). */
  movedTo?: string;
  /** responsive: when set, a button with this text puts the full trail back after it was shortened. */
  restoreLabel?: string;
  className?: string;
};

function HomeGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </svg>
  );
}

/** c.breadcrumbs@responsive: press a crumb to go up and shorten the trail; focus lands on the first revealed level. */
function ResponsiveTrail({ items, label, homeIcon, movedTo = "Now on", restoreLabel, className }: BreadcrumbsProps) {
  const [depth, setDepth] = useState(items.length);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("");
  const firstHidden = useRef<HTMLAnchorElement | null>(null);
  const trail = items.slice(0, depth);
  // Keep the first and the last two levels visible; everything between can fold away.
  const midEnd = trail.length - 2;
  const hiddenCount = Math.max(0, midEnd - 1);

  const go = (e: MouseEvent<HTMLAnchorElement>, i: number) => {
    e.preventDefault();
    setDepth(i + 1);
    setExpanded(false);
    setStatus(`${movedTo} ${items[i]!.label}`);
  };
  const reveal = () => {
    setExpanded(true);
    // Move focus to the first level that just appeared, so keyboard users land where the "…" was.
    requestAnimationFrame(() => firstHidden.current?.focus());
  };

  return (
    <div className={className} data-fl="c.breadcrumbs@responsive">
      <nav className="fl-way-crumbs" aria-label={label ?? "Breadcrumb"} data-expanded={expanded || hiddenCount === 0 ? "true" : "false"}>
        <ol>
          {trail.map((c, i) => {
            const isLast = i === trail.length - 1;
            const isMid = i > 0 && i < midEnd;
            return [
              i === 1 && hiddenCount > 0 ? (
                <li key="more" className="fl-way-crumb fl-way-crumb--more">
                  <button type="button" className="fl-way-more" aria-expanded={expanded} aria-label={`Show ${hiddenCount} hidden levels`} onClick={reveal}>
                    …
                  </button>
                </li>
              ) : null,
              <li key={c.href ?? c.label} className={`fl-way-crumb${isMid ? " fl-way-crumb--mid" : ""}`}>
                {isLast ? (
                  <span aria-current="page" title={c.label}>
                    {c.label}
                  </span>
                ) : (
                  <a href={c.href ?? "#top"} onClick={(e) => go(e, i)} ref={i === 1 ? firstHidden : undefined} aria-label={homeIcon && i === 0 ? c.label : undefined}>
                    {homeIcon && i === 0 ? <HomeGlyph /> : c.label}
                  </a>
                )}
              </li>,
            ];
          })}
        </ol>
      </nav>
      {restoreLabel && depth < items.length ? (
        <Button
          variant="secondary"
          size={32}
          onClick={() => {
            setDepth(items.length);
            setStatus(`${movedTo} ${items[items.length - 1]!.label}`);
          }}
        >
          {restoreLabel}
        </Button>
      ) : null}
      <p className="fl-way-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export function Breadcrumbs(props: BreadcrumbsProps) {
  if (props.version === "responsive") return <ResponsiveTrail {...props} />;
  return <PlainTrail {...props} />;
}

function PlainTrail({ items, label = "Breadcrumb", variant = "full", size, homeIcon, className }: BreadcrumbsProps) {
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
  responsive: [
    { label: "Home", href: "#home" },
    { label: "Shop", href: "#shop" },
    { label: "Products", href: "#products" },
    { label: "Kitchen", href: "#kitchen" },
    { label: "Mugs and cups", href: "#mugs" },
    { label: "Speckled stoneware mug", href: "#speckled-mug" },
  ],
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
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">
          c.breadcrumbs@responsive: press a crumb to go up to that level and the trail shortens. On a phone the middle levels fold behind
          a button, and pressing it moves focus to the first level it reveals.
        </p>
        <Breadcrumbs version="responsive" items={d.responsive} label="Responsive trail" homeIcon restoreLabel="Back to the product" />
      </div>

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
