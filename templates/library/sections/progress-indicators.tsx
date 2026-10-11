/** @flowcode-library progress-indicators · Progress: bars, rings, spinners and skeletons (Alerts and states)
 * Catalog ID: c.progress (component)
 * Function: The progress indicator (c.progress); the reference sheet shows bar, indeterminate bar, ring and spinner on one live run, plus skeletons and a rule for which to use.
 * Use it as: import { Progress } from "./progress-indicators"; <Progress variant?="bar"|"ring"|"spinner" value?={0-100} label? size?={16|24|32} thin? />
 * Variants: c.progress.bar - How far along something is (or a sliding bar when value is left out): a rounded track with an accent fill; c.progress.ring - The same percentage where a bar would not fit, such as a card corner or table cell: a circle filling clockwise with the number inside; c.progress.spinner - Something short with no known length, in a button or beside a row: a small turning arc in 16, 24 or 32 px
 * Look: An accent fill on a sunken track, as a bar or a ring with the percentage in its middle, or a small turning arc.
 * Tokens: --color-accent --color-surface-sunken --text-sm --duration-fast --easing --space-3
 * Use cases: a file uploading; a report building; a page loading; a long save; a queue of jobs
 * Jobs to be done: know something is happening; know how much is left; know whether to wait
 * Keywords: progress, bar, spinner, loader, skeleton, indeterminate, loading, percent
 */
/**
 * Four ways to say "wait", and the rule for choosing between them: if you know how far along it is, show a number; if
 * you do not, show motion; if the shape of what is coming is known, show the shape.
 *
 * A bar or a ring that knows its percentage is a progressbar with aria-valuenow. One that does not leaves valuenow off
 * entirely, which is what tells a screen reader it is indeterminate. A skeleton is decoration and is hidden from
 * screen readers, with one polite line of text doing the announcing for all of it.
 *
 * Make it the app's own: under a second, show nothing. Over ten, show a percentage or say what is happening.
 */
/**
 * How to try it
 * - Press "Run it": the bar, the ring and the step name all follow one run, which can be paused and restarted.
 * - "Back to nothing" resets it.
 * - The indeterminate bar has no percentage on purpose: that absence is what says "unknown".
 *
 * Dependencies: React (useEffect, useState). Nothing else — no package to install and nothing fetched at run time. The
 * styles are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs
 * in a built app exactly as it runs here.
 */
import { useEffect, useState } from "react";
import { Button } from "./buttons-variants";

// ── c.progress: the one progress indicator. Every piece's progress is this component; the specimen below shows each variant. ──

export type ProgressVariant = "bar" | "ring" | "spinner";
export type ProgressSize = 16 | 24 | 32;

// Written out in full (not built from the size) so a build finds every class the spinner needs.
const SPIN: Record<ProgressSize, string> = { 16: "fl-ctl-spin--16", 24: "fl-ctl-spin--24", 32: "fl-ctl-spin--32" };

type ProgressProps = {
  variant?: ProgressVariant;
  /** 0 to 100. Leave it out when the amount is unknown: the bar slides and has no aria-valuenow. */
  value?: number;
  /** The name a screen reader announces. A spinner without one is decoration. */
  label?: string;
  /** Spinner diameter in px; 24 when left out. */
  size?: ProgressSize;
  /** Bar only: the 6 px track instead of the 8 px one. */
  thin?: boolean;
  className?: string;
};

