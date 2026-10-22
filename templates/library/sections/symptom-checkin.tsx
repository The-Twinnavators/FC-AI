/** @flowcode-library symptom-checkin · Symptom check-in (Forms)
 * Catalog ID: b.symptom-checkin (block)
 * Function: A daily mood and symptom check-in with its two-week trend (b.symptom-checkin): overall mood picked from five faces, a 0 to 10 scale per measure (energy, sleep, pain, stress), tags for what else happened, a short note, saved or updated for today with a saving state and an error with Retry; then a 14-day line chart per measure with gaps for missed days, a keyboard and pointer cursor that reads each day out, this week's average against last week's, and the same numbers as a table.
 * Use it as: import { SymptomCheckin } from "./symptom-checkin"; <SymptomCheckin title="Daily check-in" measures={[{ id: "energy", label: "Energy", low: "Drained", high: "Full of energy", better?: "high"|"low" }]} tags={["Headache", "Exercise"]} history={[{ date: "2026-10-20", mood: 4, scores: { energy: 6 }, tags: ["Exercise"], note? }]} loading? onSave?={async (entry) => void} />
 * Built from: c.segmented.segmented, c.slider.single, c.chip.filter, c.text-field.outlined, c.button.primary, c.collapsible, c.empty-state
 * Look: A white card: the title and today's date with a Check in / Trends switch whose marker slides. Check in shows five round faces from very low to very good (the chosen one grows and fills), one slider per measure with a filled track and its number in a small bubble, the words for each end under it, a wrap of tag chips that fill and show a tick, a note box with a character count and Save. Trends shows a strip of measure choices with a sliding marker, two tiles with this week's and last week's averages (counting up, with an arrow), a line chart that draws itself across 14 days with dots that pop, a dashed cursor with a readout, and Show as table that opens beneath.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-sans --weight-medium --weight-semibold --weight-bold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger --press-scale
 * Use cases: mood tracker; symptom diary; wellbeing check-in; chronic condition journal; physio or recovery log; employee wellbeing pulse; research diary study
 * Jobs to be done: note how I feel today in under a minute; record how bad a symptom was; remember what else happened that day; see whether things are getting better or worse; show my last two weeks to a doctor
 * Keywords: symptom, mood, check-in, diary, journal, wellbeing, pain scale, energy, sleep, stress, trend, chart, health log
 */
/**
 * Symptom check-in: dates are local "YYYY-MM-DD" strings. Mood is 1 (very low) to 5 (very good); each measure is 0 to
 * 10. A measure's `better` says which end is good ("high" for energy and sleep, "low" for pain and stress); it only
 * decides whether a change reads as better or worse. Saving needs a mood; scales start at the middle and tags and the
 * note are optional. If today is already in `history`, the form opens with it and Save becomes Update.
 * This is a personal log, not a diagnosis: the wording stays plain and points to a doctor or nurse for worries.
 * The faces are native radios (arrow keys move between them); the scales are native range inputs with a spoken value;
 * the tags are toggle buttons. The two switches (Check in / Trends, and the measure strip) are radio groups with a
 * sliding marker. The chart is one Tab stop: Left and Right (Home, End) move the cursor between days and the readout
 * says the day and value; the same numbers are in Show as table.
 * The line draws across, dots and ticks pop, averages count up, the faces grow, the table opens with grid rows (and is
 * inert while closed). Everything works and shows with motion off.
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin) and HyperUI (MIT, Copyright (c) Mark Mead): TailAdmin's
 * line chart card and HyperUI's range inputs and radio groups, reshaped into a daily check-in with a trend.
 */
