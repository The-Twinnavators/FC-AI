/** @flowcode-library product-tour · Product tour (Dialogs and drawers)
 * Catalog ID: p.product-tour (pattern)
 * Function: Product tour (p.product-tour): a guided walk through a screen; the page dims and a spotlight glides from one part to the next while a step card beside it says what that part does, with Back, Next (Done on the last), Skip tour, a step count and progress dots; arrow keys move between steps and Escape pauses; focus moves into the step card and returns to the launcher; progress is remembered so the launcher offers Resume (with Start over) and, once finished, a list of what was covered and Take it again; a missing or hidden part shows its step centered without a spotlight; every step is announced.
 * Use it as: import { ProductTour } from "./product-tour"; <ProductTour title lede? steps={[{ id, target: "search" (matches data-tour="search" inside children), title, text }]} storageKey?="my-tour" onFinish?={() => ...} labels?={{ start, resume, restart, again, next, back, done, skip, ... }}>{the screen, with data-tour="…" on the parts}</ProductTour>
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.text-field.outlined, c.badge.status
 * Look: A white card with a launcher row (a compass badge, the title, a short line, Start tour or Resume and Start over, a seen-steps meter) above the screen being toured; while touring, the screen dims, a rounded spotlight with a soft pulsing ring frames one part, and a small white step card with an arrow sits beside it: a step count, a title, a sentence, progress dots with a sliding active pill, Skip tour on the left and Back / Next on the right.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --radius-lg --text-xs --text-sm --text-md --text-lg --weight-medium --weight-semibold --focus-ring --surface-shadow-hover --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: product tour; onboarding walkthrough; feature tour; first-run guide; new feature spotlight; coach marks; guided setup
 * Jobs to be done: show a new user where the important parts of a screen are; walk someone through a redesigned screen; let people pause a tour and pick it up later; replay the tour from a help button
 * Keywords: product tour, onboarding, walkthrough, coach marks, spotlight, guided tour, step popover, first run, resume, help
 */
/**
 * Product tour: the screen being toured is the children; mark its parts with data-tour="name" and list the steps in
 * order. While the tour runs the screen is inert (it can't be clicked or tabbed into) and the step card is a
 * non-modal dialog that keeps focus inside it: Tab cycles its buttons, Left and Right arrows go back and forward, and
 * Escape pauses. The spotlight and the card glide between parts and the card's words rise in; with motion off they
 * simply move. Progress goes to localStorage under storageKey when the browser allows it, and the tour still works
 * when it doesn't.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its popover (title, text, actions, arrow) and progress
 * components, and Meraki UI (MIT, Copyright (c) 2021 Khatab Wedaa): its tooltip placements.
 */
/**
 * How to try it
 * - Press Start tour. The screen dims and the spotlight frames the search box; focus is on the step card's title.
 * - Press Next (or the Right arrow): the spotlight glides to New project. Press Left to go back.
 * - Press Escape on step 3: the tour pauses and the launcher says Resume, step 3 of 5. Reload the page: it still does.
 * - Resume and finish with Done: the launcher lists the five steps with ticks. Press the round help button at the
 *   bottom right of the screen (or Take it again) to replay it.
 * - At 375px wide the sidebar hides; the step card spans the screen under or above its part.
 *
 * Dependencies: React (useCallback, useEffect, useId, useLayoutEffect, useRef, useState), the library's Button,
 * TextField and Badge ("./buttons-variants", "./text-fields-states", "./badges-status") and its inline icon set
 * ("./icons"). localStorage when the browser allows it. Nothing else: no package and nothing fetched. The styles are
 * the library's own fl- classes in templates/library/css/r6b-product-tour.css.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── p.product-tour: a spotlight and a step card that walk through the parts of a screen. ──

export type TourStep = { id: string; target: string; title: string; text: string };

export type ProductTourLabels = Partial<{
  start: string;
  resume: string;
  restart: string;
  again: string;
  next: string;
  back: string;
  done: string;
  skip: string;
  stepOf: string;
  seen: string;
  finished: string;
  paused: string;
  ended: string;
  card: string;
}>;

export type ProductTourProps = {
  title: string;
  lede?: string;
  steps: TourStep[];
  /** Where progress is remembered between visits; nothing is saved when left out. */
  storageKey?: string;
  onFinish?: () => void;
  labels?: ProductTourLabels;
  /** The screen being toured, with data-tour="…" on each part a step points at. */
  children: ReactNode;
};

