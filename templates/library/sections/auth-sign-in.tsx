/** @flowcode-library auth-sign-in · Sign in (Sign-in and sign-up)
 * Catalog ID: p.auth-form (pattern)
 * Function: The authentication screen pattern (p.auth-form): sign-in, sign-up, forgot-password and verify-code in a card or split layout, with validation, password show/hide, strength meter, code entry and resend countdown; the reference sheet shows sign-in.
 * Use it as: import { AuthForm } from "./auth-sign-in"; <AuthForm variant?="sign-in"|"sign-up"|"forgot-password"|"verify-code" layout?="card"|"split" brand title lede submitLabel? footer?={{text,linkLabel,href}} help?={{label,href}} doneTitle? doneText? side?={{tag,quote,person:{initials,name,role}}} /> plus per variant: sign-in demo?={{email,password}} providers?={["Continue with email link"]} forgotHref rememberKey?; sign-up takenEmails rules?={[{id:"length"|"number"|"case"|"symbol",label}]} strengthLabels termsHref privacyHref termsLabel privacyLabel storageKey; forgot-password cooldownSeconds linkValidMinutes; verify-code destination demoCode length resendSeconds attemptsAllowed expiresMinutes
 * Variants: p.auth-form.sign-in - returning users: email, password with show/hide, remember me, forgot link, optional provider buttons under an "or" rule, welcome-back confirmation; p.auth-form.sign-up - new users: name, email, password with strength meter and live rule checklist, terms checkbox, check-your-email confirmation; p.auth-form.forgot-password - locked-out users: ask for an email, then a check-your-email screen with steps and a resend button on a cooldown; p.auth-form.verify-code - confirm email, phone or two-step: six one-time-code boxes with paste and auto-advance, wrong-code feedback, resend countdown
 * Built from: c.text-field.outlined, c.checkbox, c.button.primary, c.button.secondary, c.alert.danger, c.alert.success, c.divider.labelled, c.card.surface
 * Look: A centered card (or a form beside a quote panel with layout split) holding a brand mark, heading, the form and a footer link, ending in a confirmation state.
 * Tokens: --color-accent --color-danger --color-danger-surface --color-border --color-text-muted --color-surface --space-2 --space-3 --space-4 --radius-md --text-sm --text-xs --weight-semibold --focus-ring
 * Use cases: sign in; login; member login; account access; customer portal login; admin login; returning user
 * Jobs to be done: sign in to my account; reset a forgotten password; stay signed in on my device; continue with another account
 * Keywords: auth, sign in, login, form, password
 */
/**
 * Sign in, and the implementation of the whole sign-in family. AuthForm (p.auth-form) draws four screens, picked by
 * `variant`: sign-in (email, password with show/hide, "remember me", forgot link, optional "continue with" buttons),
 * sign-up (name, email, password with a strength meter and rule checklist, terms), forgot-password (ask for an email,
 * then a check-your-email screen with a resend cooldown) and verify-code (six boxes with paste and auto-advance, a
 * resend countdown). `layout` is "card" (one centered card) or "split" (the form beside a quote panel). Every screen
 * validates, shows a working state and ends on a confirmation. auth-sign-up, auth-split, auth-forgot-password and
 * auth-verify-code are thin wrappers over this file. Nothing is sent: the sample account is checked in memory. Make it
 * the app's own: replace SAMPLE with the app's name and copy, and swap each in-memory check for the real call.
 */
import { useEffect, useId, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Alert } from "./alerts-states";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Checkbox } from "./checkboxes-radios";
import { Divider } from "./dividers-rules";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── p.auth-form: one authentication screen. Content (copy, links, rules, side panel) comes in as props. ──

export type AuthVariant = "sign-in" | "sign-up" | "forgot-password" | "verify-code";
export type AuthLayout = "card" | "split";

/** The picture panel beside the form in the split layout. */
export type AuthSide = {
  tag?: string;
  quote: string;
  person?: { initials: string; name: string; role: string };
};

