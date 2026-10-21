/** @flowcode-library testimonials-wall · Testimonial wall (Testimonials)
 * Catalog ID: b.testimonials-wall (block)
 * Function: The testimonial wall block (b.testimonials-wall): many short quotes in a masonry of cards with stars, a face, a name and a role, an overall rating above, and a Show more button that reveals the rest a batch at a time.
 * Use it as: import { TestimonialsWall } from "./testimonials-wall"; <TestimonialsWall label="Reviews" quotes={[{ id, quote, name, role?, rating?: 1-5, avatar?, highlight? }]} summary?={{ rating: 4.9, label: "from 1,240 reviews" }} show?={6} step?={6} moreLabel?="Show more" lessLabel?="Show less" />
 * Built from: c.avatar.person, c.button.secondary
 * Look: Three columns (two on a tablet, one on a phone) of rounded surface cards of different heights, each with a row of accent stars, the quote, and a small face with a name and role; a highlighted card is tinted with the accent. While more are hidden the wall fades out at its foot above a centered Show more button with the count left.
 * Tokens: --color-accent --color-on-accent --color-surface --color-bg --color-border --color-text --color-text-muted --color-warning --surface-radius --surface-shadow --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-sm --text-md --text-2xl --font-display --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: customer reviews; testimonials; wall of love; social proof; saas homepage; app reviews; client feedback; course reviews
 * Jobs to be done: see what people like me say about it; trust the product before I sign up; read more reviews; check the overall rating
 * Keywords: testimonials, reviews, wall of love, masonry, quotes, social proof, ratings, stars, show more
 */
/**
 * Testimonial wall: lots of proof without a long page. The first few quotes show in a masonry (the cards keep their
 * own heights and fill the columns), the rest wait behind Show more, which reveals the next batch, moves focus to the
 * first new card and says how many are left; once all are shown it becomes Show less, which folds the wall back and
 * returns focus to the button. The cards rise in once as the wall scrolls into view, and new cards rise in when they
 * appear; with reduced motion or animation off they are simply there. Make it the app's own: replace SAMPLE with real
 * quotes from real customers (with permission), their real roles and pictures, and the true overall rating.
 * Built from c.avatar and c.button.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren) and AstroWind (MIT License, Copyright (c)
 * 2023 onWidget): their testimonial blocks (quote cards with a face, a name and a role).
 */
import { useEffect, useId, useRef, useState } from "react";
import { Avatar, type AvatarTone } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

export type WallQuote = {
  id: string;
  quote: string;
  name: string;
  role?: string;
  /** Stars out of five. */
  rating?: number;
  /** A picture of the person; their initials show without one. */
  avatar?: string;
  /** Tints the card with the accent: one or two per wall. */
  highlight?: boolean;
};

export type TestimonialsWallProps = {
  /** Names the list of quotes for screen readers. */
  label: string;
  quotes: WallQuote[];
  /** The overall rating above the wall. */
  summary?: { rating: number; label: string };
  /** How many show at first. */
  show?: number;
  /** How many more each Show more reveals; all of the rest when left out. */
  step?: number;
  moreLabel?: string;
  lessLabel?: string;
};

const TONES: AvatarTone[] = ["a", "b", "c", "d", "e"];

const still = () =>
  typeof window === "undefined" ||
  document.documentElement.dataset.motion === "off" ||
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: "wait" until the wall is in view, then "in". Without an observer, or with motion off, it is shown at once. */
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
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.1 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

