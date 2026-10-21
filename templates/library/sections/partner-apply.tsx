/** @flowcode-library partner-apply · Partner program application (Contact)
 * Catalog ID: b.partner-apply (block)
 * Function: The partner application block (b.partner-apply): pick a program (referral, reseller, agency) from cards with their perks, fill a checked application (name, work email, company, website, country, clients, a short note, terms), and get a confirmation with a reference and what happens next.
 * Use it as: import { PartnerApply } from "./partner-apply"; <PartnerApply programs={[{ id, title, meta, text, perks: string[] }]} countries={[{ value, label }]} sizes={[{ value, label }]} next?={[{ title, text }]} start?="id" freeMail?={["gmail.com"]} labels?={{ ... }} onSubmit={async (data) => ({ reference })} />
 * Built from: c.text-field.outlined, c.select, c.checkbox, c.button.primary, c.button.tertiary
 * Look: Two columns in one form. On the left a stack of program cards, each a bordered white card with a round mark, a bold name, an accent meta line ("20% recurring"), a muted line and ticked perks; the chosen one has an accent outline and a filled mark. Under them three numbered "What happens next" steps on a thin straight line. On the right a white form card with paired fields, a note box with a live count, a terms checkbox and a full-width primary button; errors list at the top and under each field. When sent, the card turns into a green tick, a title, the reference in a pill and the next steps.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-danger-surface --color-success --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-7 --text-xs --text-sm --text-md --text-lg --font-display --weight-semibold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: partner program; reseller application; affiliate signup; agency partners; become a partner page; channel partners; referral program
 * Jobs to be done: see which partner program fits me; know what I get as a partner; apply without a sales call; know when I'll hear back
 * Keywords: partners, partner program, reseller, affiliate, agency, referral, application form, apply, validation, become a partner
 */
/**
 * Partner program application: the page a would-be partner lands on, made into one form. The program cards are real
 * radios (arrow keys move between them) and show what each program gives you, so choosing is part of applying. The
 * fields check themselves on submit: the error list at the top names every problem and each item jumps to its field;
 * the first problem takes focus. A free email address is turned away politely (partners need a work address). While it
 * sends the button works; when it's done the form becomes a confirmation with a reference and the next steps, and
 * focus moves to it. Make it the app's own: list the real programs and send the data through onSubmit.
 * Adapted from Landwind (MIT, Copyright (c) 2022 Themesberg) and AstroWind (MIT, Copyright (c) 2023 onWidget): their
 * contact forms, feature lists and steps widgets.
 */
/**
 * How to try it
 * - Press Send application with nothing filled in: the list at the top names every problem and focus goes to it;
 *   press an item to jump to that field.
 * - Type a gmail.com address: it asks for a work email. Type "acme" as the website: it asks for a full address.
 * - Use the arrow keys on the program cards: the chosen card and its perks change.
 * - Fill everything in and send: the button works for a moment, then the confirmation shows a reference. Press Send
 *   another to start over.
 *
 * Dependencies: React (useId, useRef, useState), the library's TextField, Select, Checkbox and Button
 * ("./text-fields-states", "./dropdowns-states", "./checkboxes-radios", "./buttons-variants") and its inline icon set
 * ("./icons"). Nothing else: no package and nothing fetched. The styles are the library's own fl- classes in
 * templates/library/css/r4c-partner-apply.css.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

export type PartnerProgram = {
  id: string;
  title: string;
  meta: string;
  text: string;
  perks: string[];
};
export type PartnerData = {
  program: string;
  name: string;
  email: string;
  company: string;
  website: string;
  country: string;
  size: string;
  note: string;
  agree: boolean;
};
type Field = Exclude<keyof PartnerData, "program">;

export type PartnerApplyProps = {
  programs: PartnerProgram[];
  countries: Array<{ value: string; label: string }>;
  sizes: Array<{ value: string; label: string }>;
  next?: Array<{ title: string; text: string }>;
  start?: string;
  /** Email domains that are not accepted (partners apply with a work address). */
  freeMail?: string[];
  noteMin?: number;
  noteMax?: number;
  labels?: Partial<{
    program: string;
    name: string;
    email: string;
    company: string;
    website: string;
    country: string;
    size: string;
    note: string;
    agree: string;
    choose: string;
    submit: string;
    sending: string;
    problems: string;
    failed: string;
    doneTitle: string;
    doneText: string;
    reference: string;
    again: string;
    nextTitle: string;
  }>;
  onSubmit?: (
    data: PartnerData,
  ) => Promise<{ reference?: string } | void> | { reference?: string } | void;
};

