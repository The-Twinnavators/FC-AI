/** @flowcode-library progress-indicators · Progress: bars, rings, spinners and skeletons (Alerts and states)
 * Catalog ID: c.progress (component)
 * Function: The progress indicator (c.progress); the reference sheet shows bar, indeterminate bar, ring and spinner on one live run, bar tones, steps, a stacked share bar, skeletons and a rule for which to use. Versions: track and neobrutal.
 * Use it as: import { Progress } from "./progress-indicators"; <Progress version?="track"|"neobrutal" variant?="bar"|"ring"|"spinner"|"steps"|"stacked" value?={0-100} label? size?={16|24|32} thin? large? tone?="accent"|"success"|"danger" steps?={["Ordered","Paid"]} current?={index} segments?={[{label,value}]} max? unit?>words beside a large ring</Progress> (track and neobrutal draw the bar only and take caption? valueText?; neobrutal also takes striped?; tone also accepts "warning")
 * Variants: c.progress.bar - How far along something is (or a sliding bar when value is left out): a rounded track with an accent fill; c.progress.ring - The same percentage where a bar would not fit, such as a card corner or table cell: a circle filling clockwise with the number inside; c.progress.spinner - Something short with no known length, in a button or beside a row: a small turning arc in 16, 24 or 32 px; c.progress.steps - Where something is in a known list of stages (an order: Ordered, Paid, Fired, Ready): a row of short segments, finished ones filled, the current one tinted and bold, with the stage names under; c.progress.stacked - How one whole is shared out (storage by kind): a single bar split into colored parts with a legend of amounts and the free space left over
 * Look: An accent fill on a sunken track, as a bar or ring (green when finished, red when failed; the ring can be large with words beside it), a small turning arc, a row of stage segments, or one bar split into shares.
 * Tokens: --color-accent --color-surface-sunken --text-sm --duration-fast --easing --space-3 --color-success --color-danger --color-text-muted --color-border --color-text --color-surface --color-secondary --radius-sm --space-1 --space-2 --space-4 --space-5 --weight-bold --text-xs --text-md --tracking-wide --duration-base --focus-ring --color-warning
 * Use cases: a file uploading; a report building; a page loading; a long save; a queue of jobs; upload progress; order status; storage usage; goal tracking; quota usage; fundraising goal; delivery tracking; fitness goal
 * Jobs to be done: know something is happening; know how much is left; know whether to wait; track my order's progress; see how much storage i have left; check progress toward my goal; follow an upload until it finishes
 * Keywords: progress, bar, spinner, loader, skeleton, indeterminate, loading, percent, progress bar, steps, usage, storage, ring, circular, goal
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
import { useEffect, useId, useState, type ReactNode } from "react";
import { Button } from "./buttons-variants";

// ── c.progress: the one progress indicator. Every piece's progress is this component; the specimen below shows each variant. ──

export type ProgressVariant = "bar" | "ring" | "spinner" | "steps" | "stacked";
export type ProgressSize = 16 | 24 | 32;
export type ProgressTone = "accent" | "success" | "danger" | "warning";
/**
 * Other designs of the progress bar. "default" is the slim rounded bar; "track" is the thicker labelled track with a
 * pill fill (upload rows); "neobrutal" is the neobrutalism kit's chunky ink-bordered bar with a hard shadow and an
 * optional striped fill. Versions apply to variant "bar" only.
 */
export type ProgressVersion = "default" | "track" | "neobrutal";
export type ProgressSegment = { label: string; value: number };

// Written out in full (not built from the size) so a build finds every class the spinner needs.
const SPIN: Record<ProgressSize, string> = { 16: "fl-ctl-spin--16", 24: "fl-ctl-spin--24", 32: "fl-ctl-spin--32" };

