/** @flowcode-library hero-signup · Hero with sign-up (Heroes)
 * Catalog ID: b.hero-signup (block)
 * Function: The sign-up hero block (b.hero-signup): a headline, a lede and an email sign-up that checks the address and confirms, above a browser-window frame holding a picture of the product with a floating proof chip.
 * Use it as: import { HeroSignup } from "./hero-signup"; <HeroSignup id title lede badge?={{ label, href? }} field?={{ label, placeholder? }} action="Start free" notes?={string[]} done?={{ title, text }} screen={{ alt, src?, address? }} proof?={{ value, label }} onSignup?={(email) => Promise<void> | void} />
 * Built from: c.button.primary, c.button.tertiary, c.text-field.outlined, c.media-frame, c.badge.status
 * Look: A centered stack: a small pill badge, a large display title, a muted lede, an email field joined to a primary button with small ticked notes under it; below, a wide rounded browser window (three dots and an address pill) holds the product picture, with a small surface chip showing one proof number floating over its corner.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-success --surface-radius --surface-shadow --pill-radius --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --space-8 --text-xs --text-sm --text-md --font-display --duration-base --duration-slow --ease-out --ease-spring --enter-distance --focus-ring
 * Use cases: saas homepage; product launch; app homepage; free trial signup; waitlist landing; beta signup; startup homepage; software landing page
 * Jobs to be done: understand what the product does; see the product before signing up; start a free trial with my email; join the waitlist
 * Keywords: hero, signup, email capture, product screenshot, browser frame, free trial, waitlist, landing, homepage
 */
/**
 * Sign-up hero: the top of a homepage that asks for one thing, an email, and shows the product right under the promise.
 * The form checks the address as you leave the field and again on send, says what is wrong next to the field, shows a
 * busy button while it sends, then replaces itself with a confirmation (focus moves to it) and a way to use another
 * address. The words rise in, then the product frame lifts in once; with reduced motion or animation off everything
 * is simply there. Make it the app's own: replace SAMPLE with the product's promise, a real screenshot (screen.src)
 * and a true proof number, and pass onSignup to send the address to the app's own sign-up.
 * Built from c.button, c.text-field, c.badge and c.media-frame.
 * Adapted from AstroWind (MIT License, Copyright (c) 2023 onWidget) and Landwind (MIT License, Copyright (c) 2022
 * Themesberg): their hero layouts (a centered promise with actions above a wide product image).
 */
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "./buttons-variants";
import { TextField } from "./text-fields-states";
import { MediaFrame } from "./media-frames";
import { Badge } from "./badges-status";
import { Icon, Tick } from "./icons";

export type HeroSignupProps = {
  /** Used for the heading's id, so the section can be labelled by it. */
  id: string;
  title: string;
  lede: string;
  /** A small pill above the title: news, a launch, an offer. */
  badge?: { label: string; href?: string };
  /** The email field's label (read by screen readers) and placeholder. */
  field?: { label: string; placeholder?: string };
  /** The button that sends the form. */
  action: string;
  /** Small ticked notes under the form ("No card needed"). */
  notes?: string[];
  /** Shown in place of the form once it is sent. */
  done?: { title: string; text: string };
  /** The product picture in the browser frame; without src a tinted stand-in is drawn. */
  screen: { alt: string; src?: string; address?: string };
  /** One proof number floating over the frame's corner. */
  proof?: { value: string; label: string };
  /** Sends the address. Return a promise to keep the button busy until it settles; throw to show an error. */
  onSignup?: (email: string) => Promise<void> | void;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const check = (v: string) => (!v.trim() ? "Enter your email." : EMAIL.test(v.trim()) ? "" : "Check the email address.");

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
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, state] as const;
}

