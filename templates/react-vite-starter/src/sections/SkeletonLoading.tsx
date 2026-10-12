/** @flowcode-library skeleton-loading · Skeleton loading (Alerts and states)
 * Catalog ID: c.skeleton (component)
 * Function: The skeleton placeholder (c.skeleton) that holds a page's shape while content loads; the sheet swaps a list of skeleton rows for real cards after a short wait.
 * Use it as: import { Skeleton } from "./SkeletonLoading"; <Skeleton variant?="text"|"block"|"avatar"|"pill"|"card"|"row" width? height? lines?={n} seed?={n} className? />
 * Variants: c.skeleton.text - a line of copy: a thin shimmering bar; set width, or lines for a paragraph whose last line is shorter; c.skeleton.block - any rectangle (an image, a chart): a shimmering box, give it width and height; c.skeleton.avatar - a profile picture: a shimmering rounded square or circle; c.skeleton.pill - a button, price or badge: a short shimmering rounded bar; c.skeleton.card - a bordered box with an avatar and two lines, for a card grid; c.skeleton.row - a list row: avatar, two lines and a pill inside a card; seed varies the line widths between rows
 * Look: A quiet sunken gray shape with a light shimmer sweeping across it, shaped like the content that is loading (hidden from screen readers; still when motion is reduced).
 * Tokens: --color-surface-sunken --color-surface --color-border --radius-sm --radius-md --radius-lg --space-2 --space-4
 * Use cases: loading state; feed loading; dashboard loading; list loading; search results loading; profile loading
 * Jobs to be done: know content is on its way; wait without the page jumping around; see the page shape before data arrives
 * Keywords: skeleton, loading, placeholder, shimmer
 */
/**
 * Skeleton loading: shimmering placeholders shaped like the card list to come, then the real cards after a short
 * wait. Use it wherever content arrives after a moment, so the page keeps its shape instead of jumping.
 * Adapted from FlowCode's own UI (Branding page).
 * Make it the app's own: replace SAMPLE with real items and swap the timer for your real loading; match the
 * placeholder rows to your card layout.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "./ButtonsVariants";

// ── c.skeleton: a shimmering placeholder shaped like the content to come. Compose them to match your layout. ──

export type SkeletonVariant = "text" | "block" | "avatar" | "pill" | "card" | "row";

// Written out in full (not built from the variant name) so a build finds every class the skeleton needs.
const VARIANT: Record<SkeletonVariant, string> = {
  text: "fl-ctl-skel fl-ctl-skel--title",
  block: "fl-ctl-skel",
  avatar: "fl-ctl-skel fl-ctl-skel--avatar",
  pill: "fl-ctl-skel fl-ctl-skel--pill",
  card: "fl-ctl-skel-card",
  row: "fl-ctl-card",
};

/**
 * c.skeleton: a placeholder that holds the space while content loads. It is hidden from screen readers; put one
 * role="status" label around a group of them. The shimmer stops when the visitor prefers reduced motion.
 * text: a line (width/height optional; `lines` draws several, the last shorter). block: any box (give width and height).
 * avatar: a round or rounded square picture. pill: a button- or badge-sized chip. card: a bordered box with an avatar
 * and two lines. row: a list row with an avatar, two lines and a pill; `seed` varies the line widths between rows.
 */
export function Skeleton({ variant = "text", width, height, lines = 1, seed = 0, className }: {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  lines?: number;
  seed?: number;
  className?: string;
}) {
  const fl = `c.skeleton.${variant}`;
  const style: CSSProperties = { width, height };
  const cls = [VARIANT[variant], className ?? ""].filter(Boolean).join(" ");
  if (variant === "row" || variant === "card") {
    const title = `${70 - ((seed * 13) % 30)}%`;
    const sub = `${45 - ((seed * 7) % 20)}%`;
    return (
      <div className={cls} data-fl={fl} aria-hidden="true" style={style}>
        <Skeleton variant="avatar" />
        <span className={variant === "row" ? "fl-ctl-card__lines" : "fl-ctl-skel-lines"}>
          <Skeleton variant="text" width={title} />
          <span className="fl-ctl-skel fl-ctl-skel--sub" style={{ width: sub }} />
        </span>
        {variant === "row" && <Skeleton variant="pill" />}
      </div>
    );
  }
  if (variant === "text" && lines > 1) {
    return (
      <span style={{ display: "grid", gap: "var(--space-2)" }} data-fl={fl} aria-hidden="true" className={className}>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={VARIANT.text} style={{ width: i === lines - 1 ? "60%" : width, height }} />
        ))}
      </span>
    );
  }
  return <span className={cls} data-fl={fl} aria-hidden="true" style={style} />;
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "This week",
  title: "Upcoming bookings",
  loadingLabel: "Loading bookings",
  loadingText: "Fetching this week's bookings…",
  doneText: (n: number) => `${n} bookings this week.`,
  reloadLabel: "Load again",
  emptyText: "No bookings this week. Quiet days are good for editing.",
  delayMs: 1600,
  placeholders: 4,
  items: [
    { id: "b1", initials: "PN", name: "Priya Nair", what: "Portrait session · Tue 10:00", price: "$120" },
    { id: "b2", initials: "TR", name: "Tom Reyes", what: "Family shoot · Wed 15:30", price: "$220" },
    { id: "b3", initials: "AL", name: "Ana Lima", what: "Headshots, two people · Thu 09:00", price: "$160" },
    { id: "b4", initials: "SK", name: "Sam Kerr", what: "Product photos · Fri 13:00", price: "$300" },
  ],
};

export default function SkeletonLoading() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    timer.current = window.setTimeout(() => setLoading(false), d.delayMs);
    return () => window.clearTimeout(timer.current);
  }, [round, d.delayMs]);

  const items = d.items;

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="skeleton-loading-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-ctl-load-head">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <p className="fl-eyebrow">{d.eyebrow}</p>
            <h2 id="skeleton-loading-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
          </div>
          <Button variant="secondary" onClick={() => setRound((r) => r + 1)} disabled={loading}>
            {d.reloadLabel}
          </Button>
        </div>

        <p className="fl-ctl-load-status" aria-live="polite">
          {loading ? d.loadingText : items.length ? d.doneText(items.length) : ""}
        </p>

        <div aria-busy={loading} style={{ marginTop: "var(--space-4)" }}>
          {loading ? (
            <div role="status">
              <span className="fl-sr">{d.loadingLabel}</span>
              <ul className="fl-ctl-cards" aria-hidden="true">
                {Array.from({ length: d.placeholders }, (_, i) => (
                  <li key={i}>
                    <Skeleton variant="row" seed={i} />
                  </li>
                ))}
              </ul>
            </div>
          ) : items.length === 0 ? (
            <p className="fl-note">{d.emptyText}</p>
          ) : (
            <ul className="fl-ctl-cards">
              {items.map((it) => (
                <li key={it.id} className="fl-ctl-card fl-ctl-fade-in">
                  <span className="fl-ctl-card__avatar" aria-hidden="true">
                    {it.initials}
                  </span>
                  <div className="fl-ctl-card__lines">
                    <p className="fl-ctl-card__title">{it.name}</p>
                    <p className="fl-ctl-card__meta">{it.what}</p>
                  </div>
                  <span className="fl-ctl-card__price">{it.price}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
