/** @flowcode-library volunteer-signup · Volunteer sign-up (Forms)
 * Catalog ID: b.volunteer-signup (block)
 * Function: The volunteer sign-up block (b.volunteer-signup): role cards with what each needs and how many spots are left, a shift picker for the chosen role (full shifts shown but closed), a short form (name, email, phone, an age check when the role needs it) and a confirmation that holds the spot.
 * Use it as: import { VolunteerSignup } from "./volunteer-signup"; <VolunteerSignup roles={[{ id, name, icon, text, needs?: ["18+"], adult?: true, shifts: [{ id, start: ISO, end: ISO, spots: 6, taken: 4 }] }]} title? onSignUp?={async ({ role, shift, name, email, phone, note }) => ...} locale? />  // connect onSignUp to the real roster
 * Built from: c.button.primary, c.button.secondary, c.text-field.outlined, c.checkbox, c.animated-number
 * Look: Three numbered steps on the canvas. Step 1 is a row of white role cards with a tinted icon tile, a bold name, a muted line, small requirement pills and "8 spots left" over a thin straight bar; the chosen card gets an accent ring and lifts. Step 2 opens below with shift tiles grouped by day, each with the time and spots left, full ones struck through. Step 3 is a white card with name, email, phone, an age check and a full-width button naming the shift. After signing up the card settles into a confirmation with a drawn check.
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-success --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --space-7 --text-xs --text-sm --text-md --text-lg --text-xl --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: volunteer sign-up; nonprofit volunteers; food bank shifts; event volunteers; community clean-up; mentoring program; shelter volunteers; charity run marshals
 * Jobs to be done: find a way to help that suits me; pick a time I can make; sign up in a minute; know my spot is held
 * Keywords: volunteer, sign up, shifts, roles, spots left, schedule, nonprofit, charity, community, form, rota
 */
/**
 * Volunteer sign-up: three steps on one screen. Role cards are real radios (arrow keys move between them), each lifting
 * on hover and showing its spots left over a straight bar that fills. Choosing a role opens the shift step with a
 * grid-rows reveal (inert until then); its shifts are radios grouped by day, full ones disabled. The form checks name,
 * email and, for roles that need it, the age box; it focuses the first problem and says it in a live region. Signing up
 * takes the spot (the count goes down), and the card settles into a confirmation with a small spring. Sign up for
 * another shift keeps the name and email. Make it the app's own: replace SAMPLE with the real roles and rota and pass
 * onSignUp to save to it.
 * Adapted from Landwind (MIT, Copyright (c) 2022 Themesberg): its pricing section's row of option cards.
 */
