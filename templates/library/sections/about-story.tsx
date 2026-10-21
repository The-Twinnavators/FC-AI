/** @flowcode-library about-story · About us story (Features)
 * Catalog ID: b.about-story (block)
 * Function: The about-us story block (b.about-story): the mission beside a picture, a row of value cards, and the founding story as a year rail you step through, each year opening its milestone with a picture.
 * Use it as: import { AboutStory } from "./about-story"; <AboutStory mission={{ eyebrow?, title, text, signature?, since?: "Since 2019", picture?: { src?, alt } }} values={[{ id, icon, title, text }]} valuesTitle? storyTitle? milestones={[{ id, year, title, text, tag?, picture?: { src?, alt } }]} start?="id" labels?={{ previous, next, of }} onStep?={(id) => ...} />  // use only the company's real history
 * Built from: c.media-frame, c.button.secondary
 * Look: A two-part opener: a large display mission line with a muted paragraph and a signature on the left, a rounded picture on the right with a small year pill over its corner. Under it three or four white value cards with a square tinted icon tile, a bold name and a muted line. Then the story: a row of years on a thin rule with a straight accent bar that fills up to the chosen year, and a wide white card with the milestone's picture, a small tag, a bold title, a muted paragraph and round Previous and Next buttons with "2 of 6".
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-md --text-lg --text-2xl --font-display --weight-semibold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: about us page; company story; our mission; founding story; company history; who we are; brand story
 * Jobs to be done: understand why the company exists; see what it stands for; learn how it got here; trust the people behind the product
 * Keywords: about us, mission, values, story, history, timeline, milestones, founding, company, who we are
 */
/**
 * About us story: the three things an about page has to say, in order. Why we exist (the mission, said in one line),
 * what we stand for (the values as cards), and how we got here (a timeline you step through rather than scroll past).
 * The year rail is a tablist: arrow keys, Home and End move between years, and the straight bar under it fills up to the
 * chosen one. Previous and Next step the same story and say "2 of 6". The whole block rises in once as it comes into
 * view. Make it the app's own: replace SAMPLE with the company's own words and dates.
 * Adapted from AstroWind (MIT, Copyright (c) 2023 onWidget): its about page (hero, feature grid and timeline widgets).
 */
/**
 * How to try it
 * - Press a year on the rail: the bar slides to it and the card below shows that milestone.
 * - Tab to the rail and use the Left and Right arrows, Home and End: the chosen year follows and keeps focus.
 * - Press Next until the last year: Next turns off; Previous walks back.
 * - Narrow the window to a phone: the opener stacks, the value cards go to one column and the rail keeps every year.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's MediaFrame and Button
 * ("./media-frames", "./buttons-variants") and its inline icon set ("./icons"). Nothing else: no package and nothing
 * fetched. The styles are the library's own fl- classes in templates/library/css/r4c-about-story.css.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { MediaFrame } from "./media-frames";

export type AboutPicture = { src?: string; alt: string };
export type AboutValue = {
  id: string;
  icon: string;
  title: string;
  text: string;
};
export type AboutMilestone = {
  id: string;
  year: string;
  title: string;
  text: string;
  tag?: string;
  picture?: AboutPicture;
};

export type AboutStoryProps = {
  mission: {
    eyebrow?: string;
    title: string;
    text: string;
    signature?: string;
    since?: string;
    picture?: AboutPicture;
  };
  valuesTitle?: string;
  values: AboutValue[];
  storyTitle?: string;
  milestones: AboutMilestone[];
  /** The milestone shown first; the last one when left out. */
  start?: string;
  labels?: { previous?: string; next?: string; of?: string; years?: string };
  onStep?: (id: string) => void;
};

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: plays now when already on screen, else on view, and never later than 1.2s. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
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
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && show(),
      { threshold: 0.1 },
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

const ART = ["a", "b", "c", "d", "e"] as const;

