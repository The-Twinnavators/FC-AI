/** @flowcode-library goal-targets · Goal targets (Charts and data)
 * Catalog ID: p.goal-targets (pattern)
 * Function: Progress toward a few targets for the current period: each goal shows how far along it is against where it should be by today, says ahead, on pace, behind or done, projects where it will land, and lets you change its target in place; a period switch and a summary of how many are on pace sit on top.
 * Use it as: import { GoalTargets } from "./goal-targets"; <GoalTargets title="October targets" periods={[{ id: "month", label: "Month", elapsed: 0.68, note: "Day 21 of 31", goals: [{ id: "revenue", label: "Revenue", value: 48200, target: 60000, format?: "count"|"money"|"percent", unit?: "orders" }] }]} defaultPeriod? currency?="USD" locale? loading?={false} onTargetChange?={async (periodId, goalId, target) => ...} labels?={{ period, edit, target, save, cancel, onPace, ahead, behind, done, pace, projected, summary, empty, loading, invalid, saved, failed }} />
 * Built from: c.segmented.toggle, c.badge.status, c.button.tertiary, c.button.primary, c.text-field.outlined
 * Look: A white card with a title, "3 of 4 on pace" and how far the period has gone, then one row per goal: its name and a status pill, the figure "of" the target, a rounded track with an accent fill and a thin straight upright mark for where it should be today, a muted line with the projection, and a quiet Edit target button that turns the row into a small number field with Save and Cancel.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --surface-radius --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-xl --font-sans --font-display --duration-fast --duration-slow --ease-out --stagger --focus-ring
 * Use cases: sales targets; monthly goals; quota tracking; fundraising goals; okr progress; fitness goals; savings goals; support targets
 * Jobs to be done: see if we will hit our targets; find the goal that is falling behind; change a target; check progress at a glance
 * Keywords: goals, targets, quota, progress, pace, projection, okr, bullet chart, dashboard
 */
/**
 * Goal targets: a target only means something against time. Each row compares how far the goal is (figure over
 * target) with how far the period is (the upright mark on the track), and says the result in a pill: Done once it
 * reaches the target, Ahead when it is more than 5% ahead of pace, Behind when more than 5% behind, else On pace.
 * The line under it projects the period's end at today's rate.
 * Edit target turns the row into a number field: Enter or Save keeps it (onTargetChange may return a promise; the
 * row waits on it and puts the old target back if it fails), Escape or Cancel leaves it, and focus goes back to the
 * Edit button. A number of zero or less is refused with the reason under the field.
 * Bars fill the first time the card is on screen, and slide when a target or the period changes; figures count up.
 * Each track is a meter with its figures in words, and a status line says what changed.
 * Make it the app's own: pass the app's own goals and how far through the period it is (elapsed, 0 to 1).
 * Adapted from TailAdmin (MIT, Copyright (c) 2023 TailAdmin): its Monthly Target card (a target you set for the month,
 * progress against it and a short note on how it's going), reshaped into a list of goals with editable targets.
 */
