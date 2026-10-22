/** @flowcode-library stats-band · Stats band (Stats)
 * Catalog ID: b.stats-band (block)
 * Function: The stats band block (b.stats-band): a heading and up to four big numbers on the accent color.
 * Use it as: import { StatsBand } from "./stats-band"; <StatsBand id title eyebrow? lede? tone?="accent"|"tint"|"plain" stats={[{value,label}]} />
 * Look: A solid accent band; a heading, then four bold numbers in a row (two by two on a phone) with a small label under each. The band can instead be a soft tint or plain.
 * Tokens: --color-accent --color-on-accent --space-6 --text-2xl --font-display --color-surface-sunken
 * Use cases: results section; company milestones; impact numbers; social proof metrics; about us figures; nonprofit impact; growth highlights
 * Jobs to be done: see the results in numbers; judge how established the company is; trust the product with proof; understand the scale of impact
 * Keywords: stats, numbers, results, metrics
 */
/**
 * Stats: band. Four numbers on the accent color, a strong break between sections. Make it the app's own: replace
 * SAMPLE with numbers the PRD actually gives; never invent results.
 * Motion: the heading, then the numbers, rise in once as the band comes into view, and each number counts up to its value (screen readers get the value only). With reduced motion or animation off the numbers are simply there.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the section is in view, then "in". Already on screen plays at once; without an observer,
 * or with motion off, it is simply shown; a timeout never leaves it hidden. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in" | "done">("idle");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
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
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.15 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  // Once it has played, drop the entrance classes, so content never depends on an animation finishing.
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("done"), 1200);
    return () => clearTimeout(t);
  }, [state]);
  return [ref, state] as const;
}

const enterClass = (state: "idle" | "wait" | "in" | "done") => (state === "wait" ? " is-waiting" : state === "in" ? " is-entering" : "");

/** A number that counts up from zero once the band enters, keeping its words and separators ("2,400", "38%",
 * "6 hrs"). Screen readers get only the real value, and a timeout always ends on it. */
function CountUp({ value, run }: { value: string; run: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    setShown(value);
    const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(value);
    if (!run || !m || still()) return;
    const [, before, num, after] = m;
    const target = Number(num.replace(/,/g, ""));
    const places = num.includes(".") ? num.split(".")[1].length : 0;
    const grouped = num.includes(",");
    const format = (n: number) =>
      grouped ? n.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places }) : n.toFixed(places);
    const slow = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--duration-slow")) || 320;
    const length = slow * 2.5;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / length);
      setShown(`${before}${format(target * (1 - Math.pow(1 - k, 3)))}${after}`);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    setShown(`${before}${format(0)}${after}`);
    frame = requestAnimationFrame(tick);
    // A page that is not painting (a background tab) still ends on the real value.
    const end = setTimeout(() => (cancelAnimationFrame(frame), setShown(value)), length + 200);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(end);
    };
  }, [value, run]);
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="fl-sr">{value}</span>
    </>
  );
}

export type StatsBandProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  /** A short label above the title. */
  eyebrow?: string;
  /** One sentence under the title. */
  lede?: string;
  /** The band's background: accent (default), a soft tint, or plain page color. */
  tone?: "plain" | "tint" | "accent";
  /** Up to four numbers; each is a bold value and what it counts. */
  stats: { value: string; label: string }[];
};

const TONE: Record<"plain" | "tint" | "accent", string> = {
  plain: "fl-section",
  tint: "fl-section fl-section--tint",
  accent: "fl-section fl-section--accent",
};

export function StatsBand({ id, title, eyebrow, lede, tone = "accent", stats }: StatsBandProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`${TONE[tone]} fl-hx${enterClass(enter)}`} aria-labelledby={`${id}-title`} data-fl="b.stats-band">
      <div className="fl-wrap">
        <div className="fl-head fl-hx-seq" style={{ marginBottom: "var(--space-6)" }}>
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id={`${id}-title`} className="fl-title fl-title--md">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <dl className="fl-grid fl-grid--4 fl-hx-items" style={{ margin: 0 }}>
          {stats.map((s) => (
            <div key={s.label} className="fl-stat">
              {/* The label comes first for screen readers; the number shows first. */}
              <dt style={{ order: 2 }}>
                <span>{s.label}</span>
              </dt>
              <dd style={{ margin: 0 }}>
                <strong>
                  <CountUp value={s.value} run={enter === "in" || enter === "done"} />
                </strong>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: StatsBandProps = {
  id: "stats-band",
  title: "Studios run calmer with it",
  stats: [
    { value: "2,400", label: "bookings a week" },
    { value: "38%", label: "fewer no-shows" },
    { value: "6 hrs", label: "saved each week" },
    { value: "98%", label: "would recommend it" },
  ],
};

export default function StatsBandPreview() {
  return (
    <>
      <StatsBand {...SAMPLE} />
      {/* The tint tone, with a label and a sentence under the title. */}
      <StatsBand {...SAMPLE} id="stats-band-tint" tone="tint" eyebrow="This year" lede="Numbers from studios using it every day." />
    </>
  );
}
