/** @flowcode-library otp-input · One-time code input (Forms)
 * Catalog ID: c.otp-input (component)
 * Function: The one-time code input (c.otp-input): four to eight single-character boxes that fill from a paste or the phone's code suggestion, move forward as you type and back on Backspace, with a hidden PIN mode and a wrong-code state. Adapted from TailGrids (MIT).
 * Use it as: import { OtpInput } from "./otp-input"; <OtpInput label="Verification code" length?={4|6|8} value? defaultValue? onChange?={(code) => ...} onComplete?={(code) => ...} kind?="numeric"|"alphanumeric" masked? split? hint? error? disabled? autoFocus? id? />
 * Look: A row of square bordered boxes with a large centered character in each, an optional short dash splitting the row in half, the focused box ringed in the accent; filled boxes pop in, a wrong code shakes the row and turns the boxes red with the reason below.
 * Tokens: --color-surface --color-surface-sunken --color-border-strong --color-accent --color-danger --color-danger-surface --color-success --color-text --color-text-muted --control-lg --field-radius --text-xl --text-sm --space-2 --space-3 --focus-ring --duration-fast --duration-base --ease-spring --easing
 * Use cases: two-step sign-in; email verification; phone verification; payment confirmation; device pairing code; pin entry; invite code; account recovery
 * Jobs to be done: type the code i was sent; paste the code from my messages; fix a digit i got wrong; enter my pin without showing it
 * Keywords: otp, one-time code, verification code, pin, two-factor, code input, passcode
 */
/**
 * Input: one-time code. One box per character. Typing moves to the next box, Backspace clears and steps back, the arrow
 * keys, Home and End move between boxes, and pasting (or the phone's "From Messages" suggestion, which types the whole
 * code into one box) fills every box at once. The first box carries autocomplete="one-time-code" so phones offer the
 * code. onComplete fires once every box is filled. A wrong code is shown with `error`: the boxes turn red, the row gives
 * a short shake and the message is tied to the group with aria-describedby. Use it on its own screen or inside a
 * dialog (two-step settings, payment checks); the full verify page is p.auth-form.verify-code.
 * Make it the app's own: replace SAMPLE with the app's own wording and check the code against the app's server.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): the OTP input.
 */

/**
 * How to try it
 * - Type 2 4 6 8 1 0 into the first row: it is checked as soon as the last box fills.
 * - Copy any six digits and paste into any box: every box fills. Paste letters: nothing changes.
 * - Backspace on an empty box steps back and clears the one before; ← → Home End move between boxes.
 * - The second row starts wrong: change a digit and the message clears.
 *
 * Dependencies: React (useEffect, useId, useRef, useState). Nothing else: no package to install and nothing fetched at
 * run time. The styles are the library's own fl-otp- classes in templates/library/css/otp-input.css.
 */
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

// ── c.otp-input: one box per character, paste fills all, Backspace steps back. ──

export type OtpInputProps = {
  /** Names the group of boxes ("Verification code"). */
  label: string;
  /** How many characters: 4 to 8. */
  length?: number;
  /** Controlled code (shorter than length while it's being typed). */
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  /** Called once with the code when the last box fills. */
  onComplete?: (code: string) => void;
  /** Digits only, or letters and digits (shown in capitals). */
  kind?: "numeric" | "alphanumeric";
  /** Draw dots instead of the characters, for a PIN. */
  masked?: boolean;
  /** A short dash between the two halves, easier to read back. On by default for 6 and 8. */
  split?: boolean;
  hint?: string;
  /** Rejected: the reason. Shakes the row and turns the boxes red. */
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Goes on the first box. */
  id?: string;
  className?: string;
};

const clean = (text: string, kind: "numeric" | "alphanumeric") => (kind === "numeric" ? text.replace(/\D/g, "") : text.replace(/[^a-z0-9]/gi, "").toUpperCase());
const toCells = (code: string, length: number) => Array.from({ length }, (_, i) => code[i] ?? "");

