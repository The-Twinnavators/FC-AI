/** @flowcode-library form-account · Create account form (Forms)
 * Catalog ID: p.account-form (pattern)
 * Function: The account form (p.account-form) for sign-up: fields as data with required, email and password rules, focus on the first error, and a success panel; nothing is sent.
 * Use it as: import { AccountForm } from "./form-account"; <AccountForm title eyebrow? lede? fields={[{ id, type: "text"|"email"|"password"|"checkbox", label, placeholder?, hint?, autoComplete?, required: "message", invalid?, tooShort?, minLength? }]} strength={[5 words]} submit signIn? signInLink? signInHref? errorSummary={{ one, many: "{n} ..." }} success={{ title, text: "... {email}", action }} onSubmit?={(values) => ...} />
 * Built from: c.text-field.outlined, c.checkbox, c.button.primary, c.button.secondary, c.alert.danger, c.card.surface
 * Look: A centered card holding stacked fields; each checks itself on blur and on submit with an error under it, the password has a show/hide toggle and a four-segment strength bar, and a success panel replaces the form.
 * Tokens: --color-danger --color-danger-surface --color-success --color-accent --color-border --color-surface --color-text-muted --space-4 --space-5 --space-7 --text-sm --radius-md --focus-ring
 * Use cases: sign up; create account; registration; join page; onboarding signup; member registration; trial signup
 * Jobs to be done: create my account; choose a strong password; join the service; get started with a new account
 * Keywords: form, sign up, account, validation, password, registration
 */
/**
 * Form: create an account. Stacked fields for name, email and a password (show/hide and a strength hint) plus a terms
 * checkbox. Each field checks itself when you leave it and again on submit; errors sit under the field and the first
 * one gets focus. A success panel replaces the form. Nothing is sent: the details stay in memory. Use it for sign-up,
 * joining a studio or creating a household profile. Make it the app's own: replace SAMPLE's wording and rules, and
 * drop or add fields to match what the PRD asks people for.
 */
import { useState, useId, type FormEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Alert } from "./alerts-states";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Checkbox } from "./checkboxes-radios";
import { TextField } from "./text-fields-states";

// ── p.account-form: a sign-up form made from field data, with validation, a password strength hint and a success panel. ──

export type AccountField = {
  id: string;
  type: "text" | "email" | "password" | "checkbox";
  label: string;
  placeholder?: string;
  /** Help text under the field (a password keeps it beside an error; other fields swap it for the error). */
  hint?: string;
  autoComplete?: string;
  /** Said when the field is empty (or the box is not ticked). */
  required: string;
  /** Email: said when the text is not an address. */
  invalid?: string;
  /** Password: said when it is shorter than minLength. */
  tooShort?: string;
  /** Password: fewest characters, 8 when left out. */
  minLength?: number;
};

export type AccountFormProps = {
  eyebrow?: string;
  title: string;
  lede?: string;
  fields: AccountField[];
  /** Five words for the password strength, from nothing to strong. */
  strength: string[];
  submit: string;
  /** The line before the sign-in link ("Already have an account?"). */
  signIn?: string;
  signInLink?: string;
  signInHref?: string;
  /** The error summary above the form; {n} is the number of problems. */
  errorSummary: { one: string; many: string };
  /** The panel that replaces the form. {id} in the text is replaced by that field's value, in bold. */
  success: { title: string; text: string; action: string };
  /** Called with the values when every field passes. */
  onSubmit?: (values: Record<string, string | boolean>) => void;
  className?: string;
};

function scorePassword(p: string) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) s++;
  if (/[^a-zA-Z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) s++;
  return Math.max(1, Math.min(4, s));
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}

/** Puts each {id} in the text in bold with that field's value. */
function fill(text: string, values: Record<string, string | boolean>): ReactNode[] {
  return text.split(/\{(\w+)\}/).map((part, i) =>
    i % 2 ? (
      <strong key={i} style={{ color: "var(--color-text)" }}>
        {String(values[part] ?? "")}
      </strong>
    ) : (
      part
    ),
  );
}

