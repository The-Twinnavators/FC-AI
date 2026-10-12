/** @flowcode-library badges-status · Badges: status pills, counts and dots (Small components)
 * Catalog ID: c.badge (component)
 * Function: The badge component (c.badge): the reference sheet shows status pills in five tones and three looks, counts that cap at 99+, and live-state dots. Version: signal-chip.
 * Use it as: import { Badge } from "./BadgesStatus"; <Badge version?="signal-chip" variant?="status"|"count"|"dot" tone?="neutral"|"info"|"success"|"warning"|"danger"|"online"|"away"|"offline" look?="soft"|"solid"|"outline"|"chip" led? pulse? count?={n} label?>Label</Badge>
 * Variants: c.badge.status - the state a row is in, read as words: a small pill in a tone (neutral, info, success, warning, danger) and a look (soft tint, solid fill, outline); look chip is small square corners in uppercase mono with a signal light, for a status key; c.badge.count - how many are waiting: a small round number on the corner of an icon; renders nothing at 0 and reads 99+ past 99; c.badge.dot - live or away at a glance: a tiny colored dot (online, away, offline) that needs a word nearby or a label prop
 * Look: A small rounded pill with a short label in a tone color, a round count on an icon, or a tiny colored dot.
 * Tokens: --color-accent --color-danger --color-success --color-surface --color-surface-sunken --color-text --color-text-muted --color-border --color-on-accent --text-xs --weight-semibold --radius-sm --space-1 --space-2 --color-warning --font-mono --tracking-wide --color-secondary --color-on-secondary --weight-bold
 * Use cases: a row's status; unread counts; an online dot; a plan label; a new flag; order status; task status; deployment status; job queue; ticket status; build progress; workflow tracker; delivery tracking
 * Jobs to be done: see the state of a row at a glance; see how many are waiting; tell live from stale; see where each item stands; spot what failed at a glance; know when something is still working; track progress over time
 * Keywords: badge, pill, status, count, dot, notification, label, tone, chip, signal light, indicator
 */
/**
 * Three different things that all get called badges. A status pill says what state a thing is in and is read as words.
 * A count says how many and is read as a number. A dot says only "something", and needs words somewhere near it.
 *
 * Every tone carries a shape or a word as well as a color: a pill has its label, a dot has a hidden line of text. The
 * counts here go up and over, because the only interesting thing about a count badge is what it does at 100.
 *
 * Make it the app's own: pick five status words and never add a sixth. Six statuses is a table column, not a pill.
 */
/**
 * How to try it
 * - Press "One more" past 99: the count becomes 99+.
 * - At nought there is no badge at all, which is the state most often got wrong.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./ButtonsVariants";

// ── c.badge: the one badge. Every piece's pills, counts and dots are this component; the specimen shows every variant. ──

export type BadgeVariant = "status" | "count" | "dot";
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
export type BadgeLook = "soft" | "solid" | "outline" | "chip";
export type BadgeLive = "online" | "away" | "offline";
/**
 * Other designs of the status badge. "default" follows the app's tokens; "signal-chip" is the small square-cornered
 * uppercase chip with a signal light (pulsing while work is in progress); it applies to variant "status" only. The look
 * of each follows the style and surface tokens.
 */
export type BadgeVersion = "default" | "signal-chip";

// Written out in full (not built from the names) so a build finds every class the badge needs.
const TONE: Record<BadgeTone, string> = {
  neutral: "fl-ctl-badge--neutral",
  info: "fl-ctl-badge--info",
  success: "fl-ctl-badge--success",
  warning: "fl-ctl-badge--warning",
  danger: "fl-ctl-badge--danger",
};
const LOOK: Record<BadgeLook, string> = { soft: "fl-ctl-badge--soft", solid: "fl-ctl-badge--solid", outline: "fl-ctl-badge--outline", chip: "" };
// The signal light inside a status pill takes its color from these tone classes (controls.css).
const LED: Record<BadgeTone, string> = {
  neutral: "fl-ctl-tone-draft",
  info: "fl-ctl-tone-progress",
  success: "fl-ctl-tone-done",
  warning: "fl-ctl-tone-waiting",
  danger: "fl-ctl-tone-failed",
};
const LIVE: Record<BadgeLive, string> = { online: "fl-ctl-dot--online", away: "fl-ctl-dot--away", offline: "fl-ctl-dot--offline" };