export type AuthFormProps = {
  /** Which screen. sign-in when left out. */
  variant?: AuthVariant;
  /** card: one centered card. split: the form beside the `side` panel. card when left out. */
  layout?: AuthLayout;
  brand?: string;
  title: string;
  lede?: string;
  /** The main button's label; each screen has its own default. */
  submitLabel?: string;
  /** The line under the form: text, then a link. Verify-code uses only the link, as its "back" link. */
  footer?: { text?: string; linkLabel: string; href: string };
  /** forgot-password: a second link after the footer, such as "Get help". */
  help?: { label: string; href: string };
  /** The confirmation heading shown when the screen succeeds. sign-up: "{name}" becomes the first name. */
  doneTitle?: string;
  /** The confirmation sentence. sign-up: shown after "We sent a confirmation link to <email>." */
  doneText?: string;
  /** The picture panel; split layout only. */
  side?: AuthSide;
  className?: string;

  /** sign-in: the in-memory account checked on submit. Without it any well-formed email and password signs in. */
  demo?: { email: string; password: string };
  /** sign-in: "continue with" button labels (plain text, no logos); none hides the "or" rule. */
  providers?: string[];
  forgotHref?: string;
  /** sign-in: the storage key that remembers the email; leave out to hide the "remember me" box. */
  rememberKey?: string;

  /** sign-up: emails that already have an account. */
  takenEmails?: string[];
  /** sign-up: password rules, ids from length | number | case | symbol. */
  rules?: { id: "length" | "number" | "case" | "symbol"; label: string }[];
  /** sign-up: five words for strength 0 to 4. */
  strengthLabels?: string[];
  termsHref?: string;
  privacyHref?: string;
  termsLabel?: string;
  privacyLabel?: string;
  /** sign-up: the local storage key the new account is kept under. */
  storageKey?: string;

  /** forgot-password */
  cooldownSeconds?: number;
  linkValidMinutes?: number;

  /** verify-code: where the code went, the code that works in the prototype, its length and limits. */
  destination?: string;
  demoCode?: string;
  length?: number;
  resendSeconds?: number;
  attemptsAllowed?: number;
  expiresMinutes?: number;
};

// Written out in full so a build finds every class each layout needs.
const SHELL: Record<AuthLayout, { section: string; inner: string }> = {
  card: { section: "fl-section fl-section--tint fl-auth", inner: "fl-auth-card" },
  split: { section: "fl-section", inner: "fl-auth-split__form" },
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// flowcode:sample
const SAMPLE = {
  variant: "sign-in" as AuthVariant,
  brand: "Kiln & Co. Studio",
  title: "Welcome back",
  lede: "Sign in to see your classes and open-studio bookings.",
  demo: { email: "sam@example.com", password: "glaze-2024" },
  providers: ["Continue with email link", "Continue with passkey"],
  forgotHref: "#forgot-password",
  rememberKey: "studio-remembered-email",
  footer: { text: "New to the studio?", linkLabel: "Create an account", href: "#sign-up" },
  doneTitle: "You're signed in",
  doneText: "Good to see you again. Taking you to your bookings…",
};

export default function AuthSignIn() {
  return <AuthForm {...SAMPLE} />;
}

export function AuthForm(props: AuthFormProps) {
  const { variant = "sign-in", layout = "card", side, className } = props;
  const id = useId();
  const shell = SHELL[layout];
  // sign-up is a little wider as a card
  const width = layout === "card" && variant === "sign-up" ? { maxWidth: "30rem" } : undefined;
  const body = (
    <>
      {variant === "sign-in" && <SignIn {...props} id={id} />}
      {variant === "sign-up" && <SignUp {...props} id={id} />}
      {variant === "forgot-password" && <Forgot {...props} id={id} />}
      {variant === "verify-code" && <Verify {...props} id={id} />}
    </>
  );
  return (
    <section className={[shell.section, className ?? ""].filter(Boolean).join(" ")} data-fl={`p.auth-form.${variant}`} aria-labelledby={`${id}-title`}>
      {layout === "split" ? (
        <div className="fl-wrap fl-auth-split">
          <div className={shell.inner}>{body}</div>
          {side && (
            <figure className="fl-auth-split__picture" style={{ margin: 0 }}>
              {side.tag && <span className="fl-auth-split__tag">{side.tag}</span>}
              <blockquote className="fl-auth-split__quote" style={{ margin: 0 }}>
                “{side.quote}”
              </blockquote>
              {side.person && (
                <figcaption className="fl-auth-split__who">
                  <span aria-hidden="true">{side.person.initials}</span>
                  <span>
                    <strong>{side.person.name}</strong>
                    <small>{side.person.role}</small>
                  </span>
                </figcaption>
              )}
            </figure>
          )}
        </div>
      ) : (
        <Card variant="surface" className={shell.inner} style={width}>
          {body}
        </Card>
      )}
    </section>
  );
}

// ── Pieces the four screens share ──

type Inner = AuthFormProps & { id: string };

function Brand({ brand, icon = "layers" }: { brand?: string; icon?: string }) {
  if (!brand) return null;
  return (
    <span className="fl-auth-brand">
      <span className="fl-auth-brand__mark">
        <Icon name={icon} />
      </span>
      {brand}
    </span>
  );
}

function Head({ id, title, lede, center }: { id: string; title: string; lede?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "fl-auth-head fl-auth-head--center" : "fl-auth-head"}>
      <h1 id={`${id}-title`}>{title}</h1>
      {lede ? <p>{lede}</p> : null}
    </div>
  );
}