export function AccountForm({ eyebrow, title, lede, fields, strength, submit, signIn, signInLink, signInHref = "#sign-in", errorSummary, success, onSubmit, className }: AccountFormProps) {
  const uid = useId();
  const fid = (id: string) => `${uid}-${id}`;
  const empty = (): Record<string, string | boolean> => Object.fromEntries(fields.map((f) => [f.id, f.type === "checkbox" ? false : ""]));
  const [values, setValues] = useState(empty);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<Record<string, string | boolean> | null>(null);

  const validate = (v: Record<string, string | boolean>) => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const val = v[f.id];
      if (f.type === "checkbox") {
        if (!val) e[f.id] = f.required;
      } else {
        const text = String(val);
        if (f.type === "password") {
          if (!text) e[f.id] = f.required;
          else if (text.length < (f.minLength ?? 8)) e[f.id] = f.tooShort ?? f.required;
        } else if (!text.trim()) e[f.id] = f.required;
        else if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) e[f.id] = f.invalid ?? f.required;
      }
    }
    return e;
  };
  const errors = validate(values);
  const shown = (id: string) => (touched[id] || submitted ? errors[id] : undefined);
  const errorCount = Object.keys(errors).length;

  const set = (id: string, val: string | boolean) => setValues((v) => ({ ...v, [id]: val }));
  const blur = (id: string) => setTouched((t) => ({ ...t, [id]: true }));
  const describe = (f: AccountField, extra?: string) =>
    [f.hint && (f.type === "password" || !shown(f.id)) ? `${fid(f.id)}-hint` : "", shown(f.id) ? `${fid(f.id)}-error` : "", extra ?? ""].filter(Boolean).join(" ") || undefined;

  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    const first = fields.find((f) => errors[f.id]);
    if (first) {
      document.getElementById(fid(first.id))?.focus();
      return;
    }
    const clean = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    onSubmit?.(clean);
    setDone(clean);
    requestAnimationFrame(() => document.getElementById(`${uid}-success`)?.focus());
  };

  const reset = () => {
    setValues(empty());
    setTouched({});
    setSubmitted(false);
    setShowPass({});
    setDone(null);
    requestAnimationFrame(() => document.getElementById(fid(fields[0].id))?.focus());
  };

  const error = (id: string) =>
    shown(id) ? (
      <p id={`${fid(id)}-error`} className="fl-frm-error">
        <ErrorIcon />
        {shown(id)}
      </p>
    ) : null;

  return (
    <section className={["fl-section fl-section--tint", className ?? ""].filter(Boolean).join(" ")} aria-labelledby={`${uid}-title`} data-fl="p.account-form">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id={`${uid}-title`} className="fl-title">
            {title}
          </h2>
          {lede ? <p className="fl-lede">{lede}</p> : null}
        </div>
        <Card variant="surface" className="fl-frm-card" style={{ padding: "var(--space-7)" }}>
          {done ? (
            <div className="fl-frm-success" role="status">
              <span className="fl-icon">
                <Icon name="check" />
              </span>
              <h3 id={`${uid}-success`} tabIndex={-1}>
                {success.title}
              </h3>
              <p className="fl-text">{fill(success.text, done)}</p>
              <Button variant="secondary" onClick={reset}>
                {success.action}
              </Button>
            </div>
          ) : (
            <form className="fl-form" onSubmit={send} noValidate style={{ gap: "var(--space-5)" }}>
              {submitted && errorCount > 0 && <Alert variant="danger" title={(errorCount === 1 ? errorSummary.one : errorSummary.many).replace("{n}", String(errorCount))} />}

              {fields.map((f) => {
                if (f.type === "checkbox") {
                  return (
                    <div className="fl-field" key={f.id}>
                      <label className="fl-frm-check" htmlFor={fid(f.id)} style={{ fontWeight: "var(--weight-regular)" }}>
                        <Checkbox
                          id={fid(f.id)}
                          checked={values[f.id] === true}
                          onChange={(e) => {
                            set(f.id, e.target.checked);
                            blur(f.id);
                          }}
                          aria-invalid={shown(f.id) ? true : undefined}
                          aria-describedby={describe(f)}
                        />
                        <span>{f.label}</span>
                      </label>
                      {error(f.id)}
                    </div>
                  );
                }
                const text = String(values[f.id]);
                if (f.type === "password") {
                  const level = scorePassword(text);
                  const open = showPass[f.id] === true;
                  return (
                    <div className="fl-field" key={f.id}>
                      <div className="fl-frm-label-row">
                        <label htmlFor={fid(f.id)}>{f.label}</label>
                        {text && (
                          <span className="fl-meta" id={`${fid(f.id)}-strength`} aria-live="polite">
                            Strength: {strength[level]}
                          </span>
                        )}
                      </div>
                      <div className="fl-frm-pass">
                        <TextField
                          id={fid(f.id)}
                          type={open ? "text" : "password"}
                          autoComplete={f.autoComplete ?? "new-password"}
                          value={text}
                          onChange={(e) => set(f.id, e.target.value)}
                          onBlur={() => blur(f.id)}
                          invalid={!!shown(f.id)}
                          aria-describedby={describe(f, text ? `${fid(f.id)}-strength` : "")}
                          required
                        />
                        <button type="button" className="fl-frm-reveal" aria-controls={fid(f.id)} aria-pressed={open} onClick={() => setShowPass((s) => ({ ...s, [f.id]: !open }))}>
                          {open ? "Hide" : "Show"}
                          <span className="fl-sr"> password</span>
                        </button>
                      </div>
                      <div className="fl-frm-strength" data-level={text ? level : 0} aria-hidden="true">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>
                      {error(f.id)}
                      {f.hint ? (
                        <p id={`${fid(f.id)}-hint`} className="fl-frm-hint">
                          {f.hint}
                        </p>
                      ) : null}
                    </div>
                  );
                }
                return (
                  <div className="fl-field" key={f.id}>
                    <label htmlFor={fid(f.id)}>{f.label}</label>
                    <TextField
                      id={fid(f.id)}
                      type={f.type}
                      autoComplete={f.autoComplete ?? (f.type === "email" ? "email" : f.id)}
                      inputMode={f.type === "email" ? "email" : undefined}
                      placeholder={f.placeholder}
                      value={text}
                      onChange={(e) => set(f.id, e.target.value)}
                      onBlur={() => blur(f.id)}
                      invalid={!!shown(f.id)}
                      aria-describedby={describe(f)}
                      required
                    />
                    {error(f.id) ??
                      (f.hint ? (
                        <p id={`${fid(f.id)}-hint`} className="fl-frm-hint">
                          {f.hint}
                        </p>
                      ) : null)}
                  </div>
                );
              })}

              <Button type="submit" className="fl-frm-full">
                {submit}
              </Button>
              {signIn ? (
                <p className="fl-note" style={{ margin: 0, textAlign: "center" }}>
                  {signIn}{" "}
                  <a className="fl-link" href={signInHref}>
                    {signInLink}
                  </a>
                </p>
              ) : null}
            </form>
          )}
        </Card>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE: AccountFormProps = {
  eyebrow: "Join the studio",
  title: "Create your account",
  lede: "Book classes, keep your passes in one place and get reminders before each session.",
  fields: [
    { id: "name", type: "text", label: "Full name", placeholder: "Alex Morgan", autoComplete: "name", required: "Tell us your name so the teacher knows who's coming." },
    {
      id: "email",
      type: "email",
      label: "Email",
      placeholder: "alex@example.com",
      hint: "We send booking confirmations here.",
      required: "Add your email address.",
      invalid: "That email looks incomplete. Check for an @ and a dot.",
    },
    { id: "password", type: "password", label: "Password", hint: "At least 8 characters. Mix in a number or symbol to make it stronger.", required: "Choose a password.", tooShort: "Use at least 8 characters." },
    { id: "terms", type: "checkbox", label: "I agree to the booking terms and the cancellation policy (free up to 12 hours before a class).", required: "Please accept the terms to continue." },
  ],
  strength: ["Too weak", "Weak", "Fair", "Good", "Strong"],
  submit: "Create account",
  signIn: "Already have an account?",
  signInLink: "Sign in",
  errorSummary: { one: "One thing needs fixing before we can create your account.", many: "{n} things need fixing before we can create your account." },
  success: { title: "You're in", text: "Your account is ready. We've sent a welcome note to {email}.", action: "Create another" },
};

export default function FormAccount() {
  return <AccountForm {...SAMPLE} />;
}
