/** @flowcode-library features-alternating · Alternating features (Features)
 * Catalog ID: b.features-alternating (block)
 * Function: The alternating features block (b.features-alternating): picture-and-story rows that show how the product works.
 * Use it as: import { FeaturesAlternating } from "./features-alternating"; <FeaturesAlternating label? rows={[{eyebrow,title,text,points:[string],media}]} />
 * Look: Two-column rows with a picture on one side and eyebrow, title, sentence and ticked points on the other, flipping sides every row.
 * Tokens: --space-9 --color-surface-sunken --color-accent --color-border --color-text-muted --radius-lg
 * Use cases: how it works; product tour; feature showcase; step by step guide; onboarding overview; case study story; service process
 * Jobs to be done: understand how the product works; see each feature in action; follow the process step by step; picture using it in my day
 * Keywords: features, how it works, steps, showcase
 */
/**
 * Features: alternating rows. Each feature gets a picture and a short story, alternating sides. Good for showing how
 * the product works step by step. Make it the app's own: replace SAMPLE; 2 to 4 rows; swap each media placeholder
 * for a real screenshot with alt text.
 * Motion: once, as the section comes into view, each row's words rise in order and its picture settles in from slightly smaller. With reduced motion they only fade; with animation off they are simply there.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tick } from "./icons";


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

export type FeaturesAlternatingProps = {
  /** The section's accessible name. "How it works" when left out. */
  label?: string;
  /** Each row: eyebrow, title, a sentence, ticked points, and a description of its picture (shown as a placeholder, used as alt text). */
  rows: { eyebrow: string; title: string; text: string; points: string[]; media: string }[];
};

export function FeaturesAlternating({ label = "How it works", rows }: FeaturesAlternatingProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`fl-section fl-hx${enterClass(enter)}`} aria-label={label} data-fl="b.features-alternating">
      <div className="fl-wrap" style={{ display: "grid", gap: "var(--space-9)" }}>
        {rows.map((r, i) => (
          <article key={r.title} className="fl-split">
            <div className="fl-media" role="img" aria-label={r.media} style={{ order: i % 2 ? 2 : 0 }}>
              {r.media}
            </div>
            <div className="fl-head fl-hx-seq" style={{ marginBottom: 0 }}>
              <span className="fl-eyebrow">{r.eyebrow}</span>
              <h2 className="fl-title fl-title--md">{r.title}</h2>
              <p className="fl-text">{r.text}</p>
              <ul className="fl-checks" style={{ marginTop: "var(--space-2)" }}>
                {r.points.map((p) => (
                  <li key={p}>
                    <Tick />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: FeaturesAlternatingProps = {
  rows: [
    {
      eyebrow: "Plan",
      title: "See the whole week at once",
      text: "Drag a booking to move it. Everyone involved is told, and nothing double-books.",
      points: ["Week and day views", "Color by service", "Holidays blocked automatically"],
      media: "The week view with bookings color-coded by service",
    },
    {
      eyebrow: "Get paid",
      title: "Deposits without the awkward chase",
      text: "Ask for a deposit when someone books. It's taken off the final bill.",
      points: ["Card or bank transfer", "Refunds in one click", "Receipts sent for you"],
      media: "A booking confirmation showing the deposit paid",
    },
  ],
};

export default function FeaturesAlternatingPreview() {
  return <FeaturesAlternating {...SAMPLE} />;
}
