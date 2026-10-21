/** @flowcode-library social-button · Social sign-in buttons (Sign-in and sign-up)
 * Catalog ID: c.social-button (component)
 * Function: The social sign-in button (c.social-button) and its set: Continue with Google, Apple, GitHub, Microsoft, Facebook or X, stacked or as an icon row, running one sign-in at a time with a busy state and a failure line with Try again. Adapted from TailGrids (MIT).
 * Use it as: import { SocialButton, SocialSignIn } from "./social-button"; <SocialSignIn providers={["google","apple","github","microsoft","facebook","x"]} onSelect={async (provider) => ...} layout?="stack"|"row" divider?="or" disabled? disabledReason? labels?={{ failed, retry }} />; one button: <SocialButton provider="google" label? busy? busyLabel? iconOnly? disabled? onClick />
 * Look: Outlined buttons the width of the form, each with a one-color brand mark at the left and "Continue with …" centered, or square icon-only buttons in a row; pressed, the mark becomes a small spinner reading "Connecting to …" while the others wait; a red line with Try again appears under the set when sign-in fails.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-danger --color-danger-surface --control-lg --control-radius --text-sm --text-xs --space-2 --space-3 --space-4 --focus-ring --duration-fast --duration-base --easing --ease-out
 * Use cases: sign in with google; sign up with apple; developer tool sign-in with github; work account sign-in with microsoft; social sign-up; connect an account
 * Jobs to be done: sign in without making a new password; use my work account; see that sign-in is under way; try again when it fails
 * Keywords: social login, sign in with google, oauth, sso, continue with, provider buttons
 */
/**
 * Auth: social sign-in buttons. Each provider is a real <button> with "Continue with Google" as its name (the icon-only
 * row keeps that name as aria-label and a tooltip). The brand marks are drawn in one color (currentColor) so they take
 * the theme's text color. SocialSignIn runs the sign-in for you: the pressed button turns busy (aria-busy and a
 * spinner, "Connecting to GitHub…"), the others switch off so only one runs at a time, and if onSelect throws, a red
 * line says which provider failed with a Try again button. Put it above or below the email form under an "or" rule.
 * Make it the app's own: list only the providers the app has set up and start each one's sign-in in onSelect.
 * Brand marks adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): the social button. The names and marks are
 * the providers' trademarks; use them only for signing in with that provider.
 */

/**
 * How to try it
 * - Press Continue with Google: it spins for a moment, then says you're signed in. Start over brings the buttons back.
 * - Press Continue with GitHub: the first try fails with a reason and Try again; the second works.
 * - Tab across the icon row: each button names its provider (hover for the tooltip).
 * - The last set is disabled, with the reason under it.
 *
 * Dependencies: React (useEffect, useId, useRef, useState). Nothing else: no package to install and nothing fetched at
 * run time; the demo's sign-in is a timer. Styles are the fl-soc- classes in templates/library/css/social-button.css.
 */
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

// ── c.social-button: "Continue with …" for one sign-in provider. ──

export type SocialProvider = "google" | "apple" | "github" | "microsoft" | "facebook" | "x";

const NAMES: Record<SocialProvider, string> = { google: "Google", apple: "Apple", github: "GitHub", microsoft: "Microsoft", facebook: "Facebook", x: "X" };

/** One-color brand marks on a 24 by 24 box, filled with currentColor. */
const MARKS: Record<SocialProvider, ReactNode> = {
  google: (
    <>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </>
  ),
  apple: (
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  ),
  github: (
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  ),
  microsoft: <path d="M1 1h10.5v10.5H1zM12.5 1H23v10.5H12.5zM1 12.5h10.5V23H1zM12.5 12.5H23V23H12.5z" />,
  facebook: (
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  ),
  x: <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.294 19.486h2.039L6.486 3.24H4.298l13.309 17.398z" />,
};

export function SocialMark({ provider }: { provider: SocialProvider }) {
  return (
    <svg className="fl-soc-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {MARKS[provider]}
    </svg>
  );
}

