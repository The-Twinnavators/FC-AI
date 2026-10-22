/** @flowcode-library team-grid · Team grid (Team)
 * Catalog ID: b.team-grid (block)
 * Function: The team grid block (b.team-grid): the people behind the product, with a role and a line each.
 * Use it as: import { TeamGrid } from "./team-grid"; <TeamGrid title eyebrow? people={[{name,role,text,photo?}]} />
 * Built from: c.avatar.person
 * Look: A centered heading above four columns of centered cards, each with a round avatar, a bold name, an eyebrow role and a muted sentence.
 * Tokens: --space-6 --space-9 --type-h3-size --color-surface --color-border --color-accent --color-text-muted
 * Use cases: team page; about us; meet the team; staff directory; leadership; our people; board members; speakers
 * Jobs to be done: see who is behind the product; find the right person to contact; trust the company by knowing the people; learn what each person does
 * Keywords: team, about, people, staff
 */
/**
 * Team: grid. The people behind the product, with a role and one line each. Make it the app's own: use only people
 * the PRD names; swap the initials for real photos (with alt text) when there are some.
 * Motion: the heading, then the people one after another, rise in once as the section comes into view; a card lifts a little under the pointer. With reduced motion they only fade; with animation off they are simply there.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "./avatars-variants";


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

export type TeamGridProps = {
  eyebrow?: string;
  title: string;
  /** Each person: name, role, one line about them, and an optional photo address (initials show without one). */
  people: { name: string; role: string; text: string; photo?: string }[];
};

export function TeamGrid({ eyebrow, title, people }: TeamGridProps) {
  const [ref, enter] = useEnterOnce<HTMLElement>();
  return (
    <section ref={ref} className={`fl-section fl-hx${enterClass(enter)}`} aria-labelledby="team-grid-title" data-fl="b.team-grid">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center fl-hx-seq">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id="team-grid-title" className="fl-title">
            {title}
          </h2>
        </div>
        <ul className="fl-grid fl-grid--4 fl-hx-items fl-hx-lift" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {people.map((p) => (
            <li key={p.name} className="fl-card" style={{ textAlign: "center", justifyItems: "center" }}>
              <Avatar name={p.name} size={72} src={p.photo} decorative />
              <h3>{p.name}</h3>
              <span className="fl-eyebrow">{p.role}</span>
              <p className="fl-text">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: TeamGridProps = {
  eyebrow: "The team",
  title: "Small team, big on care",
  people: [
    { name: "Jordan Lee", role: "Founder", text: "Ran a studio for eight years before building this." },
    { name: "Sam Patel", role: "Design", text: "Makes sure every screen feels calm." },
    { name: "Alex Kim", role: "Engineering", text: "Keeps your bookings fast and safe." },
    { name: "Rosa Diaz", role: "Support", text: "Answers every message, usually within the hour." },
  ],
};

export default function TeamGridPreview() {
  return <TeamGrid {...SAMPLE} />;
}
