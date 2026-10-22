/** @flowcode-library workout-logger · Workout logger (Forms)
 * Catalog ID: b.workout-logger (block)
 * Function: A strength workout in progress (b.workout-logger): exercises with their sets (weight × reps), each set ticked when done, a rest timer that starts on each tick, personal-best flags when a set beats the exercise's best, exercises added from a list, moved up and down, folded away or removed after a confirm, sets added and removed, and Finish with a check for unticked sets, a saving state, an error with Retry and a summary of time, volume, sets and new bests.
 * Use it as: import { WorkoutLogger } from "./workout-logger"; <WorkoutLogger title="Push day" unit?="kg"|"lb" startedAt?={Date.now()} restSeconds?={90} exercises={[{ id, name, muscle?, best?: { weight: 80, reps: 5 }, sets: [{ id, weight: 60, reps: 8, done: false, prev?: { weight: 60, reps: 8 } }] }]} choices?={[{ name, muscle?, best? }]} loading? onFinish?={async (summary, exercises) => void} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.select.outlined, c.progress.ring, c.modal.danger, c.modal.confirm, c.collapsible, c.empty-state
 * Look: A white card: the title with a running clock and a Finish button; three sunken tiles (volume, sets done, new bests) whose numbers count up; then one block per exercise with its name, muscle and best, a fold chevron, move up, move down and remove; inside, a table of sets (set number, last time, weight and reps fields, a round tick that fills green and pops, a small remove) where a set that beats the best gets a star "PB" pill; Add set under the table. While resting, a sunken rest bar opens under the exercise just ticked: a draining ring with the time left, minus and plus 15 seconds and Skip. An Add exercise select with a button sits below the list. Finish turns the card into a summary with a big tick.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-sans --weight-medium --weight-semibold --weight-bold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger --press-scale
 * Use cases: gym workout log; strength training app; personal training client app; home workout tracker; fitness coaching; physio exercise log
 * Jobs to be done: log each set as I do it; know when my rest is over; see when I beat my best; add an exercise I hadn't planned; finish and see what I did
 * Keywords: workout, gym, sets, reps, weight, rest timer, personal best, PB, strength, training log, exercise, fitness
 */
/**
 * Workout logger: weights are in `unit` (kg or lb). A set is ticked with its round button; it needs reps (1 or more) and
 * a weight (0 for bodyweight). Ticking a set starts the rest timer (restSeconds), which can be shortened, lengthened or
 * skipped and says "Rest over" when it ends. A set is a personal best when its estimated one-rep max (weight × (1 +
 * reps / 30)) beats the exercise's `best`; only the strongest set of an exercise carries the flag.
 * Each exercise's set table keeps its row actions (tick and remove) as one Tab stop: Up and Down move between sets, Left
 * and Right between tick and remove. Removing a set asks once in place (the button turns into "Remove?"); removing an
 * exercise asks in a dialog. Finish asks first when sets are left unticked (they are left out of the summary).
 * Rows glide when exercises move, are added or removed; ticks pop; numbers count up; the rest ring drains; folding uses
 * grid rows and the folded part is inert. Everything works and shows with motion off.
 * Adapted from HyperUI (MIT, Copyright (c) Mark Mead): its tables, quantity inputs and progress bars, reshaped into a
 * set-by-set workout log.
 */