export type SocialButtonProps = {
  provider: SocialProvider;
  /** The visible words; "Continue with Google" when left out. */
  label?: string;
  /** Under way: a spinner in place of the mark, aria-busy, and clicks ignored. */
  busy?: boolean;
  busyLabel?: string;
  /** Square, mark only; the label stays as its accessible name and tooltip. */
  iconOnly?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function SocialButton({ provider, label, busy, busyLabel, iconOnly, disabled, className, onClick, ...rest }: SocialButtonProps) {
  const name = label ?? `Continue with ${NAMES[provider]}`;
  const shown = busy ? (busyLabel ?? `Connecting to ${NAMES[provider]}…`) : name;
  return (
    <button
      type="button"
      {...rest}
      className={["fl-soc-btn", iconOnly ? "fl-soc-btn--icon" : "", busy ? "is-busy" : "", className ?? ""].filter(Boolean).join(" ")}
      data-fl="c.social-button"
      data-provider={provider}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      aria-label={iconOnly ? shown : undefined}
      title={iconOnly ? name : undefined}
      onClick={(e) => {
        if (busy) return;
        onClick?.(e);
      }}
    >
      <span className="fl-soc-lead">{busy ? <span className="fl-soc-spin" aria-hidden="true" /> : <SocialMark provider={provider} />}</span>
      {iconOnly ? null : <span className="fl-soc-label">{shown}</span>}
    </button>
  );
}

// ── SocialSignIn: a set of provider buttons that runs one sign-in at a time and shows failures. ──

export type SocialSignInProps = {
  providers: SocialProvider[];
  /** Start the provider's sign-in. Throw (or reject) with a message to show it under the buttons. */
  onSelect: (provider: SocialProvider) => void | Promise<void>;
  layout?: "stack" | "row";
  /** A rule with this word above the set ("or"); leave out for none. */
  divider?: string;
  disabled?: boolean;
  /** Why the set is off, shown under it. */
  disabledReason?: string;
  labels?: { failed?: string; retry?: string };
  className?: string;
};

export function SocialSignIn({ providers, onSelect, layout = "stack", divider, disabled, disabledReason, labels = {}, className }: SocialSignInProps) {
  const l = { failed: "Couldn't sign in with", retry: "Try again", ...labels };
  const uid = useId();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [failed, setFailed] = useState<{ provider: SocialProvider; reason: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const run = async (p: SocialProvider) => {
    setFailed(null);
    setBusy(p);
    try {
      await onSelect(p);
    } catch (err) {
      if (alive.current) setFailed({ provider: p, reason: err instanceof Error ? err.message : String(err ?? "") });
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  const reasonId = disabled && disabledReason ? `${uid}-why` : undefined;
  return (
    <div className={["fl-soc", className ?? ""].filter(Boolean).join(" ")}>
      {divider ? (
        <p className="fl-soc-or">
          <span>{divider}</span>
        </p>
      ) : null}
      <div className={`fl-soc-set fl-soc-set--${layout}`} role="group" aria-label="Sign-in options" aria-describedby={reasonId}>
        {providers.map((p) => (
          <SocialButton key={p} provider={p} iconOnly={layout === "row"} busy={busy === p} disabled={disabled || (busy !== null && busy !== p)} onClick={() => run(p)} />
        ))}
      </div>
      <div className="fl-soc-alert" role="alert">
        {failed ? (
          <p className="fl-soc-error">
            <span>
              {l.failed} {NAMES[failed.provider]}.{failed.reason ? ` ${failed.reason}` : ""}
            </span>
            <button type="button" className="fl-soc-retry" onClick={() => run(failed.provider)}>
              {l.retry}
            </button>
          </p>
        ) : null}
      </div>
      {reasonId ? (
        <p id={reasonId} className="fl-soc-why">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Social sign-in",
  lede: "Stacked buttons, an icon row and the disabled state.",
  stack: { heading: "Stacked", providers: ["google", "apple", "github", "microsoft"] as SocialProvider[], divider: "or continue with email" },
  row: { heading: "Icon row", providers: ["google", "apple", "github", "facebook", "x"] as SocialProvider[] },
  off: { heading: "Disabled", providers: ["google", "microsoft"] as SocialProvider[], reason: "Your workspace signs in with its own single sign-on." },
  failOnce: "github" as SocialProvider,
  reason: "The connection timed out.",
  signedIn: "Signed in with",
  startOver: "Start over",
};

function useDemoSignIn() {
  const tries = useRef(0);
  const [done, setDone] = useState<SocialProvider | null>(null);
  const onSelect = (p: SocialProvider) =>
    new Promise<void>((resolve, reject) =>
      window.setTimeout(() => {
        if (p === SAMPLE.failOnce && tries.current++ === 0) reject(new Error(SAMPLE.reason));
        else {
          setDone(p);
          resolve();
        }
      }, 1200),
    );
  return { done, onSelect, reset: () => setDone(null) };
}

function Demo({ providers, layout, divider }: { providers: SocialProvider[]; layout: "stack" | "row"; divider?: string }) {
  const { done, onSelect, reset } = useDemoSignIn();
  // The pressed button is gone once signed in: the confirmation takes focus so the keyboard isn't left on nothing.
  const doneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);
  return done ? (
    <div ref={doneRef} tabIndex={-1} className="fl-soc-done" role="status">
      <span className="fl-soc-done__mark">
        <SocialMark provider={done} />
      </span>
      <strong>
        {SAMPLE.signedIn} {NAMES[done]}
      </strong>
      <button type="button" className="fl-soc-retry" onClick={reset}>
        {SAMPLE.startOver}
      </button>
    </div>
  ) : (
    <SocialSignIn providers={providers} layout={layout} divider={divider} onSelect={onSelect} />
  );
}

export default function SocialButtonSheet() {
  const uid = useId();
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-soc-sheet">
          <div className="fl-soc-card">
            <h3>{d.stack.heading}</h3>
            <Demo providers={d.stack.providers} layout="stack" />
            <p className="fl-soc-or">
              <span>{d.stack.divider}</span>
            </p>
          </div>
          <div className="fl-soc-card">
            <h3>{d.row.heading}</h3>
            <Demo providers={d.row.providers} layout="row" />
          </div>
          <div className="fl-soc-card">
            <h3>{d.off.heading}</h3>
            <SocialSignIn providers={d.off.providers} onSelect={() => undefined} disabled disabledReason={d.off.reason} />
          </div>
        </div>
      </div>
    </section>
  );
}