type Saved = { step: number; state: "new" | "paused" | "done" };
type Box = { x: number; y: number; w: number; h: number } | null;
type Place = { top: number; left: number; arrow: number; side: "top" | "bottom" | "left" | "right" | "none"; width: number };

function motionOff() {
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
function readSaved(key?: string): Saved {
  if (!key) return { step: 0, state: "new" };
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "null") as Saved | null;
    if (v && typeof v.step === "number" && ["new", "paused", "done"].includes(v.state)) return v;
  } catch {
    /* storage blocked or bad data: start fresh */
  }
  return { step: 0, state: "new" };
}
function writeSaved(key: string | undefined, v: Saved) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage blocked: progress lasts for this visit only */
  }
}

const PAD = 6;
const GAP = 12;

export function ProductTour({ title, lede, steps, storageKey, onFinish, labels = {}, children }: ProductTourProps) {
  const l = {
    start: "Start tour",
    resume: "Resume",
    restart: "Start over",
    again: "Take it again",
    next: "Next",
    back: "Back",
    done: "Done",
    skip: "Skip tour",
    stepOf: "Step {n} of {total}",
    seen: "{n} of {total} seen",
    finished: "Tour finished",
    paused: "Tour paused at step {n}. Resume any time.",
    ended: "Tour finished. You can take it again from the help button.",
    card: "Tour step",
    ...labels,
  };
  const id = useId();
  const total = steps.length;
  const [saved, setSaved] = useState<Saved>({ step: 0, state: "new" });
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState<Box>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [said, setSaid] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLDivElement>(null);
  const backTo = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // Read progress after mounting, so the first render matches on server and client.
  useEffect(() => setSaved(readSaved(storageKey)), [storageKey]);
  const save = (v: Saved) => {
    setSaved(v);
    writeSaved(storageKey, v);
  };

  const measure = useCallback(() => {
    const root = stage.current;
    if (!root || !running) return;
    const s = steps[step];
    const r0 = root.getBoundingClientRect();
    const el = s ? root.querySelector<HTMLElement>(`[data-tour="${CSS.escape(s.target)}"]`) : null;
    const r = el?.getBoundingClientRect();
    const box: Box = r && r.width > 0 && r.height > 0 ? { x: r.left - r0.left - PAD, y: r.top - r0.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } : null;
    setSpot(box);
    const cw = Math.min(320, r0.width - 16);
    const ch = card.current?.offsetHeight ?? 180;
    if (!box) {
      setPlace({ top: Math.max(8, (r0.height - ch) / 2), left: (r0.width - cw) / 2, arrow: cw / 2, side: "none", width: cw });
      return;
    }
    const below = box.y + box.h + GAP;
    const fitsBelow = below + ch <= r0.height - 8;
    const fitsAbove = box.y - GAP - ch >= 8;
    const fitsRight = box.x + box.w + GAP + cw <= r0.width - 8;
    const fitsLeft = box.x - GAP - cw >= 8;
    if (!fitsBelow && !fitsAbove && (fitsRight || fitsLeft)) {
      const top = Math.min(Math.max(8, box.y + box.h / 2 - ch / 2), Math.max(8, r0.height - ch - 8));
      const left = fitsRight ? box.x + box.w + GAP : box.x - GAP - cw;
      setPlace({ top, left, arrow: Math.min(Math.max(16, box.y + box.h / 2 - top), ch - 16), side: fitsRight ? "right" : "left", width: cw });
      return;
    }
    const side: Place["side"] = fitsBelow || !fitsAbove ? "bottom" : "top";
    const top = side === "bottom" ? Math.min(below, Math.max(8, r0.height - ch - 8)) : box.y - GAP - ch;
    const center = box.x + box.w / 2;
    const left = Math.min(Math.max(8, center - cw / 2), r0.width - cw - 8);
    setPlace({ top, left, arrow: Math.min(Math.max(16, center - left), cw - 16), side, width: cw });
  }, [running, step, steps]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    if (!running || !stage.current) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(stage.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [running, measure]);

  // Each step: bring its part into view, focus the card's title and say where we are.
  useEffect(() => {
    if (!running) return;
    const s = steps[step];
    const el = s ? stage.current?.querySelector<HTMLElement>(`[data-tour="${CSS.escape(s.target)}"]`) : null;
    if (!motionOff()) body.current?.animate([{ opacity: 0, translate: "0 4px" }, { opacity: 1, translate: "0 0" }], { duration: tokenMs("--duration-base", 200), easing: getComputedStyle(document.documentElement).getPropertyValue("--ease-out").trim() || "ease-out" });
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: motionOff() ? "auto" : "smooth" });
    const raf = window.setTimeout(() => document.getElementById(`${id}-step-title`)?.focus({ preventScroll: true }), 20);
    setSaid(`${l.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(total))}: ${s?.title ?? ""}`);
    return () => window.clearTimeout(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, step]);

  const begin = (from: number) => {
    backTo.current = document.activeElement as HTMLElement | null;
    setStep(from);
    setRunning(true);
    save({ step: from, state: "paused" });
  };
  const go = (to: number) => {
    if (to < 0) return;
    if (to >= total) return finish();
    setStep(to);
    save({ step: to, state: "paused" });
  };
  const returnFocus = () =>
    window.setTimeout(() => {
      const target = backTo.current && document.contains(backTo.current) && !backTo.current.closest("[inert]") ? backTo.current : launcher.current?.querySelector<HTMLElement>("button");
      target?.focus();
    }, 30);
  const pause = () => {
    setRunning(false);
    save({ step, state: "paused" });
    setSaid(l.paused.replace("{n}", String(step + 1)));
    returnFocus();
  };
  const finish = () => {
    setRunning(false);
    save({ step: total - 1, state: "done" });
    setSaid(l.ended);
    onFinish?.();
    backTo.current = null;
    window.setTimeout(() => launcher.current?.querySelector<HTMLElement>("button")?.focus(), 30);
  };

  const onCardKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      pause();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(step + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(step - 1);
    } else if (e.key === "Tab" && card.current) {
      const able = Array.from(card.current.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='-1'][id]"));
      const btns = able.filter((b) => b.tagName === "BUTTON");
      if (!btns.length) return;
      const first = btns[0];
      const last = btns[btns.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement?.id === `${id}-step-title`)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  // Help buttons inside the screen (data-tour-start) replay the tour.
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-tour-start]")) begin(0);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  });

  const seenCount = saved.state === "done" ? total : saved.state === "paused" ? saved.step : 0;
  const s = steps[step];

  return (
    <section className="fl-ptour" aria-labelledby={`${id}-title`} data-fl="p.product-tour">
      <div className="fl-ptour-launch" ref={launcher}>
        <span className="fl-ptour-mark" aria-hidden="true">
          <Icon name="map" />
        </span>
        <div className="fl-ptour-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {saved.state === "done" ? (
            <p>
              <Badge tone="success">{l.finished}</Badge>
            </p>
          ) : lede ? (
            <p>{lede}</p>
          ) : null}
          <div className="fl-ptour-meter" role="img" aria-label={l.seen.replace("{n}", String(seenCount)).replace("{total}", String(total))}>
            <span style={{ ["--fill" as string]: total ? seenCount / total : 0 }} />
          </div>
        </div>
        <div className="fl-ptour-actions">
          {saved.state === "paused" && !running ? (
            <>
              <Button size={40} icon="play" onClick={() => begin(Math.min(saved.step, total - 1))}>
                {`${l.resume} · ${l.stepOf.replace("{n}", String(saved.step + 1)).replace("{total}", String(total))}`}
              </Button>
              <Button variant="tertiary" size={40} icon="refresh" onClick={() => begin(0)}>
                {l.restart}
              </Button>
            </>
          ) : saved.state === "done" ? (
            <Button variant="secondary" size={40} icon="refresh" onClick={() => begin(0)}>
              {l.again}
            </Button>
          ) : (
            <Button size={40} icon="play" disabled={running || !total} onClick={() => begin(0)}>
              {l.start}
            </Button>
          )}
        </div>
        {saved.state === "done" ? (
          <ol className="fl-ptour-covered" aria-label={l.finished}>
            {steps.map((x, i) => (
              <li key={x.id} style={{ ["--i" as string]: i }}>
                <span className="fl-ptour-tick" aria-hidden="true">
                  <Icon name="check" />
                </span>
                {x.title}
              </li>
            ))}
          </ol>
        ) : null}
      </div>

      <div className={["fl-ptour-stage", running ? "is-running" : ""].filter(Boolean).join(" ")} ref={stage}>
        <div className="fl-ptour-screen" inert={running || undefined}>
          {children}
        </div>
        {running ? (
          <>
            <div className="fl-ptour-scrim" aria-hidden="true" onClick={() => document.getElementById(`${id}-step-title`)?.focus()} />
            <div
              className={["fl-ptour-spot", spot ? "" : "is-none"].filter(Boolean).join(" ")}
              aria-hidden="true"
              style={spot ? { top: spot.y, left: spot.x, width: spot.w, height: spot.h } : undefined}
            />
            <div
              ref={card}
              className={["fl-ptour-card", place ? `is-${place.side}` : ""].filter(Boolean).join(" ")}
              role="dialog"
              aria-modal="false"
              aria-label={l.card}
              aria-labelledby={`${id}-step-title`}
              aria-describedby={`${id}-step-text`}
              onKeyDown={onCardKey}
              style={place ? { top: place.top, left: place.left, width: place.width, ["--arrow" as string]: `${place.arrow}px` } : { opacity: 0, top: 0, left: 0 }}
            >
              <div className="fl-ptour-body" ref={body}>
                <p className="fl-ptour-count">{l.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(total))}</p>
                <h3 id={`${id}-step-title`} tabIndex={-1}>
                  {s?.title}
                </h3>
                <p id={`${id}-step-text`} className="fl-ptour-text">
                  {s?.text}
                </p>
              </div>
              <div className="fl-ptour-dots" aria-hidden="true" style={{ ["--at" as string]: step }}>
                {steps.map((x, i) => (
                  <span key={x.id} className={i < step ? "is-past" : undefined} />
                ))}
                <i />
              </div>
              <div className="fl-ptour-foot">
                <Button variant="tertiary" size={32} onClick={pause}>
                  {l.skip}
                </Button>
                <span className="fl-ptour-nav">
                  {step > 0 ? (
                    <Button variant="secondary" size={32} onClick={() => go(step - 1)}>
                      {l.back}
                    </Button>
                  ) : null}
                  <Button size={32} icon={step === total - 1 ? "check" : "chevron-right"} iconAt={step === total - 1 ? "start" : "end"} onClick={() => go(step + 1)}>
                    {step === total - 1 ? l.done : l.next}
                  </Button>
                </span>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </section>
  );
}