const TONE: Record<ProgressTone, string> = { accent: "", success: " fl-ctl-bar--high", danger: " fl-ctl-bar--low", warning: " fl-ctl-bar--mid" };
// track: the fill color for a finished or failed bar.
const TRACK_FILL: Record<ProgressTone, string> = { accent: "", success: " fl-dsp-fill--success", danger: " fl-dsp-fill--danger", warning: "" };
// neobrutal: the tone class sets the fill color.
const NB_TONE: Record<ProgressTone, string> = { accent: "fl-nb-tone-info", success: "fl-nb-tone-success", danger: "fl-nb-tone-error", warning: "fl-nb-tone-warning" };
// Four segment colors, in order; written out so a build finds each class.
const SEG: string[] = ["fl-dsp-c1", "fl-dsp-c2", "fl-dsp-c3", "fl-dsp-c4"];

type ProgressProps = {
  /** Another design of the bar; "default" when left out. See ProgressVersion. */
  version?: ProgressVersion;
  /** track and neobrutal only: the words above the bar on the left, which also name it for screen readers. */
  caption?: ReactNode;
  /** track and neobrutal only: the words above the bar on the right, such as "3 of 4" or "60%". */
  valueText?: string;
  /** neobrutal only: draw the fill with diagonal stripes, for work still running. */
  striped?: boolean;
  variant?: ProgressVariant;
  /** 0 to 100. Leave it out when the amount is unknown: the bar slides and has no aria-valuenow. */
  value?: number;
  /** The name a screen reader announces. A spinner without one is decoration. */
  label?: string;
  /** Spinner diameter in px; 24 when left out. */
  size?: ProgressSize;
  /** Bar only: the 6 px track instead of the 8 px one. */
  thin?: boolean;
  /** Ring only: draw it large (120px) with children as text beside it. */
  large?: boolean;
  /** Bar and ring: accent (default), success once finished, danger once failed or cancelled. */
  tone?: ProgressTone;
  /** Steps only: the stage names, in order. */
  steps?: string[];
  /** Steps only: the index of the stage in progress; earlier ones read as done. Past the last, all are done. */
  current?: number;
  /** Stacked only: the parts that share one bar, such as storage by kind (up to four colors). */
  segments?: ProgressSegment[];
  /** Stacked only: the whole the parts are measured against; the rest is free. */
  max?: number;
  /** Stacked only: the unit written after each amount, such as "GB". */
  unit?: string;
  className?: string;
  /** Large ring only: the words beside it, such as "9 of 12 classes". */
  children?: ReactNode;
};

const TONE_STROKE: Record<ProgressTone, string> = { accent: "var(--color-accent)", success: "var(--color-success)", danger: "var(--color-danger)", warning: "var(--color-warning)" };