/**
 * How to try it
 * - Press a role card (or Tab to it and use the arrows): it lifts, gets a ring, and the shifts open below.
 * - Pick a shift; a full one can't be chosen. Switch roles and the shift list swaps.
 * - Press the sign-up button with the form empty: the first problem gets focus and the reason shows.
 * - Fill name and email (and tick the age box for an adult role), then sign up: the confirmation settles in and that
 *   shift has one spot fewer. "Sign up for another shift" starts over with your details kept.
 * - Narrow the window to a phone: the role cards stack and the shift tiles go one across.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's Button, TextField, Checkbox and
 * AnimatedNumber ("./buttons-variants", "./text-fields-states", "./checkboxes-radios", "./data-animated-number") and
 * its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl-
 * classes in templates/library/css/r6d-volunteer-signup.css.
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { AnimatedNumber } from "./data-animated-number";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

export type VolunteerShift = { id: string; start: string; end: string; spots: number; taken: number };
export type VolunteerRole = { id: string; name: string; icon: string; text: string; needs?: string[]; adult?: boolean; shifts: VolunteerShift[] };
export type VolunteerSignupValue = { role: string; shift: string; name: string; email: string; phone?: string; note?: string };

export type VolunteerSignupProps = {
  roles: VolunteerRole[];
  title?: string;
  steps?: { role?: string; shift?: string; you?: string };
  onSignUp?: (value: VolunteerSignupValue) => Promise<void> | void;
  locale?: string;
};

const still = () =>
  typeof window === "undefined" || document.documentElement.dataset.motion === "off" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function VolunteerSignup({ roles: initial, title = "Volunteer with us", steps = {}, onSignUp, locale = "en-US" }: VolunteerSignupProps) {
  const uid = useId();
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const [roles, setRoles] = useState(initial);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adult, setAdult] = useState(false);
  const [errors, setErrors] = useState<{ role?: string; shift?: string; name?: string; email?: string; adult?: string }>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ role: VolunteerRole; shift: VolunteerShift } | null>(null);
  const doneHead = useRef<HTMLHeadingElement>(null);

  const role = roles.find((r) => r.id === roleId) ?? null;
  const shift = role?.shifts.find((s) => s.id === shiftId) ?? null;
  const left = (r: VolunteerRole) => r.shifts.reduce((n, s) => n + Math.max(0, s.spots - s.taken), 0);
  const total = (r: VolunteerRole) => r.shifts.reduce((n, s) => n + s.spots, 0);

  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
  const span = (s: VolunteerShift) => `${time(s.start)}–${time(s.end)}`;

  const byDay = (role?.shifts ?? []).reduce<{ key: string; label: string; shifts: VolunteerShift[] }[]>((acc, s) => {
    const key = s.start.slice(0, 10);
    const g = acc.find((x) => x.key === key);
    if (g) g.shifts.push(s);
    else acc.push({ key, label: day(s.start), shifts: [s] });
    return acc;
  }, []);

  const focusId = (id: string) => document.getElementById(`${uid}-${id}`)?.focus();

  useEffect(() => {
    if (done) doneHead.current?.focus();
  }, [done]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = {
      role: role ? undefined : "Pick a role first.",
      shift: role && !shift ? "Pick a shift." : undefined,
      name: name.trim() ? undefined : "Enter your name.",
      email: !email.trim() ? "Enter your email so we can confirm." : EMAIL.test(email.trim()) ? undefined : "Check the email address.",
      adult: role?.adult && !adult ? "This role is for volunteers 18 or older." : undefined,
    };
    setErrors(next);
    const order: (keyof typeof next)[] = ["role", "shift", "name", "email", "adult"];
    const first = order.find((k) => next[k]);
    if (first) {
      const bad = order.filter((k) => next[k]).length;
      setStatus(`${bad} ${bad === 1 ? "thing needs" : "things need"} fixing.`);
      if (first === "role") (document.querySelector(`[name="${uid}-role"]`) as HTMLInputElement | null)?.focus();
      else if (first === "shift") (document.querySelector(`[name="${uid}-shift"]:not(:disabled)`) as HTMLInputElement | null)?.focus();
      else focusId(first);
      return;
    }
    if (!role || !shift) return;
    if (shift.taken >= shift.spots) {
      setErrors({ shift: "That shift just filled up. Pick another." });
      return;
    }
    setBusy(true);
    setStatus("Holding your spot.");
    try {
      const value: VolunteerSignupValue = { role: role.id, shift: shift.id, name: name.trim(), email: email.trim(), phone: phone.trim() || undefined };
      if (onSignUp) await onSignUp(value);
      else await new Promise((r) => setTimeout(r, 600));
      const held = { ...shift, taken: shift.taken + 1 };
      setRoles((rs) => rs.map((r) => (r.id !== role.id ? r : { ...r, shifts: r.shifts.map((s) => (s.id === shift.id ? held : s)) })));
      setDone({ role, shift: held });
      setStatus(`You're signed up: ${role.name}, ${day(shift.start)}, ${span(shift)}.`);
    } catch {
      setStatus("That didn't save. Your spot isn't held yet. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const another = () => {
    setDone(null);
    setShiftId(null);
    setAdult(false);
    setStatus("");
    setTimeout(() => (document.querySelector(`[name="${uid}-role"]:checked`) as HTMLInputElement | null)?.focus(), 0);
  };

  const cls = ["fl-vsu", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ");
  return (
    <div ref={root} className={cls} data-fl="b.volunteer-signup">
      <form onSubmit={submit} noValidate aria-label={title}>
        <fieldset className="fl-vsu-step" aria-describedby={errors.role ? `${uid}-re` : undefined}>
          <legend className="fl-vsu-legend fl-vsu-rise" style={{ "--i": 0 } as CSSProperties}>
            <span className="fl-vsu-num" aria-hidden="true">
              1
            </span>
            {steps.role ?? "Pick a role"}
          </legend>
          <div className="fl-vsu-roles">
            {roles.map((r, i) => {
              const l = left(r);
              const t = total(r);
              return (
                <label
                  key={r.id}
                  className={["fl-vsu-role", "fl-vsu-rise", roleId === r.id ? "is-on" : "", l === 0 ? "is-full" : ""].filter(Boolean).join(" ")}
                  style={{ "--i": i + 1 } as CSSProperties}
                >
                  <input
                    type="radio"
                    className="fl-sr"
                    name={`${uid}-role`}
                    checked={roleId === r.id}
                    disabled={done !== null}
                    onChange={() => {
                      setRoleId(r.id);
                      setShiftId(null);
                      setErrors((x) => ({ ...x, role: undefined, shift: undefined, adult: undefined }));
                    }}
                  />
                  <span className="fl-vsu-icon" aria-hidden="true">
                    <Icon name={r.icon} />
                  </span>
                  <span className="fl-vsu-role-name">{r.name}</span>
                  <span className="fl-vsu-role-text">{r.text}</span>
                  {r.needs?.length ? (
                    <span className="fl-vsu-needs">
                      {r.needs.map((n) => (
                        <span key={n}>{n}</span>
                      ))}
                    </span>
                  ) : null}
                  <span className="fl-vsu-left">
                    {l === 0 ? (
                      "All shifts full"
                    ) : (
                      <>
                        <AnimatedNumber value={l} className="fl-vsu-left-n" /> {l === 1 ? "spot" : "spots"} left
                      </>
                    )}
                  </span>
                  <span className="fl-vsu-bar" aria-hidden="true">
                    <span style={{ "--fill": t ? (t - l) / t : 0 } as CSSProperties} />
                  </span>
                </label>
              );
            })}
          </div>
          {errors.role ? (
            <p id={`${uid}-re`} className="fl-vsu-err">
              {errors.role}
            </p>
          ) : null}
        </fieldset>

        <div className={["fl-vsu-reveal", role ? "is-open" : ""].filter(Boolean).join(" ")}>
          <div className="fl-vsu-reveal-in" inert={!role}>
            <fieldset className="fl-vsu-step" aria-describedby={errors.shift ? `${uid}-se` : undefined}>
              <legend className="fl-vsu-legend">
                <span className="fl-vsu-num" aria-hidden="true">
                  2
                </span>
                {steps.shift ?? "Pick a shift"}
                {role ? <span className="fl-vsu-for">for {role.name}</span> : null}
              </legend>
              <div key={role?.id ?? "none"} className="fl-vsu-days">
                {byDay.map((g) => (
                  <div key={g.key} className="fl-vsu-day">
                    <p className="fl-vsu-day-label">{g.label}</p>
                    <div className="fl-vsu-shifts">
                      {g.shifts.map((s) => {
                        const l = Math.max(0, s.spots - s.taken);
                        return (
                          <label key={s.id} className={["fl-vsu-shift", shiftId === s.id ? "is-on" : "", l === 0 ? "is-full" : ""].filter(Boolean).join(" ")}>
                            <input
                              type="radio"
                              className="fl-sr"
                              name={`${uid}-shift`}
                              checked={shiftId === s.id}
                              disabled={l === 0 || done !== null}
                              onChange={() => {
                                setShiftId(s.id);
                                setErrors((x) => ({ ...x, shift: undefined }));
                              }}
                            />
                            <span className="fl-vsu-shift-time">{span(s)}</span>
                            <span className="fl-vsu-shift-left">{l === 0 ? "Full" : `${l} of ${s.spots} left`}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {errors.shift ? (
                <p id={`${uid}-se`} className="fl-vsu-err">
                  {errors.shift}
                </p>
              ) : null}
            </fieldset>
          </div>
        </div>

        <div className="fl-vsu-step fl-vsu-rise" style={{ "--i": roles.length + 1 } as CSSProperties}>
          <p className="fl-vsu-legend" id={`${uid}-y`}>
            <span className="fl-vsu-num" aria-hidden="true">
              3
            </span>
            {steps.you ?? "Your details"}
          </p>
          <div className="fl-vsu-card">
            {done ? (
              <div className="fl-vsu-done">
                <span className="fl-vsu-tick" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <h3 ref={doneHead} tabIndex={-1} className="fl-vsu-done-title">
                  You're on the list, {name.trim().split(" ")[0]}!
                </h3>
                <p className="fl-vsu-done-sum">
                  <strong>{done.role.name}</strong> · {day(done.shift.start)} · {span(done.shift)}
                </p>
                <p className="fl-vsu-muted">We'll send the details to {email.trim()}.</p>
                <Button variant="secondary" size={44} icon="plus" onClick={another}>
                  Sign up for another shift
                </Button>
              </div>
            ) : (
              <div className="fl-vsu-fields" role="group" aria-labelledby={`${uid}-y`}>
                <div className="fl-field">
                  <label htmlFor={`${uid}-name`}>Name</label>
                  <TextField
                    id={`${uid}-name`}
                    autoComplete="name"
                    value={name}
                    invalid={!!errors.name}
                    aria-describedby={errors.name ? `${uid}-ne` : undefined}
                    onChange={(e) => {
                      setName(e.target.value);
                      setErrors((x) => ({ ...x, name: undefined }));
                    }}
                  />
                  {errors.name ? (
                    <p id={`${uid}-ne`} className="fl-vsu-err">
                      {errors.name}
                    </p>
                  ) : null}
                </div>
                <div className="fl-field">
                  <label htmlFor={`${uid}-email`}>Email</label>
                  <TextField
                    id={`${uid}-email`}
                    type="email"
                    autoComplete="email"
                    value={email}
                    invalid={!!errors.email}
                    aria-describedby={errors.email ? `${uid}-ee` : undefined}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((x) => ({ ...x, email: undefined }));
                    }}
                  />
                  {errors.email ? (
                    <p id={`${uid}-ee`} className="fl-vsu-err">
                      {errors.email}
                    </p>
                  ) : null}
                </div>
                <div className="fl-field">
                  <label htmlFor={`${uid}-phone`}>
                    Phone <span className="fl-vsu-opt">(optional)</span>
                  </label>
                  <TextField id={`${uid}-phone`} type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                {role?.adult ? (
                  <div className="fl-vsu-age">
                    <Checkbox
                      id={`${uid}-adult`}
                      label="I'm 18 or older"
                      checked={adult}
                      aria-invalid={!!errors.adult || undefined}
                      aria-describedby={errors.adult ? `${uid}-ae` : undefined}
                      onChange={(e) => {
                        setAdult(e.target.checked);
                        setErrors((x) => ({ ...x, adult: undefined }));
                      }}
                    />
                    {errors.adult ? (
                      <p id={`${uid}-ae`} className="fl-vsu-err">
                        {errors.adult}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <Button type="submit" block size={48} busy={busy} icon="calendar" className="fl-vsu-submit">
                  {shift && role ? `Sign up for ${day(shift.start)}` : "Sign up"}
                </Button>
              </div>
            )}
          </div>
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {status}
        </p>
      </form>
    </div>
  );
}

/** A shift `days` from today, from `from` to `to` o'clock local time. */
const at = (days: number, from: number, to: number) => {
  const a = new Date();
  a.setDate(a.getDate() + days);
  a.setHours(from, 0, 0, 0);
  const b = new Date(a);
  b.setHours(to, 0, 0, 0);
  return { start: a.toISOString(), end: b.toISOString() };
};