export function AboutStory({
  mission,
  valuesTitle = "What we stand for",
  values,
  storyTitle = "How we got here",
  milestones,
  start,
  labels = {},
  onStep,
}: AboutStoryProps) {
  const uid = useId();
  const L = {
    previous: labels.previous ?? "Previous",
    next: labels.next ?? "Next",
    of: labels.of ?? "of",
    years: labels.years ?? "Years",
  };
  const first = Math.max(
    0,
    start ? milestones.findIndex((m) => m.id === start) : milestones.length - 1,
  );
  const [at, setAt] = useState(first);
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const rail = useRef<HTMLDivElement>(null);
  const [fill, setFill] = useState(0);

  // The bar runs from the first year's center to the chosen year's center.
  useLayoutEffect(() => {
    const measure = () => {
      const b = tabs.current[at];
      const a = tabs.current[0];
      if (!a || !b) return;
      setFill(
        b.offsetLeft + b.offsetWidth / 2 - (a.offsetLeft + a.offsetWidth / 2),
      );
    };
    measure();
    const ro =
      typeof ResizeObserver !== "undefined" && rail.current
        ? new ResizeObserver(measure)
        : null;
    if (ro && rail.current) ro.observe(rail.current);
    return () => ro?.disconnect();
  }, [at, milestones.length]);

  const go = (i: number, focus = false) => {
    const n = Math.max(0, Math.min(milestones.length - 1, i));
    setAt(n);
    onStep?.(milestones[n]!.id);
    if (focus) tabs.current[n]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = milestones.length - 1;
    const n =
      e.key === "ArrowRight"
        ? Math.min(last, i + 1)
        : e.key === "ArrowLeft"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (n === null) return;
    e.preventDefault();
    go(n, true);
  };

  const m = milestones[at];
  const cls = [
    "fl-abs",
    enter === "wait" ? "is-waiting" : "",
    enter === "in" ? "is-entering" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={root} className={cls} data-fl="b.about-story">
      <div className="fl-abs-mission">
        <div
          className="fl-abs-words fl-abs-rise"
          style={{ "--i": 0 } as CSSProperties}
        >
          {mission.eyebrow ? (
            <p className="fl-abs-eyebrow">{mission.eyebrow}</p>
          ) : null}
          <h3 className="fl-abs-statement">{mission.title}</h3>
          <p className="fl-abs-text">{mission.text}</p>
          {mission.signature ? (
            <p className="fl-abs-sign">{mission.signature}</p>
          ) : null}
        </div>
        <div
          className="fl-abs-photo fl-abs-rise"
          style={{ "--i": 1 } as CSSProperties}
        >
          <MediaFrame
            ratio="4-3"
            src={mission.picture?.src}
            alt={mission.picture?.alt ?? ""}
            art="b"
          />
          {mission.since ? (
            <span className="fl-abs-since">{mission.since}</span>
          ) : null}
        </div>
      </div>

      <section className="fl-abs-values" aria-labelledby={`${uid}-v`}>
        <h3 id={`${uid}-v`} className="fl-abs-h">
          {valuesTitle}
        </h3>
        <ul className="fl-abs-cards">
          {values.map((v, i) => (
            <li
              key={v.id}
              className="fl-abs-card fl-abs-rise"
              style={{ "--i": i + 2 } as CSSProperties}
            >
              <span className="fl-abs-icon" aria-hidden="true">
                <Icon name={v.icon} />
              </span>
              <h4 className="fl-abs-card-title">{v.title}</h4>
              <p className="fl-abs-card-text">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {milestones.length && m ? (
        <section
          className="fl-abs-story fl-abs-rise"
          style={{ "--i": values.length + 2 } as CSSProperties}
          aria-labelledby={`${uid}-s`}
        >
          <h3 id={`${uid}-s`} className="fl-abs-h">
            {storyTitle}
          </h3>
          <div
            ref={rail}
            className="fl-abs-rail"
            role="tablist"
            aria-label={`${storyTitle}: ${L.years}`}
            style={{ "--n": milestones.length } as CSSProperties}
          >
            <span className="fl-abs-line" aria-hidden="true" />
            <span
              className="fl-abs-fill"
              aria-hidden="true"
              style={{ width: fill }}
            />
            {milestones.map((x, i) => (
              <button
                key={x.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-t${i}`}
                aria-selected={i === at}
                aria-controls={`${uid}-p`}
                tabIndex={i === at ? 0 : -1}
                className={[
                  "fl-abs-year",
                  i === at ? "is-on" : "",
                  i < at ? "is-past" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => go(i)}
                onKeyDown={(e) => onKey(e, i)}
              >
                <span className="fl-abs-dot" aria-hidden="true" />
                <span className="fl-abs-yr">{x.year}</span>
              </button>
            ))}
          </div>

          <div
            id={`${uid}-p`}
            role="tabpanel"
            aria-labelledby={`${uid}-t${at}`}
            className="fl-abs-panel"
          >
            <div key={m.id} className="fl-abs-swap">
              <div className="fl-abs-panel-pic">
                <MediaFrame
                  ratio="4-3"
                  src={m.picture?.src}
                  alt={m.picture?.alt ?? ""}
                  art={ART[at % ART.length]}
                />
              </div>
              <div className="fl-abs-panel-body">
                <p className="fl-abs-meta">
                  <span className="fl-abs-panel-year">{m.year}</span>
                  {m.tag ? <span className="fl-abs-tag">{m.tag}</span> : null}
                </p>
                <h4 className="fl-abs-panel-title">{m.title}</h4>
                <p className="fl-abs-panel-text">{m.text}</p>
                <div className="fl-abs-step">
                  <Button
                    variant="secondary"
                    size={40}
                    icon="chevron-left"
                    iconOnly
                    onClick={() => go(at - 1)}
                    disabled={at === 0}
                  >
                    {L.previous}
                  </Button>
                  <span className="fl-abs-count" aria-live="polite">
                    {at + 1} {L.of} {milestones.length}
                  </span>
                  <Button
                    variant="secondary"
                    size={40}
                    icon="chevron-right"
                    iconOnly
                    onClick={() => go(at + 1)}
                    disabled={at === milestones.length - 1}
                  >
                    {L.next}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "About us",
  title: "Built by people who ran the front desk",
  lede: "We spent years booking clients by phone. So we made the tool we wanted.",
  mission: {
    eyebrow: "Our mission",
    title: "Give small studios their evenings back.",
    text: "Every hour spent chasing bookings and payments is an hour not spent with clients or family. We build the quiet back office that runs while you work, so the busy part of running a studio fits inside the working day.",
    signature: "Maya Lindqvist and Dev Okafor, founders",
    since: "Since 2019",
    picture: { alt: "The founders at the first studio's front desk" },
  },
  values: [
    {
      id: "plain",
      icon: "sparkle",
      title: "Say it plainly",
      text: "No jargon in the app, the invoices or the help pages.",
    },
    {
      id: "owner",
      icon: "users",
      title: "Owners first",
      text: "We ask a studio owner before we ship anything big.",
    },
    {
      id: "calm",
      icon: "clock",
      title: "Calm by default",
      text: "Fewer alerts, fewer clicks, no dark patterns.",
    },
    {
      id: "trust",
      icon: "shield",
      title: "Earn the trust",
      text: "Your clients' data is theirs. We never sell it.",
    },
  ],
  milestones: [
    {
      id: "m1",
      year: "2019",
      tag: "The start",
      title: "A spreadsheet in a yoga studio",
      text: "Maya runs bookings for her studio in Portland from a shared sheet and a phone. Dev, a regular, offers to build something better over a weekend.",
    },
    {
      id: "m2",
      year: "2020",
      tag: "First users",
      title: "Twelve studios, one group chat",
      text: "Word spreads to other studios nearby. Every feature request lands in one busy group chat, and we answer each one ourselves.",
    },
    {
      id: "m3",
      year: "2021",
      tag: "Funding",
      title: "A small seed round",
      text: "We raise $1.2M from studio owners and two angel investors, and hire our first support lead and designer.",
    },
    {
      id: "m4",
      year: "2023",
      tag: "Payments",
      title: "Taking payments in the app",
      text: "Deposits and no-show fees arrive. Studios cut missed visits by a third in their first month.",
    },
    {
      id: "m5",
      year: "2025",
      tag: "Growth",
      title: "5,000 studios in 14 countries",
      text: "Salons, clinics and trainers join the studios. The team grows to 48 people, most of them remote.",
    },
    {
      id: "m6",
      year: "2026",
      tag: "Today",
      title: "A mobile app for the whole team",
      text: "Staff check schedules, take payments and message clients from their phones, all from the same account.",
    },
  ],
};

export default function AboutStoryPreview() {
  const d = SAMPLE;
  return (
    <section
      className="fl-section fl-section--canvas"
      aria-labelledby="about-story-title"
    >
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="about-story-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <AboutStory
          mission={d.mission}
          values={d.values}
          milestones={d.milestones}
          start="m3"
        />
      </div>
    </section>
  );
}
