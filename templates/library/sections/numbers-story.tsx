/** @flowcode-library numbers-story · Story in numbers (Stats)
 * Catalog ID: b.numbers-story (block)
 * Function: The story-in-numbers block (b.numbers-story): one big picture with numbered markers pinned where each figure happens, beside a list of figures that count up; choosing a figure or a marker lights both and opens its note on the picture.
 * Use it as: import { NumbersStory } from "./numbers-story"; <NumbersStory label="By the numbers" picture={{ src?, alt }} stats={[{ id, value: 38, prefix?: "$", suffix?: "%", decimals?, label, note, spot: { x: 30, y: 55 } }]} source?="Figures from our 2026 customer survey" start?="id" onSelect?={(id) => ...} />  // use only figures the PRD supplies
 * Built from: c.media-frame
 * Look: A wide rounded picture on one side with small round numbered markers pinned on it, the chosen one larger in the accent color with a soft ring; a white note card sits over the picture's foot with the figure's story. On the other side a stacked list of figures: each a row with its number tile, a large display figure that counts up and a muted label, the chosen row on white with a straight accent bar down its left edge. A muted source line closes it.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-md --text-2xl --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: about us page; impact report; annual review; company in numbers; nonprofit impact; investor page; results page
 * Jobs to be done: see the scale of the company at a glance; understand what each number means; trust the claims behind the numbers; find where a figure comes from
 * Keywords: by the numbers, stats, statistics, impact, annotated image, hotspots, count up, figures, metrics, story
 */
/**
 * Story in numbers: big figures mean more when they are tied to something you can see. Each figure has a marker on the
 * picture, and the two are one control: press a row or a marker (or hover a row) and both light up while the note opens
 * over the picture. Rows and markers are buttons with aria-pressed; Up and Down arrows move between rows. Numbers count
 * up once as the block comes into view (screen readers hear only the final value), and the block is never left hidden.
 * Make it the app's own: use a real photo of the place or product, and pin each marker where its figure happens.
 * Adapted from AstroWind (MIT, Copyright (c) 2023 onWidget): its stats and content-with-image widgets.
 */
/**
 * How to try it
 * - Hover or press a figure in the list: its marker grows on the picture and the note card changes.
 * - Press a marker on the picture: the matching row is chosen.
 * - Tab to the list and use the Up and Down arrows, Home and End: the choice and focus move together.
 * - Reload with the block in view: the numbers count up once. With reduced motion they are simply there.
 *
 * Dependencies: React (useEffect, useId, useRef, useState) and the library's MediaFrame ("./media-frames"). Nothing
 * else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4c-numbers-story.css.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { MediaFrame } from "./media-frames";

export type StoryStat = {
  id: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  note: string;
  /** Where the marker sits on the picture, in percent from the top-left corner. */
  spot: { x: number; y: number };
};

export type NumbersStoryProps = {
  label: string;
  picture: { src?: string; alt: string };
  stats: StoryStat[];
  source?: string;
  start?: string;
  onSelect?: (id: string) => void;
};

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: plays now when already on screen, else on view, and never later than 1.2s. "in" also starts the count. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in" | "still">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) {
      setState("still");
      return;
    }
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
    };
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && show(),
      { threshold: 0.15 },
    );
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