function ErrorLine({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="fl-auth-error">
      <Icon name="alert" />
      {children}
    </p>
  );
}

/** A labelled text field with its error line wired to it. */
function Field({ id, label, error, aside, children }: { id: string; label: string; error?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="fl-field">
      {aside ? (
        <div className="fl-auth-row">
          <label htmlFor={id}>{label}</label>
          {aside}
        </div>
      ) : (
        <label htmlFor={id}>{label}</label>
      )}
      {children}
      {error && <ErrorLine id={`${id}-err`}>{error}</ErrorLine>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, disabled, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; disabled?: boolean; invalid?: boolean; describedBy?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="fl-auth-pass">
      <TextField id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} invalid={invalid} aria-describedby={describedBy} />
      <button type="button" className="fl-auth-reveal" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-controls={id}>
        {show ? "Hide" : "Show"}
        <span className="fl-sr"> password</span>
      </button>
    </div>
  );
}

function Done({ id, icon, mail, title, children }: { id: string; icon: string; mail?: boolean; title: string; children: ReactNode }) {
  return (
    <div className={mail ? "fl-auth-done fl-auth-done--mail" : "fl-auth-done"} role="status">
      <span className="fl-auth-done__icon">
        <Icon name={icon} />
      </span>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </div>
  );
}

const describe = (...ids: Array<string | false | undefined>) => ids.filter(Boolean).join(" ") || undefined;
const focusId = (id: string) => document.getElementById(id)?.focus();