export function Progress({ variant = "bar", value, label, size = 24, thin, className }: ProgressProps) {
  const extra = className ? ` ${className}` : "";
  const fl = `c.progress.${variant}`;
  if (variant === "spinner") {
    return <span {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })} data-fl={fl} className={`fl-ctl-spin ${SPIN[size]}${extra}`} />;
  }
  const now = value === undefined ? {} : { "aria-valuenow": value, "aria-valuemin": 0, "aria-valuemax": 100 };
  if (variant === "ring") {
    const v = value ?? 0;
    return (
      <span className={`fl-ctl-ring${extra}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"} data-fl={fl}>
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle className="fl-ctl-ring-track" cx="18" cy="18" r="15.5" />
          <circle className="fl-ctl-ring-fill" cx="18" cy="18" r="15.5" style={{ strokeDasharray: `${(v / 100) * 97.4} 97.4` }} />
        </svg>
        <span className="fl-ctl-ring-num">{v}%</span>
      </span>
    );
  }
  return (
    <span className={`fl-ctl-bar${thin ? "" : " fl-ctl-bar--lg"}${value === undefined ? " fl-ctl-bar--idle" : ""}${extra}`} role="progressbar" {...now} aria-label={label ?? "Progress"} data-fl={fl}>
      <span style={value === undefined ? undefined : { width: `${value}%` }} />
    </span>
  );
}

// flowcode:sample
const SAMPLE = {
  steps: ["Reading your files", "Working out the layout", "Writing the pages", "Tidying up"],
};

export default function ProgressIndicators() {
  const d = SAMPLE;
  const [pct, setPct] = useState(38);
  const [running, setRunning] = useState(false);
  const step = Math.min(d.steps.length - 1, Math.floor((pct / 100) * d.steps.length));

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setPct((n) => {
        if (n >= 100) {
          setRunning(false);
          return 100;
        }
        return n + 4;
      });
    }, 220);
    return () => window.clearInterval(t);
  }, [running]);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-prog-run">
        <Button
          size={40}
          onClick={() => {
            setPct(pct >= 100 ? 0 : pct);
            setRunning((v) => !v);
          }}
        >
          {running ? "Pause" : pct >= 100 ? "Run it again" : "Run it"}
        </Button>
        <Button variant="tertiary" size={40} onClick={() => { setRunning(false); setPct(0); }}>
          Back to nothing
        </Button>
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          {pct >= 100 ? "Finished" : running ? `${d.steps[step]}, ${pct}%` : `Paused at ${pct}%`}
        </span>
      </div>

      <ul className="fl-ctl-prog-grid">
        <li>
          <p className="fl-ctl-matrix-kind">Bar, with a number</p>
          <p className="fl-ctl-matrix-what">When you know how far along it is. The number is written out, not only drawn.</p>
          <Progress value={pct} label="Building your site" />
          <span className="fl-ctl-matrix-what">{pct}% &middot; {d.steps[step]}</span>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Bar, indeterminate</p>
          <p className="fl-ctl-matrix-what">When you do not. No aria-valuenow at all: that absence is what says "unknown".</p>
          <Progress label="Working" />
          <span className="fl-ctl-matrix-what">Working on it</span>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Ring</p>
          <p className="fl-ctl-matrix-what">The same number, where a bar would not fit: a card corner, a table cell, beside a name.</p>
          <Progress variant="ring" value={pct} label="Building your site" />
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Spinner</p>
          <p className="fl-ctl-matrix-what">For something short, in a button or beside a row. It says only that something is happening.</p>
          <span className="fl-ctl-spin-row">
            <Progress variant="spinner" size={16} />
            <Progress variant="spinner" size={24} />
            <Progress variant="spinner" size={32} />
          </span>
          <Button size={40} disabled>
            <Progress variant="spinner" size={16} /> Saving
          </Button>
        </li>
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Skeleton</h3>
        <p className="fl-ctl-btn-what">
          The shape of what is coming, when you know the shape. It stops the page jumping when the content lands. It is
          decoration, so it is hidden from screen readers and one line of text does the announcing.
        </p>
        <div className="fl-ctl-skel-card" aria-hidden="true">
          <span className="fl-spec-skel fl-ctl-skel--avatar" />
          <span className="fl-ctl-skel-lines">
            <span className="fl-spec-skel" />
            <span className="fl-spec-skel fl-ctl-skel--short" />
          </span>
        </div>
        <p className="fl-ctl-matrix-what" role="status" aria-live="polite">
          Loading your shoots
        </p>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Which to use</h3>
        <ul className="fl-ctl-tip-rules">
          <li>
            <strong>Under a second</strong>
            <span className="fl-ctl-matrix-what">Nothing at all. A spinner that flashes for 200 ms reads as a glitch.</span>
          </li>
          <li>
            <strong>One to ten seconds</strong>
            <span className="fl-ctl-matrix-what">A spinner or a skeleton. People will wait this long without a number.</span>
          </li>
          <li>
            <strong>Over ten seconds</strong>
            <span className="fl-ctl-matrix-what">A percentage, and what it is doing right now. Otherwise people assume it has hung.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