/**
 * How to try it
 * - Switch Month and Quarter (the switch shows gray rows first); Quarter starts with nothing set.
 * - Press Edit target on a row, type a new number and press Enter; try 0 to see the error; press Escape to leave.
 * - Watch the pill and projection change when a target moves past or under pace.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's Segmented ("./segmented-control"),
 * Badge ("./badges-status") and Button ("./buttons-variants"). Nothing else — nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css/r3t-goals.css, and the sample data is in the file.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Segmented } from "./segmented-control";

// ── p.goal-targets: goals against targets and pace, with targets edited in place. ──

export type Goal = { id: string; label: string; value: number; target: number; format?: "count" | "money" | "percent"; unit?: string };
export type GoalPeriod = { id: string; label: string; elapsed: number; note?: string; goals: Goal[] };
type GoalLabels = {
  period: string; edit: string; target: string; save: string; cancel: string; onPace: string; ahead: string; behind: string; done: string;
  pace: string; projected: string; summary: string; empty: string; loading: string; invalid: string; saved: string; failed: string;
};

const LABELS: GoalLabels = {
  period: "Period",
  edit: "Edit target",
  target: "Target",
  save: "Save",
  cancel: "Cancel",
  onPace: "On pace",
  ahead: "Ahead",
  behind: "Behind",
  done: "Done",
  pace: "Where it should be today",
  projected: "On track for {n} · {p} done",
  summary: "{n} of {total} on pace",
  empty: "No goals set for this period yet.",
  loading: "Loading…",
  invalid: "Enter a number above zero.",
  saved: "Target for {goal} set to {n}.",
  failed: "Couldn't save the target for {goal}. It's back to {n}.",
};

type Status = "done" | "ahead" | "onPace" | "behind";
const TONE: Record<Status, "success" | "info" | "neutral" | "warning"> = { done: "success", ahead: "success", onPace: "info", behind: "warning" };

const motionOff = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";

/** True once the element has been on screen (at once when motion is off). */
function useSeen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || motionOff() || !("IntersectionObserver" in window)) return setSeen(true);
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      const t = window.setTimeout(() => setSeen(true), 40);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** True a moment after `on` turns true, so freshly mounted bars start empty and grow; at once when motion is off. */
function useGrown(on: boolean) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    if (!on) return setGrown(false);
    if (motionOff()) return setGrown(true);
    const t = window.setTimeout(() => setGrown(true), 40);
    return () => window.clearTimeout(t);
  }, [on]);
  return grown;
}