function readRemembered(key?: string) {
  if (!key) return "";
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// ── sign-in ──

type SignInErrors = { email?: string; password?: string; form?: string };

function SignIn({ id, brand, title, lede, submitLabel = "Sign in", footer, doneTitle = "You're signed in", doneText = "Good to see you again.", demo, providers = [], forgotHref = "#forgot-password", rememberKey }: Inner) {
  const [email, setEmail] = useState(() => readRemembered(rememberKey));
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => readRemembered(rememberKey) !== "");
  const [errors, setErrors] = useState<SignInErrors>({});
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const [note, setNote] = useState("");
  const busy = status === "busy";

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: SignInErrors = {};
    const value = email.trim();
    if (!value) next.email = "Enter your email address.";
    else if (!EMAIL.test(value)) next.email = "That doesn't look like an email address. Check for a missing @ or dot.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    setNote("");
    if (next.email) return focusId(`${id}-email`);
    if (next.password) return focusId(`${id}-pass`);

    setStatus("busy");
    window.setTimeout(() => {
      if (demo && (value.toLowerCase() !== demo.email || password !== demo.password)) {
        setStatus("idle");
        setErrors({ form: "That email and password don't match an account. Check them and try again, or reset your password." });
        focusId(`${id}-pass`);
        return;
      }
      if (rememberKey) {
        try {
          if (remember) localStorage.setItem(rememberKey, value);
          else localStorage.removeItem(rememberKey);
        } catch {
          /* storage unavailable: signing in still works */
        }
      }
      setStatus("done");
    }, 1100);
  };

  if (status === "done") {
    return (
      <Done id={id} icon="check" title={doneTitle}>
        <p>{doneText}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setStatus("idle");
            setPassword("");
          }}
        >
          Sign out
        </Button>
      </Done>
    );
  }

  return (
    <>
      <Brand brand={brand} />
      <Head id={id} title={title} lede={lede} />

      <div aria-live="assertive">{errors.form && <Alert variant="danger" title={errors.form} id={`${id}-form-err`} />}</div>

      <form className="fl-form" onSubmit={submit} noValidate aria-describedby={errors.form ? `${id}-form-err` : undefined}>
        <Field id={`${id}-email`} label="Email" error={errors.email}>
          <TextField
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            disabled={busy}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email || errors.form) setErrors({ ...errors, email: undefined, form: undefined });
            }}
            invalid={!!errors.email}
            aria-describedby={errors.email ? `${id}-email-err` : undefined}
          />
        </Field>

        <Field
          id={`${id}-pass`}
          label="Password"
          error={errors.password}
          aside={
            <a className="fl-link" href={forgotHref}>
              Forgot password?
            </a>
          }
        >
          <PasswordInput
            id={`${id}-pass`}
            value={password}
            autoComplete="current-password"
            disabled={busy}
            onChange={(v) => {
              setPassword(v);
              if (errors.password || errors.form) setErrors({ ...errors, password: undefined, form: undefined });
            }}
            invalid={!!(errors.password || errors.form)}
            describedBy={errors.password ? `${id}-pass-err` : undefined}
          />
        </Field>

        {rememberKey && (
          <label className="fl-auth-check">
            <Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} disabled={busy} aria-label="Remember my email on this device" />
            Remember my email on this device
          </label>
        )}

        <Button type="submit" className="fl-auth-full" busy={busy}>
          {busy ? "Signing in…" : submitLabel}
        </Button>
        <p className="fl-sr" aria-live="polite">
          {busy ? "Signing in, please wait." : ""}
        </p>
      </form>

      {providers.length > 0 && (
        <>
          <Divider variant="labelled" label="or" />
          <div className="fl-auth-alt">
            {providers.map((label) => (
              <Button key={label} variant="secondary" disabled={busy} onClick={() => setNote(`“${label}” isn't set up in this prototype yet.`)}>
                {label}
              </Button>
            ))}
          </div>
          <p className="fl-note" aria-live="polite" style={{ margin: 0, textAlign: "center" }}>
            {note}
          </p>
        </>
      )}

      {footer && (
        <p className="fl-auth-foot">
          {footer.text}{" "}
          <a className="fl-link" href={footer.href}>
            {footer.linkLabel}
          </a>
        </p>
      )}
      {demo && (
        <p className="fl-auth-foot" style={{ fontSize: "var(--text-xs)" }}>
          Prototype: sign in with {demo.email} / {demo.password}
        </p>
      )}
    </>
  );
}

// ── sign-up ──

type SignUpField = "name" | "email" | "password" | "terms";
type SignUpErrors = Partial<Record<SignUpField, string>>;

const RULE_TEST: Record<string, (p: string) => boolean> = {
  length: (p) => p.length >= 10,
  number: (p) => /\d/.test(p),
  case: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p),
  symbol: (p) => /[^A-Za-z0-9]/.test(p),
};
const DEFAULT_RULES: NonNullable<AuthFormProps["rules"]> = [
  { id: "length", label: "At least 10 characters" },
  { id: "number", label: "A number" },
  { id: "case", label: "Upper and lower case" },
  { id: "symbol", label: "A symbol, like ! or #" },
];
const DEFAULT_STRENGTH = ["Too weak", "Weak", "Fair", "Good", "Strong"];