/** 0 → 1 over `ms` once `go` turns true; straight to 1 when motion is off. */
function useProgress(go: boolean, instant: boolean, ms = 1100) {
  const [p, setP] = useState(instant ? 1 : 0);
  useEffect(() => {
    if (instant) {
      setP(1);
      return;
    }
    if (!go) return;
    let start = -1;
    let raf = 0;
    const tick = (t: number) => {
      if (start < 0) start = t;
      const k = Math.max(0, Math.min(1, (t - start) / ms));
      setP(1 - Math.pow(1 - k, 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, instant, ms]);
  return p;
}

const fmt = (s: StoryStat, n: number) =>
  `${s.prefix ?? ""}${n.toLocaleString("en-US", { minimumFractionDigits: s.decimals ?? 0, maximumFractionDigits: s.decimals ?? 0 })}${s.suffix ?? ""}`;

export function NumbersStory({
  label,
  picture,
  stats,
  source,
  start,
  onSelect,
}: NumbersStoryProps) {
  const uid = useId();
  const [at, setAt] = useState(() =>
    Math.max(
      0,
      stats.findIndex((s) => s.id === start),
    ),
  );
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const p = useProgress(enter === "in", enter === "still");
  const rows = useRef<Array<HTMLButtonElement | null>>([]);

  const choose = (i: number, focus = false) => {
    setAt(i);
    onSelect?.(stats[i]!.id);
    if (focus) rows.current[i]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = stats.length - 1;
    const n =
      e.key === "ArrowDown"
        ? Math.min(last, i + 1)
        : e.key === "ArrowUp"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (n === null) return;
    e.preventDefault();
    choose(n, true);
  };

  const cur = stats[at];
  const cls = [
    "fl-nbs",
    enter === "wait" ? "is-waiting" : "",
    enter === "in" ? "is-entering" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={root} className={cls} data-fl="b.numbers-story">
      <div className="fl-nbs-grid">
        <figure
          className="fl-nbs-pic fl-nbs-rise"
          style={{ "--i": 0 } as CSSProperties}
        >
          <MediaFrame ratio="4-3" src={picture.src} alt={picture.alt} art="c" />
          {stats.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={i === at ? "fl-nbs-pin is-on" : "fl-nbs-pin"}
              style={
                { left: `${s.spot.x}%`, top: `${s.spot.y}%` } as CSSProperties
              }
              aria-pressed={i === at}
              aria-label={`${i + 1}. ${s.label}`}
              onClick={() => choose(i)}
            >
              <span aria-hidden="true">{i + 1}</span>
            </button>
          ))}
          {cur ? (
            <figcaption
              id={`${uid}-note`}
              className="fl-nbs-note"
              aria-live="polite"
            >
              <span key={cur.id} className="fl-nbs-note-in">
                <strong className="fl-nbs-note-fig">
                  {fmt(cur, cur.value)} <span>{cur.label}</span>
                </strong>
                <span className="fl-nbs-note-text">{cur.note}</span>
              </span>
            </figcaption>
          ) : null}
        </figure>

        <div className="fl-nbs-side">
          <ul className="fl-nbs-list" aria-label={label}>
            {stats.map((s, i) => (
              <li
                key={s.id}
                className="fl-nbs-rise"
                style={{ "--i": i + 1 } as CSSProperties}
              >
                <button
                  ref={(el) => {
                    rows.current[i] = el;
                  }}
                  type="button"
                  className={i === at ? "fl-nbs-row is-on" : "fl-nbs-row"}
                  aria-pressed={i === at}
                  aria-describedby={i === at ? `${uid}-note` : undefined}
                  onClick={() => choose(i)}
                  onMouseEnter={() => i !== at && choose(i)}
                  onKeyDown={(e) => onKey(e, i)}
                >
                  <span className="fl-nbs-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="fl-nbs-what">
                    <span className="fl-nbs-fig">
                      <span aria-hidden="true">{fmt(s, s.value * p)}</span>
                      <span className="fl-sr">{fmt(s, s.value)}</span>
                    </span>
                    <span className="fl-nbs-label">{s.label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {source ? <p className="fl-nbs-source">{source}</p> : null}
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "By the numbers",
  title: "Six years, one front desk at a time",
  lede: "What changed for the studios that run on us.",
  picture: {
    alt: "A busy studio front desk with a tablet showing the day's bookings",
  },
  stats: [
    {
      id: "studios",
      value: 5200,
      suffix: "+",
      label: "studios and salons",
      note: "From one yoga studio in Portland to salons, clinics and gyms in 14 countries.",
      spot: { x: 22, y: 30 },
    },
    {
      id: "bookings",
      value: 3.8,
      decimals: 1,
      suffix: "M",
      label: "bookings a month",
      note: "Most are made at night or on weekends, when nobody is at the desk to answer the phone.",
      spot: { x: 62, y: 24 },
    },
    {
      id: "noshows",
      value: 34,
      suffix: "%",
      label: "fewer no-shows",
      note: "Studios that switch on deposits and text reminders see a third fewer missed visits in month one.",
      spot: { x: 74, y: 62 },
    },
    {
      id: "hours",
      value: 6,
      suffix: " hrs",
      label: "saved each week",
      note: "The average owner's time back from chasing bookings, payments and reminders by hand.",
      spot: { x: 36, y: 70 },
    },
  ],
  source: "Figures from our 2026 customer survey of 1,140 studios.",
};

export default function NumbersStoryPreview() {
  const d = SAMPLE;
  return (
    <section
      className="fl-section fl-section--canvas"
      aria-labelledby="numbers-story-title"
    >
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="numbers-story-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <NumbersStory
          label={d.eyebrow}
          picture={d.picture}
          stats={d.stats}
          source={d.source}
        />
      </div>
    </section>
  );
}