export function HeroSignup({
  id,
  title,
  lede,
  badge,
  field = { label: "Work email", placeholder: "you@company.com" },
  action,
  notes,
  done = { title: "You're in", text: "Check your inbox for a link to get started." },
  screen,
  proof,
  onSignup,
}: HeroSignupProps) {
  const uid = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState("");
  const confirm = useRef<HTMLDivElement>(null);
  const [root, enter] = useEnterOnce<HTMLElement>();
  const focusField = () => document.getElementById(`${uid}-email`)?.focus();

  useEffect(() => {
    if (sent) confirm.current?.focus();
  }, [sent]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const why = check(email);
    setError(why);
    if (why) {
      focusField();
      return;
    }
    setBusy(true);
    try {
      await onSignup?.(email.trim());
      setSent(email.trim());
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setSent("");
    setEmail("");
    setError("");
    requestAnimationFrame(() => focusField());
  };

  return (
    <section
      ref={root}
      className={["fl-section", "fl-hps", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ")}
      aria-labelledby={`${id}-title`}
      data-fl="b.hero-signup"
    >
      <div className="fl-wrap fl-hps-inner">
        <div className="fl-hps-words">
          {badge ? (
            badge.href ? (
              <a className="fl-hps-badge fl-hps-rise" href={badge.href} style={{ ["--i" as string]: 0 }}>
                <Badge tone="info">New</Badge>
                <span>{badge.label}</span>
                <Icon name="chevron-right" />
              </a>
            ) : (
              <p className="fl-hps-badge fl-hps-rise" style={{ ["--i" as string]: 0 }}>
                <Badge tone="info">New</Badge>
                <span>{badge.label}</span>
              </p>
            )
          ) : null}
          <h1 id={`${id}-title`} className="fl-title fl-title--xl fl-hps-title fl-hps-rise" style={{ ["--i" as string]: 1 }}>
            {title}
          </h1>
          <p className="fl-lede fl-hps-lede fl-hps-rise" style={{ ["--i" as string]: 2 }}>
            {lede}
          </p>

          <div className="fl-hps-ask fl-hps-rise" style={{ ["--i" as string]: 3 }}>
            {sent ? (
              <div ref={confirm} className="fl-hps-done" role="status" tabIndex={-1}>
                <span className="fl-hps-done-mark" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <div>
                  <p className="fl-hps-done-title">{done.title}</p>
                  <p className="fl-hps-done-text">
                    {done.text} <span className="fl-hps-done-mail">{sent}</span>
                  </p>
                  <Button variant="tertiary" size={32} onClick={again}>
                    Use another email
                  </Button>
                </div>
              </div>
            ) : (
              <form className="fl-hps-form" onSubmit={submit} noValidate>
                <label htmlFor={`${uid}-email`} className="fl-sr">
                  {field.label}
                </label>
                <div className="fl-hps-row">
                  <TextField
                    id={`${uid}-email`}
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder={field.placeholder}
                    value={email}
                    invalid={!!error}
                    aria-describedby={error ? `${uid}-err` : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(check(e.target.value));
                    }}
                    onBlur={() => email && setError(check(email))}
                    className="fl-hps-input"
                  />
                  <Button type="submit" busy={busy} icon="arrow" iconAt="end">
                    {action}
                  </Button>
                </div>
                <p id={`${uid}-err`} className="fl-hps-err" aria-live="polite">
                  {error ? (
                    <>
                      <Icon name="alert" />
                      {error}
                    </>
                  ) : null}
                </p>
              </form>
            )}
            {notes?.length ? (
              <ul className="fl-hps-notes">
                {notes.map((n) => (
                  <li key={n}>
                    <Tick />
                    {n}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="fl-hps-stage">
          <figure className="fl-hps-window">
            <div className="fl-hps-bar" aria-hidden="true">
              <span className="fl-hps-dots">
                <i />
                <i />
                <i />
              </span>
              {screen.address ? <span className="fl-hps-address">{screen.address}</span> : null}
            </div>
            <MediaFrame ratio="16-9" src={screen.src} alt={screen.alt} art="b" className="fl-hps-shot" />
            {screen.src ? null : <figcaption className="fl-sr">{screen.alt}</figcaption>}
          </figure>
          {proof ? (
            <p className="fl-hps-proof">
              <strong>{proof.value}</strong>
              <span>{proof.label}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: Omit<HeroSignupProps, "onSignup"> = {
  id: "hero-signup",
  badge: { label: "Team calendars are here", href: "#news" },
  title: "Bookings that run themselves",
  lede: "Clients pick a time, pay a deposit and get reminders. You get your evenings back.",
  field: { label: "Work email", placeholder: "you@studio.com" },
  action: "Start free",
  notes: ["Free for 14 days", "No card needed", "Set up in 5 minutes"],
  done: { title: "You're in", text: "We sent a sign-in link to" },
  screen: { alt: "The week calendar with three bookings and a paid deposit", address: "app.slotwise.com/week" },
  proof: { value: "12,400", label: "studios booked this week" },
};

export default function HeroSignupPreview() {
  return <HeroSignup {...SAMPLE} onSignup={() => new Promise<void>((resolve) => setTimeout(resolve, 700))} />;
}