const EMPTY = {
  name: "",
  email: "",
  company: "",
  website: "",
  country: "",
  size: "",
  note: "",
  agree: false,
};
const ORDER: Field[] = [
  "name",
  "email",
  "company",
  "website",
  "country",
  "size",
  "note",
  "agree",
];

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

export function PartnerApply({
  programs,
  countries,
  sizes,
  next = [],
  start,
  freeMail = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
  ],
  noteMin = 20,
  noteMax = 500,
  labels = {},
  onSubmit,
}: PartnerApplyProps) {
  const uid = useId();
  const L = {
    program: labels.program ?? "Choose a program",
    name: labels.name ?? "Full name",
    email: labels.email ?? "Work email",
    company: labels.company ?? "Company",
    website: labels.website ?? "Website",
    country: labels.country ?? "Country",
    size: labels.size ?? "Clients a year",
    note: labels.note ?? "Tell us about your clients",
    agree: labels.agree ?? "I agree to the partner terms",
    choose: labels.choose ?? "Choose one",
    submit: labels.submit ?? "Send application",
    sending: labels.sending ?? "Sending",
    problems: labels.problems ?? "Fix these to send:",
    failed:
      labels.failed ?? "That didn't send. Check your connection and try again.",
    doneTitle: labels.doneTitle ?? "Application sent",
    doneText:
      labels.doneText ?? "We'll reply to {email} within 3 business days.",
    reference: labels.reference ?? "Reference",
    again: labels.again ?? "Send another",
    nextTitle: labels.nextTitle ?? "What happens next",
  };
  const [program, setProgram] = useState(start ?? programs[0]?.id ?? "");
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState<{ reference: string; email: string } | null>(
    null,
  );
  const summary = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const [root, enter] = useEnterOnce<HTMLDivElement>();

  const id = (f: Field) => `${uid}-${f}`;

  const check = (d: typeof v): Partial<Record<Field, string>> => {
    const e: Partial<Record<Field, string>> = {};
    if (!d.name.trim()) e.name = "Enter your full name.";
    const email = d.email.trim();
    if (!email) e.email = "Enter your work email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      e.email = "Enter an email like name@company.com.";
    else if (freeMail.includes(email.split("@")[1]!.toLowerCase()))
      e.email = "Use your work email, not a personal one.";
    if (!d.company.trim()) e.company = "Enter your company's name.";
    const site = d.website.trim();
    if (!site) e.website = "Enter your website.";
    else if (!/^(https?:\/\/)?[^\s.]+(\.[^\s.]+)+(\/\S*)?$/i.test(site))
      e.website = "Enter a full address, like company.com.";
    if (!d.country) e.country = "Choose your country.";
    if (!d.size) e.size = "Choose how many clients you serve.";
    const n = d.note.trim().length;
    if (n < noteMin)
      e.note = `Write at least ${noteMin} characters (${n} so far).`;
    else if (n > noteMax) e.note = `Keep it under ${noteMax} characters.`;
    if (!d.agree) e.agree = "Agree to the terms to apply.";
    return e;
  };

  const set = <K extends Field>(k: K, val: (typeof EMPTY)[K]) => {
    const d = { ...v, [k]: val };
    setV(d);
    setFailed(false);
    // After a first try, errors clear as each one is fixed.
    if (tried) setErrors(check(d));
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    setTried(true);
    const e = check(v);
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const r = await onSubmit?.({
        program,
        ...v,
        name: v.name.trim(),
        email: v.email.trim(),
        company: v.company.trim(),
        website: v.website.trim(),
        note: v.note.trim(),
      });
      const ref =
        (r && r.reference) || `PA-${Math.floor(10000 + Math.random() * 89999)}`;
      setDone({ reference: ref, email: v.email.trim() });
      requestAnimationFrame(() => doneRef.current?.focus());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const again = () => {
    setV(EMPTY);
    setErrors({});
    setTried(false);
    setDone(null);
    requestAnimationFrame(() => document.getElementById(id("name"))?.focus());
  };

  const list = ORDER.filter((f) => errors[f]);
  const err = (f: Field) =>
    errors[f] ? (
      <p id={`${id(f)}-err`} className="fl-pta-error">
        <Icon name="alert" />
        {errors[f]}
      </p>
    ) : null;
  const desc = (f: Field, extra?: string) =>
    [errors[f] ? `${id(f)}-err` : "", extra ?? ""].filter(Boolean).join(" ") ||
    undefined;
  const chosen = programs.find((p) => p.id === program);
  const cls = [
    "fl-pta",
    enter === "wait" ? "is-waiting" : "",
    enter === "in" ? "is-entering" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const len = v.note.trim().length;

  const steps = next.length ? (
    <section
      className="fl-pta-next fl-pta-rise"
      style={{ "--i": programs.length } as CSSProperties}
      aria-labelledby={`${uid}-next`}
    >
      <h3 id={`${uid}-next`} className="fl-pta-h">
        {L.nextTitle}
      </h3>
      <ol>
        {next.map((s, i) => (
          <li key={s.title}>
            <span className="fl-pta-step" aria-hidden="true">
              {i + 1}
            </span>
            <span>
              <strong>{s.title}</strong>
              <span className="fl-pta-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  ) : null;

  return (
    <div ref={root} className={cls} data-fl="b.partner-apply">
      {done ? (
        <div
          ref={doneRef}
          tabIndex={-1}
          className="fl-pta-done"
          role="status"
          aria-labelledby={`${uid}-done`}
        >
          <span className="fl-pta-tick" aria-hidden="true">
            <Icon name="check" />
          </span>
          <h3 id={`${uid}-done`} className="fl-pta-done-title">
            {L.doneTitle}
          </h3>
          <p className="fl-pta-muted">
            {L.doneText.replace("{email}", done.email)}
          </p>
          <p className="fl-pta-ref">
            {L.reference} <strong>{done.reference}</strong>
            {chosen ? <span> · {chosen.title}</span> : null}
          </p>
          {steps}
          <Button variant="secondary" size={44} icon="refresh" onClick={again}>
            {L.again}
          </Button>
        </div>
      ) : (
        <form
          className="fl-pta-form"
          noValidate
          onSubmit={submit}
          aria-busy={busy || undefined}
        >
          <div className="fl-pta-side">
            <fieldset className="fl-pta-programs">
              <legend className="fl-pta-h">{L.program}</legend>
              {programs.map((p, i) => (
                <label
                  key={p.id}
                  className={
                    p.id === program
                      ? "fl-pta-prog is-on fl-pta-rise"
                      : "fl-pta-prog fl-pta-rise"
                  }
                  style={{ "--i": i } as CSSProperties}
                >
                  <input
                    type="radio"
                    name={`${uid}-program`}
                    value={p.id}
                    checked={p.id === program}
                    onChange={() => setProgram(p.id)}
                    aria-labelledby={`${uid}-pt-${p.id}`}
                    aria-describedby={`${uid}-pm-${p.id} ${uid}-p-${p.id}`}
                  />
                  <span className="fl-pta-mark" aria-hidden="true" />
                  <span className="fl-pta-prog-body">
                    <span
                      id={`${uid}-pt-${p.id}`}
                      className="fl-pta-prog-title"
                    >
                      {p.title}
                    </span>
                    <span id={`${uid}-pm-${p.id}`} className="fl-pta-prog-meta">
                      {p.meta}
                    </span>
                    <span id={`${uid}-p-${p.id}`} className="fl-pta-muted">
                      {p.text}
                    </span>
                    <span className="fl-pta-perks">
                      {p.perks.map((k) => (
                        <span key={k}>
                          <Icon name="check" />
                          {k}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {steps}
          </div>

          <div
            className="fl-pta-card fl-pta-rise"
            style={{ "--i": 1 } as CSSProperties}
          >
            {list.length ? (
              <div
                ref={summary}
                tabIndex={-1}
                className="fl-pta-summary"
                role="alert"
                aria-labelledby={`${uid}-sum`}
              >
                <p id={`${uid}-sum`}>
                  <strong>{L.problems}</strong>
                </p>
                <ul>
                  {list.map((f) => (
                    <li key={f}>
                      <a
                        href={`#${id(f)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(id(f))?.focus();
                        }}
                      >
                        {errors[f]}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {failed ? (
              <p className="fl-pta-summary" role="alert">
                {L.failed}
              </p>
            ) : null}

            <div className="fl-pta-row">
              <div className="fl-field">
                <label htmlFor={id("name")}>{L.name}</label>
                <TextField
                  id={id("name")}
                  autoComplete="name"
                  value={v.name}
                  invalid={!!errors.name}
                  aria-describedby={desc("name")}
                  onChange={(e) => set("name", e.target.value)}
                />
                {err("name")}
              </div>
              <div className="fl-field">
                <label htmlFor={id("email")}>{L.email}</label>
                <TextField
                  id={id("email")}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={v.email}
                  invalid={!!errors.email}
                  aria-describedby={desc("email")}
                  onChange={(e) => set("email", e.target.value)}
                />
                {err("email")}
              </div>
            </div>
            <div className="fl-pta-row">
              <div className="fl-field">
                <label htmlFor={id("company")}>{L.company}</label>
                <TextField
                  id={id("company")}
                  autoComplete="organization"
                  value={v.company}
                  invalid={!!errors.company}
                  aria-describedby={desc("company")}
                  onChange={(e) => set("company", e.target.value)}
                />
                {err("company")}
              </div>
              <div className="fl-field">
                <label htmlFor={id("website")}>{L.website}</label>
                <TextField
                  id={id("website")}
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="company.com"
                  value={v.website}
                  invalid={!!errors.website}
                  aria-describedby={desc("website")}
                  onChange={(e) => set("website", e.target.value)}
                />
                {err("website")}
              </div>
            </div>
            <div className="fl-pta-row">
              <div className="fl-field">
                <label htmlFor={id("country")}>{L.country}</label>
                <Select
                  id={id("country")}
                  options={countries}
                  placeholder={L.choose}
                  value={v.country}
                  invalid={!!errors.country}
                  aria-describedby={desc("country")}
                  onChange={(e) => set("country", e.target.value)}
                />
                {err("country")}
              </div>
              <div className="fl-field">
                <label htmlFor={id("size")}>{L.size}</label>
                <Select
                  id={id("size")}
                  options={sizes}
                  placeholder={L.choose}
                  value={v.size}
                  invalid={!!errors.size}
                  aria-describedby={desc("size")}
                  onChange={(e) => set("size", e.target.value)}
                />
                {err("size")}
              </div>
            </div>
            <div className="fl-field">
              <label htmlFor={id("note")}>{L.note}</label>
              <TextField
                id={id("note")}
                multiline
                autoGrow
                rows={3}
                value={v.note}
                invalid={!!errors.note}
                aria-describedby={desc("note", `${id("note")}-count`)}
                onChange={(e) => set("note", e.target.value)}
              />
              <p
                id={`${id("note")}-count`}
                className={
                  len > noteMax ? "fl-pta-count is-over" : "fl-pta-count"
                }
              >
                {len} / {noteMax}
              </p>
              {err("note")}
            </div>
            <div className="fl-pta-agree">
              <Checkbox
                id={id("agree")}
                label={L.agree}
                checked={v.agree}
                aria-invalid={!!errors.agree || undefined}
                aria-describedby={desc("agree")}
                onChange={(e) => set("agree", e.target.checked)}
              />
              {err("agree")}
            </div>
            <Button
              type="submit"
              variant="primary"
              block
              busy={busy}
              icon={busy ? undefined : "send"}
            >
              {busy ? L.sending : L.submit}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Partners",
  title: "Grow with Frontdesk",
  lede: "Refer, resell or build on Frontdesk and earn for every studio you bring.",
  programs: [
    {
      id: "referral",
      title: "Referral",
      meta: "20% for 12 months",
      text: "Send studios our way with your own link.",
      perks: ["Your own referral link", "Monthly payouts", "No minimums"],
    },
    {
      id: "reseller",
      title: "Reseller",
      meta: "30% recurring",
      text: "Sell Frontdesk with your own services.",
      perks: ["Partner pricing", "Co-branded invoices", "Sales training"],
    },
    {
      id: "agency",
      title: "Agency",
      meta: "Priority support",
      text: "Set up and run Frontdesk for clients.",
      perks: [
        "One login for all clients",
        "Partner directory listing",
        "Early access",
      ],
    },
  ],
  countries: [
    { value: "us", label: "United States" },
    { value: "ca", label: "Canada" },
    { value: "gb", label: "United Kingdom" },
    { value: "au", label: "Australia" },
    { value: "de", label: "Germany" },
    { value: "other", label: "Somewhere else" },
  ],
  sizes: [
    { value: "1-10", label: "1 to 10" },
    { value: "11-50", label: "11 to 50" },
    { value: "51-200", label: "51 to 200" },
    { value: "200+", label: "More than 200" },
  ],
  next: [
    {
      title: "We review it",
      text: "A partner manager reads every application.",
    },
    { title: "A short call", text: "20 minutes to plan your first clients." },
    {
      title: "You're live",
      text: "Get your link, pricing and partner portal.",
    },
  ],
};

export default function PartnerApplyPreview() {
  const d = SAMPLE;
  return (
    <section
      className="fl-section fl-section--canvas"
      aria-labelledby="partner-apply-title"
    >
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="partner-apply-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <PartnerApply
          programs={d.programs}
          countries={d.countries}
          sizes={d.sizes}
          next={d.next}
          start="reseller"
          onSubmit={() =>
            new Promise<{ reference: string }>((r) =>
              setTimeout(() => r({ reference: "PA-20417" }), 900),
            )
          }
        />
      </div>
    </section>
  );
}