function Dot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

function SignUp({
  id,
  brand,
  title,
  lede,
  submitLabel = "Create account",
  footer,
  doneTitle = "Welcome, {name}",
  doneText = "Open it to finish setting up.",
  takenEmails = [],
  rules = DEFAULT_RULES,
  strengthLabels = DEFAULT_STRENGTH,
  termsHref = "#terms",
  privacyHref = "#privacy",
  termsLabel = "terms",
  privacyLabel = "privacy notice",
  storageKey = "accounts",
}: Inner) {
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const busy = status === "busy";

  const met = rules.map((r) => (RULE_TEST[r.id] ? RULE_TEST[r.id](values.password) : false));
  const score = met.filter(Boolean).length;
  const level = values.password ? Math.max(1, score) : 0;

  const set = (field: "name" | "email" | "password", value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: SignUpErrors = {};
    const email = values.email.trim().toLowerCase();
    if (!values.name.trim()) next.name = "Enter your name so we know who you are.";
    if (!email) next.email = "Enter your email address.";
    else if (!EMAIL.test(email)) next.email = "That doesn't look like an email address.";
    else if (takenEmails.includes(email)) next.email = "There's already an account with this email. Sign in instead.";
    if (!values.password) next.password = "Choose a password.";
    else if (score < rules.length) next.password = "Your password needs to meet every rule below.";
    if (!terms) next.terms = "Agree to the terms to create your account.";
    setErrors(next);
    const first = (["name", "email", "password", "terms"] as SignUpField[]).find((f) => next[f]);
    if (first) return focusId(`${id}-${first}`);
    setStatus("busy");
    window.setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]") as unknown[];
        localStorage.setItem(storageKey, JSON.stringify([...saved, { name: values.name.trim(), email, at: new Date().toISOString() }]));
      } catch {
        /* storage unavailable: the confirmation still shows */
      }
      setStatus("done");
    }, 900);
  };

  const errorCount = Object.values(errors).filter(Boolean).length;

  if (status === "done") {
    return (
      <Done id={id} icon="mail" mail title={doneTitle.replace("{name}", values.name.trim().split(" ")[0])}>
        <p>
          Your account is ready. We sent a confirmation link to <strong>{values.email.trim()}</strong>. {doneText}
        </p>
        {footer && <Button href={footer.href}>Go to sign in</Button>}
      </Done>
    );
  }

  return (
    <>
      <Brand brand={brand} />
      <Head id={id} title={title} lede={lede} />

      <div aria-live="polite">{errorCount > 1 && <Alert variant="danger" title={`${errorCount} things need fixing before we can create your account.`} />}</div>

      <form className="fl-form" onSubmit={submit} noValidate>
        <Field id={`${id}-name`} label="Full name" error={errors.name}>
          <TextField id={`${id}-name`} autoComplete="name" value={values.name} disabled={busy} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-err` : undefined} />
        </Field>

        <Field id={`${id}-email`} label="Email" error={errors.email}>
          <TextField id={`${id}-email`} type="email" autoComplete="email" value={values.email} disabled={busy} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-err` : undefined} />
        </Field>

        <div className="fl-field">
          <label htmlFor={`${id}-password`}>Password</label>
          <PasswordInput
            id={`${id}-password`}
            value={values.password}
            autoComplete="new-password"
            disabled={busy}
            onChange={(v) => set("password", v)}
            invalid={!!errors.password}
            describedBy={describe(errors.password && `${id}-password-err`, `${id}-strength`, `${id}-rules`)}
          />
          {errors.password && <ErrorLine id={`${id}-password-err`}>{errors.password}</ErrorLine>}
          <div className="fl-auth-meter" data-level={level}>
            <div className="fl-auth-meter__bars" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="fl-auth-meter__label" id={`${id}-strength`} aria-live="polite">
              Strength: <strong>{values.password ? strengthLabels[score] : "not set"}</strong>
            </p>
          </div>
          <ul className="fl-auth-rules" id={`${id}-rules`} aria-label="Password rules">
            {rules.map((r, i) => (
              <li key={r.id} data-met={met[i]}>
                {met[i] ? <Icon name="check" /> : <Dot />}
                <span>
                  {r.label}
                  <span className="fl-sr">{met[i] ? " (done)" : " (not yet)"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="fl-field">
          <label className="fl-auth-check" style={{ fontWeight: "var(--weight-regular)" }}>
            <Checkbox
              id={`${id}-terms`}
              checked={terms}
              disabled={busy}
              onChange={(e) => {
                setTerms(e.target.checked);
                if (errors.terms) setErrors((x) => ({ ...x, terms: undefined }));
              }}
              aria-label="I agree to the terms and privacy notice"
              aria-invalid={errors.terms ? true : undefined}
              aria-describedby={errors.terms ? `${id}-terms-err` : undefined}
            />
            <span>
              I agree to the{" "}
              <a className="fl-link" href={termsHref}>
                {termsLabel}
              </a>{" "}
              and{" "}
              <a className="fl-link" href={privacyHref}>
                {privacyLabel}
              </a>
              .
            </span>
          </label>
          {errors.terms && <ErrorLine id={`${id}-terms-err`}>{errors.terms}</ErrorLine>}
        </div>

        <Button type="submit" className="fl-auth-full" busy={busy}>
          {busy ? "Creating your account…" : submitLabel}
        </Button>
      </form>

      {footer && (
        <p className="fl-auth-foot">
          {footer.text}{" "}
          <a className="fl-link" href={footer.href}>
            {footer.linkLabel}
          </a>
        </p>
      )}
    </>
  );
}

// ── forgot-password ──

function Forgot({ id, brand, title, lede, submitLabel = "Send reset link", footer, help, doneTitle = "Check your email", cooldownSeconds = 30, linkValidMinutes = 30 }: Inner) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"ask" | "busy" | "sent">("ask");
  const [cooldown, setCooldown] = useState(0);
  const [sends, setSends] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (stage === "sent") headingRef.current?.focus();
  }, [stage]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) setError("Enter your email address.");
    else if (!EMAIL.test(value)) setError("That doesn't look like an email address. Check for a missing @ or dot.");
    else {
      setError("");
      setStage("busy");
      window.setTimeout(() => {
        setStage("sent");
        setSends(1);
        setCooldown(cooldownSeconds);
      }, 900);
      return;
    }
    focusId(`${id}-email`);
  };

  const resend = () => {
    if (cooldown > 0) return;
    setSends((n) => n + 1);
    setCooldown(cooldownSeconds);
    setStatus(`We sent another link to ${email.trim()}.`);
  };

  if (stage === "sent") {
    return (
      <div className="fl-auth-done fl-auth-done--mail">
        <span className="fl-auth-done__icon">
          <Icon name="mail" />
        </span>
        <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
          {doneTitle}
        </h2>
        <p>If there's an account for this address, a reset link is on its way to</p>
        <p className="fl-auth-mailbox">{email.trim()}</p>
        <ol className="fl-auth-steps">
          <li>Open the email{brand ? ` from ${brand}` : ""}. It can take a minute to arrive.</li>
          <li>Select “Choose a new password”. The link works for {linkValidMinutes} minutes.</li>
          <li>Not there? Look in spam or promotions.</li>
        </ol>
        <div className="fl-actions" style={{ justifyContent: "center" }}>
          <Button onClick={resend} disabled={cooldown > 0} aria-describedby={`${id}-timer`}>
            Resend link
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setStage("ask");
              setStatus("");
              window.setTimeout(() => focusId(`${id}-email`), 0);
            }}
          >
            Use a different email
          </Button>
        </div>
        <p className="fl-note" id={`${id}-timer`} style={{ margin: 0 }}>
          {cooldown > 0 ? (
            <>
              You can resend in{" "}
              <span className="fl-auth-timer">
                {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}
              </span>
            </>
          ) : (
            "Didn't get it? You can resend now."
          )}
        </p>
        <div role="status" style={{ width: "100%" }}>
          {status && (
            <Alert variant="success" title={`${status} ${sends > 2 ? "Still nothing? Contact us and we'll help." : ""}`.trim()} />
          )}
        </div>
        {footer && (
          <a className="fl-link" href={footer.href}>
            {footer.linkLabel}
          </a>
        )}
      </div>
    );
  }

  const busy = stage === "busy";
  return (
    <>
      <Brand brand={brand} icon="lock" />
      <Head id={id} title={title} lede={lede} />
      <form className="fl-form" onSubmit={submit} noValidate>
        <Field id={`${id}-email`} label="Email" error={error}>
          <TextField
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            value={email}
            disabled={busy}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            invalid={!!error}
            aria-describedby={error ? `${id}-email-err` : undefined}
          />
        </Field>
        <Button type="submit" className="fl-auth-full" busy={busy}>
          {busy ? "Sending link…" : submitLabel}
        </Button>
      </form>
      {(footer || help) && (
        <p className="fl-auth-foot">
          {footer && (
            <>
              {footer.text}{" "}
              <a className="fl-link" href={footer.href}>
                {footer.linkLabel}
              </a>
            </>
          )}
          {footer && help && " · "}
          {help && (
            <a className="fl-link" href={help.href}>
              {help.label}
            </a>
          )}
        </p>
      )}
    </>
  );
}