export function OtpInput({ label, length = 6, value, defaultValue = "", onChange, onComplete, kind = "numeric", masked, split, hint, error, disabled, autoFocus, id, className }: OtpInputProps) {
  const n = Math.max(4, Math.min(8, Math.round(length)));
  const uid = useId();
  const firstId = id ?? `${uid}-0`;
  const [own, setOwn] = useState(() => toCells(clean(defaultValue, kind), n));
  const cells = value !== undefined ? toCells(clean(value, kind), n) : own;
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const row = useRef<HTMLDivElement>(null);
  const done = useRef("");
  const half = split ?? (n === 6 || n === 8);

  // A new error restarts the shake even when the message is the same as last time.
  useEffect(() => {
    const el = row.current;
    if (!el || !error) return;
    el.classList.remove("is-shaking");
    void el.offsetWidth;
    el.classList.add("is-shaking");
  }, [error]);

  const focusAt = (i: number) => {
    const el = boxes.current[Math.max(0, Math.min(n - 1, i))];
    el?.focus();
    el?.select();
  };

  const commit = (next: string[]) => {
    if (value === undefined) setOwn(next);
    const code = next.join("");
    onChange?.(code);
    if (next.every(Boolean)) {
      if (done.current !== code) {
        done.current = code;
        onComplete?.(code);
      }
    } else done.current = "";
  };

  /** Writes characters from box i on (a paste, a phone's code suggestion or one keystroke). */
  const fillFrom = (i: number, text: string) => {
    const chars = clean(text, kind);
    if (!chars) return;
    const start = chars.length >= n ? 0 : i;
    const next = [...cells];
    for (let k = 0; k < chars.length && start + k < n; k++) next[start + k] = chars[k]!;
    commit(next);
    focusAt(Math.min(start + chars.length, n - 1));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (k === "Backspace") {
      e.preventDefault();
      const next = [...cells];
      if (cells[i]) next[i] = "";
      else if (i > 0) {
        next[i - 1] = "";
        focusAt(i - 1);
      }
      commit(next);
    } else if (k === "Delete") {
      e.preventDefault();
      const next = [...cells];
      next[i] = "";
      commit(next);
    } else if (k === "ArrowLeft") {
      e.preventDefault();
      focusAt(i - 1);
    } else if (k === "ArrowRight") {
      e.preventDefault();
      focusAt(i + 1);
    } else if (k === "Home") {
      e.preventDefault();
      focusAt(0);
    } else if (k === "End") {
      e.preventDefault();
      focusAt(n - 1);
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (clean(k, kind)) fillFrom(i, k);
    }
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillFrom(i, e.clipboardData.getData("text"));
  };

  const hintId = hint ? `${uid}-hint` : "";
  const errId = error ? `${uid}-err` : "";
  const described = [errId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["fl-otp", className ?? ""].filter(Boolean).join(" ")} data-fl="c.otp-input">
      <label className="fl-otp-label" id={`${uid}-label`} htmlFor={firstId}>
        {label}
      </label>
      <div
        ref={row}
        className={`fl-otp-row${error ? " is-invalid" : ""}`}
        role="group"
        aria-labelledby={`${uid}-label`}
        aria-describedby={described}
        onAnimationEnd={(e) => {
          if (e.target === row.current) row.current.classList.remove("is-shaking");
        }}
      >
        {cells.map((c, i) => (
          <span key={i} className="fl-otp-slot">
            {half && i === n / 2 ? <span className="fl-otp-dash" aria-hidden="true" /> : null}
            <input
              ref={(el) => {
                boxes.current[i] = el;
              }}
              id={i === 0 ? firstId : `${uid}-${i}`}
              className={`fl-otp-box${c ? " is-filled" : ""}`}
              type={masked ? "password" : "text"}
              inputMode={kind === "numeric" ? "numeric" : "text"}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              autoCapitalize={kind === "alphanumeric" ? "characters" : "off"}
              spellCheck={false}
              autoFocus={autoFocus && i === 0}
              value={c}
              disabled={disabled}
              aria-label={`${i === 0 ? `${label}, ` : ""}character ${i + 1} of ${n}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={i === 0 ? described : undefined}
              // A phone's code suggestion (or a typed key on a soft keyboard) arrives here; spread it across the boxes.
              onChange={(e) => {
                const v = e.target.value;
                if (!v) commit(cells.map((x, k) => (k === i ? "" : x)));
                else fillFrom(i, v.replace(c, "") || v);
              }}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => e.target.select()}
            />
          </span>
        ))}
      </div>
      {error ? (
        <p id={errId} className="fl-otp-error" role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="fl-otp-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "One-time code",
  lede: "Six digits, a wrong code, a hidden PIN and the disabled state.",
  demoCode: "246810",
  states: [
    { key: "default", heading: "Default", label: "Verification code", value: "", hint: "Sent to •••• 4821. Try 246810.", error: "" },
    { key: "invalid", heading: "Wrong code", label: "Verification code", value: "246801", hint: "", error: "That code doesn't match. Check the last digits." },
    { key: "pin", heading: "Hidden PIN", label: "Card PIN", value: "", hint: "4 digits", error: "" },
    { key: "disabled", heading: "Disabled", label: "Backup code", value: "A7K2Q9", hint: "Available after 2 minutes", error: "" },
  ],
  checking: "Checking…",
  right: "Code accepted.",
  wrong: "That code doesn't match. Try again.",
  pinSet: "PIN set.",
};

type State = (typeof SAMPLE.states)[number];

function DemoCheck({ label, hint }: { label: string; hint: string }) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <>
      <OtpInput
        label={label}
        hint={state === "ok" ? undefined : hint}
        value={code}
        error={state === "bad" ? SAMPLE.wrong : undefined}
        disabled={state === "checking"}
        onChange={(c) => {
          setCode(c);
          if (state !== "checking") setState("idle");
        }}
        onComplete={(c) => {
          setState("checking");
          timer.current = window.setTimeout(() => setState(c === SAMPLE.demoCode ? "ok" : "bad"), 600);
        }}
      />
      <p className="fl-otp-status" role="status">
        {state === "checking" ? SAMPLE.checking : state === "ok" ? SAMPLE.right : ""}
      </p>
    </>
  );
}

function DemoWrong({ label, value, error }: { label: string; value: string; error: string }) {
  const [code, setCode] = useState(value);
  return <OtpInput label={label} value={code} onChange={setCode} error={code === value ? error : undefined} />;
}

function DemoPin({ label, hint }: { label: string; hint: string }) {
  const [set, setSet] = useState(false);
  return (
    <>
      <OtpInput label={label} length={4} masked hint={hint} onChange={() => setSet(false)} onComplete={() => setSet(true)} />
      <p className="fl-otp-status" role="status">
        {set ? SAMPLE.pinSet : ""}
      </p>
    </>
  );
}

export default function OtpInputSheet() {
  const uid = useId();
  const [a, b, c, d] = SAMPLE.states as [State, State, State, State];
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {SAMPLE.title}
          </h2>
          <p className="fl-text">{SAMPLE.lede}</p>
        </div>
        <div className="fl-otp-sheet">
          <div className="fl-otp-card">
            <h3>{a.heading}</h3>
            <DemoCheck label={a.label} hint={a.hint} />
          </div>
          <div className="fl-otp-card">
            <h3>{b.heading}</h3>
            <DemoWrong label={b.label} value={b.value} error={b.error} />
          </div>
          <div className="fl-otp-card">
            <h3>{c.heading}</h3>
            <DemoPin label={c.label} hint={c.hint} />
          </div>
          <div className="fl-otp-card">
            <h3>{d.heading}</h3>
            <OtpInput label={d.label} kind="alphanumeric" defaultValue={d.value} hint={d.hint} disabled />
          </div>
        </div>
      </div>
    </section>
  );
}
