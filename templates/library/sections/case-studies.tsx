/** @flowcode-library case-studies · Customer stories carousel (Testimonials)
 * Catalog ID: b.case-studies (block)
 * Function: The customer stories block (b.case-studies): one customer at a time with a picture, a quote, the person and result numbers that count up, stepped by company tabs, Previous and Next; it turns on its own only when motion is allowed and stops on hover, focus, pause or out of view.
 * Use it as: import { CaseStudies } from "./case-studies"; <CaseStudies label="Customer stories" stories={[{ id, company, industry?, quote, person: { name, role, src? }, metrics: [{ value: "38%", label }], picture?: { src?, alt }, href? }]} interval?={8000} autoplay?={true} labels?={{ previous, next, pause, play, read, slide }} onChange?={(id) => ...} />  // use only customers and numbers the PRD supplies
 * Built from: c.media-frame, c.avatar.person, c.button.secondary
 * Look: A wide rounded surface card: a picture on the left with the company name on a pill over its corner, and on the right a muted industry line, a large quote, a small face with name and role, a row of big accent numbers with muted labels and a Read the story link. Under it a row of company names, the current one dark with a thin straight accent bar filling under it, and round Previous, Pause and Next buttons.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --surface-radius --surface-shadow --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-xl --text-2xl --font-display --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: customer stories; case studies; saas homepage; results; social proof; agency work; b2b landing page
 * Jobs to be done: see results companies like mine got; trust the product before I buy; read a full customer story; compare outcomes
 * Keywords: case studies, customer stories, carousel, slider, metrics, results, testimonials, trusted by, social proof
 */
/**
 * Customer stories: proof for a homepage, told as results. The company row is a tablist (arrow keys move and show a
 * story), Previous and Next step through them, and the pause button stops the turning for good. It turns on its
 * own every `interval` only when motion is allowed: never under reduced motion or with animation off, never while
 * the pointer is over it, a control inside has focus, the tab is hidden or the block is out of view. While it turns,
 * announcements are off (so a screen reader is not interrupted); when it is still, a change is said. Numbers count up
 * once per story when motion is allowed. Make it the app's own: replace SAMPLE with real customers, true numbers,
 * pictures (picture.src) and links to the full stories.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Avatar } from "./avatars-variants";
import { Icon } from "./icons";

export type CaseStory = {
  id: string;
  company: string;
  industry?: string;
  quote: string;
  person: { name: string; role: string; src?: string };
  /** Two or three results: { value: "38%", label: "fewer no-shows" }. Numbers in the value count up. */
  metrics: Array<{ value: string; label: string }>;
  picture?: { src?: string; alt: string };
  href?: string;
};

export type CaseStudiesProps = {
  label: string;
  stories: CaseStory[];
  /** Milliseconds per story while it turns on its own. */
  interval?: number;
  /** Turn on its own (only ever when motion is allowed). */
  autoplay?: boolean;
  labels?: { previous?: string; next?: string; pause?: string; play?: string; read?: string; slide?: (n: number, of: number) => string };
  onChange?: (id: string) => void;
};

const ARTS: MediaArt[] = ["c", "a", "d", "b", "e"];

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** "38%" -> counts 0..38 and keeps the %; text without a number stays as it is. */
function CountUp({ value, run }: { value: string; run: boolean }) {
  const m = value.match(/^([^\d]*)([\d.,]+)(.*)$/);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!m || !run || still()) {
      setShown(value);
      return;
    }
    const target = parseFloat(m[2]!.replace(/,/g, ""));
    const decimals = (m[2]!.split(".")[1] ?? "").length;
    const commas = m[2]!.includes(",");
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const n = target * eased;
      const txt = commas ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals);
      setShown(`${m[1]}${txt}${m[3]}`);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, run]);
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="fl-sr">{value}</span>
    </>
  );
}

