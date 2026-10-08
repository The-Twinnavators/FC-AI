/**
 * Breadcrumbs: a trail from the home page to the page you are on. On phones the middle levels fold into a "…" button
 * that reveals them; the last crumb is the current page (aria-current). Use it on pages three or more levels deep.
 * Make it the app's own: replace SAMPLE with your page path and point each crumb at its real route.
 */
import { useRef, useState, type MouseEvent } from "react";

// flowcode:sample
const SAMPLE = {
  label: "Breadcrumb",
  eyebrow: "Shop admin",
  trail: [
    { label: "Home", href: "#home" },
    { label: "Shop", href: "#shop" },
    { label: "Products", href: "#products" },
    { label: "Kitchen", href: "#kitchen" },
    { label: "Mugs and cups", href: "#mugs" },
    { label: "Speckled stoneware mug", href: "#speckled-mug" },
  ],
  pageText: "Hand-thrown in the studio, 350 ml, dishwasher safe. 14 in stock.",
  movedTo: "Now on",
  reset: "Back to the product",
};

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
    </svg>
  );
}

export default function Breadcrumbs() {
  const d = SAMPLE;
  // How deep we are: clicking a crumb "goes up" to that level, so the trail shortens like a real app would.
  const [depth, setDepth] = useState(d.trail.length);
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("");
  const firstHidden = useRef<HTMLAnchorElement | null>(null);

  const trail = d.trail.slice(0, depth);
  const current = trail[trail.length - 1];
  // Keep the first and the last two levels visible; everything between can fold away.
  const midEnd = trail.length - 2;
  const hiddenCount = Math.max(0, midEnd - 1);

  const go = (e: MouseEvent<HTMLAnchorElement>, i: number) => {
    e.preventDefault();
    setDepth(i + 1);
    setExpanded(false);
    setStatus(`${d.movedTo} ${d.trail[i].label}`);
  };

  const reveal = () => {
    setExpanded(true);
    // Move focus to the first level that just appeared, so keyboard users land where the "…" was.
    requestAnimationFrame(() => firstHidden.current?.focus());
  };

  return (
    <section className="fl-section" aria-labelledby="breadcrumbs-title">
      <div className="fl-wrap fl-wrap--narrow">
        <nav className="fl-way-crumbs" aria-label={d.label} data-expanded={expanded || hiddenCount === 0 ? "true" : "false"}>
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
                <li key={c.href} className={`fl-way-crumb${isMid ? " fl-way-crumb--mid" : ""}`}>
                  {isLast ? (
                    <span aria-current="page" title={c.label}>
                      {c.label}
                    </span>
                  ) : (
                    <a
                      href={c.href}
                      onClick={(e) => go(e, i)}
                      ref={i === 1 ? firstHidden : undefined}
                      aria-label={i === 0 ? c.label : undefined}
                    >
                      {i === 0 ? <HomeIcon /> : c.label}
                    </a>
                  )}
                </li>,
              ];
            })}
          </ol>
        </nav>

        <div className="fl-card fl-way-crumbs-page">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="breadcrumbs-title" className="fl-title fl-title--md">
            {current.label}
          </h2>
          {depth === d.trail.length ? (
            <p className="fl-text">{d.pageText}</p>
          ) : (
            <div className="fl-actions">
              <button type="button" className="fl-btn fl-btn--secondary" onClick={() => { setDepth(d.trail.length); setStatus(`${d.movedTo} ${d.trail[d.trail.length - 1].label}`); }}>
                {d.reset}
              </button>
            </div>
          )}
          <p className="fl-way-status" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>
    </section>
  );
}