/**
 * How to try it
 * - Type a weight and reps in Bench press set 3 and press its tick: the rest bar slides up and the ring drains.
 * - Put 85 × 5 in a Bench press set and tick it: a PB star pops on that row and New bests counts up.
 * - Tab into a set table's tick buttons and move with the arrow keys; press × twice to remove a set.
 * - Pick "Dips" under Add exercise and add it; move it up; fold Overhead press away.
 * - Press Finish with sets unticked: it asks first. The first save fails in this preview; press Retry.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Button
 * ("./buttons-variants"), Icon ("./icons"), Modal ("./modals-dialogs") and TextField ("./text-fields-states"). Nothing
 * else: nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r6a-workout-logger.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";
import { TextField } from "./text-fields-states";

// ── b.workout-logger: a strength workout logged set by set, with a rest timer and personal bests. ──

export type WorkoutSet = { id: string; weight: number | ""; reps: number | ""; done: boolean; prev?: { weight: number; reps: number } };
export type WorkoutExercise = { id: string; name: string; muscle?: string; best?: { weight: number; reps: number }; sets: WorkoutSet[] };
export type WorkoutChoice = { name: string; muscle?: string; best?: { weight: number; reps: number } };
export type WorkoutSummary = { minutes: number; volume: number; sets: number; bests: { exercise: string; weight: number; reps: number }[] };
export type WorkoutLoggerProps = {
  title: string;
  unit?: "kg" | "lb";
  /** When the workout began (ms since 1970); the clock counts from here. */
  startedAt?: number;
  restSeconds?: number;
  exercises: WorkoutExercise[];
  /** Exercises that can be added. */
  choices?: WorkoutChoice[];
  loading?: boolean;
  onFinish?: (summary: WorkoutSummary, exercises: WorkoutExercise[]) => Promise<void>;
  className?: string;
};