type BadgeProps = {
  /** Another design of the status badge; "default" when left out. See BadgeVersion. */
  version?: BadgeVersion;
  variant?: BadgeVariant;
  /** status: the color. dot: online, away or offline. Defaults to neutral (status) or offline (dot). */
  tone?: BadgeTone | BadgeLive;
  /** status only: soft tint (default), solid fill, outline, or chip (small square corners, uppercase mono, with a light). */
  look?: BadgeLook;
  /** status only: a small signal light before the label, so the status reads by shape as well as color. */
  led?: boolean;
  /** status only (with led): the light pulses, for work in progress. */
  pulse?: boolean;
  /** count only: the number. 0 renders nothing; past 99 it reads 99+. */
  count?: number;
  /** dot only: the word a screen reader hears, such as "Online". */
  label?: string;
  className?: string;
  /** status only: the words in the pill. */
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className">;

export function Badge({ version = "default", variant = "status", tone, look = "soft", led, pulse, count = 0, label, className, children, ...rest }: BadgeProps) {
  const extra = className ? ` ${className}` : "";
  if (variant === "status" && version === "signal-chip") {
    const ledTone = LED[(tone as BadgeTone) ?? "neutral"] ?? LED.neutral;
    return (
      <span {...rest} className={`fl-ctl-chip ${ledTone}${extra}`} data-fl="c.badge@signal-chip">
        <span className={`fl-ctl-led ${ledTone}${pulse ? " fl-ctl-led--pulse" : ""}`} aria-hidden="true" />
        {children}
      </span>
    );
  }
  if (variant === "count") {
    if (!count) return null;
    return (
      <span {...rest} className={`fl-ctl-badge-count${extra}`} data-fl="c.badge.count" aria-hidden="true">
        {count > 99 ? "99+" : count}
      </span>
    );
  }
  if (variant === "dot") {
    const live = LIVE[(tone as BadgeLive) ?? "offline"] ?? LIVE.offline;
    const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
    return <span {...rest} {...a11y} className={`fl-ctl-dot ${live}${extra}`} data-fl="c.badge.dot" />;
  }
  const t = TONE[(tone as BadgeTone) ?? "neutral"] ?? TONE.neutral;
  const ledTone = LED[(tone as BadgeTone) ?? "neutral"] ?? LED.neutral;
  const showLed = led ?? look === "chip";
  const light = showLed ? <span className={`fl-ctl-led ${ledTone}${pulse ? " fl-ctl-led--pulse" : ""}`} aria-hidden="true" /> : null;
  if (look === "chip") {
    return (
      <span {...rest} className={`fl-ctl-chip ${ledTone}${extra}`} data-fl="c.badge.status">
        {light}
        {children}
      </span>
    );
  }
  return (
    <span {...rest} className={`fl-ctl-badge ${LOOK[look]} ${t}${extra}`} data-fl="c.badge.status">
      {light}
      {children}
    </span>
  );
}

// flowcode:sample
const SAMPLE = {
  tones: [
    { id: "neutral" as const, label: "Draft", what: "Nothing has happened to it yet" },
    { id: "info" as const, label: "In review", what: "Waiting on somebody" },
    { id: "success" as const, label: "Approved", what: "Finished, and good" },
    { id: "warning" as const, label: "Needs changes", what: "Finished, and not good" },
    { id: "danger" as const, label: "Rejected", what: "Stopped" },
  ],
  chips: [
    { id: "neutral" as const, label: "Draft", pulse: false },
    { id: "warning" as const, label: "Waiting", pulse: false },
    { id: "info" as const, label: "In progress", pulse: true },
    { id: "success" as const, label: "Done", pulse: false },
    { id: "danger" as const, label: "Failed", pulse: false },
  ],
  looks: [
    { id: "soft" as const, label: "Soft", what: "A tinted pill: the default, quiet enough for a whole column" },
    { id: "solid" as const, label: "Solid", what: "Filled: for one row that needs pulling out" },
    { id: "outline" as const, label: "Outline", what: "A border only: for a dense table where fills would be noise" },
  ],
  statuses: [
    { id: "neutral" as const, label: "Draft", led: false },
    { id: "warning" as const, label: "Waiting", led: false },
    { id: "info" as const, label: "In progress", led: true },
    { id: "success" as const, label: "Done", led: false },
    { id: "danger" as const, label: "Failed", led: false },
  ],
  live: [
    { id: "online" as const, label: "Online", what: "Here now" },
    { id: "away" as const, label: "Away", what: "Signed in, not at the desk" },
    { id: "offline" as const, label: "Offline", what: "Not here" },
  ],
};

export default function BadgesStatus() {
  const d = SAMPLE;
  const [n, setN] = useState(3);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap fl-ctl-spec fl-ctl-spec--wide">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each status in each look</caption>
          <thead>
            <tr>
              <th scope="col">Status</th>
              {d.looks.map((l) => (
                <th key={l.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{l.label}</span>
                  <span className="fl-ctl-matrix-what">{l.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.tones.map((t) => (
              <tr key={t.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{t.label}</span>
                  <span className="fl-ctl-matrix-what">{t.what}</span>
                </th>
                {d.looks.map((l) => (
                  <td key={l.id} data-state={l.label}>
                    <Badge look={l.id} tone={t.id}>
                      {t.label}
                    </Badge>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>With a light</h3>
        <p className="fl-ctl-btn-what">
          A signal light before the word, for a list of orders or jobs read at a glance. The light pulses only while work is
          in progress; the word is always there.
        </p>
        <div className="fl-ctl-badge-count-row">
          {d.statuses.map((s) => (
            <Badge key={s.id} tone={s.id} led pulse={s.led}>
              {s.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Chip</h3>
        <p className="fl-ctl-btn-what">
          Small square corners, uppercase mono and a light: a status key for a dashboard or order list (look="chip").
        </p>
        <div className="fl-ctl-badge-count-row">
          {d.chips.map((c) => (
            <Badge key={c.id} look="chip" tone={c.id} pulse={c.pulse}>
              {c.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">Other designs of the status badge, chosen with <code>version</code>.</p>
        <p className="fl-ctl-matrix-kind">c.badge@signal-chip</p>
        <p className="fl-ctl-btn-what">A status key: a light, then the word. The light pulses while work is in progress. Used on lists of orders or jobs.</p>
        <div className="fl-ctl-badge-count-row">
          {d.chips.map((c) => (
            <Badge key={c.id} version="signal-chip" tone={c.id} pulse={c.pulse}>
              {c.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Counts</h3>
        <p className="fl-ctl-btn-what">
          A number on top of something. Past 99 it becomes 99+, because three digits do not fit on an icon and nobody
          reads the difference between 142 and 143 anyway.
        </p>
        <div className="fl-ctl-badge-count-row">
          {[0, 1, 9, 42, 128].map((c) => (
            <span key={c} className="fl-ctl-badge-host">
              <Button variant="tertiary" size={40} icon="mail" iconOnly>{`Messages, ${c} unread`}</Button>
              <Badge variant="count" count={c} />
            </span>
          ))}
        </div>
        <div className="fl-ctl-badge-count-row">
          <Button variant="secondary" size={32} onClick={() => setN((v) => Math.max(0, v - 1))}>
            One fewer
          </Button>
          <span className="fl-ctl-badge-host">
            <Button variant="tertiary" size={40} icon="bell" iconOnly>{`Notifications, ${n} unread`}</Button>
            <Badge variant="count" count={n} />
          </span>
          <Button variant="secondary" size={32} onClick={() => setN((v) => v + 1)}>
            One more
          </Button>
          <Button variant="tertiary" size={32} onClick={() => setN(120)}>
            Jump past 99
          </Button>
          <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
            {n === 0 ? "Nothing unread, so no badge at all" : `${n} unread`}
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Dots</h3>
        <p className="fl-ctl-btn-what">
          The smallest badge there is. A dot alone says nothing to a screen reader and nothing to anyone who cannot tell
          the colors apart, so each carries its word, visible or hidden.
        </p>
        <ul className="fl-ctl-dot-list">
          {d.live.map((s) => (
            <li key={s.id}>
              <Badge variant="dot" tone={s.id} />
              <span>
                <strong>{s.label}</strong>
                <span className="fl-ctl-matrix-what">{s.what}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
