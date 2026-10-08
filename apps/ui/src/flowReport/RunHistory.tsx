/**
 * The runs of one Repo Report project, three ways: a line (RunTrend), a list (RunHistoryList) and a row of buttons
 * (RunPicker). Together because they all answer "which run am I looking at, and how did the score get here", and the
 * line and the list sit side by side and must never disagree about which runs exist.
 */
import { useId, useState } from "react";
import { Trash2 } from "lucide-react";
import { isDeletableRun, isEmptyRun, TERMINAL, type FlowReportRun } from "./api";

const RUN_STAMP: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };

/** When a run happened: finished, else started, else created. */
export function runStamp(r: FlowReportRun): string {
  return new Date(r.completedAt ?? r.startedAt ?? r.createdAt).toLocaleString(undefined, RUN_STAMP);
}

/** The score, or why there isn't one: a dash for a run that ended without one, an ellipsis for one still going. */
function scoreMark(r: FlowReportRun): string | number {
  return r.summary?.overallScore ?? (TERMINAL.has(r.status) ? "—" : "…");
}

const VW = 200;
const VH = 132;

// Both control points sit level with their endpoint, so a curve between two scores never bulges past either: a
// Catmull-Rom would overshoot and draw a score that was never measured.
function spline(pts: Array<[number, number]>, close = false): string {
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const cx = ((pts[i][0] + pts[i + 1][0]) / 2).toFixed(1);
    d += ` C ${cx},${pts[i][1].toFixed(1)} ${cx},${pts[i + 1][1].toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  if (close) d += ` L ${pts[pts.length - 1][0].toFixed(1)},${VH} L ${pts[0][0].toFixed(1)},${VH} Z`;
  return d;
}

/**
 * The scores in the list beside it, as a line. Oldest on the left; one step per run, not per hour (runs minutes apart
 * and then days apart would squash into a smudge on a time axis). The y axis spans the scores' own range, printed
 * beside it. A run without a score breaks the line and leaves a dashed tick, so no movement is drawn across a gap.
 * Markers are HTML (the SVG stretches, so a circle would be an ellipse) and out of the tab order: the list selects
 * the same runs with real labels.
 */
export function RunTrend({ runs, selected, onSelect }: { runs: FlowReportRun[]; selected: string | null; onSelect: (id: string) => void }) {
  const uid = useId().replace(/:/g, "");
  const order = [...runs].reverse();
  const scores = order.map((r) => r.summary?.overallScore ?? null);
  const known = scores.filter((s): s is number => s !== null);
  // One score is a dot, not a trend; the list still says everything there is to say.
  if (known.length < 2) return null;

  const PX = 5;
  const PY = 14;
  const hi = Math.max(...known);
  const lo = Math.min(...known);
  const flat = hi === lo;
  const x = (i: number) => PX + i * ((VW - PX * 2) / Math.max(1, order.length - 1));
  // Every run scoring the same is a line down the middle, not along the floor (which would read as the worst score).
  const y = (v: number) => (flat ? VH / 2 : VH - PY - ((v - lo) / (hi - lo)) * (VH - PY * 2));

  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  scores.forEach((s, i) => {
    if (s === null) {
      if (current.length > 1) segments.push(current);
      current = [];
      return;
    }
    current.push([x(i), y(s)]);
  });
  if (current.length > 1) segments.push(current);
  const missing = scores.filter((s) => s === null).length;
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="fr-trend">
      <div className="fr-trend__plot-row">
        <div className={`fr-trend__axis${flat ? " is-flat" : ""}`}>
          <span>{hi}</span>
          {!flat ? <span>{lo}</span> : null}
        </div>
        <div className="fr-trend__plot" style={{ height: VH }} role="img" aria-label={`Overall score across the last ${order.length} runs, oldest first, ranging from ${lo} to ${hi}.`}>
          <svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {/* userSpaceOnUse: one ramp down the whole chart, so the depth of the fill means the same everywhere. */}
              <linearGradient id={`fr-fill-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={VH}>
                <stop offset="0%" className="fr-trend__stop" stopOpacity={0.2} />
                <stop offset="100%" className="fr-trend__stop" stopOpacity={0} />
              </linearGradient>
              <clipPath id={`fr-sweep-${uid}`}>
                <rect x="0" y="0" height={VH} width={still ? VW : 0}>
                  {still ? null : <animate attributeName="width" from="0" to={VW} dur="1.1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />}
                </rect>
              </clipPath>
            </defs>
            <g clipPath={`url(#fr-sweep-${uid})`}>
              {segments.map((pts) => (
                <path key={`f${pts[0][0]}`} d={spline(pts, true)} fill={`url(#fr-fill-${uid})`} />
              ))}
              {/* non-scaling-stroke: the chart is stretched, and 1px should mean 1px along the whole line. */}
              {segments.map((pts) => (
                <path key={`l${pts[0][0]}`} d={spline(pts)} className="fr-trend__line" fill="none" strokeWidth={1.25} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          </svg>
          {order.map((r, i) => {
            const s = scores[i];
            const on = r.id === selected;
            const left = `${(x(i) / VW) * 100}%`;
            if (s === null) {
              return (
                <button key={r.id} type="button" aria-hidden="true" tabIndex={-1} title={`${runStamp(r)}: finished without a score`} onClick={() => onSelect(r.id)} className={`fr-trend__gap${on ? " is-on" : ""}`} style={{ left }}>
                  <span />
                </button>
              );
            }
            return (
              <button key={r.id} type="button" aria-hidden="true" tabIndex={-1} title={`${runStamp(r)}: ${s}`} onClick={() => onSelect(r.id)} className={`fr-trend__dot${on ? " is-on" : ""}`} style={{ left, top: `${(y(s) / VH) * 100}%` }}>
                <span />
              </button>
            );
          })}
        </div>
      </div>
      <div className="fr-trend__ends">
        <span>{runStamp(order[0])}</span>
        <span>{runStamp(order[order.length - 1])}</span>
      </div>
      <p className="fr-trend__note">
        Oldest run on the left: one step per run, not per hour, and the scale spans {lo} to {hi} rather than 0 to 100
        {missing > 0 ? (missing === 1 ? "; the dash is a run that finished without a score" : `; the dashes are ${missing} runs that finished without a score`) : ""}.
      </p>
    </div>
  );
}

/**
 * Every run, newest first, as the thing you click. Removing one is asked in the row itself: it can't be undone, and a
 * one-click delete a pixel from the control that selects is a mis-click waiting to happen.
 */
export function RunHistoryList({ runs, selected, onSelect, onDelete }: { runs: FlowReportRun[]; selected: string | null; onSelect: (id: string) => void; onDelete?: (id: string) => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  return (
    <ul className="fr-history">
      {runs.map((r) => {
        const on = r.id === selected;
        if (confirming === r.id) {
          const score = r.summary?.overallScore;
          return (
            <li key={r.id} className="fr-history__confirm">
              <span>{isEmptyRun(r) ? "Remove for good?" : score === null || score === undefined ? "Remove this report for good?" : `Remove for good? This deletes the report and drops ${score} from the trend.`}</span>
              <button
                type="button"
                className="fr-link fr-link--bad"
                onClick={() => {
                  setConfirming(null);
                  onDelete?.(r.id);
                }}
              >
                Remove
              </button>
              <button type="button" className="fr-link" onClick={() => setConfirming(null)}>
                No
              </button>
            </li>
          );
        }
        return (
          <li key={r.id} className="fr-history__row">
            <button type="button" className={`fr-history__pick${on ? " is-on" : ""}`} onClick={() => onSelect(r.id)} aria-current={on ? "true" : undefined}>
              <span className="fr-history__dot" aria-hidden="true" />
              <span className="fr-history__when">{runStamp(r)}</span>
              <span className="fr-history__score">{scoreMark(r)}</span>
            </button>
            {onDelete && isDeletableRun(r) ? (
              <button type="button" className="fr-history__del" onClick={() => setConfirming(r.id)} title={isEmptyRun(r) ? `Remove the run of ${runStamp(r)}, which produced no report` : `Remove the run of ${runStamp(r)} and its report`} aria-label={`Remove the run of ${runStamp(r)}`}>
                <Trash2 size={11} />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** The same choice as a wrapped row, for a run with no summary to hold the chart and list (failed, or still going). */
export function RunPicker({ runs, selected, onSelect }: { runs: FlowReportRun[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="fr-picker">
      {runs.slice(0, 12).map((r) => (
        <button key={r.id} type="button" className={`fr-chip${r.id === selected ? " is-on" : ""}`} onClick={() => onSelect(r.id)} aria-pressed={r.id === selected}>
          {runStamp(r)}
          <span className="fr-chip__score">{scoreMark(r)}</span>
        </button>
      ))}
    </div>
  );
}