/** A number that counts toward its target with an ease-out curve; jumps when motion is off. */
function useTween(target: number, run: boolean, ms = 700) {
  const [v, setV] = useState(0);
  const cur = useRef(0);
  useEffect(() => {
    if (!run) return;
    if (motionOff()) {
      cur.current = target;
      return setV(target);
    }
    const from = cur.current;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const p = Math.min(1, (t - start) / ms);
      const n = from + (target - from) * (1 - (1 - p) ** 3);
      cur.current = n;
      setV(n);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return v;
}

function Count({ value, run, fmt }: { value: number; run: boolean; fmt: (n: number) => string }) {
  return <>{fmt(useTween(value, run))}</>;
}

export function GoalTargets({
  title,
  periods,
  defaultPeriod,
  currency = "USD",
  locale,
  loading = false,
  onPeriodChange,
  onTargetChange,
  labels,
  className,
}: {
  title: string;
  /** elapsed: how far through the period today is, 0 to 1. */
  periods: GoalPeriod[];
  defaultPeriod?: string;
  currency?: string;
  locale?: string;
  loading?: boolean;
  onPeriodChange?: (id: string) => void;
  /** Saves a new target; a rejected promise puts the old one back. */
  onTargetChange?: (periodId: string, goalId: string, target: number) => void | Promise<void>;
  labels?: Partial<GoalLabels>;
  className?: string;
}) {
  const L = { ...LABELS, ...labels };
  const uid = useId().replace(/:/g, "");
  const [periodId, setPeriodId] = useState(defaultPeriod ?? periods[0]?.id ?? "");
  const period = periods.find((p) => p.id === periodId) ?? periods[0];
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const editBtns = useRef(new Map<string, HTMLButtonElement>());
  const field = useRef<HTMLInputElement>(null);
  const back = useRef<string | null>(null);
  const [box, seen] = useSeen<HTMLElement>();
  const draw = useGrown(seen && !loading);

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const mf = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }), [locale, currency]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }), [locale]);
  const fmtOf = (g: Goal, withUnit = true) => (n: number) =>
    g.format === "money" ? mf.format(n) : g.format === "percent" ? `${nf.format(Math.round(n * 10) / 10)}%` : `${nf.format(Math.round(n))}${withUnit && g.unit ? ` ${g.unit}` : ""}`;

  const elapsed = Math.max(0.01, Math.min(1, period?.elapsed ?? 1));
  const goals = (period?.goals ?? []).map((g) => ({ ...g, target: targets[`${period!.id}:${g.id}`] ?? g.target }));
  const statusOf = (g: Goal): Status => {
    const ratio = g.target > 0 ? g.value / g.target : 0;
    if (ratio >= 1) return "done";
    const pace = ratio / elapsed;
    return pace >= 1.05 ? "ahead" : pace >= 0.95 ? "onPace" : "behind";
  };
  const statusText: Record<Status, string> = { done: L.done, ahead: L.ahead, onPace: L.onPace, behind: L.behind };
  const good = goals.filter((g) => statusOf(g) !== "behind").length;
  const empty = !loading && goals.length === 0;

  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const startEdit = (g: Goal) => {
    setEditing(g.id);
    setDraft(String(g.target));
    setError("");
  };
  const stopEdit = (id: string) => {
    back.current = id;
    setEditing(null);
    setError("");
  };
  // Focus goes back to the row's Edit button once the editor is gone.
  useEffect(() => {
    if (editing || !back.current) return;
    editBtns.current.get(back.current)?.focus();
    back.current = null;
  }, [editing]);
  const save = async (e: FormEvent, g: Goal) => {
    e.preventDefault();
    const n = Number(draft.replace(/[^\d.-]/g, ""));
    if (!draft.trim() || !Number.isFinite(n) || n <= 0) {
      setError(L.invalid);
      field.current?.focus();
      return;
    }
    const key = `${period!.id}:${g.id}`;
    const old = g.target;
    setTargets((t) => ({ ...t, [key]: n }));
    stopEdit(g.id);
    setSaid(L.saved.replace("{goal}", g.label).replace("{n}", fmtOf(g)(n)));
    if (!onTargetChange) return;
    setBusy(true);
    try {
      await onTargetChange(period!.id, g.id, n);
    } catch {
      setTargets((t) => ({ ...t, [key]: old }));
      setSaid(L.failed.replace("{goal}", g.label).replace("{n}", fmtOf(g)(old)));
    } finally {
      setBusy(false);
    }
  };
  const onFieldKey = (g: Goal) => (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      stopEdit(g.id);
    }
  };
  const choosePeriod = (id: string) => {
    setPeriodId(id);
    setEditing(null);
    setSaid("");
    onPeriodChange?.(id);
  };

  return (
    <section ref={box} className={["fl-gol", className ?? ""].filter(Boolean).join(" ")} data-fl="p.goal-targets" aria-labelledby={`${uid}-t`} aria-busy={loading || busy || undefined}>
      <div className="fl-gol-top">
        <div className="fl-gol-titles">
          <h3 id={`${uid}-t`} className="fl-gol-title">
            {title}
          </h3>
          {!loading && !empty ? (
            <p className="fl-gol-meta">
              <strong>{L.summary.replace("{n}", String(good)).replace("{total}", String(goals.length))}</strong>
              {period?.note ? <span>{period.note}</span> : null}
            </p>
          ) : null}
        </div>
        {periods.length > 1 ? (
          <Segmented variant="toggle" size="sm" label={L.period} options={periods.map((p) => ({ value: p.id, label: p.label }))} value={period?.id ?? ""} onChange={choosePeriod} />
        ) : null}
      </div>

      {loading ? (
        <div className="fl-gol-list" aria-hidden="true">
          {[0, 1, 2].map((k) => (
            <span key={k} className="fl-gol-ghost" />
          ))}
        </div>
      ) : empty ? (
        <p className="fl-gol-empty">{L.empty}</p>
      ) : (
        <ul className="fl-gol-list">
          {goals.map((g, k) => {
            const fmt = fmtOf(g);
            const st = statusOf(g);
            const ratio = g.target > 0 ? g.value / g.target : 0;
            const projected = g.value / elapsed;
            const isEditing = editing === g.id;
            return (
              <li key={g.id} className={`fl-gol-item${draw ? " is-in" : ""}`} style={{ ["--i" as string]: k }}>
                <div className="fl-gol-head">
                  <span className="fl-gol-name">{g.label}</span>
                  <Badge tone={TONE[st]} led>
                    {statusText[st]}
                  </Badge>
                  <span className="fl-gol-fig">
                    <strong aria-hidden="true">
                      <Count value={g.value} run={draw} fmt={fmtOf(g, false)} />
                    </strong>
                    <span aria-hidden="true"> of {fmt(g.target)}</span>
                  </span>
                </div>
                <div
                  className="fl-gol-track"
                  role="meter"
                  aria-label={g.label}
                  aria-valuemin={0}
                  aria-valuemax={Math.max(g.target, g.value)}
                  aria-valuenow={g.value}
                  aria-valuetext={`${fmt(g.value)} of ${fmt(g.target)}, ${pf.format(ratio)}. ${statusText[st]}.`}
                >
                  <span className={`fl-gol-fill fl-gol-fill--${st}`} style={{ width: `${draw ? Math.min(1, ratio) * 100 : 0}%` }} />
                  {elapsed < 1 ? <span className="fl-gol-pace" style={{ left: `${elapsed * 100}%` }} title={L.pace} /> : null}
                </div>
                {isEditing ? (
                  <form className="fl-gol-edit" onSubmit={(e) => void save(e, g)} noValidate>
                    <label htmlFor={`${uid}-${g.id}`} className="fl-gol-label">
                      {L.target}
                    </label>
                    <input
                      ref={field}
                      id={`${uid}-${g.id}`}
                      className="fl-gol-input"
                      inputMode="decimal"
                      value={draft}
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? `${uid}-${g.id}-err` : undefined}
                      onChange={(e) => (setDraft(e.target.value), setError(""))}
                      onKeyDown={onFieldKey(g)}
                    />
                    <Button type="submit" variant="primary" size={32}>
                      {L.save}
                    </Button>
                    <Button variant="tertiary" size={32} onClick={() => stopEdit(g.id)}>
                      {L.cancel}
                    </Button>
                    {error ? (
                      <p id={`${uid}-${g.id}-err`} className="fl-gol-error">
                        {error}
                      </p>
                    ) : null}
                  </form>
                ) : (
                  <div className="fl-gol-foot">
                    <span className="fl-gol-proj">
                      {st === "done" ? `${pf.format(ratio)} · ${L.done}` : L.projected.replace("{n}", fmt(projected)).replace("{p}", pf.format(ratio))}
                    </span>
                    <Button
                      ref={(el) => {
                        if (el) editBtns.current.set(g.id, el as HTMLButtonElement);
                      }}
                      variant="tertiary"
                      size={32}
                      icon="pencil"
                      aria-label={`${L.edit}: ${g.label}`}
                      onClick={() => startEdit(g)}
                    >
                      {L.edit}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="fl-gol-said" role="status">
        {loading ? L.loading : said}
      </p>
    </section>
  );
}

// ── The reference sheet: a small online shop's targets. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Targets",
  title: "Are we on track?",
  lede: "The upright mark is where each goal should be by today.",
  cardTitle: "Shop targets",
  periods: [
    {
      id: "month",
      label: "Month",
      elapsed: 21 / 31,
      note: "Day 21 of 31",
      goals: [
        { id: "revenue", label: "Revenue", value: 48200, target: 60000, format: "money" as const },
        { id: "orders", label: "Orders", value: 612, target: 1000, format: "count" as const, unit: "orders" },
        { id: "subs", label: "New subscribers", value: 1840, target: 2000, format: "count" as const },
        { id: "rating", label: "Reviews answered", value: 100, target: 95, format: "percent" as const },
      ],
    },
    {
      id: "quarter",
      label: "Quarter",
      elapsed: 21 / 92,
      note: "Week 3 of 13",
      goals: [] as Goal[],
    },
  ],
};

export default function GoalTargetsPreview() {
  const d = SAMPLE;
  const [loading, setLoading] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="goal-targets-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="goal-targets-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <GoalTargets
          title={d.cardTitle}
          periods={d.periods}
          loading={loading}
          onPeriodChange={() => {
            // A new period fetches in a real app: show the gray rows for a moment.
            setLoading(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setLoading(false), 650);
          }}
          onTargetChange={() => new Promise<void>((done) => window.setTimeout(done, 300))}
        />
      </div>
    </section>
  );
}
