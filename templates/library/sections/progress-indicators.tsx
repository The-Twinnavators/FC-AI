/** @flowcode-library progress-indicators · Progress: bars, rings, spinners and skeletons (Alerts and states)
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
        <button
          type="button"
          className="fl-btn fl-btn--primary fl-ctl-btn--40"
          onClick={() => {
            setPct(pct >= 100 ? 0 : pct);
            setRunning((v) => !v);
          }}
        >
          {running ? "Pause" : pct >= 100 ? "Run it again" : "Run it"}
        </button>
        <button type="button" className="fl-btn fl-ctl-btn--tertiary fl-ctl-btn--40" onClick={() => { setRunning(false); setPct(0); }}>
          Back to nothing
        </button>
        <span className="fl-ctl-matrix-what" role="status" aria-live="polite">
          {pct >= 100 ? "Finished" : running ? `${d.steps[step]}, ${pct}%` : `Paused at ${pct}%`}
        </span>
      </div>

      <ul className="fl-ctl-prog-grid">
        <li>
          <p className="fl-ctl-matrix-kind">Bar, with a number</p>
          <p className="fl-ctl-matrix-what">When you know how far along it is. The number is written out, not only drawn.</p>
          <span className="fl-ctl-bar fl-ctl-bar--lg" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Building your site">
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="fl-ctl-matrix-what">{pct}% &middot; {d.steps[step]}</span>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Bar, indeterminate</p>
          <p className="fl-ctl-matrix-what">When you do not. No aria-valuenow at all: that absence is what says "unknown".</p>
          <span className="fl-ctl-bar fl-ctl-bar--lg fl-ctl-bar--idle" role="progressbar" aria-label="Working">
            <span />
          </span>
          <span className="fl-ctl-matrix-what">Working on it</span>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Ring</p>
          <p className="fl-ctl-matrix-what">The same number, where a bar would not fit: a card corner, a table cell, beside a name.</p>
          <span className="fl-ctl-ring" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Building your site">
            <svg viewBox="0 0 36 36" aria-hidden="true">
              <circle className="fl-ctl-ring-track" cx="18" cy="18" r="15.5" />
              <circle className="fl-ctl-ring-fill" cx="18" cy="18" r="15.5" style={{ strokeDasharray: `${(pct / 100) * 97.4} 97.4` }} />
            </svg>
            <span className="fl-ctl-ring-num">{pct}%</span>
          </span>
        </li>

        <li>
          <p className="fl-ctl-matrix-kind">Spinner</p>
          <p className="fl-ctl-matrix-what">For something short, in a button or beside a row. It says only that something is happening.</p>
          <span className="fl-ctl-spin-row">
            <span className="fl-ctl-spin fl-ctl-spin--16" aria-hidden="true" />
            <span className="fl-ctl-spin fl-ctl-spin--24" aria-hidden="true" />
            <span className="fl-ctl-spin fl-ctl-spin--32" aria-hidden="true" />
          </span>
          <button type="button" className="fl-btn fl-btn--primary fl-ctl-btn--40" disabled>
            <span className="fl-ctl-spin fl-ctl-spin--16" aria-hidden="true" /> Saving
          </button>
        </li>
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Skeleton</h3>
        <p className="fl-ctl-btn-what">
          The shape of what is coming, when you know the shape. It stops the page jumping when the content lands. It is
          decoration, so it is hidden from screen readers and one line of text does the announcing.
        </p>
        <div className="fl-ctl-skel-card" aria-hidden="true">
          <span className="fl-ctl-skel fl-ctl-skel--avatar" />
          <span className="fl-ctl-skel-lines">
            <span className="fl-ctl-skel" />
            <span className="fl-ctl-skel fl-ctl-skel--short" />
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