// ── verify-code ──

function Verify({ id, title, lede, submitLabel = "Verify", footer, doneTitle = "You're verified", doneText = "Thanks for confirming it's you. Your account is ready to use.", destination = "", demoCode = "", length = 6, resendSeconds = 20, attemptsAllowed = 5, expiresMinutes = 10 }: Inner) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [state, setState] = useState<"idle" | "busy" | "error" | "ok">("idle");
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(resendSeconds);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const focusBox = (i: number) => {
    const el = boxes.current[Math.max(0, Math.min(length - 1, i))];
    el?.focus();
    el?.select();
  };

  const locked = attempts >= attemptsAllowed;

  const check = (code: string[]) => {
    const value = code.join("");
    if (value.length < length) {
      setState("error");
      setError(`Enter all ${length} digits.`);
      focusBox(code.findIndex((c) => !c));
      return;
    }
    setState("busy");
    setError("");
    window.setTimeout(() => {
      // With no demoCode any full code is accepted (a prototype).
      if (!demoCode || value === demoCode) {
        setState("ok");
        return;
      }
      const used = attempts + 1;
      setAttempts(used);
      setState("error");
      setError(
        used >= attemptsAllowed
          ? "Too many wrong codes. Ask for a new code to try again."
          : `That code isn't right. Check the latest email and try again (${attemptsAllowed - used} ${attemptsAllowed - used === 1 ? "try" : "tries"} left).`,
      );
      setDigits(Array(length).fill(""));
      window.setTimeout(() => focusBox(0), 0);
    }, 700);
  };

  const update = (next: string[]) => {
    setDigits(next);
    if (state === "error") {
      setState("idle");
      setError("");
    }
    if (next.every(Boolean)) check(next);
  };

  const onInput = (i: number, raw: string) => {
    let only = raw.replace(/\D/g, "");
    // Typing over a filled box: keep the new digit, not the old one.
    if (only.length === 2 && digits[i]) only = only[0] === digits[i] ? only[1] : only[0];
    if (!only) {
      const next = [...digits];
      next[i] = "";
      setDigits(next);
      return;
    }
    if (only.length > 1) return fill(only, i);
    const next = [...digits];
    next[i] = only;
    if (i < length - 1) focusBox(i + 1);
    update(next);
  };

  const fill = (text: string, start = 0) => {
    const only = text.replace(/\D/g, "").slice(0, length - start);
    if (!only) return;
    const next = [...digits];
    only.split("").forEach((c, k) => (next[start + k] = c));
    focusBox(Math.min(start + only.length, length - 1));
    update(next);
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const only = e.clipboardData.getData("text").replace(/\D/g, "");
    fill(only, only.length >= length ? 0 : i);
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      focusBox(i - 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!locked) check(digits);
  };

  const resend = () => {
    setAttempts(0);
    setCooldown(resendSeconds);
    setDigits(Array(length).fill(""));
    setState("idle");
    setError("");
    setNote(`A new code is on its way to ${destination}.`);
    focusBox(0);
  };

  const busy = state === "busy";
  const half = Math.ceil(length / 2);

  if (state === "ok") {
    return (
      <Done id={id} icon="shield" title={doneTitle}>
        <p>{doneText}</p>
        <Button
          variant="secondary"
          onClick={() => {
            setDigits(Array(length).fill(""));
            setAttempts(0);
            setState("idle");
          }}
        >
          Start again
        </Button>
      </Done>
    );
  }

  return (
    <>
      <span className="fl-icon" style={{ justifySelf: "center" }}>
        <Icon name="mail" />
      </span>
      <Head
        id={id}
        title={title}
        center
        lede={
          <>
            {lede} <strong style={{ color: "var(--color-text)" }}>{destination}</strong>. It expires in {expiresMinutes} minutes.
          </>
        }
      />

      <form className="fl-form" onSubmit={submit} noValidate>
        <fieldset className="fl-auth-otp" data-state={state === "error" ? "error" : undefined} aria-describedby={error ? `${id}-err` : undefined} disabled={busy || locked}>
          <legend className="fl-sr">One-time code, {length} digits</legend>
          <div className="fl-auth-otp__boxes">
            {digits.map((digit, i) => (
              <Box key={i} withDash={i === half}>
                <input
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  className="fl-auth-otp__box"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={i === 0 ? "one-time-code" : "off"}
                  maxLength={i === 0 ? length : 1}
                  placeholder=" "
                  value={digit}
                  aria-label={`Digit ${i + 1} of ${length}`}
                  aria-invalid={state === "error" ? true : undefined}
                  onChange={(e) => onInput(i, e.target.value)}
                  onKeyDown={(e) => onKey(i, e)}
                  onPaste={(e) => onPaste(i, e)}
                  onFocus={(e) => e.target.select()}
                />
              </Box>
            ))}
          </div>
        </fieldset>
        <div aria-live="assertive">
          {error && (
            <ErrorLine id={`${id}-err`}>{error}</ErrorLine>
          )}
        </div>
        <Button type="submit" className="fl-auth-full" busy={busy} disabled={locked}>
          {busy ? "Checking…" : submitLabel}
        </Button>
      </form>

      <p className="fl-auth-foot">
        Didn't get it?{" "}
        {cooldown > 0 ? (
          <span>
            Resend in <span className="fl-auth-timer">{cooldown}s</span>
          </span>
        ) : (
          <button type="button" className="fl-link" onClick={resend} style={{ border: 0, background: "none", padding: 0, font: "inherit", fontWeight: "var(--weight-semibold)", cursor: "pointer" }}>
            Send a new code
          </button>
        )}
      </p>
      <p className="fl-note" role="status" style={{ margin: 0, textAlign: "center" }}>
        {note}
      </p>
      {demoCode && (
        <p className="fl-auth-hint">
          Prototype: the code is <code>{demoCode}</code>. Try pasting it.
        </p>
      )}
      {footer && (
        <a className="fl-link" href={footer.href} style={{ justifySelf: "center", fontSize: "var(--text-sm)" }}>
          {footer.linkLabel}
        </a>
      )}
    </>
  );
}

/** Puts a small dash between the two halves of the code so it's easier to read back. */
function Box({ withDash, children }: { withDash: boolean; children: ReactNode }) {
  return (
    <>
      {withDash && <span className="fl-auth-otp__dash" aria-hidden="true" />}
      {children}
    </>
  );
}