// flowcode:sample
const SAMPLE = {
  eyebrow: "Volunteer",
  title: "Give a few hours this month",
  lede: "Pick something you'd enjoy and a time that works. No experience needed.",
  roles: [
    {
      id: "sort",
      name: "Food sorting",
      icon: "layers",
      text: "Check dates, sort donations and pack family boxes at the larder.",
      needs: ["All ages with an adult", "Standing work"],
      shifts: [
        { id: "s1", ...at(2, 9, 12), spots: 8, taken: 5 },
        { id: "s2", ...at(2, 13, 16), spots: 8, taken: 8 },
        { id: "s3", ...at(5, 9, 12), spots: 10, taken: 3 },
        { id: "s4", ...at(9, 9, 12), spots: 10, taken: 1 },
      ],
    },
    {
      id: "drive",
      name: "Home delivery driver",
      icon: "map",
      text: "Drive boxes to neighbors who can't get out. Routes take about two hours.",
      needs: ["18+", "Own car", "License"],
      adult: true,
      shifts: [
        { id: "d1", ...at(3, 10, 12), spots: 4, taken: 3 },
        { id: "d2", ...at(6, 10, 12), spots: 4, taken: 1 },
        { id: "d3", ...at(10, 14, 16), spots: 4, taken: 0 },
      ],
    },
    {
      id: "greet",
      name: "Welcome desk",
      icon: "users",
      text: "Greet guests, explain how the larder works and keep the line moving.",
      needs: ["16+", "Friendly"],
      shifts: [
        { id: "g1", ...at(2, 9, 13), spots: 2, taken: 1 },
        { id: "g2", ...at(5, 9, 13), spots: 2, taken: 2 },
        { id: "g3", ...at(9, 9, 13), spots: 2, taken: 0 },
      ],
    },
  ] as VolunteerRole[],
};

export default function VolunteerSignupPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="volunteer-signup-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="volunteer-signup-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <VolunteerSignup roles={d.roles} />
      </div>
    </section>
  );
}
