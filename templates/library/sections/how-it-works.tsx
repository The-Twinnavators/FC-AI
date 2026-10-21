/** @flowcode-library how-it-works · How it works (Features)
 * Catalog ID: b.how-it-works (block)
 * Function: The how-it-works block (b.how-it-works): a numbered path of three to six steps joined by a line that fills as you go, each step opening to say more with a Next step button, and a picture beside it that follows the open step.
 * Use it as: import { HowItWorks } from "./how-it-works"; <HowItWorks label="How it works" steps={[{ id, title, text, more?, icon?, picture?: { src?, alt } }]} start?={0} cta?={{ label: "Book a class", href: "#book" }} nextLabel?="Next step" onStep?={(id) => ...} />
 * Built from: c.button.secondary, c.button.primary, c.media-frame
 * Look: A vertical line of round numbered markers, the ones reached filled with the accent and joined by an accent line, each with a bold step title and a short line; the open step shows more text and a Next step button. A large rounded picture sits beside the steps (above them on a phone) with the step's number and title over its corner.
 * Tokens: --color-accent --color-on-accent --color-surface --color-border --color-text --color-text-muted --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-sm --text-md --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: how it works; getting started; onboarding steps; booking process; ordering process; service process; first visit guide; product setup
 * Jobs to be done: understand how the service works; see what happens after I sign up; know what to do first; get to the next step
 * Keywords: how it works, steps, process, timeline, getting started, onboarding, numbered steps
 */
/**
 * How it works: a vertical, numbered path of steps for a marketing or product page. Every step is a button that opens
 * it (one open at a time, so the page stays short); the open step shows more text and a Next step button, the line
 * fills up to it, and the picture beside the list changes to that step. Up and Down move between steps, Home and End
 * jump to the ends. The steps rise in once as the block scrolls into view; with reduced motion or animation off they
 * are simply there. Use it on a homepage, a landing page or a service page. Make it the app's own: replace SAMPLE with
 * the product's real steps (three to six), their pictures and the call to action at the end.
 * Built from c.button and c.media-frame.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren): its step block (numbered markers on a line
 * beside a picture).
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

export type HowStep = {
  id: string;
  title: string;
  /** One short line, always shown. */
  text: string;
  /** More, shown while the step is open. */
  more?: string;
  /** An icon name from ./icons, drawn in the marker instead of the number once the step is reached. */
  icon?: string;
  /** The step's picture; without src a tinted stand-in is drawn. */
  picture?: { src?: string; alt: string };
};

export type HowItWorksProps = {
  /** Names the list of steps for screen readers. */
  label: string;
  steps: HowStep[];
  /** Which step is open first (its index). */
  start?: number;
  /** The button on every open step but the last. */
  nextLabel?: string;
  /** Shown on the last step instead of Next step. */
  cta?: { label: string; href?: string; onClick?: () => void };
  /** Called when a step opens. */
  onStep?: (id: string) => void;
};

const ARTS: MediaArt[] = ["a", "b", "c", "d", "e"];
const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the block is a third in view, then "in". Without an observer or with reduced motion it is shown at once. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || reduced()) return;
    // Already on screen: play now. Otherwise wait for it, but never leave it hidden (a page that isn't painting gets
    // the content after a moment either way).
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
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.25 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

