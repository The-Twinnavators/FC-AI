/** @flowcode-library account-password · Change password (Forms)
 * Catalog ID: p.change-password (pattern)
 * Function: Change password (p.change-password): current password, new password and confirm, each with Show; a strength meter and a list of rules that tick as you type; checks on submit (current given, every rule met, not the same as the current one, the two new ones match) with the first problem focused; an option to sign out other devices; a working state, a wrong-current-password error and a success banner with the new last-changed date.
 * Use it as: import { ChangePassword } from "./account-password"; <ChangePassword title lede? lastChanged?="2026-03-02" rules?={[{ id, label, test: /[A-Z]/ }]} now?={new Date()} onSubmit?={async ({ current, next, signOutOthers }) => void} labels?={{ current, next, confirm, submit, ... }} />  // throw new Error("wrong-current") for a wrong current password
 * Built from: c.text-field.outlined, c.checkbox, c.button.primary, c.button.tertiary
 * Look: A white card with a lock tile, the title, a line of help and "Last changed" at the right; three password fields with an eye button inside each, a four-step strength bar with a word under the new one, a two-column list of rules that turn green with a tick as they are met, a sign-out-others checkbox, and Update password with Cancel. Errors slide open under the fields; a green banner says when it worked.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --radius-lg --text-xs --text-sm --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: change password; account security; security settings; password update; profile settings; password rules; account settings
 * Jobs to be done: change my password; see whether my new password is strong enough; make sure I typed it the same twice; sign out everywhere else after changing it
 * Keywords: password, change password, update password, strength meter, password rules, show password, security, account
 */
/**
 * Change password: the three fields a password change needs, with the rules shown up front and ticked live so nobody
 * finds out after pressing the button. Show reveals one field at a time; the strength meter is one bar that grows. On
 * submit every problem is listed under its field and the first one takes focus. Make it the app's own: set the rules
 * to the server's, and send the change through onSubmit (throw Error("wrong-current") when the current one is wrong).
 * Adapted from Creative Tim UI (MIT, Copyright (c) 2025 Creative Tim): its account change-password block.
 */
/**
 * How to try it
 * - Press Update password with nothing filled in: the current password field says why and takes focus.
 * - Type "sunny" as the new password: the meter says Weak and two rules tick. Add "Day!24" to see it reach Strong.
 * - Type a different confirm: it says they don't match. Fix it, enter "wrong" as the current password and submit:
 *   the current field says it's not right.
 * - Use any other current password: the button works for a moment, then the green banner shows and the fields clear.
 *
 * Dependencies: React (useId, useRef, useState), the library's TextField, Checkbox and Button ("./text-fields-states",
 * "./checkboxes-radios", "./buttons-variants") and its inline icon set ("./icons"). Nothing else: no package and nothing
 * fetched. The styles are the library's own fl- classes in templates/library/css/r3c-change-password.css.
 */
import { useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";

// ── p.change-password: three fields, live rules and a strength meter. ──

export type PasswordRule = { id: string; label: string; test: RegExp };

export type ChangePasswordLabels = Partial<{
  current: string;
  next: string;
  confirm: string;
  show: string;
  hide: string;
  rulesTitle: string;
  signOut: string;
  signOutText: string;
  submit: string;
  submitting: string;
  cancel: string;
  lastChanged: string;
  done: string;
  noCurrent: string;
  wrongCurrent: string;
  rulesUnmet: string;
  same: string;
  noConfirm: string;
  mismatch: string;
  failed: string;
}>;

export type ChangePasswordProps = {
  title: string;
  lede?: string;
  /** ISO date of the last change. */
  lastChanged?: string;
  rules?: PasswordRule[];
  /** "Today" for the last-changed date; the real date when left out. */
  now?: Date;
  /** Sends the change. Throw Error("wrong-current") when the current password is wrong; anything else shows a general error. */
  onSubmit?: (change: { current: string; next: string; signOutOthers: boolean }) => Promise<void>;
  labels?: ChangePasswordLabels;
};

const RULES: PasswordRule[] = [
  { id: "len", label: "At least 10 characters", test: /.{10,}/ },
  { id: "upper", label: "An uppercase letter", test: /[A-Z]/ },
  { id: "lower", label: "A lowercase letter", test: /[a-z]/ },
  { id: "digit", label: "A number", test: /\d/ },
  { id: "symbol", label: "A symbol, like ! or #", test: /[^A-Za-z0-9\s]/ },
];
const WORDS = ["Too short", "Weak", "Fair", "Good", "Strong"];
const wait = (t: number) => new Promise((r) => window.setTimeout(r, t));

type Key = "current" | "next" | "confirm";

export function ChangePassword({ title, lede, lastChanged, rules = RULES, now: nowProp, onSubmit, labels = {} }: ChangePasswordProps) {
  const l = {
    current: "Current password",
    next: "New password",
    confirm: "Confirm new password",
    show: "Show password",
    hide: "Hide password",
    rulesTitle: "Your new password needs",
    signOut: "Sign out of other devices",
    signOutText: "Anyone signed in elsewhere has to use the new password.",
    submit: "Update password",
    submitting: "Updating…",
    cancel: "Cancel",
    lastChanged: "Last changed {date}",
    done: "Password updated. Use it the next time you sign in.",
    noCurrent: "Enter your current password.",
    wrongCurrent: "That's not your current password.",
    rulesUnmet: "Meet every rule below.",
    same: "Pick a password you haven't used here.",
    noConfirm: "Type the new password again.",
    mismatch: "The passwords don't match.",
    failed: "Couldn't update your password. Try again.",
    ...labels,
  };
  const id = useId();
  const [values, setValues] = useState<Record<Key, string>>({ current: "", next: "", confirm: "" });
  const [shown, setShown] = useState<Key | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Key | "form", string>>>({});
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [changed, setChanged] = useState(lastChanged);
  const [touched, setTouched] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  const met = rules.map((r) => r.test.test(values.next));
  const metCount = met.filter(Boolean).length;
  const score = !values.next ? 0 : Math.max(1, Math.round((metCount / rules.length) * 4) - (values.next.length < 8 ? 1 : 0));
  const tone = score <= 1 ? "danger" : score === 2 ? "warning" : score === 3 ? "accent" : "success";
  const matches = values.confirm.length > 0 && values.confirm === values.next;

  const day = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

  const update = (k: Key, v: string) => {
    setValues((x) => ({ ...x, [k]: v }));
    setDone(false);
    if (errors[k] || errors.form) setErrors((x) => ({ ...x, [k]: undefined, form: undefined }));
  };

  const focus = (k: Key) => window.setTimeout(() => document.getElementById(`${id}-${k}`)?.focus(), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTouched(true);
    const err: Partial<Record<Key, string>> = {};
    if (!values.current) err.current = l.noCurrent;
    if (!values.next || met.includes(false)) err.next = l.rulesUnmet;
    else if (values.next === values.current) err.next = l.same;
    if (!values.confirm) err.confirm = l.noConfirm;
    else if (values.confirm !== values.next) err.confirm = l.mismatch;
    setErrors(err);
    const first = (["current", "next", "confirm"] as Key[]).find((k) => err[k]);
    if (first) return focus(first);
    setBusy(true);
    try {
      await (onSubmit ? onSubmit({ current: values.current, next: values.next, signOutOthers }) : wait(900));
      setValues({ current: "", next: "", confirm: "" });
      setShown(null);
      setTouched(false);
      setChanged((nowProp ?? new Date()).toISOString().slice(0, 10));
      setDone(true);
    } catch (ex) {
      if (ex instanceof Error && ex.message === "wrong-current") {
        setErrors({ current: l.wrongCurrent });
        focus("current");
      } else setErrors({ form: l.failed });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setValues({ current: "", next: "", confirm: "" });
    setErrors({});
    setShown(null);
    setTouched(false);
    setDone(false);
    focus("current");
  };

  const field = (k: Key, auto: string, extra?: ReactNode, describe: string[] = []) => {
    const err = errors[k];
    const ids = [err ? `${id}-${k}-err` : "", ...describe].filter(Boolean).join(" ") || undefined;
    return (
      <div className="fl-cpw-field">
        <label htmlFor={`${id}-${k}`}>{l[k]}</label>
        <span className="fl-cpw-input">
          <TextField
            id={`${id}-${k}`}
            name={k}
            type={shown === k ? "text" : "password"}
            size={44}
            autoComplete={auto}
            spellCheck={false}
            value={values[k]}
            invalid={Boolean(err)}
            valid={k === "confirm" && matches && !err}
            aria-describedby={ids}
            onChange={(e) => update(k, e.currentTarget.value)}
          />
          <button type="button" className="fl-cpw-eye" aria-label={shown === k ? l.hide : l.show} aria-pressed={shown === k} aria-controls={`${id}-${k}`} onClick={() => setShown((s) => (s === k ? null : k))}>
            <Icon name={shown === k ? "eye-off" : "eye"} />
          </button>
        </span>
        <div className={["fl-cpw-errwrap", err ? "is-open" : ""].filter(Boolean).join(" ")}>
          <p id={`${id}-${k}-err`} className="fl-cpw-error" role={err ? "alert" : undefined}>
            {err ? (
              <>
                <Icon name="alert" />
                {err}
              </>
            ) : null}
          </p>
        </div>
        {extra}
      </div>
    );
  };

  return (
    <section className="fl-cpw" aria-labelledby={`${id}-title`} data-fl="p.change-password">
      <header className="fl-cpw-head">
        <span className="fl-cpw-tile" aria-hidden="true">
          <Icon name="lock" />
        </span>
        <div className="fl-cpw-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        {changed ? <p className="fl-cpw-when">{l.lastChanged.replace("{date}", day.format(new Date(`${changed}T12:00`)))}</p> : null}
      </header>

      <div className="fl-cpw-live" role="status" aria-live="polite">
        {done ? (
          <p className="fl-cpw-done">
            <span className="fl-cpw-tick" aria-hidden="true">
              <Icon name="check" />
            </span>
            {l.done}
          </p>
        ) : null}
      </div>

      <form ref={form} className="fl-cpw-form" noValidate onSubmit={(e) => void submit(e)} aria-busy={busy || undefined}>
        {field("current", "current-password")}
        {field(
          "next",
          "new-password",
          <>
            <div className="fl-cpw-meter" aria-hidden="true" style={{ "--cpw-score": score } as CSSProperties} data-tone={tone}>
              <span className="fl-cpw-meterbar" />
            </div>
            <p id={`${id}-strength`} className="fl-cpw-strength" data-tone={tone}>
              {values.next ? `Strength: ${WORDS[score]}` : " "}
            </p>
            <div className="fl-cpw-rules" id={`${id}-rules`}>
              <p className="fl-cpw-rulestitle">{l.rulesTitle}</p>
              <ul role="list">
                {rules.map((r, i) => (
                  <li key={r.id} className={met[i] ? "is-met" : touched && !met[i] ? "is-miss" : undefined}>
                    <span className="fl-cpw-dot" aria-hidden="true">
                      <Icon name={met[i] ? "check" : "dot"} />
                    </span>
                    {r.label}
                    <span className="fl-sr">{met[i] ? ", done" : ", not yet"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>,
          [`${id}-strength`, `${id}-rules`],
        )}
        {field(
          "confirm",
          "new-password",
          matches && !errors.confirm ? (
            <p className="fl-cpw-match">
              <Icon name="check" />
              Passwords match
            </p>
          ) : null,
        )}

        <div className="fl-cpw-signout">
          <Checkbox label={l.signOut} description={l.signOutText} checked={signOutOthers} onChange={(e) => setSignOutOthers(e.currentTarget.checked)} />
        </div>

        {errors.form ? (
          <p className="fl-cpw-error fl-cpw-formerr" role="alert">
            <Icon name="alert" />
            {errors.form}
          </p>
        ) : null}

        <div className="fl-cpw-btns">
          <Button type="button" variant="tertiary" size={44} onClick={reset} disabled={busy}>
            {l.cancel}
          </Button>
          <Button type="submit" size={44} busy={busy}>
            {busy ? l.submitting : l.submit}
          </Button>
        </div>
      </form>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Change password",
  lede: "Use a password you don't use anywhere else.",
  lastChanged: "2026-03-02",
  now: new Date("2026-10-21T10:00:00"),
};

export default function ChangePasswordSheet() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <ChangePassword
          {...SAMPLE}
          onSubmit={async ({ current }) => {
            await wait(900);
            // The sample server treats "wrong" as a wrong current password.
            if (current === "wrong") throw new Error("wrong-current");
          }}
        />
      </div>
    </section>
  );
}