export function CaseStudies({ label, stories, interval = 8000, autoplay = true, labels = {}, onChange }: CaseStudiesProps) {
  const uid = useId();
  const L = {
    previous: labels.previous ?? "Previous story",
    next: labels.next ?? "Next story",
    pause: labels.pause ?? "Pause",
    play: labels.play ?? "Play",
    read: labels.read ?? "Read the story",
    slide: labels.slide ?? ((n: number, of: number) => `${n} of ${of}`),
  };
  const [at, setAt] = useState(0);
  const [canMove, setCanMove] = useState(false);
  const [stopped, setStopped] = useState(!autoplay);
  const [held, setHeld] = useState(false); // pointer over or focus inside
  const [hidden, setHidden] = useState(false); // tab hidden or block off screen
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const n = stories.length;
  const story = stories[at];

  useEffect(() => {
    const ok = !still();
    setCanMove(ok);
    if (!ok) setStopped(true);
    const el = root.current;
    const onVis = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    let io: IntersectionObserver | null = null;
    // Already on screen: show it now, without waiting on an observer.
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) setSeen(true);
    }
    const onScroll = () => {
      const r = el?.getBoundingClientRect();
      if (r && r.top < window.innerHeight && r.bottom > 0) setSeen(true);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => {
        const on = es.some((e) => e.isIntersecting);
        setHidden(!on || document.visibilityState === "hidden");
        if (on) setSeen(true);
      }, { threshold: 0.3 });
      io.observe(el);
    } else setSeen(true);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  const turning = canMove && !stopped && n > 1;
  const running = turning && !held && !hidden;

  const go = (i: number, focusTab = false) => {
    const next = ((i % n) + n) % n;
    setAt(next);
    onChange?.(stories[next]!.id);
    if (focusTab) tabs.current[next]?.focus();
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let t: number | null = null;
    if (e.key === "ArrowRight") t = i + 1;
    else if (e.key === "ArrowLeft") t = i - 1;
    else if (e.key === "Home") t = 0;
    else if (e.key === "End") t = n - 1;
    if (t === null) return;
    e.preventDefault();
    go(t, true);
  };

  if (!story) return null;

  return (
    <div
      ref={root}
      className={["fl-cst", canMove && !seen ? "is-waiting" : "", seen && canMove ? "is-seen" : ""].filter(Boolean).join(" ")}
      data-fl="b.case-studies"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false);
      }}
      style={{ ["--fl-cst-interval" as string]: `${interval}ms` }}
    >
      <div className="fl-cst-stage" aria-live={turning ? "off" : "polite"}>
        <article
          key={story.id}
          id={`${uid}-p${at}`}
          className="fl-cst-card"
          role="tabpanel"
          aria-roledescription="slide"
          aria-labelledby={`${uid}-t${at}`}
        >
          <div className="fl-cst-media">
            <MediaFrame ratio="4-3" src={story.picture?.src} alt={story.picture?.alt ?? ""} art={ARTS[at % ARTS.length]} />
            <span className="fl-cst-company" aria-hidden="true">
              {story.company}
            </span>
          </div>
          <div className="fl-cst-body">
            <p className="fl-cst-industry">
              <span className="fl-sr">{L.slide(at + 1, n)}: </span>
              {story.company}
              {story.industry ? ` · ${story.industry}` : ""}
            </p>
            <blockquote className="fl-cst-quote">
              <p>{story.quote}</p>
            </blockquote>
            <div className="fl-cst-person">
              <Avatar name={story.person.name} src={story.person.src} size={40} tone="a" decorative />
              <p>
                <strong>{story.person.name}</strong>
                <span>{story.person.role}</span>
              </p>
            </div>
            <dl className="fl-cst-metrics">
              {story.metrics.map((m, i) => (
                <div key={m.label} className="fl-cst-metric" style={{ ["--i" as string]: i }}>
                  <dt>{m.label}</dt>
                  <dd>
                    <CountUp value={m.value} run={seen} />
                  </dd>
                </div>
              ))}
            </dl>
            {story.href ? (
              <a className="fl-link fl-cst-read" href={story.href}>
                {L.read}
                <span className="fl-sr">: {story.company}</span>
                <Icon name="arrow" />
              </a>
            ) : null}
          </div>
        </article>
      </div>

      <div className="fl-cst-nav">
        <div className="fl-cst-tabs" role="tablist" aria-label={label}>
          {stories.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`${uid}-t${i}`}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-controls={i === at ? `${uid}-p${i}` : undefined}
              tabIndex={i === at ? 0 : -1}
              className={i === at ? "fl-cst-tab is-on" : "fl-cst-tab"}
              onClick={() => go(i)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {s.company}
              <span className="fl-cst-track" aria-hidden="true">
                {i === at ? (
                  <span
                    key={`${s.id}-${at}`}
                    className={["fl-cst-fill", turning ? "is-timed" : "", running ? "" : "is-paused"].filter(Boolean).join(" ")}
                    onAnimationEnd={() => {
                      if (turning) go(at + 1);
                    }}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
        <div className="fl-cst-buttons">
          <Button variant="secondary" size={40} icon="chevron-left" iconOnly onClick={() => go(at - 1)}>
            {L.previous}
          </Button>
          {canMove && n > 1 ? (
            <Button variant="secondary" size={40} icon={stopped ? "play" : "pause"} iconOnly onClick={() => setStopped((s) => !s)}>
              {stopped ? L.play : L.pause}
            </Button>
          ) : null}
          <Button variant="secondary" size={40} icon="chevron-right" iconOnly onClick={() => go(at + 1)}>
            {L.next}
          </Button>
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Customer stories",
  title: "Teams that switched and never looked back",
  stories: [
    {
      id: "harbor",
      company: "Harbor Dental",
      industry: "Dental clinics",
      quote: "Patients move their own visits now. The phones went quiet and our chairs stayed full.",
      person: { name: "Dana Ruiz", role: "Practice manager" },
      metrics: [
        { value: "38%", label: "fewer no-shows" },
        { value: "11 hrs", label: "saved each week" },
        { value: "4.9", label: "patient rating" },
      ],
      picture: { alt: "A bright dental clinic front desk" },
      href: "#story-harbor",
    },
    {
      id: "peak",
      company: "Peak Physio",
      industry: "Physical therapy",
      quote: "We opened a second location without hiring another receptionist.",
      person: { name: "Omar Haddad", role: "Founder" },
      metrics: [
        { value: "2x", label: "locations, same front desk" },
        { value: "92%", label: "booked online" },
      ],
      picture: { alt: "A physiotherapist working with a client" },
      href: "#story-peak",
    },
    {
      id: "willow",
      company: "Willow Vet",
      industry: "Veterinary care",
      quote: "Reminders by text cut our late arrivals in half in the first month.",
      person: { name: "Mei Tanaka", role: "Head nurse" },
      metrics: [
        { value: "50%", label: "fewer late arrivals" },
        { value: "1,240", label: "visits a month" },
        { value: "3 days", label: "to set up" },
      ],
      picture: { alt: "A vet nurse holding a small dog" },
      href: "#story-willow",
    },
  ],
};

export default function CaseStudiesPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="case-studies-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="case-studies-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <CaseStudies label={d.eyebrow} stories={d.stories} />
      </div>
    </section>
  );
}
