/** @flowcode-library use-cases-tabs · Use cases in tabs (Features)
 * Catalog ID: b.use-cases-tabs (block)
 * Function: The use-cases block (b.use-cases-tabs): one tab per kind of customer or job, a sliding indicator under the chosen tab, and a panel with a short pitch, three ticked points, a link and a picture for that case.
 * Use it as: import { UseCasesTabs } from "./use-cases-tabs"; <UseCasesTabs label="Who it's for" cases={[{ id, tab, icon?, title, text, points: string[], link?: { label, href }, picture: { src?, alt } }]} start?={0} onChange?={(id) => ...} />
 * Built from: c.media-frame
 * Look: A row of tab buttons with icons over a thin rule, an accent bar sliding under the chosen one; below, a two-column panel: a bold title, a muted lede, ticked points and an arrow link on the left, a rounded picture on the right. Panels cross-fade as tabs change.
 * Tokens: --color-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-radius --radius-sm --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-sm --text-md --text-xl --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --focus-ring
 * Use cases: use cases; who it's for; solutions by industry; solutions by role; customer segments; product for teams; saas homepage; industries we serve
 * Jobs to be done: see how it works for someone like me; find my use case; compare what it does for different teams; decide if it fits my business
 * Keywords: use cases, tabs, solutions, industries, roles, segments, showcase, tab indicator, who it's for
 */
/**
 * Use cases in tabs: the same product shown through each kind of customer. Tabs follow the ARIA tabs pattern: Left and
 * Right move and open the next tab, Home and End jump to the ends, and Tab moves on into the open panel. The accent
 * bar slides to the chosen tab (it follows resizes too), the panel's words and picture cross-fade, and the whole block
 * rises in once as it scrolls into view; with reduced motion or animation off it changes at once. On a phone the tab
 * row scrolls sideways inside itself (never the page) and the picture goes above the words. Make it the app's own:
 * replace SAMPLE with three to five real customer types, their own points and real pictures.
 * Built from c.media-frame; the tab row is its own (an underline tab bar with a sliding indicator).
 * Adapted from AstroWind (MIT License, Copyright (c) 2023 onWidget): its FeatureTabs widget (a tab list beside the
 * selected tab's image, with tablist, tab and tabpanel roles).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Icon, Tick } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

export type UseCase = {
  id: string;
  /** The tab's short label. */
  tab: string;
  /** An icon name from ./icons, before the tab label. */
  icon?: string;
  title: string;
  text: string;
  /** Two to four short points, each ticked. */
  points: string[];
  link?: { label: string; href: string };
  /** Without src a tinted stand-in is drawn. */
  picture: { src?: string; alt: string };
};

export type UseCasesTabsProps = {
  /** Names the tab list for screen readers. */
  label: string;
  cases: UseCase[];
  /** Which tab is open first (its index). */
  start?: number;
  /** Called when a tab opens. */
  onChange?: (id: string) => void;
};

const ARTS: MediaArt[] = ["d", "a", "e", "b", "c"];

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the block is in view, then "in". Without an observer, or with motion off, it is shown at once. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    setState("wait");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setState("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, state] as const;
}