const quick = async () => undefined;
const motionOff = () => typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
const tokenMs = (name: string, fallback: number) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n;
};
const oneRep = (w: number, r: number) => w * (1 + r / 30);
const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
let seq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq += 1)}`;

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

function Count({ value, format = (n: number) => num.format(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="fl-sr">{format(value)}</span>
    </>
  );
}

/** FLIP: children marked data-flip glide from where they were to where they are whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const now = new Map<string, number>();
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(":scope > [data-flip]"));
    for (const n of nodes) now.set(n.dataset.flip!, n.getBoundingClientRect().top - top);
    if (!motionOff()) {
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        const dy = was === undefined ? 0 : was - now.get(n.dataset.flip!)!;
        if (dy) n.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    last.current = now;
  }, [key, box]);
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

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

/** The set that is this exercise's new personal best, if any. */
function bestSetId(ex: WorkoutExercise) {
  // With no best on record there is nothing to beat yet.
  if (!ex.best) return null;
  let top = oneRep(ex.best.weight, ex.best.reps);
  let id: string | null = null;
  for (const s of ex.sets) {
    if (!s.done || s.weight === "" || s.reps === "") continue;
    const v = oneRep(s.weight, s.reps);
    if (v > top + 1e-9) {
      top = v;
      id = s.id;
    }
  }
  return id;
}

type Phase = "log" | "saving" | "done";

export function WorkoutLogger({ title, unit = "kg", startedAt, restSeconds = 90, exercises: given, choices = [], loading = false, onFinish = quick, className }: WorkoutLoggerProps) {
  const uid = useId().replace(/:/g, "");
  const focusLater = useFocusLater();
  const begin = useMemo(() => startedAt ?? Date.now(), [startedAt]);
  const [list, setList] = useState(given);
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<{ end: number; total: number; exId: string } | null>(null);
  const [rove, setRove] = useState<Record<string, { r: number; c: number }>>({});
  const [arming, setArming] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [pick, setPick] = useState("");
  const [pickErr, setPickErr] = useState("");
  const [askRemove, setAskRemove] = useState<string | null>(null);
  const [askFinish, setAskFinish] = useState(false);
  const [finishErr, setFinishErr] = useState("");
  const [phase, setPhase] = useState<Phase>("log");
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [said, setSaid] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useFlip(listRef, list.map((e) => e.id).join("|"));

  // One clock for the workout time and the rest countdown.
  useEffect(() => {
    if (phase === "done") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [phase]);
  const restLeft = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && restLeft === 0) {
      setRest(null);
      setSaid("Rest over. Time for your next set.");
    }
  }, [rest, restLeft]);

  const done = list.flatMap((e) => e.sets.filter((s) => s.done && s.weight !== "" && s.reps !== ""));
  const volume = done.reduce((t, s) => t + Number(s.weight) * Number(s.reps), 0);
  const totalSets = list.reduce((t, e) => t + e.sets.length, 0);
  const bestIds = useMemo(() => new Map(list.map((e) => [e.id, bestSetId(e)])), [list]);
  const newBests = [...bestIds.values()].filter(Boolean).length;
  const elapsed = Math.max(0, Math.floor((now - begin) / 1000));
  const available = choices.filter((c) => !list.some((e) => e.name.toLowerCase() === c.name.toLowerCase()));

  const patchSet = (exId: string, setId: string, patch: Partial<WorkoutSet>) =>
    setList((all) => all.map((e) => (e.id === exId ? { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) } : e)));

  const actId = (exId: string, r: number, c: number) => `${uid}-${exId}-a${r}-${c}`;

  const tick = (ex: WorkoutExercise, s: WorkoutSet, row: number) => {
    setRove((m) => ({ ...m, [ex.id]: { r: row, c: 0 } }));
    setArming(null);
    if (s.done) {
      patchSet(ex.id, s.id, { done: false });
      setSaid(`${ex.name} set ${row + 1} not done.`);
      return;
    }
    const err = s.reps === "" || s.reps < 1 ? "Enter reps." : s.weight === "" || s.weight < 0 ? `Enter a weight (0 for bodyweight).` : "";
    if (err) {
      setRowErr((m) => ({ ...m, [s.id]: err }));
      setSaid(`${ex.name} set ${row + 1}: ${err}`);
      document.getElementById(`${uid}-${s.id}-${s.reps === "" || s.reps < 1 ? (s.weight === "" ? "w" : "r") : "w"}`)?.focus();
      return;
    }
    setRowErr((m) => ({ ...m, [s.id]: "" }));
    const next = { ...ex, sets: ex.sets.map((x) => (x.id === s.id ? { ...x, done: true } : x)) };
    patchSet(ex.id, s.id, { done: true });
    const pb = bestSetId(next) === s.id && bestIds.get(ex.id) !== s.id;
    setRest({ end: Date.now() + restSeconds * 1000, total: restSeconds, exId: ex.id });
    setSaid(`${ex.name} set ${row + 1} done: ${num.format(Number(s.weight))} ${unit} × ${s.reps}.${pb ? " New personal best!" : ""} Rest ${clock(restSeconds)}.`);
  };

  const addSet = (ex: WorkoutExercise) => {
    const last = ex.sets[ex.sets.length - 1];
    const set: WorkoutSet = { id: newId("s"), weight: last?.weight ?? "", reps: last?.reps ?? "", done: false };
    setList((all) => all.map((e) => (e.id === ex.id ? { ...e, sets: [...e.sets, set] } : e)));
    setSaid(`Set ${ex.sets.length + 1} added to ${ex.name}.`);
    focusLater(() => document.getElementById(`${uid}-${set.id}-w`));
  };

  const removeSet = (ex: WorkoutExercise, s: WorkoutSet, row: number) => {
    const key = `${ex.id}:${s.id}`;
    if (arming !== key) {
      setArming(key);
      setSaid(`Press again to remove set ${row + 1}.`);
      return;
    }
    setArming(null);
    setList((all) => all.map((e) => (e.id === ex.id ? { ...e, sets: e.sets.filter((x) => x.id !== s.id) } : e)));
    setSaid(`${ex.name} set ${row + 1} removed.`);
    const left = ex.sets.length - 1;
    if (left > 0) {
      const r = Math.min(row, left - 1);
      setRove((m) => ({ ...m, [ex.id]: { r, c: 1 } }));
      focusLater(() => document.getElementById(actId(ex.id, r, 1)));
    } else focusLater(() => document.getElementById(`${uid}-${ex.id}-add`));
  };

  const onActKey = (ex: WorkoutExercise, e: ReactKeyboardEvent<HTMLElement>) => {
    const t = e.target as HTMLElement;
    if (!t.dataset.act) return;
    if (e.key === "Escape" && arming) {
      setArming(null);
      setSaid("Kept.");
      return;
    }
    const [r0, c0] = t.dataset.act.split(":").map(Number) as [number, number];
    let r = r0;
    let c = c0;
    if (e.key === "ArrowDown") r = Math.min(ex.sets.length - 1, r + 1);
    else if (e.key === "ArrowUp") r = Math.max(0, r - 1);
    else if (e.key === "ArrowRight") c = 1;
    else if (e.key === "ArrowLeft") c = 0;
    else if (e.key === "Home") r = 0;
    else if (e.key === "End") r = ex.sets.length - 1;
    else return;
    e.preventDefault();
    setArming(null);
    setRove((m) => ({ ...m, [ex.id]: { r, c } }));
    document.getElementById(actId(ex.id, r, c))?.focus();
  };

  const move = (ex: WorkoutExercise, by: -1 | 1) => {
    const i = list.findIndex((e) => e.id === ex.id);
    const j = i + by;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setList(next);
    setSaid(`${ex.name} moved to ${j + 1} of ${list.length}.`);
    const edge = (by < 0 && j === 0) || (by > 0 && j === list.length - 1);
    focusLater(() => document.getElementById(`${uid}-${ex.id}-${edge ? (by < 0 ? "down" : "up") : by < 0 ? "up" : "down"}`));
  };

  const toggleFold = (ex: WorkoutExercise) => {
    setFolded((f) => {
      const n = new Set(f);
      if (n.has(ex.id)) n.delete(ex.id);
      else n.add(ex.id);
      return n;
    });
  };

  const addExercise = () => {
    const c = available.find((x) => x.name === pick);
    if (!c) {
      setPickErr("Pick an exercise to add.");
      document.getElementById(`${uid}-pick`)?.focus();
      return;
    }
    const ex: WorkoutExercise = { id: newId("e"), name: c.name, muscle: c.muscle, best: c.best, sets: [{ id: newId("s"), weight: "", reps: "", done: false }] };
    setList((all) => [...all, ex]);
    setPick("");
    setPickErr("");
    setSaid(`${c.name} added with one set.`);
    focusLater(() => document.getElementById(`${uid}-${ex.sets[0]!.id}-w`));
  };

  const removing = askRemove ? list.find((e) => e.id === askRemove) : undefined;
  const doRemove = () => {
    if (!removing) return;
    const i = list.findIndex((e) => e.id === removing.id);
    const rest2 = list.filter((e) => e.id !== removing.id);
    setList(rest2);
    setAskRemove(null);
    setSaid(`${removing.name} removed.`);
    const next = rest2[Math.min(i, rest2.length - 1)];
    focusLater(() => (next ? document.getElementById(`${uid}-${next.id}-fold`) : document.getElementById(`${uid}-pick`)));
  };

  const undone = list.reduce((t, e) => t + e.sets.filter((s) => !s.done).length, 0);
  const startFinish = () => {
    setFinishErr("");
    if (!done.length) {
      setFinishErr("Tick at least one set before you finish.");
      setSaid("Tick at least one set before you finish.");
      return;
    }
    if (undone) setAskFinish(true);
    else void save();
  };
  const save = async () => {
    setAskFinish(false);
    setPhase("saving");
    setFinishErr("");
    const s: WorkoutSummary = {
      minutes: Math.max(1, Math.round(elapsed / 60)),
      volume,
      sets: done.length,
      bests: list.flatMap((e) => {
        const id = bestIds.get(e.id);
        const set = e.sets.find((x) => x.id === id);
        return set ? [{ exercise: e.name, weight: Number(set.weight), reps: Number(set.reps) }] : [];
      }),
    };
    try {
      await onFinish(s, list.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })));
      setRest(null);
      setSummary(s);
      setPhase("done");
      setSaid(`Workout saved. ${s.sets} sets in ${s.minutes} minutes.`);
      focusLater(() => document.getElementById(`${uid}-again`));
    } catch {
      setPhase("log");
      setFinishErr("Couldn't save the workout. Check your connection and try again.");
      setSaid("Couldn't save the workout.");
      focusLater(() => document.getElementById(`${uid}-retry`));
    }
  };

  const again = () => {
    setList((all) => all.map((e) => ({ ...e, sets: e.sets.map((s) => ({ id: newId("s"), weight: "" as const, reps: "" as const, done: false, prev: s.done && s.weight !== "" && s.reps !== "" ? { weight: Number(s.weight), reps: Number(s.reps) } : s.prev })) })));
    setSummary(null);
    setPhase("log");
    setSaid("New workout started.");
    focusLater(() => document.getElementById(`${uid}-finish`));
  };

  return (
    <section className={["fl-wkl", className ?? ""].filter(Boolean).join(" ")} data-fl="b.workout-logger" aria-labelledby={`${uid}-t`} aria-busy={loading || phase === "saving" || undefined}>
      <header className="fl-wkl-head">
        <div className="fl-wkl-titles">
          <h3 id={`${uid}-t`} className="fl-wkl-title">
            {title}
          </h3>
          {!loading && phase !== "done" ? (
            <span className="fl-wkl-clock">
              <Icon name="clock" />
              <span role="timer" aria-label={`Workout time ${Math.floor(elapsed / 60)} minutes`}>
                {clock(elapsed)}
              </span>
            </span>
          ) : null}
        </div>
        {phase !== "done" ? (
          <Button id={`${uid}-finish`} variant="primary" size={40} icon="check" busy={phase === "saving"} disabled={loading} onClick={startFinish}>
            {phase === "saving" ? "Saving…" : "Finish"}
          </Button>
        ) : null}
      </header>

      {loading ? (
        <div className="fl-wkl-ghosts" aria-hidden="true">
          <span className="fl-wkl-ghost fl-wkl-ghost--strip" />
          {[0, 1].map((k) => (
            <span key={k} className="fl-wkl-ghost" />
          ))}
        </div>
      ) : phase === "done" && summary ? (
        <div className="fl-wkl-done">
          <span className="fl-wkl-done-tick" aria-hidden="true">
            <Icon name="check" />
          </span>
          <h4>Workout saved</h4>
          <dl className="fl-wkl-stats">
            <div style={{ ["--i" as string]: 0 }}>
              <dt>Time</dt>
              <dd>
                <Count value={summary.minutes} /> min
              </dd>
            </div>
            <div style={{ ["--i" as string]: 1 }}>
              <dt>Volume</dt>
              <dd>
                <Count value={summary.volume} /> {unit}
              </dd>
            </div>
            <div style={{ ["--i" as string]: 2 }}>
              <dt>Sets</dt>
              <dd>
                <Count value={summary.sets} />
              </dd>
            </div>
          </dl>
          {summary.bests.length ? (
            <ul className="fl-wkl-bests" aria-label="New personal bests">
              {summary.bests.map((b, i) => (
                <li key={b.exercise} style={{ ["--i" as string]: i }}>
                  <Icon name="star" filled />
                  <span>
                    <strong>{b.exercise}</strong> {num.format(b.weight)} {unit} × {b.reps}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-wkl-muted">No new bests this time. Consistency counts.</p>
          )}
          <Button id={`${uid}-again`} variant="secondary" size={40} icon="refresh" onClick={again}>
            Start another
          </Button>
        </div>
      ) : (
        <>
          <dl className="fl-wkl-stats">
            <div style={{ ["--i" as string]: 0 }}>
              <dt>Volume</dt>
              <dd>
                <Count value={volume} /> {unit}
              </dd>
            </div>
            <div style={{ ["--i" as string]: 1 }}>
              <dt>Sets done</dt>
              <dd>
                <Count value={done.length} /> <span className="fl-wkl-of">of {totalSets}</span>
              </dd>
            </div>
            <div style={{ ["--i" as string]: 2 }} className={newBests ? "is-pb" : undefined}>
              <dt>New bests</dt>
              <dd>
                {newBests ? <Icon name="star" filled /> : null}
                <Count value={newBests} />
              </dd>
            </div>
          </dl>

          {finishErr ? (
            <div className="fl-wkl-alert" role="alert">
              <Icon name="alert" />
              <span>{finishErr}</span>
              {finishErr.startsWith("Couldn't") ? (
                <Button id={`${uid}-retry`} variant="secondary" size={32} icon="refresh" onClick={() => void save()}>
                  Retry
                </Button>
              ) : null}
            </div>
          ) : null}

          {!list.length ? (
            <div className="fl-wkl-empty" data-fl="c.empty-state">
              <Icon name="bolt" />
              <strong>No exercises yet</strong>
              <p>Add the first exercise of today's workout below.</p>
            </div>
          ) : null}

          <div className="fl-wkl-list" ref={listRef}>
            {list.map((ex, ei) => {
              const open = !folded.has(ex.id);
              const pbId = bestIds.get(ex.id);
              const doneN = ex.sets.filter((s) => s.done).length;
              const rv = rove[ex.id] ?? { r: 0, c: 0 };
              const rr = Math.min(rv.r, Math.max(0, ex.sets.length - 1));
              const resting = !!rest && rest.exId === ex.id;
              return (
                <article key={ex.id} data-flip={ex.id} className={`fl-wkl-ex${open ? " is-open" : ""}`} aria-labelledby={`${uid}-${ex.id}-n`} style={{ ["--i" as string]: Math.min(ei, 6) }}>
                  <div className="fl-wkl-exhead">
                    <button type="button" id={`${uid}-${ex.id}-fold`} className="fl-wkl-fold" aria-expanded={open} aria-controls={`${uid}-${ex.id}-body`} onClick={() => toggleFold(ex)}>
                      <Icon name="chevron-down" />
                      <span id={`${uid}-${ex.id}-n`} className="fl-wkl-exname">
                        {ex.name}
                      </span>
                      <span className="fl-wkl-exmeta">
                        {ex.muscle ? <span>{ex.muscle}</span> : null}
                        <span>
                          {doneN}/{ex.sets.length} sets
                        </span>
                        {ex.best ? (
                          <span>
                            Best {num.format(ex.best.weight)} {unit} × {ex.best.reps}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <div className="fl-wkl-extools">
                      <Button id={`${uid}-${ex.id}-up`} className="fl-wkl-up" variant="tertiary" size={32} icon="chevron-down" iconOnly disabled={ei === 0} onClick={() => move(ex, -1)} aria-label={`Move ${ex.name} up`}>
                        Move up
                      </Button>
                      <Button id={`${uid}-${ex.id}-down`} variant="tertiary" size={32} icon="chevron-down" iconOnly disabled={ei === list.length - 1} onClick={() => move(ex, 1)} aria-label={`Move ${ex.name} down`}>
                        Move down
                      </Button>
                      <Button variant="tertiary" size={32} icon="trash" iconOnly onClick={() => setAskRemove(ex.id)} aria-label={`Remove ${ex.name}`}>
                        Remove exercise
                      </Button>
                    </div>
                  </div>
                  <div id={`${uid}-${ex.id}-body`} className="fl-wkl-body" inert={!open}>
                    <div>
                      {ex.sets.length ? (
                        <table className="fl-wkl-sets" onKeyDown={(e) => onActKey(ex, e)}>
                          <caption className="fl-sr">
                            {ex.name} sets. Arrow keys move between the tick and remove buttons.
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Set</th>
                              <th scope="col" className="fl-wkl-prevh">
                                Last time
                              </th>
                              <th scope="col">{unit}</th>
                              <th scope="col">Reps</th>
                              <th scope="col">
                                <span className="fl-sr">Done and remove</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ex.sets.map((s, row) => {
                              const isPb = pbId === s.id;
                              const err = rowErr[s.id];
                              const armed = arming === `${ex.id}:${s.id}`;
                              return (
                                <tr key={s.id} className={`fl-wkl-set${s.done ? " is-done" : ""}${isPb ? " is-pb" : ""}`}>
                                  <th scope="row">
                                    <span className="fl-wkl-setno">{row + 1}</span>
                                    {isPb ? (
                                      <span className="fl-wkl-pb">
                                        <Icon name="star" filled />
                                        PB
                                      </span>
                                    ) : null}
                                  </th>
                                  <td className="fl-wkl-prev">{s.prev ? `${num.format(s.prev.weight)} × ${s.prev.reps}` : "–"}</td>
                                  <td>
                                    <TextField
                                      id={`${uid}-${s.id}-w`}
                                      size={32}
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      step={0.5}
                                      className="fl-wkl-num"
                                      aria-label={`${ex.name} set ${row + 1} weight in ${unit}`}
                                      placeholder={s.prev ? String(s.prev.weight) : "0"}
                                      value={s.weight}
                                      readOnly={s.done}
                                      onFocus={() => setRove((m) => ({ ...m, [ex.id]: { r: row, c: 0 } }))}
                                      invalid={!!err && (s.weight === "" || Number(s.weight) < 0)}
                                      aria-describedby={err ? `${uid}-${s.id}-err` : undefined}
                                      onChange={(e) => {
                                        patchSet(ex.id, s.id, { weight: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) });
                                        setRowErr((m) => ({ ...m, [s.id]: "" }));
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <TextField
                                      id={`${uid}-${s.id}-r`}
                                      size={32}
                                      type="number"
                                      inputMode="numeric"
                                      min={1}
                                      step={1}
                                      className="fl-wkl-num"
                                      aria-label={`${ex.name} set ${row + 1} reps`}
                                      placeholder={s.prev ? String(s.prev.reps) : "0"}
                                      value={s.reps}
                                      readOnly={s.done}
                                      onFocus={() => setRove((m) => ({ ...m, [ex.id]: { r: row, c: 0 } }))}
                                      invalid={!!err && (s.reps === "" || Number(s.reps) < 1)}
                                      aria-describedby={err ? `${uid}-${s.id}-err` : undefined}
                                      onChange={(e) => {
                                        patchSet(ex.id, s.id, { reps: e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value))) });
                                        setRowErr((m) => ({ ...m, [s.id]: "" }));
                                      }}
                                    />
                                    {err ? (
                                      <span id={`${uid}-${s.id}-err`} className="fl-wkl-err">
                                        {err}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="fl-wkl-acts">
                                    <button
                                      type="button"
                                      id={actId(ex.id, row, 0)}
                                      data-act={`${row}:0`}
                                      tabIndex={rr === row && rv.c === 0 ? 0 : -1}
                                      className="fl-wkl-tick"
                                      aria-pressed={s.done}
                                      aria-label={`Set ${row + 1} done`}
                                      onFocus={() => setRove((m) => ({ ...m, [ex.id]: { r: row, c: 0 } }))}
                                      onClick={() => tick(ex, s, row)}
                                    >
                                      <Icon name="check" />
                                    </button>
                                    <button
                                      type="button"
                                      id={actId(ex.id, row, 1)}
                                      data-act={`${row}:1`}
                                      tabIndex={rr === row && rv.c === 1 ? 0 : -1}
                                      className={`fl-wkl-x${armed ? " is-armed" : ""}`}
                                      aria-label={armed ? `Confirm: remove set ${row + 1}` : `Remove set ${row + 1}`}
                                      onFocus={() => setRove((m) => ({ ...m, [ex.id]: { r: row, c: 1 } }))}
                                      onBlur={() => armed && setArming(null)}
                                      onClick={() => removeSet(ex, s, row)}
                                    >
                                      {armed ? <span>Remove?</span> : <Icon name="close" />}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <p className="fl-wkl-muted">No sets. Add one to start.</p>
                      )}
                      <Button id={`${uid}-${ex.id}-add`} variant="tertiary" size={32} icon="plus" className="fl-wkl-addset" onClick={() => addSet(ex)}>
                        Add set
                      </Button>
                      <div className={`fl-wkl-rest${resting ? " is-on" : ""}`} inert={!resting} aria-hidden={!resting || undefined}>
                        <div>
                          <svg viewBox="0 0 36 36" aria-hidden="true" className="fl-wkl-ring">
                            <circle className="fl-wkl-ring-bg" cx="18" cy="18" r="15" pathLength={100} />
                            <circle className="fl-wkl-ring-fg" cx="18" cy="18" r="15" pathLength={100} style={{ strokeDashoffset: rest ? 100 - (restLeft / rest.total) * 100 : 100 }} />
                          </svg>
                          <p>
                            <span className="fl-wkl-rest-label">Rest</span>
                            <strong role="timer" aria-label={`Rest, ${restLeft} seconds left`}>
                              {clock(restLeft)}
                            </strong>
                          </p>
                          <div className="fl-wkl-rest-tools">
                            <Button variant="tertiary" size={32} onClick={() => rest && setRest({ ...rest, end: Math.max(Date.now() + 1000, rest.end - 15000) })} aria-label="15 seconds less rest">
                              −15s
                            </Button>
                            <Button variant="tertiary" size={32} onClick={() => rest && setRest({ ...rest, end: rest.end + 15000, total: rest.total + 15 })} aria-label="15 seconds more rest">
                              +15s
                            </Button>
                            <Button
                              variant="secondary"
                              size={32}
                              onClick={() => {
                                setRest(null);
                                setSaid("Rest skipped.");
                                focusLater(() => document.getElementById(`${uid}-${ex.id}-add`));
                              }}
                            >
                              Skip
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="fl-wkl-addex">
            <label htmlFor={`${uid}-pick`}>Add exercise</label>
            <div className="fl-wkl-addrow">
              <span className="fl-wkl-select">
                <select
                  id={`${uid}-pick`}
                  value={pick}
                  aria-invalid={!!pickErr || undefined}
                  aria-describedby={pickErr ? `${uid}-pick-err` : undefined}
                  disabled={!available.length}
                  onChange={(e) => {
                    setPick(e.target.value);
                    setPickErr("");
                  }}
                >
                  <option value="">{available.length ? "Choose an exercise" : "Every exercise is added"}</option>
                  {available.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                      {c.muscle ? ` · ${c.muscle}` : ""}
                    </option>
                  ))}
                </select>
              </span>
              <Button variant="secondary" size={40} icon="plus" disabled={!available.length} onClick={addExercise}>
                Add
              </Button>
            </div>
            {pickErr ? (
              <p id={`${uid}-pick-err`} className="fl-wkl-err">
                {pickErr}
              </p>
            ) : null}
          </div>

        </>
      )}

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Remove ${removing.name}?`}
          description={`Its ${removing.sets.length} ${removing.sets.length === 1 ? "set goes" : "sets go"} with it.`}
          confirmLabel="Remove"
          cancelLabel="Keep"
          onConfirm={() => {
            doRemove();
            return false;
          }}
          onClose={() => setAskRemove(null)}
        />
      ) : null}
      {askFinish ? (
        <Modal
          variant="confirm"
          title={`Finish with ${undone} ${undone === 1 ? "set" : "sets"} not done?`}
          description="Sets you didn't tick are left out of the summary."
          confirmLabel="Finish workout"
          cancelLabel="Keep going"
          onConfirm={() => {
            void save();
            return false;
          }}
          onClose={() => setAskFinish(false)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {loading ? "Loading workout…" : said}
      </p>
    </section>
  );
}

// ── The reference sheet: a push day half done, with last week's numbers. ──

// flowcode:sample
const SAMPLE: WorkoutLoggerProps = {
  title: "Push day",
  unit: "kg",
  startedAt: Date.now() - 23 * 60 * 1000 - 41 * 1000,
  restSeconds: 90,
  exercises: [
    {
      id: "bench",
      name: "Bench press",
      muscle: "Chest",
      best: { weight: 82.5, reps: 5 },
      sets: [
        { id: "b1", weight: 60, reps: 10, done: true, prev: { weight: 60, reps: 10 } },
        { id: "b2", weight: 77.5, reps: 6, done: true, prev: { weight: 75, reps: 6 } },
        { id: "b3", weight: "", reps: "", done: false, prev: { weight: 80, reps: 5 } },
      ],
    },
    {
      id: "ohp",
      name: "Overhead press",
      muscle: "Shoulders",
      best: { weight: 50, reps: 5 },
      sets: [
        { id: "o1", weight: 40, reps: 8, done: false, prev: { weight: 40, reps: 8 } },
        { id: "o2", weight: 40, reps: 8, done: false, prev: { weight: 40, reps: 7 } },
      ],
    },
    {
      id: "incline",
      name: "Incline dumbbell press",
      muscle: "Upper chest",
      best: { weight: 28, reps: 8 },
      sets: [
        { id: "i1", weight: "", reps: "", done: false, prev: { weight: 26, reps: 10 } },
        { id: "i2", weight: "", reps: "", done: false, prev: { weight: 26, reps: 9 } },
      ],
    },
  ],
  choices: [
    { name: "Dips", muscle: "Triceps", best: { weight: 10, reps: 8 } },
    { name: "Cable fly", muscle: "Chest" },
    { name: "Lateral raise", muscle: "Shoulders", best: { weight: 12, reps: 12 } },
    { name: "Triceps pushdown", muscle: "Triceps" },
    { name: "Push-up", muscle: "Chest" },
  ],
};

export default function WorkoutLoggerPreview() {
  const [loading, setLoading] = useState(true);
  const tries = useRef(0);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <section className="fl-section fl-section--canvas" aria-label="Workout logger">
      <div className="fl-wrap">
        <WorkoutLogger
          {...SAMPLE}
          loading={loading}
          onFinish={() =>
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
