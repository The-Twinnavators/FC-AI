/** @flowcode-library hero-stats · Hero with proof (Heroes)
 * Catalog ID: b.hero-stats (block)
 * Function: The hero-with-proof block (b.hero-stats): promise and action beside two to four stat cards.
 * Use it as: import { HeroStats } from "./hero-stats"; <HeroStats id title lede primary={{label,href}} stats={[{value,label}]} />
 * Built from: c.button.primary, c.card.plain
 * Look: A tinted band; words and one button on the left, a stack of cards on the right, each with a bold number and what it counts.
 * Tokens: --space-3 --space-5 --space-6 --text-2xl --font-display --color-surface-sunken --color-border --color-text-muted
 * Use cases: landing page hero; results-driven homepage; agency homepage; fundraising page; b2b product homepage; case study intro; nonprofit impact page
 * Jobs to be done: see proof the product works; judge whether the claims are credible; get started with confidence; book a demo with the team
 * Keywords: hero, landing, results, stats
 */
/**
 * Hero: with proof. Promise, actions and three numbers that back it up, on a tinted band. Good when the product has
 * real results to show. Make it the app's own: replace SAMPLE; only use numbers the PRD actually gives.
 * Motion: the words rise in once, then the numbers, which count up from zero; a number card lifts a little under the pointer. With reduced motion or animation off everything is simply there.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";

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
  // Once it has played, drop the entrance classes, so content never depends on an animation finishing (a page that
  // isn't painting freezes animations).
  useEffect(() => {
    if (state !== "in") return;
    const t = setTimeout(() => setState("done"), 1200);
    return () => clearTimeout(t);
  }, [state]);
  return [ref, state] as const;
}

const enterClass = (state: "idle" | "wait" | "in" | "done") => (state === "wait" ? " is-waiting" : state === "in" ? " is-entering" : "");

/** Counts a stat's first number up from zero once, keeping its words ("12 min", "4.8 / 5"). Screen readers get the
 * final value only. With motion off or reduced, or a value without a number, the value is simply shown. */
function CountUp({ value, run }: { value: string; run: boolean }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    setShown(value);
    const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s.exec(value);
    if (!run || !m || still()) return;
    const [, before, num, after] = m;
    const target = Number(num.replace(/,/g, ""));
    const places = num.includes(".") ? num.split(".")[1].length : 0;
    // "2,400" keeps its separators while it counts.
    const format = (n: number) =>
      num.includes(",") ? n.toLocaleString("en-US", { minimumFractionDigits: places, maximumFractionDigits: places }) : n.toFixed(places);
    const slow = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--duration-slow")) || 320;
    const length = slow * 2.5;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const k = Math.min(1, (now - start) / length);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(`${before}${format(target * eased)}${after}`);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    setShown(`${before}${format(0)}${after}`);
    frame = requestAnimationFrame(tick);
    // A page that isn't painting (a background tab) still ends on the real value.
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

export type HeroStatsProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  primary: { label: string; href: string };
  /** Two to four numbers; each is a bold value and what it counts. */
  stats: { value: string; label: string }[];
};

export function HeroStats({ id, title, lede, primary, stats }: HeroStatsProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`fl-section fl-section--tint fl-hx${enterClass(enter)}`} aria-labelledby={`${id}-title`} data-fl="b.hero-stats">
      <div className="fl-wrap fl-split">
        <div className="fl-head fl-hx-seq" style={{ marginBottom: 0 }}>
          <h1 id={`${id}-title`} className="fl-title fl-title--xl">
            {title}
          </h1>
          <p className="fl-lede">{lede}</p>
          <div className="fl-actions" style={{ marginTop: "var(--space-3)" }}>
            <Button variant="primary" href={primary.href}>
              {primary.label}
            </Button>
          </div>
        </div>
        <dl className="fl-grid fl-hx-seq fl-hx-seq--after" style={{ margin: 0 }}>
          {stats.map((s) => (
            <Card key={s.label} variant="surface" className="fl-stat">
              <dt className="fl-sr">{s.label}</dt>
              <dd style={{ margin: 0, display: "grid", gap: "var(--space-1)" }}>
                <strong>
                  <CountUp value={s.value} run={enter === "in" || enter === "done"} />
                </strong>
                <span>{s.label}</span>
              </dd>
            </Card>
          ))}
        </dl>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: HeroStatsProps = {
  id: "hero-stats",
  title: "Your money, finally organized",
  lede: "Every account, bill and goal in one view, with a plan that adjusts when life does.",
  primary: { label: "Get started", href: "#start" },
  stats: [
    { value: "12 min", label: "to set up" },
    { value: "3 accounts", label: "linked on average" },
    { value: "4.8 / 5", label: "from early users" },
  ],
};

export default function HeroStatsPreview() {
  return <HeroStats {...SAMPLE} />;
}