export function Progress({ version = "default", caption, valueText, striped, variant = "bar", value, label, size = 24, thin, tone = "accent", steps = [], current = 0, segments = [], max = 100, unit = "", large, className, children }: ProgressProps) {
  const extra = className ? ` ${className}` : "";
  const fl = `c.progress.${variant}`;
  const captionId = useId();
  if (variant === "bar" && version !== "default") {
    const name = caption ? { "aria-labelledby": captionId } : { "aria-label": label ?? "Progress" };
    const aria = value === undefined ? {} : { "aria-valuenow": value, "aria-valuemin": 0, "aria-valuemax": 100 };
    const top = caption || valueText ? (
      <div className={version === "neobrutal" ? "fl-nb-progress__top" : "fl-dsp-bar-row__top"}>
        <span id={captionId}>{caption}</span>
        <span>{valueText}</span>
      </div>
    ) : null;
    if (version === "track") {
      return (
        <div className={`fl-dsp-bar-row${extra}`} data-fl="c.progress@track">
          {top}
          <div className="fl-dsp-track" role="progressbar" {...name} {...aria}>
            <div className={`fl-dsp-fill${TRACK_FILL[tone]}`} style={{ width: `${value ?? 0}%` }} />
          </div>
        </div>
      );
    }
    return (
      <div className={`fl-nb fl-nb-progress ${NB_TONE[tone]}${extra}`} data-fl="c.progress@neobrutal">
        {top}
        <div className="fl-nb-progress__track" role="progressbar" {...name} {...aria}>
          <div className={`fl-nb-progress__fill${striped ? " fl-nb-progress__fill--striped" : ""}${!value ? " fl-nb-progress__fill--empty" : ""}`} style={{ width: `${value ?? 0}%` }} />
        </div>
      </div>
    );
  }
  if (variant === "steps") {
    const last = steps.length - 1;
    return (
      <ol className={`fl-dsp-steps${extra}`} aria-label={label ?? "Progress"} data-fl={fl}>
        {steps.map((s, i) => (
          <li key={s} data-state={i < current || current > last ? "done" : i === current ? "current" : "todo"} aria-current={i === current ? "step" : undefined}>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (variant === "stacked") {
    const used = segments.reduce((n, p) => n + p.value, 0);
    const amount = (n: number) => `${Number(n.toFixed(1))}${unit ? ` ${unit}` : ""}`;
    return (
      <div className={extra.trim() || undefined} style={{ display: "grid", gap: "var(--space-3)" }} data-fl={fl}>
        <div className="fl-dsp-track" role="img" aria-label={`${amount(used)} of ${amount(max)}: ${segments.map((p) => `${p.label} ${amount(p.value)}`).join(", ")}`} style={{ height: "0.875rem" }}>
          {segments.map((p, i) => (
            <div key={p.label} className={`fl-dsp-seg ${SEG[i % SEG.length]}`} style={{ width: `${(p.value / max) * 100}%` }} />
          ))}
        </div>
        <ul className="fl-dsp-legend">
          {segments.map((p, i) => (
            <li key={p.label}>
              <i className={SEG[i % SEG.length]} aria-hidden="true" />
              {p.label} <span>{amount(p.value)}</span>
            </li>
          ))}
          <li>
            <i aria-hidden="true" style={{ background: "var(--color-surface-sunken)", border: "1px solid var(--color-border)" }} />
            Free <span>{amount(max - used)}</span>
          </li>
        </ul>
      </div>
    );
  }
  if (variant === "spinner") {
    return <span {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })} data-fl={fl} className={`fl-ctl-spin ${SPIN[size]}${extra}`} />;
  }
  const now = value === undefined ? {} : { "aria-valuenow": value, "aria-valuemin": 0, "aria-valuemax": 100 };
  if (variant === "ring") {
    const v = value ?? 0;
    const stroke = { stroke: TONE_STROKE[tone] };
    if (large) {
      const circ = 2 * Math.PI * 52;
      return (
        <div className={`fl-dsp-ring${extra}`} data-fl={fl}>
          <div className="fl-dsp-ring__wrap" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle className="fl-dsp-ring__bg" cx="60" cy="60" r="52" />
              <circle className="fl-dsp-ring__fg" cx="60" cy="60" r="52" style={stroke} strokeDasharray={circ} strokeDashoffset={circ * (1 - v / 100)} />
            </svg>
            <strong>{v}%</strong>
          </div>
          {children ? <div className="fl-dsp-ring__text">{children}</div> : null}
        </div>
      );
    }
    return (
      <span className={`fl-ctl-ring${extra}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"} data-fl={fl}>
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle className="fl-ctl-ring-track" cx="18" cy="18" r="15.5" />
          <circle className="fl-ctl-ring-fill" cx="18" cy="18" r="15.5" style={{ ...stroke, strokeDasharray: `${(v / 100) * 97.4} 97.4` }} />
        </svg>
        <span className="fl-ctl-ring-num">{v}%</span>
      </span>
    );
  }
  return (
    <span className={`fl-ctl-bar${thin ? "" : " fl-ctl-bar--lg"}${TONE[tone]}${value === undefined ? " fl-ctl-bar--idle" : ""}${extra}`} role="progressbar" {...now} aria-label={label ?? "Progress"} data-fl={fl}>
      <span style={value === undefined ? undefined : { width: `${value}%` }} />
    </span>
  );
}

// flowcode:sample
const SAMPLE = {
  steps: ["Reading your files", "Working out the layout", "Writing the pages", "Tidying up"],
  order: ["Ordered", "Paid", "Thrown", "Fired", "Ready to collect"],
  storage: [
    { label: "Photos", value: 8.4 },
    { label: "Videos", value: 5.1 },
    { label: "Documents", value: 1.9 },
    { label: "Other", value: 1.2 },
  ],
};

export default function ProgressIndicators() {
  const d = SAMPLE;
  const [pct, setPct] = useState(38);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(2);
  const [goal, setGoal] = useState(9);
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
        <h3>Tones, steps and shares</h3>
        <p className="fl-ctl-btn-what">
          A bar turns green when it finishes and red when it fails. Steps show where in a known list of stages something
          is. Stacked shows how one whole is shared out, with the rest left as free space.
        </p>
        <ul className="fl-ctl-prog-grid">
          <li>
            <p className="fl-ctl-matrix-kind">Bar, finished and failed</p>
            <Progress value={100} tone="success" label="Upload finished" />
            <Progress value={42} tone="danger" label="Upload cancelled" />
          </li>
          <li>
            <p className="fl-ctl-matrix-kind">Steps</p>
            <Progress variant="steps" steps={d.order} current={stage} label="Order progress" />
            <span className="fl-ctl-prog-run">
              <Button variant="tertiary" size={32} disabled={stage === 0} onClick={() => setStage((v) => Math.max(0, v - 1))}>
                Back a step
              </Button>
              <Button variant="secondary" size={32} disabled={stage > d.order.length - 1} onClick={() => setStage((v) => v + 1)}>
                Next step
              </Button>
            </span>
          </li>
          <li>
            <p className="fl-ctl-matrix-kind">Stacked</p>
            <Progress variant="stacked" segments={d.storage} max={20} unit="GB" />
          </li>
          <li>
            <p className="fl-ctl-matrix-kind">Large ring, with words</p>
            <Progress variant="ring" large value={Math.round((goal / 12) * 100)} label="Classes this month" tone={goal >= 12 ? "success" : "accent"}>
              <span className="fl-ctl-matrix-what" aria-live="polite">
                {goal} of 12 classes
              </span>
              <Button variant="secondary" size={32} disabled={goal >= 12} onClick={() => setGoal((g) => g + 1)}>
                Log a class
              </Button>
            </Progress>
          </li>
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">Other designs of the progress bar, chosen with <code>version</code>. Both take a caption and a value above the bar.</p>
        <ul className="fl-ctl-prog-grid">
          <li>
            <p className="fl-ctl-matrix-kind">c.progress@track</p>
            <p className="fl-ctl-matrix-what">A thicker labelled track with a pill fill: an upload row you can follow to the end.</p>
            <Progress version="track" value={pct} caption="glaze-tests-november.zip" valueText={`${pct}%`} />
            <Progress version="track" value={100} tone="success" caption="Upload finished" valueText="100%" />
            <Progress version="track" value={42} tone="danger" caption="Upload cancelled" valueText="42%" />
          </li>
          <li>
            <p className="fl-ctl-matrix-kind">c.progress@neobrutal</p>
            <p className="fl-ctl-matrix-what">The neobrutalism kit's bar: a thick ink border, a hard shadow, and a striped fill while work runs.</p>
            <Progress version="neobrutal" value={75} caption="Classes used this month" valueText="3 of 4" />
            <Progress version="neobrutal" value={85} tone="warning" caption="Kiln load" valueText="85 of 100" />
            <Progress version="neobrutal" striped value={pct} caption="Uploading class photos" valueText={`${pct}%`} />
          </li>
        </ul>
      </div>

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