// ── The sample screen being toured: a small project board that works on its own. ──

type Card = { id: string; name: string; col: "todo" | "doing" | "done" };

function SampleBoard({ cards: initial, cols }: { cards: Card[]; cols: { id: Card["col"]; label: string }[] }) {
  const id = useId();
  const [cards, setCards] = useState(initial);
  const [q, setQ] = useState("");
  const [nav, setNav] = useState("Board");
  const [said, setSaid] = useState("");
  const n = useRef(1);
  const shown = cards.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="fl-ptour-app">
      <header className="fl-ptour-bar">
        <strong className="fl-ptour-brand">Northwind</strong>
        <span className="fl-ptour-search" data-tour="search">
          <Icon name="search" />
          <TextField id={`${id}-q`} type="search" size={32} aria-label="Search projects" placeholder="Search projects" value={q} onChange={(e) => setQ(e.currentTarget.value)} />
        </span>
        <Button
          size={32}
          icon="plus"
          data-tour="new"
          onClick={() => {
            const name = `Untitled project ${n.current++}`;
            setCards((c) => [...c, { id: `n${Date.now()}`, name, col: "todo" }]);
            setSaid(`Added ${name} to To do.`);
          }}
        >
          New project
        </Button>
        <Button variant="secondary" size={32} icon="share" data-tour="share" onClick={() => setSaid("Invite link ready to share.")}>
          Share
        </Button>
      </header>
      <div className="fl-ptour-main">
        <nav className="fl-ptour-side" aria-label="Workspace">
          {["Board", "Calendar", "Reports"].map((x) => (
            <button key={x} type="button" aria-current={nav === x ? "page" : undefined} onClick={() => setNav(x)}>
              <Icon name={x === "Board" ? "layers" : x === "Calendar" ? "calendar" : "chart"} />
              {x}
            </button>
          ))}
        </nav>
        <div className="fl-ptour-cols">
          {cols.map((c) => {
            const list = shown.filter((x) => x.col === c.id);
            return (
              <section key={c.id} className="fl-ptour-col" aria-label={c.label} data-tour={`col-${c.id}`}>
                <h4>
                  {c.label} <span>{list.length}</span>
                </h4>
                {list.length ? (
                  <ul>
                    {list.map((x) => (
                      <li key={x.id}>{x.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="fl-ptour-none">{q.trim() ? "No matches" : "Nothing here"}</p>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <button type="button" className="fl-ptour-help" data-tour="help" data-tour-start aria-label="Replay the tour" title="Replay the tour">
        <Icon name="help" />
      </button>
      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Get to know your board",
  lede: "A one-minute tour of the parts you'll use most.",
  storageKey: "fl-sample-product-tour",
  steps: [
    { id: "s1", target: "search", title: "Find anything", text: "Search every project by name. Results narrow as you type." },
    { id: "s2", target: "new", title: "Start a project", text: "New project adds a card to To do. Rename it and add a due date." },
    { id: "s3", target: "col-doing", title: "Track the work", text: "Cards move left to right as work moves on. The number shows how many are in each column." },
    { id: "s4", target: "share", title: "Bring your team", text: "Share sends an invite link so teammates see the same board." },
    { id: "s5", target: "help", title: "Help is here", text: "Replay this tour any time from the help button." },
  ] as TourStep[],
  cols: [
    { id: "todo" as const, label: "To do" },
    { id: "doing" as const, label: "In progress" },
    { id: "done" as const, label: "Done" },
  ],
  cards: [
    { id: "c1", name: "Spring catalog shoot", col: "todo" },
    { id: "c2", name: "Website refresh", col: "todo" },
    { id: "c3", name: "Store opening plan", col: "doing" },
    { id: "c4", name: "Q3 supplier review", col: "doing" },
    { id: "c5", name: "Holiday window display", col: "done" },
  ] as Card[],
};

export default function ProductTourSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ProductTour title={SAMPLE.title} lede={SAMPLE.lede} steps={SAMPLE.steps} storageKey={SAMPLE.storageKey}>
          <SampleBoard cards={SAMPLE.cards} cols={SAMPLE.cols} />
        </ProductTour>
      </div>
    </section>
  );
}
