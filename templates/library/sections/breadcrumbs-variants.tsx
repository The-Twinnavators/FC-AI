/** @flowcode-library breadcrumbs-variants · Breadcrumbs: full, folded and with a menu (Tabs, breadcrumbs and paging)
 * Use cases: nested folders; project then run then step; settings sections; catalog categories
 * Jobs to be done: see where I am; go back up one level; jump to the top
 * Keywords: breadcrumb, trail, hierarchy, path, overflow, current page
 */
/**
 * Where you are, and the way back up. Long trails fold in the middle rather than wrapping, because the first and
 * last levels are the ones people need. The last item is the page you are on, so it is not a link.
 *
 * Make it the app's own: replace the levels. Keep aria-current on the last one.
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  full: ["Projects", "Northlight", "Riverside wedding", "Delivery"],
  folded: ["Projects", "…", "Riverside wedding", "Delivery"],
  sizes: [14, 16],
};

function Folded() {
  const [open, setOpen] = useState(false);
  const items = open ? SAMPLE.full : SAMPLE.folded;
  return (
    <nav className="fl-ctl-crumbs" aria-label="Folded trail">
      <ol>
        {items.map((it, n) => {
          const last = n === items.length - 1;
          return (
            <li key={it + n}>
              {n > 0 ? <Icon name="chevron-down" /> : null}
              {last ? (
                <span aria-current="page">{it}</span>
              ) : it === "\u2026" ? (
                <button
                  type="button"
                  className="fl-ctl-crumb-more"
                  aria-expanded={false}
                  aria-label="Show the levels in between"
                  onClick={() => setOpen(true)}
                >
                  {it}
                </button>
              ) : (
                <a href="#top">{it}</a>
              )}
            </li>
          );
        })}
      </ol>
      {open ? (
        <button type="button" className="fl-ctl-crumb-more fl-ctl-crumb-fold" aria-expanded onClick={() => setOpen(false)}>
          Fold it back
        </button>
      ) : null}
    </nav>
  );
}

function Trail({ items, label, size = "" }: { items: string[]; label: string; size?: string }) {
  return (
    <nav className={`fl-ctl-crumbs ${size}`} aria-label={label}>
      <ol>
        {items.map((it, n) => {
          const last = n === items.length - 1;
          const fold = it === "\u2026";
          return (
            <li key={it + n}>
              {n > 0 ? <Icon name="chevron-down" /> : null}
              {last ? (
                <span aria-current="page">{it}</span>
              ) : fold ? (
                <button type="button" className="fl-ctl-crumb-more" aria-label="Show the levels in between">
                  {it}
                </button>
              ) : (
                <a href="#top">{it}</a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function BreadcrumbsVariants() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-crumb-list">
        <li>
          <p className="fl-ctl-matrix-kind">Full trail</p>
          <p className="fl-ctl-matrix-what">Every level, when they fit.</p>
          <Trail items={d.full} label="Full trail" />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">Folded</p>
          <p className="fl-ctl-matrix-what">The middle levels behind a button, when they do not. Press it to open them.</p>
          <Folded />
        </li>
        <li>
          <p className="fl-ctl-matrix-kind">On a phone</p>
          <p className="fl-ctl-matrix-what">Just the way back up one level, which is all there is room for.</p>
          <nav className="fl-ctl-crumbs" aria-label="Back">
            <ol>
              <li>
                <a href="#top">
                  <Icon name="arrow" /> Riverside wedding
                </a>
              </li>
            </ol>
          </nav>
        </li>
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Sizes</h3>
        <p className="fl-ctl-btn-what">A breadcrumb is a label, not a control, so it runs at text sizes.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((px) => (
            <li key={px}>
              <Trail items={d.full} label={`${px} px trail`} size={`fl-ctl-crumbs--${px}`} />
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
