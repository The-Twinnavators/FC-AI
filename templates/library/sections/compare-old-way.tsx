/** @flowcode-library compare-old-way · Us vs. the old way (Features)
 * Catalog ID: b.compare-old-way (block)
 * Function: The before-and-after comparison block (b.compare-old-way): the old way and the product's way side by side, row for row on the same topics, with a total at the foot of each and a switch between the two on a phone.
 * Use it as: import { CompareOldWay } from "./compare-old-way"; <CompareOldWay label="Compare" old={{ title, text?, total?: { value, label } }} ours={{ title, text?, badge?, total? }} rows={[{ id, topic, old, ours }]} start?="ours"|"old" cta?={{ label, href }} />
 * Built from: c.segmented.toggle, c.badge.status, c.button.primary
 * Look: Two rounded columns of equal rows: the old way on a sunken muted card with gray crosses, the product's way on a surface card with an accent border, a badge and accent ticks; each row names the topic in small caps over one plain line, rows line up across both columns, and a big total closes each card. On a phone a pill switch shows one side at a time.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-radius --surface-shadow --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-md --text-2xl --font-display --tracking-wide --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: why switch; before and after; us vs. them; comparison with spreadsheets; old way vs. new way; saas homepage; product benefits; replacing manual work
 * Jobs to be done: see what changes if I switch; compare it with how I work now; understand the time it saves; decide if it is worth switching
 * Keywords: comparison, versus, vs, before and after, old way, new way, why us, alternatives, switch
 */
/**
 * Us vs. the old way: the case for switching, told on the same topics twice. The rows line up across both columns
 * (the grid shares its rows), so each topic reads straight across. On a phone the columns stack into one, and a switch
 * (two pressed-state buttons, reached with Tab) shows the old way or the product's way, starting on the product's.
 * The rows rise in once, the old side first and then the product's side with its ticks popping in; with reduced motion
 * or animation off everything is simply there. Make it the app's own: replace SAMPLE with the real steps people take
 * today and what the product does instead, four to six rows, and only totals you can stand behind.
 * Built from c.segmented, c.badge and c.button.
 * Adapted from AstroWind (MIT License, Copyright (c) 2023 onWidget): its Comparison widget's "versus" mode (your
 * product against the alternatives, the highlighted column being you).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Segmented } from "./segmented-control";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

export type CompareRow = { id: string; topic: string; old: string; ours: string };
export type CompareSide = { title: string; text?: string; badge?: string; total?: { value: string; label: string } };

export type CompareOldWayProps = {
  /** Names the switch for screen readers. */
  label: string;
  old: CompareSide;
  ours: CompareSide;
  rows: CompareRow[];
  /** Which side a phone shows first. */
  start?: "ours" | "old";
  cta?: { label: string; href?: string; onClick?: () => void };
};

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
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.15 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

export function CompareOldWay({ label, old, ours, rows, start = "ours", cta }: CompareOldWayProps) {
  const uid = useId();
  const [side, setSide] = useState<"ours" | "old">(start);
  const [box, enter] = useEnterOnce<HTMLDivElement>();

  const column = (which: "old" | "ours", s: CompareSide) => (
    <div
      className={`fl-vsw-col fl-vsw-col--${which}`}
      id={`${uid}-${which}`}
      role="group"
      aria-labelledby={`${uid}-${which}-h`}
      style={{ gridRow: `1 / span ${rows.length + 2}` }}
    >
      <div className="fl-vsw-head">
        <div className="fl-vsw-head-top">
          <h3 id={`${uid}-${which}-h`} className="fl-vsw-title">
            {s.title}
          </h3>
          {s.badge ? <Badge tone={which === "ours" ? "success" : "neutral"}>{s.badge}</Badge> : null}
        </div>
        {s.text ? <p className="fl-vsw-sub">{s.text}</p> : null}
      </div>
      <ul className="fl-vsw-rows" style={{ gridRow: `span ${rows.length}` }}>
        {rows.map((r, i) => (
          <li key={r.id} className="fl-vsw-row" style={{ ["--i" as string]: i + (which === "ours" ? rows.length : 0) }}>
            <span className="fl-vsw-mark" aria-hidden="true">
              <Icon name={which === "ours" ? "check" : "close"} />
            </span>
            <span className="fl-vsw-cell">
              <span className="fl-vsw-topic">{r.topic}</span>
              <span className="fl-vsw-line">
                <span className="fl-sr">{which === "ours" ? "Yes: " : "No: "}</span>
                {which === "ours" ? r.ours : r.old}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="fl-vsw-total">
        {s.total ? (
          <>
            <strong>{s.total.value}</strong>
            <span>{s.total.label}</span>
          </>
        ) : null}
      </p>
    </div>
  );

  return (
    <div
      ref={box}
      className={["fl-vsw", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}
      data-fl="b.compare-old-way"
    >
      <div className="fl-vsw-switch">
        <Segmented
          variant="toggle"
          label={label}
          value={side}
          onChange={(v) => setSide(v === "old" ? "old" : "ours")}
          options={[
            { value: "old", label: old.title },
            { value: "ours", label: ours.title },
          ]}
        />
      </div>
      <div className="fl-vsw-grid" data-show={side}>
        {column("old", old)}
        {column("ours", ours)}
      </div>
      {cta ? (
        <div className="fl-vsw-cta">
          {cta.href ? (
            <Button href={cta.href} onClick={cta.onClick} icon="arrow" iconAt="end">
              {cta.label}
            </Button>
          ) : (
            <Button onClick={cta.onClick} icon="arrow" iconAt="end">
              {cta.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Why switch",
  title: "Less admin, more teaching",
  lede: "What a week of bookings looks like before and after.",
  old: { title: "The old way", text: "Messages, a paper diary and a spreadsheet.", total: { value: "6 hrs", label: "of admin a week" } },
  ours: { title: "With Slotwise", text: "One calendar that does the chasing.", badge: "Saves 5 hrs", total: { value: "1 hr", label: "of admin a week" } },
  rows: [
    { id: "book", topic: "Booking", old: "Back-and-forth messages to find a time", ours: "Clients pick an open time themselves" },
    { id: "pay", topic: "Payment", old: "Cash on the day, or chasing transfers", ours: "Deposit taken when they book" },
    { id: "remind", topic: "Reminders", old: "Texting everyone the night before", ours: "Sent for you, the day before" },
    { id: "cancel", topic: "Cancellations", old: "An empty spot nobody hears about", ours: "The waitlist fills it in minutes" },
    { id: "report", topic: "Money in", old: "Adding it up at the end of the month", ours: "A live total, by class and by teacher" },
  ] satisfies CompareRow[],
  cta: { label: "Try it free", href: "#start" },
};

export default function CompareOldWayPreview() {
  const d = SAMPLE;
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section" aria-labelledby="compare-old-way-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="compare-old-way-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <CompareOldWay
          label="Show"
          old={d.old}
          ours={d.ours}
          rows={d.rows}
          cta={{ ...d.cta, onClick: () => setSaid("Sign-up opens here in the real app.") }}
        />
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </div>
    </section>
  );
}