/**
 * How to try it
 * - Press Save with no face picked: it asks for one. Pick a face with the arrow keys.
 * - Drag Pain to 7 and tick Headache; type a note. Save: the first save fails in this preview; press Retry.
 * - Open Trends, pick Sleep in the strip, then Tab to the chart and walk the days with the arrow keys.
 * - Press Show as table.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Button ("./buttons-variants"),
 * Icon ("./icons") and TextField ("./text-fields-states"). Nothing else: no chart library, nothing fetched at run time.
 * The styles are the library's own fl- classes in templates/library/css/r6a-symptom-checkin.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── b.symptom-checkin: today's mood and symptoms, and how they went over two weeks. ──

export type CheckinMeasure = { id: string; label: string; low: string; high: string; better?: "high" | "low" };
export type CheckinEntry = { date: string; mood: number; scores: Record<string, number>; tags: string[]; note?: string };
export type SymptomCheckinProps = {
  title: string;
  measures: CheckinMeasure[];
  tags: string[];
  history: CheckinEntry[];
  locale?: string;
  loading?: boolean;
  onSave?: (entry: CheckinEntry) => Promise<void>;
  className?: string;
};

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const motionOff = () => typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
const MOODS = [
  { v: 1, label: "Very low" },
  { v: 2, label: "Low" },
  { v: 3, label: "Okay" },
  { v: 4, label: "Good" },
  { v: 5, label: "Very good" },
];
const NOTE_MAX = 280;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const one = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Counts from the last shown value to `value`; at once with motion off, and never left short if frames stall. */
function useCountUp(value: number, ms = 700) {
  const [shown, setShown] = useState(() => (motionOff() ? value : 0));
  const from = useRef(shown);
  useEffect(() => {
    if (motionOff()) {
      from.current = value;
      setShown(value);
      return;
    }
    const a = from.current;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = window.setTimeout(() => {
      from.current = value;
      setShown(value);
    }, ms + 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [value, ms]);
  return shown;
}

function Avg({ value }: { value: number }) {
  const shown = useCountUp(Number.isFinite(value) ? value : 0);
  if (!Number.isFinite(value)) return <>–</>;
  return (
    <>
      <span aria-hidden="true">{one.format(shown)}</span>
      <span className="fl-sr">{one.format(value)}</span>
    </>
  );
}

/** Focuses the element found once React has drawn it (tries again on the next draw if it isn't there yet). */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

/** A round face: the mouth bends from a frown (1) to a wide smile (5). */
function Face({ v }: { v: number }) {
  const bend = (v - 3) * 3.2;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" />
      <circle cx="11.5" cy="13" r="1.4" className="fl-symc-eye" />
      <circle cx="20.5" cy="13" r="1.4" className="fl-symc-eye" />
      <path d={`M10 ${20.5 - bend / 3} Q16 ${20.5 + bend} 22 ${20.5 - bend / 3}`} />
    </svg>
  );
}

type Draft = { mood: number; scores: Record<string, number>; tags: string[]; note: string };
type SaveState = "idle" | "saving" | "saved" | "error";

export function SymptomCheckin({ title, measures, tags, history: given, locale = "en-US", loading = false, onSave = quick, className }: SymptomCheckinProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const today = useMemo(() => new Date(), []);
  const todayKey = ymd(today);
  const [history, setHistory] = useState(given);
  const existing = history.find((h) => h.date === todayKey);
  const blank = (): Draft => ({ mood: 0, scores: Object.fromEntries(measures.map((m) => [m.id, 5])), tags: [], note: "" });
  const [draft, setDraft] = useState<Draft>(() => (existing ? { mood: existing.mood, scores: { ...existing.scores }, tags: [...existing.tags], note: existing.note ?? "" } : blank()));
  const [moodErr, setMoodErr] = useState("");
  const [save, setSave] = useState<SaveState>("idle");
  const [tab, setTab] = useState<"checkin" | "trends">("checkin");
  const [measure, setMeasure] = useState("mood");
  const [cursor, setCursor] = useState(13);
  const [table, setTable] = useState(false);
  const [said, setSaid] = useState("");
  const [chartW, setChartW] = useState(640);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setChartW(Math.round(el.clientWidth)));
    ro.observe(el);
    setChartW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, [tab, loading, history.length]);
  const fmtDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
  const fmtTick = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);

  const dirty = () => save === "saved" && setSave("idle");

  const submit = async () => {
    if (!draft.mood) {
      setMoodErr("Pick how you feel overall.");
      setSaid("Pick how you feel overall.");
      document.getElementById(`${uid}-mood-3`)?.focus();
      return;
    }
    const entry: CheckinEntry = { date: todayKey, mood: draft.mood, scores: { ...draft.scores }, tags: [...draft.tags], note: draft.note.trim() || undefined };
    setSave("saving");
    setSaid("Saving…");
    try {
      await onSave(entry);
      setHistory((h) => [...h.filter((x) => x.date !== todayKey), entry]);
      setSave("saved");
      setSaid(existing ? "Today's check-in updated." : "Today's check-in saved.");
      focusLater(() => document.getElementById(`${uid}-save`));
    } catch {
      setSave("error");
      setSaid("Couldn't save your check-in.");
      focusLater(() => document.getElementById(`${uid}-save`));
    }
  };

  // Trends: the last 14 days up to today.
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const byDate = new Map(history.map((h) => [h.date, h]));
  const options = [{ id: "mood", label: "Mood", low: "Very low", high: "Very good", better: "high" as const }, ...measures];
  const current = options.find((o) => o.id === measure) ?? options[0]!;
  const max = measure === "mood" ? 5 : 10;
  const minV = measure === "mood" ? 1 : 0;
  const valueOf = (e: CheckinEntry | undefined) => (e ? (measure === "mood" ? e.mood : e.scores[measure]) : undefined);
  const series = days.map((d) => valueOf(byDate.get(ymd(d))));
  const known = series.filter((v): v is number => v !== undefined);
  const thisWeek = avg(series.slice(7).filter((v): v is number => v !== undefined));
  const lastWeek = avg(series.slice(0, 7).filter((v): v is number => v !== undefined));
  const delta = thisWeek - lastWeek;
  const better = current.better ?? "high";
  const change = !Number.isFinite(delta) || Math.abs(delta) < 0.25 ? "About the same as last week" : (delta > 0) === (better === "high") ? "Better than last week" : "Worse than last week";

  // Chart geometry: drawn at the chart's own width, so text and dots keep their size on a phone.
  const W = Math.max(260, chartW);
  const H = 220;
  const L = 34;
  const R = 12;
  const T = 14;
  const B = 30;
  const x = (i: number) => L + (i * (W - L - R)) / 13;
  const y = (v: number) => T + (1 - (v - minV) / (max - minV)) * (H - T - B);
  const segments: string[] = [];
  let run: string[] = [];
  series.forEach((v, i) => {
    if (v === undefined) {
      if (run.length) segments.push(run.join(" "));
      run = [];
    } else run.push(`${run.length ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`);
  });
  if (run.length) segments.push(run.join(" "));
  const ticks = measure === "mood" ? [1, 2, 3, 4, 5] : [0, 5, 10];
  const cur = Math.max(0, Math.min(13, cursor));
  const curV = series[cur];
  const readout = `${fmtShort.format(days[cur]!)}: ${curV === undefined ? "no check-in" : measure === "mood" ? MOODS[curV - 1]?.label ?? String(curV) : `${curV} of 10`}`;

  const onChartKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    let n = cur;
    if (e.key === "ArrowRight") n = Math.min(13, cur + 1);
    else if (e.key === "ArrowLeft") n = Math.max(0, cur - 1);
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = 13;
    else return;
    e.preventDefault();
    setCursor(n);
  };

  const viewIdx = tab === "checkin" ? 0 : 1;
  const measureIdx = options.findIndex((o) => o.id === measure);

  return (
    <section className={["fl-symc", className ?? ""].filter(Boolean).join(" ")} data-fl="b.symptom-checkin" aria-labelledby={`${uid}-t`} aria-busy={loading || save === "saving" || undefined}>
      <header className="fl-symc-head">
        <div>
          <h3 id={`${uid}-t`} className="fl-symc-title">
            {title}
          </h3>
          <p className="fl-symc-date">{fmtDate.format(today)}</p>
        </div>
        <div className="fl-symc-switch" role="radiogroup" aria-label="View" style={{ ["--x" as string]: viewIdx, ["--n" as string]: 2 }}>
          <span className="fl-symc-marker" aria-hidden="true" />
          {(["checkin", "trends"] as const).map((k) => (
            <label key={k} className="fl-symc-opt">
              <input type="radio" name={`${uid}-view`} value={k} checked={tab === k} onChange={() => setTab(k)} />
              {k === "checkin" ? "Check in" : "Trends"}
            </label>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="fl-symc-ghosts" aria-hidden="true">
          {[0, 1, 2, 3].map((k) => (
            <span key={k} className="fl-symc-ghost" />
          ))}
        </div>
      ) : tab === "checkin" ? (
        <form
          className="fl-symc-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          key="checkin"
        >
          <fieldset className="fl-symc-moods" aria-describedby={moodErr ? `${uid}-mood-err` : undefined}>
            <legend>Overall, how do you feel today?</legend>
            <div className="fl-symc-faces">
              {MOODS.map((m) => (
                <label key={m.v} className={`fl-symc-face is-m${m.v}`}>
                  <input
                    type="radio"
                    id={`${uid}-mood-${m.v}`}
                    name={`${uid}-mood`}
                    value={m.v}
                    checked={draft.mood === m.v}
                    aria-invalid={!!moodErr || undefined}
                    onChange={() => {
                      setDraft((d) => ({ ...d, mood: m.v }));
                      setMoodErr("");
                      dirty();
                    }}
                  />
                  <Face v={m.v} />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
            {moodErr ? (
              <p id={`${uid}-mood-err`} className="fl-symc-err">
                {moodErr}
              </p>
            ) : null}
          </fieldset>

          <div className="fl-symc-scales">
            {measures.map((m, i) => {
              const v = draft.scores[m.id] ?? 5;
              return (
                <div key={m.id} className="fl-symc-scale" style={{ ["--i" as string]: i, ["--v" as string]: v / 10 }}>
                  <div className="fl-symc-scalehead">
                    <label htmlFor={`${uid}-s-${m.id}`}>{m.label}</label>
                    <output htmlFor={`${uid}-s-${m.id}`} key={v} aria-hidden="true">
                      {v}
                    </output>
                  </div>
                  <input
                    type="range"
                    id={`${uid}-s-${m.id}`}
                    min={0}
                    max={10}
                    step={1}
                    value={v}
                    aria-valuetext={`${v} of 10${v === 0 ? `, ${m.low}` : v === 10 ? `, ${m.high}` : ""}`}
                    aria-describedby={`${uid}-s-${m.id}-ends`}
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, scores: { ...d.scores, [m.id]: Number(e.target.value) } }));
                      dirty();
                    }}
                  />
                  <p id={`${uid}-s-${m.id}-ends`} className="fl-symc-ends">
                    <span>0 · {m.low}</span>
                    <span>10 · {m.high}</span>
                  </p>
                </div>
              );
            })}
          </div>

          <fieldset className="fl-symc-tags">
            <legend>Anything else today?</legend>
            <div>
              {tags.map((t) => {
                const on = draft.tags.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    className="fl-symc-tag"
                    aria-pressed={on}
                    onClick={() => {
                      setDraft((d) => ({ ...d, tags: on ? d.tags.filter((x) => x !== t) : [...d.tags, t] }));
                      dirty();
                    }}
                  >
                    {on ? <Icon name="check" /> : <Icon name="plus" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="fl-symc-note">
            <label htmlFor={`${uid}-note`}>Note (optional)</label>
            <TextField
              id={`${uid}-note`}
              multiline
              autoGrow
              rows={2}
              maxLength={NOTE_MAX}
              placeholder="Slept badly after a late dinner."
              value={draft.note}
              aria-describedby={`${uid}-note-count`}
              onChange={(e) => {
                setDraft((d) => ({ ...d, note: e.target.value }));
                dirty();
              }}
            />
            <span id={`${uid}-note-count`} className={`fl-symc-count${draft.note.length > NOTE_MAX - 30 ? " is-near" : ""}`}>
              {draft.note.length}/{NOTE_MAX}
            </span>
          </div>

          {save === "error" ? (
            <p className="fl-symc-alert" role="alert">
              <Icon name="alert" />
              Couldn't save your check-in. Check your connection and try again.
            </p>
          ) : null}

          <div className="fl-symc-foot">
            <p className="fl-symc-disclaimer">A personal log, not a diagnosis. If something worries you, talk to a doctor or nurse.</p>
            {save === "saved" ? (
              <span className="fl-symc-saved">
                <span className="fl-symc-tick" aria-hidden="true">
                  <Icon name="check" />
                </span>
                Saved
              </span>
            ) : null}
            <Button id={`${uid}-save`} type="submit" variant="primary" size={40} icon={save === "error" ? "refresh" : "check"} busy={save === "saving"}>
              {save === "saving" ? "Saving…" : save === "error" ? "Retry" : existing ? "Update check-in" : "Save check-in"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="fl-symc-trends" key="trends">
          <div className="fl-symc-measures" role="radiogroup" aria-label="Measure" style={{ ["--x" as string]: measureIdx, ["--n" as string]: options.length }}>
            <span className="fl-symc-marker" aria-hidden="true" />
            {options.map((o) => (
              <label key={o.id} className="fl-symc-opt">
                <input type="radio" name={`${uid}-measure`} value={o.id} checked={measure === o.id} onChange={() => (setMeasure(o.id), setSaid(`${o.label} over the last two weeks.`))} />
                {o.label}
              </label>
            ))}
          </div>

          {known.length < 2 ? (
            <div className="fl-symc-state" data-fl="c.empty-state">
              <Icon name="chart" />
              <strong>Not enough check-ins yet</strong>
              <p>Check in on a few days to see a trend.</p>
            </div>
          ) : (
            <>
              <dl className="fl-symc-avgs">
                <div>
                  <dt>This week</dt>
                  <dd>
                    <Avg value={thisWeek} />
                    <span className="fl-symc-of">/ {max}</span>
                  </dd>
                </div>
                <div>
                  <dt>Last week</dt>
                  <dd>
                    <Avg value={lastWeek} />
                    <span className="fl-symc-of">/ {max}</span>
                  </dd>
                </div>
                <p className={`fl-symc-change${change.startsWith("Better") ? " is-better" : change.startsWith("Worse") ? " is-worse" : ""}`} key={`${measure}-${change}`}>
                  {change.startsWith("About") ? <Icon name="arrow" /> : <span className={`fl-symc-arrow${delta > 0 ? " is-up" : ""}`}><Icon name="arrow" /></span>}
                  {change}
                </p>
              </dl>

              <div ref={chartRef} className="fl-symc-chart" tabIndex={0} role="group" aria-roledescription="chart" aria-label={`${current.label} over the last 14 days. Arrow keys move between days.`} aria-describedby={`${uid}-readout`} onKeyDown={onChartKey}>
                <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true" key={measure} onPointerMove={(e) => {
                  const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                  const px = ((e.clientX - box.left) / box.width) * W;
                  setCursor(Math.max(0, Math.min(13, Math.round(((px - L) / (W - L - R)) * 13))));
                }}>
                  {ticks.map((t) => (
                    <g key={t} className="fl-symc-grid">
                      <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
                      <text x={L - 8} y={y(t) + 4}>
                        {t}
                      </text>
                    </g>
                  ))}
                  {days.map((d, i) =>
                    (W < 420 ? i % 4 === 1 : i % 3 === 1) || i === 13 ? (
                      <text key={i} className="fl-symc-xtick" x={x(i)} y={H - 8}>
                        {i === 13 ? "Today" : fmtTick.format(d)}
                      </text>
                    ) : null,
                  )}
                  <line className="fl-symc-cursor" x1={0} x2={0} y1={T} y2={H - B} style={{ transform: `translateX(${x(cur)}px)` }} />
                  {segments.map((dPath, i) => (
                    <path key={i} className="fl-symc-line" d={dPath} pathLength={1} style={{ ["--i" as string]: i }} />
                  ))}
                  {series.map((v, i) =>
                    v === undefined ? null : <circle key={i} className={`fl-symc-pt${i === cur ? " is-cur" : ""}`} cx={x(i)} cy={y(v)} r={i === cur ? 6 : 4} style={{ ["--i" as string]: i }} />,
                  )}
                </svg>
                <p id={`${uid}-readout`} className="fl-symc-readout" aria-live="polite">
                  {readout}
                </p>
              </div>

              <button type="button" className="fl-symc-toggle" aria-expanded={table} aria-controls={`${uid}-table`} onClick={() => setTable((t) => !t)}>
                <Icon name="chevron-down" />
                {table ? "Hide table" : "Show as table"}
              </button>
              <div id={`${uid}-table`} className={`fl-symc-tablewrap${table ? " is-open" : ""}`} inert={!table}>
                <div>
                  <table className="fl-symc-table">
                    <caption className="fl-sr">{current.label}, last 14 days</caption>
                    <thead>
                      <tr>
                        <th scope="col">Day</th>
                        <th scope="col">{current.label}</th>
                        <th scope="col">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days
                        .map((d, i) => ({ d, i, e: byDate.get(ymd(d)) }))
                        .reverse()
                        .map(({ d, i, e }) => (
                          <tr key={i}>
                            <th scope="row">{fmtShort.format(d)}</th>
                            <td>{series[i] === undefined ? "No check-in" : measure === "mood" ? MOODS[series[i]! - 1]?.label : `${series[i]} / 10`}</td>
                            <td>{e?.tags.length ? e.tags.join(", ") : "–"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="fl-symc-disclaimer">A personal log, not a diagnosis. If something worries you, talk to a doctor or nurse.</p>
            </>
          )}
        </div>
      )}

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading check-ins…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: twelve check-ins over the last 13 days (two missed), today still open. ──

const TODAY = new Date();
const day = (back: number) => ymd(addDays(TODAY, -back));
const ROWS: [number, number, number, number, number, number, string[]][] = [
  // [days back, mood, energy, sleep, pain, stress, tags]
  [13, 3, 4, 5, 6, 6, ["Headache", "Late night"]],
  [12, 2, 3, 3, 7, 7, ["Headache", "Stress at work"]],
  [11, 3, 4, 5, 5, 6, ["Stress at work"]],
  [10, 3, 5, 6, 5, 5, []],
  [8, 4, 6, 7, 4, 4, ["Exercise"]],
  [7, 3, 5, 5, 5, 6, ["Late night"]],
  [6, 4, 6, 7, 3, 4, ["Exercise"]],
  [5, 4, 7, 7, 3, 3, ["Exercise", "Time outside"]],
  [4, 3, 5, 4, 4, 5, ["Late night", "Alcohol"]],
  [3, 4, 6, 7, 3, 4, ["Exercise"]],
  [2, 5, 8, 8, 2, 3, ["Time outside"]],
  [1, 4, 7, 6, 3, 4, ["Exercise"]],
];

// flowcode:sample
const SAMPLE: SymptomCheckinProps = {
  title: "Daily check-in",
  measures: [
    { id: "energy", label: "Energy", low: "Drained", high: "Full of energy", better: "high" },
    { id: "sleep", label: "Sleep", low: "Very poor", high: "Very good", better: "high" },
    { id: "pain", label: "Pain", low: "None", high: "Worst", better: "low" },
    { id: "stress", label: "Stress", low: "Calm", high: "Overwhelmed", better: "low" },
  ],
  tags: ["Headache", "Exercise", "Late night", "Stress at work", "Alcohol", "Time outside", "Took pain relief"],
  history: ROWS.map(([back, mood, energy, sleep, pain, stress, tags]) => ({ date: day(back), mood, scores: { energy, sleep, pain, stress }, tags })),
};

export default function SymptomCheckinPreview() {
  const [loading, setLoading] = useState(true);
  const tries = useRef(0);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Symptom check-in">
      <div className="fl-wrap">
        <SymptomCheckin
          {...SAMPLE}
          loading={loading}
          onSave={() =>
            new Promise<void>((ok, fail) =>
              window.setTimeout(() => {
                tries.current += 1;
                if (tries.current === 1) fail(new Error("offline"));
                else ok();
              }, 700),
            )
          }
        />
      </div>
    </section>
  );
}