export function HowItWorks({
  label,
  steps,
  start = 0,
  nextLabel = "Next step",
  cta,
  onStep,
}: HowItWorksProps) {
  const uid = useId();
  const [open, setOpen] = useState(
    Math.min(Math.max(start, 0), steps.length - 1),
  );
  const heads = useRef<Array<HTMLButtonElement | null>>([]);
  const [list, enter] = useEnterOnce<HTMLDivElement>();
  const step = steps[open];

  const choose = (i: number, focus = false) => {
    setOpen(i);
    onStep?.(steps[i]!.id);
    if (focus) heads.current[i]?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowDown") next = Math.min(steps.length - 1, i + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = steps.length - 1;
    if (next === null) return;
    e.preventDefault();
    heads.current[next]?.focus();
  };

  if (!step) return null;

  return (
    <div className="fl-how" data-fl="b.how-it-works">
      <div className="fl-how-grid">
        <div className="fl-how-media">
          {/* Every step's picture is stacked; the open one fades in over the rest. */}
          <div className="fl-how-stack">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={i === open ? "fl-how-pic is-on" : "fl-how-pic"}
                aria-hidden={i !== open}
              >
                <MediaFrame
                  ratio="4-3"
                  src={s.picture?.src}
                  alt={s.picture?.alt ?? ""}
                  art={ARTS[i % ARTS.length]}
                />
              </div>
            ))}
            <p className="fl-how-tag" aria-hidden="true">
              <span>{String(open + 1).padStart(2, "0")}</span>
              {step.title}
            </p>
          </div>
        </div>

        <div
          ref={list}
          className={[
            "fl-how-steps",
            enter === "wait" ? "is-waiting" : "",
            enter === "in" ? "is-entering" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <ol className="fl-how-list" aria-label={label}>
            {steps.map((s, i) => {
              const isOpen = i === open;
              const reached = i <= open;
              const last = i === steps.length - 1;
              return (
                <li
                  key={s.id}
                  className={[
                    "fl-how-step",
                    isOpen ? "is-open" : "",
                    reached ? "is-reached" : "",
                    i < open ? "is-passed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ ["--i" as string]: i }}
                  aria-current={isOpen ? "step" : undefined}
                >
                  <span className="fl-how-mark" aria-hidden="true">
                    {reached && s.icon && !isOpen ? (
                      <Icon name={s.icon} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <div className="fl-how-body">
                    <h3 className="fl-how-title">
                      <button
                        ref={(el) => {
                          heads.current[i] = el;
                        }}
                        type="button"
                        className="fl-how-head"
                        id={`${uid}-h${i}`}
                        aria-expanded={isOpen}
                        aria-controls={`${uid}-p${i}`}
                        onClick={() => choose(i)}
                        onKeyDown={(e) => onKey(e, i)}
                      >
                        <span className="fl-sr">
                          Step {i + 1} of {steps.length}:{" "}
                        </span>
                        {s.title}
                        <span className="fl-how-chev" aria-hidden="true">
                          <Icon name="chevron-down" />
                        </span>
                      </button>
                    </h3>
                    <p className="fl-how-text">{s.text}</p>
                    <div
                      className="fl-how-more"
                      id={`${uid}-p${i}`}
                      inert={!isOpen}
                    >
                      <div>
                        {s.more ? <p>{s.more}</p> : null}
                        <div className="fl-how-actions">
                          {!last ? (
                            <Button
                              variant="secondary"
                              size={40}
                              icon="chevron-right"
                              iconAt="end"
                              onClick={() => choose(i + 1, true)}
                            >
                              {nextLabel}
                            </Button>
                          ) : cta ? (
                            cta.href ? (
                              <Button
                                size={40}
                                href={cta.href}
                                onClick={cta.onClick}
                              >
                                {cta.label}
                              </Button>
                            ) : (
                              <Button size={40} onClick={cta.onClick}>
                                {cta.label}
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "How it works",
  title: "From first visit to your own glaze",
  lede: "Four steps, about six weeks, no experience needed.",
  steps: [
    {
      id: "book",
      title: "Book a taster",
      text: "Pick a two-hour evening that suits you.",
      more: "Tasters run Tuesday to Saturday. Clay, tools and an apron are included, and you can bring a friend at half price.",
      icon: "calendar",
      picture: { alt: "A row of potter's wheels in a bright studio" },
    },
    {
      id: "throw",
      title: "Throw your first pots",
      text: "A teacher stays with you at the wheel.",
      more: "Most people center the clay by the end of the first hour and leave with two or three pieces drying on the shelf.",
      icon: "sparkle",
      picture: { alt: "Hands shaping a bowl on a wheel" },
    },
    {
      id: "glaze",
      title: "Choose a glaze",
      text: "Come back a week later to trim and glaze.",
      more: "Pick from twenty house glazes. We test every batch, so the color on the tile is the color you get.",
      icon: "layers",
      picture: { alt: "Glaze test tiles in a grid on a shelf" },
    },
    {
      id: "collect",
      title: "Take it home",
      text: "We fire it, you collect it, or we post it.",
      more: "Firing takes about ten days. We send a message when your pieces are ready, and postage within the city is free.",
      icon: "home",
      picture: { alt: "Finished mugs wrapped in paper on a counter" },
    },
  ],
  cta: { label: "Book a taster", href: "#book" },
};

export default function HowItWorksSheet() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section" aria-labelledby="how-it-works-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="how-it-works-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <HowItWorks
          label={d.eyebrow}
          steps={d.steps}
          cta={{
            label: d.cta.label,
            href: d.cta.href,
            onClick: () => setSaid("Booking opens here in the real app."),
          }}
          onStep={(id) =>
            setSaid(`Showing ${d.steps.find((s) => s.id === id)?.title ?? ""}.`)
          }
        />
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