function Stars({ value }: { value: number }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="fl-twall-stars" role="img" aria-label={`Rated ${n} out of 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={i < n ? "is-on" : undefined} aria-hidden="true">
          <Icon name="star" filled={i < n} />
        </span>
      ))}
    </span>
  );
}

export function TestimonialsWall({ label, quotes, summary, show = 6, step, moreLabel = "Show more", lessLabel = "Show less" }: TestimonialsWallProps) {
  const uid = useId();
  const first = Math.min(show, quotes.length);
  const [count, setCount] = useState(first);
  const [freshFrom, setFreshFrom] = useState<number | null>(null);
  const button = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const [wall, enter] = useEnterOnce<HTMLDivElement>();
  const left = quotes.length - count;
  const all = left <= 0;

  // After Show more, focus goes to the first new card so keyboard and screen reader users land on what appeared.
  useEffect(() => {
    if (freshFrom === null) return;
    document.getElementById(`${uid}-q${freshFrom}`)?.focus({ preventScroll: false });
  }, [freshFrom, uid]);

  const more = () => {
    const next = step ? Math.min(quotes.length, count + step) : quotes.length;
    setFreshFrom(count);
    setCount(next);
  };
  const less = () => {
    setFreshFrom(null);
    setCount(first);
    requestAnimationFrame(() => {
      button.current?.focus({ preventScroll: true });
      wall.current?.scrollIntoView({ block: "start", behavior: still() ? "auto" : "smooth" });
    });
  };

  const nextBatch = step ? Math.min(step, left) : left;

  return (
    <div
      ref={wall}
      className={["fl-twall", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : "", all ? "" : "has-more"].filter(Boolean).join(" ")}
      data-fl="b.testimonials-wall"
    >
      {summary ? (
        <p className="fl-twall-summary">
          <strong>{summary.rating.toFixed(1)}</strong>
          <Stars value={summary.rating} />
          <span>{summary.label}</span>
        </p>
      ) : null}
      <div className="fl-twall-cols">
        <ul className="fl-twall-list" aria-label={label} id={`${uid}-list`}>
          {quotes.slice(0, count).map((q, i) => (
            <li
              key={q.id}
              className={["fl-twall-item", freshFrom !== null && i >= freshFrom ? "is-new" : ""].filter(Boolean).join(" ")}
              style={{ ["--i" as string]: freshFrom !== null && i >= freshFrom ? i - freshFrom : i }}
            >
              <figure className={q.highlight ? "fl-twall-card is-highlight" : "fl-twall-card"} id={`${uid}-q${i}`} tabIndex={-1}>
                {q.rating ? <Stars value={q.rating} /> : null}
                <blockquote className="fl-twall-quote">
                  <p>{q.quote}</p>
                </blockquote>
                <figcaption className="fl-twall-who">
                  <Avatar name={q.name} size={40} src={q.avatar} tone={TONES[i % TONES.length]} decorative />
                  <span>
                    <span className="fl-twall-name">{q.name}</span>
                    {q.role ? <span className="fl-twall-role">{q.role}</span> : null}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
      {quotes.length > first ? (
        <div className="fl-twall-foot">
          <Button
            ref={button}
            variant="secondary"
            size={44}
            icon={all ? "chevron-down" : "plus"}
            className={all ? "fl-twall-btn is-less" : "fl-twall-btn"}
            aria-controls={`${uid}-list`}
            onClick={all ? less : more}
          >
            {all ? lessLabel : `${moreLabel} (${nextBatch})`}
          </Button>
          <p className="fl-sr" role="status" aria-live="polite">
            {freshFrom !== null && count > first ? `Showing ${count} of ${quotes.length} reviews.` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Reviews",
  title: "Studios that stopped chasing bookings",
  summary: { rating: 4.9, label: "from 1,240 reviews" },
  quotes: [
    { id: "q1", rating: 5, quote: "No-shows dropped the first week we turned on deposits. I wish we'd done it years ago.", name: "Maya Okafor", role: "Owner, Clay Room" },
    {
      id: "q2",
      rating: 5,
      highlight: true,
      quote: "I used to spend Sunday nights texting everyone their times for the week. Now the reminders go out on their own and I just teach. Our Tuesday class has had a waitlist for three months.",
      name: "Tom Becker",
      role: "Yoga teacher",
    },
    { id: "q3", rating: 5, quote: "Set up in an afternoon.", name: "Priya Nair", role: "Piano teacher" },
    { id: "q4", rating: 4, quote: "The class packs are the best part. Clients buy ten at once and I know who's coming back.", name: "Luis Romero", role: "Pilates studio" },
    { id: "q5", rating: 5, quote: "Our front desk answers half as many calls. People just book online, even the regulars who swore they never would.", name: "Hannah Wei", role: "Studio manager" },
    { id: "q6", rating: 5, quote: "Payouts every Friday, no surprises.", name: "Sam Patel", role: "Personal trainer" },
    { id: "q7", rating: 5, quote: "Moving our three teachers onto one calendar ended the double bookings overnight.", name: "Ana Costa", role: "Dance school" },
    { id: "q8", rating: 4, quote: "Clients like that they can move a booking from the reminder. Fewer messages for me.", name: "Jonas Berg", role: "Climbing coach" },
    { id: "q9", rating: 5, highlight: true, quote: "It paid for itself in the first month from deposits alone.", name: "Grace Liu", role: "Owner, Kiln & Co" },
    { id: "q10", rating: 5, quote: "Support answered in ten minutes on a Saturday.", name: "Omar Haddad", role: "Boxing gym" },
    { id: "q11", rating: 5, quote: "The weekly email with our busiest hours helped us add a Thursday class that sells out.", name: "Elena Rossi", role: "Barre studio" },
  ] satisfies WallQuote[],
};

export default function TestimonialsWallPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="testimonials-wall-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="testimonials-wall-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <TestimonialsWall label={d.eyebrow} quotes={d.quotes} summary={d.summary} show={6} step={3} />
      </div>
    </section>
  );
}