export function UseCasesTabs({ label, cases, start = 0, onChange }: UseCasesTabsProps) {
  const uid = useId();
  const [sel, setSel] = useState(Math.min(Math.max(start, 0), cases.length - 1));
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const list = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const [root, enter] = useEnterOnce<HTMLDivElement>();

  // The indicator: measured from the chosen tab, again whenever the row changes size.
  const measure = useCallback(() => {
    const t = tabs.current[sel];
    if (t) setBar({ x: t.offsetLeft, w: t.offsetWidth });
  }, [sel]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    const el = list.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure]);

  const choose = (i: number, focus = false) => {
    setSel(i);
    onChange?.(cases[i]!.id);
    const t = tabs.current[i];
    if (focus) t?.focus();
    t?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: still() ? "auto" : "smooth" });
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = cases.length;
    let next: number | null = null;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    choose(next, true);
  };

  if (!cases.length) return null;

  return (
    <div
      ref={root}
      className={["fl-ucs", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}
      data-fl="b.use-cases-tabs"
    >
      <div className="fl-ucs-rail">
        <div ref={list} className="fl-ucs-tabs" role="tablist" aria-label={label}>
          {cases.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-t${i}`}
              aria-selected={i === sel}
              aria-controls={`${uid}-p${i}`}
              tabIndex={i === sel ? 0 : -1}
              className={i === sel ? "fl-ucs-tab is-on" : "fl-ucs-tab"}
              onClick={() => choose(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {c.icon ? <Icon name={c.icon} /> : null}
              {c.tab}
            </button>
          ))}
          <span
            className={bar ? "fl-ucs-bar is-ready" : "fl-ucs-bar"}
            aria-hidden="true"
            style={bar ? { transform: `translateX(${bar.x}px)`, width: `${bar.w}px` } : undefined}
          />
        </div>
      </div>

      <div className="fl-ucs-stack">
        {cases.map((c, i) => {
          const on = i === sel;
          return (
            <div
              key={c.id}
              role="tabpanel"
              id={`${uid}-p${i}`}
              aria-labelledby={`${uid}-t${i}`}
              hidden={!on}
              tabIndex={0}
              className={on ? "fl-ucs-panel is-on" : "fl-ucs-panel"}
            >
              <div className="fl-ucs-words">
                <h3 className="fl-ucs-title">{c.title}</h3>
                <p className="fl-ucs-text">{c.text}</p>
                <ul className="fl-ucs-points">
                  {c.points.map((p) => (
                    <li key={p}>
                      <Tick />
                      {p}
                    </li>
                  ))}
                </ul>
                {c.link ? (
                  <a className="fl-ucs-link" href={c.link.href}>
                    {c.link.label}
                    <Icon name="arrow" />
                  </a>
                ) : null}
              </div>
              <div className="fl-ucs-pic">
                <MediaFrame ratio="4-3" src={c.picture.src} alt={c.picture.alt} art={ARTS[i % ARTS.length]} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Who it's for",
  title: "Built for the way you teach",
  lede: "Pick your kind of studio to see what changes.",
  cases: [
    {
      id: "yoga",
      tab: "Yoga",
      icon: "heart",
      title: "Fill every mat, every class",
      text: "Weekly classes with drop-ins, waitlists and class packs.",
      points: ["Waitlist fills a spot when someone cancels", "Class packs that count down by themselves", "Check people in from your phone"],
      link: { label: "Yoga studios", href: "#yoga" },
      picture: { alt: "A full yoga class with mats in rows" },
    },
    {
      id: "pottery",
      tab: "Pottery",
      icon: "sparkle",
      title: "Courses and open studio",
      text: "Six-week courses, taster nights and kiln time in one calendar.",
      points: ["Sell a whole course in one booking", "Charge for kiln shelves", "Message everyone in a course at once"],
      link: { label: "Craft studios", href: "#pottery" },
      picture: { alt: "Wheels and shelves of drying pots" },
    },
    {
      id: "music",
      tab: "Music lessons",
      icon: "play",
      title: "One-to-one lessons that repeat",
      text: "Weekly slots that book themselves until the term ends.",
      points: ["Recurring lessons with one tap", "Make-up lessons for missed weeks", "Parents pay by term"],
      link: { label: "Music teachers", href: "#music" },
      picture: { alt: "A piano lesson with a teacher and a student" },
    },
    {
      id: "fitness",
      tab: "Personal training",
      icon: "bolt",
      title: "Sessions and packages",
      text: "Sell blocks of sessions and let clients pick their times.",
      points: ["Packages with an end date", "Travel time between clients", "Notes on every session"],
      link: { label: "Trainers", href: "#fitness" },
      picture: { alt: "A trainer holding pads for a client" },
    },
  ] satisfies UseCase[],
};

export default function UseCasesTabsPreview() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section" aria-labelledby="use-cases-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="use-cases-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <UseCasesTabs label={d.eyebrow} cases={d.cases} onChange={(id) => setSaid(`Showing ${d.cases.find((c) => c.id === id)?.tab ?? ""}.`)} />
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
