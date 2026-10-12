/** @flowcode-library alerts-states · Alerts: four tones, inline, banner and toast (Alerts and states)
 * Catalog ID: c.alert (component)
 * Function: The alert (c.alert) in four tones and three places (inline, banner, bleed strip, toast), each dismissible and able to carry an action, plus the self-closing toast region (c.toast-stack); the reference sheet shows each, the roles that announce them, and a live banner, strip and toast stack. Versions: tone-card, announcement and neobrutal; the sheet shows each and the toast-stack cards.
 * Use it as: import { Alert } from "./alerts-states"; <Alert version?="tone-card"|"announcement"|"neobrutal" variant?="info"|"success"|"warning"|"danger" placement?="inline"|"banner"|"toast" bleed? tag? title="Shoot saved" onDismiss? dismissLabel? action?={<Button/> or a link}>Detail text</Alert> (tone-card also takes actionLabel? onAction? dismissible?; announcement takes rememberKey? restoreLabel? tag?; neobrutal takes icon? dismissible?)
 * Variants: c.alert.info - neutral news that needs no action: accent tint with an i icon; c.alert.success - something worked: green tint with a check icon; c.alert.warning - take care before going on: amber tint with an alert icon; c.alert.danger - something failed and needs a fix: red tint, announced at once (role alert)
 * Look: A rounded, tinted box with a round tone icon, a bold title and a line of detail; inline it can carry an action button and a dismiss x, as a banner it spans the page (or, with bleed, is a full-width accent strip with an optional tag) with a link and a dismiss button, as a toast it is a pill with a small x, an optional detail line and an action such as Undo.
 * Tokens: --color-accent --color-success --color-warning --color-danger --color-border --color-surface --color-surface-sunken --color-text-muted --radius-lg --radius-md --space-1 --space-2 --space-3 --space-4 --duration-med --easing --color-on-accent --color-text --surface-shadow-hover --color-secondary --radius-sm --space-5 --weight-bold --text-xs --text-sm --text-md --tracking-wide --duration-fast --duration-base --focus-ring
 * Also: c.toast-stack (component)
 *   Use it as: import { ToastStack } from "./alerts-states"; <ToastStack version?="cards" toasts={[{id, variant?, title, text?, onUndo?}]} onDismiss={(id) => ...} max?={4} duration?={5000} contained? />
 *   Look: A column of toast cards in the page corner, each with a tone icon, title, optional second line and Undo, a close x and a thin bar along the bottom that shrinks as the toast counts down. Hover or focus pauses the count; Escape closes it; only the newest max show.
 * Use cases: form saved; something failed; a warning before an action; a tip; a site-wide notice; form errors; success message; warning notice; system status; account notices; payment failed; validation feedback; info message; announcement bar; promo banner; new feature announcement; maintenance notice; sale announcement; cookie or policy notice; event promotion; notifications; save confirmation; undo action; background task updates; activity alerts; error notifications; upload complete; alerts; status badges; upload progress; system messages; booking status; dashboard notices
 * Jobs to be done: know something happened; understand what went wrong; get told without losing my place; know what went wrong and fix it; confirm my change was saved; notice something that needs my attention; dismiss a message i've read; hear about what's new; find out about a sale or offer; learn about planned downtime; hide a notice i've seen; know my action worked; undo something i did by mistake; stay aware of updates while working; notice errors without losing my place; know if something worked; see the status of my booking; track an upload until it finishes; dismiss notices i have read
 * Keywords: alert, toast, banner, notice, success, warning, error, info, dismiss, message, status, feedback, dismissible, announcement, snackbar, notification, undo, alerts, badges, progress, notifications, neobrutalism
 */
/**
 * The same four tones in the three places a message can appear. Where it appears decides how it behaves: an inline
 * alert sits in the flow and stays; a banner spans the page and is dismissed; a toast arrives, says one thing and goes.
 *
 * The tone is never carried by color alone - each has its own icon and its own word - because a red box is invisible
 * to a good share of people. An error alert uses role="alert" so it is announced at once; everything quieter uses
 * role="status", which waits for a gap.
 *
 * Make it the app's own: replace the words. Keep the icon with the color, and keep errors out of toasts: a message
 * that disappears is no place for something the person has to act on.
 */
/**
 * How to try it
 * - Pick a tone for the banner, or dismiss it.
 * - Press any of the three buttons under Toast: toasts arrive, stack to three, and leave after a few seconds.
 * - Press a toast's x to dismiss it early.
 *
 * Dependencies: React (useEffect, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of
 * SVG paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a
 * built app exactly as it runs here.
 */
import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.alert: the one alert. Every piece's messages are this component; the specimen below shows every tone and place. ──

export type AlertVariant = "info" | "success" | "warning" | "danger";
export type AlertPlacement = "inline" | "banner" | "toast";
/**
 * Other designs of the same alert. "default" follows the app's tokens; "tone-card" is a list card with a colored left
 * edge, a screen-reader tone word and a text action; "announcement" is the full-width accent strip that stays closed
 * once dismissed; "neobrutal" is the neobrutalism kit's alert (thick ink border, hard shadow).
 */
export type AlertVersion = "default" | "tone-card" | "announcement" | "neobrutal";

// Written out in full (not built from the variant name) so a build finds every class the alert needs.
const TONE: Record<AlertVariant, string> = {
  info: "fl-ctl-alert--info",
  success: "fl-ctl-alert--success",
  warning: "fl-ctl-alert--warning",
  danger: "fl-ctl-alert--danger",
};
const TONE_ICON: Record<AlertVariant, string> = { info: "info", success: "check", warning: "alert", danger: "close" };
const PLACE: Record<AlertPlacement, string> = { inline: "fl-ctl-alert", banner: "fl-ctl-banner", toast: "fl-ctl-toast" };
// tone-card: the tone class sets the edge and icon color; the word is read by screen readers.
const CARD_TONE: Record<AlertVariant, string> = { info: "fl-alr-tone-info", success: "fl-alr-tone-success", warning: "fl-alr-tone-warning", danger: "fl-alr-tone-error" };
const TONE_WORD: Record<AlertVariant, string> = { info: "Information", success: "Success", warning: "Warning", danger: "Error" };
const CARD_PATH: Record<AlertVariant, string> = {
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01",
  success: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l2.5 2.5L16 9.5",
  warning: "M12 4 2.5 20h19zM12 10v4M12 17h.01",
  danger: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6",
};
// neobrutal: the tone class sets the ink-box color and the icon tile.
const NB_TONE: Record<AlertVariant, string> = { info: "fl-nb-tone-info", success: "fl-nb-tone-success", warning: "fl-nb-tone-warning", danger: "fl-nb-tone-error" };
const NB_ICON: Record<AlertVariant, string> = { info: "sparkle", success: "check", warning: "clock", danger: "shield" };

type AlertProps = {
  /** Another design of the alert; "default" when left out. See AlertVersion. */
  version?: AlertVersion;
  variant?: AlertVariant;
  /** Inline sits in the flow; banner spans the page; toast is a one-line pill (render it inside a <ul>). */
  placement?: AlertPlacement;
  title: string;
  /** Set it and a dismiss button appears (any placement). */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** Banner only: draw the full-width accent strip (an announcement) instead of the tinted box. */
  bleed?: boolean;
  /** Banner with bleed only: a small label before the message, such as "New". */
  tag?: string;
  /** A button or link for the person to act on: Fix it (inline), See the timetable (banner), Undo (toast). */
  action?: ReactNode;
  /** tone-card and neobrutal: show a dismiss x that hides the alert by itself (no onDismiss needed). */
  dismissible?: boolean;
  /** tone-card only: a text action button with this label (instead of an action node); onAction runs when pressed. */
  actionLabel?: string;
  onAction?: () => void;
  /** neobrutal only: an icon name from ./icons to use instead of the tone's own. */
  icon?: string;
  /** announcement only: the key under which the dismissal is remembered on this device, so it stays closed. */
  rememberKey?: string;
  /** announcement only: the button that brings a dismissed announcement back (left out, nothing shows once closed). */
  restoreLabel?: string;
  className?: string;
  /** The detail line under (inline) or after (banner) the title. */
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title" | "children" | "className">;

function CloseGlyph({ width }: { width: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function Alert(props: AlertProps) {
  const { version = "default", ...own } = props;
  if (version === "tone-card") return <ToneCardAlert {...own} />;
  if (version === "announcement") return <Announcement {...own} />;
  if (version === "neobrutal") return <NeobrutalAlert {...own} />;
  return <BaseAlert {...own} />;
}

// c.alert@tone-card: a list card with a colored left edge, the tone as a hidden word, and a text action.
function ToneCardAlert({ variant = "info", title, onDismiss, dismissible, dismissLabel, action, actionLabel, onAction, className, children, ...rest }: Omit<AlertProps, "version">) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const close = onDismiss || dismissible ? () => { onDismiss?.(); setGone(true); } : undefined;
  const act = action ?? (actionLabel ? <button type="button" className="fl-alr__action" onClick={onAction}>{actionLabel}</button> : null);
  const { bleed: _b, tag: _t, placement: _p, icon: _i, rememberKey: _r, restoreLabel: _rl, ...attrs } = rest as AlertProps;
  return (
    <div role={variant === "danger" ? "alert" : undefined} {...(attrs as HTMLAttributes<HTMLDivElement>)} className={["fl-alr", CARD_TONE[variant], className ?? ""].filter(Boolean).join(" ")} data-fl="c.alert@tone-card">
      <span className="fl-alr__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={CARD_PATH[variant]} />
        </svg>
      </span>
      <div className="fl-alr__body">
        <p className="fl-alr__title">
          <span className="fl-sr">{TONE_WORD[variant]}: </span>
          {title}
        </p>
        {children ? <p className="fl-alr__text">{children}</p> : null}
        {act ? <div className="fl-alr__actions">{act}</div> : null}
      </div>
      {close ? (
        <button type="button" className="fl-alr__close" aria-label={dismissLabel ?? `Dismiss: ${title}`} onClick={close}>
          <CloseGlyph width={1.75} />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function readDismissed(key: string) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

// c.alert@announcement: the full-width accent strip across the top of a page; once closed it stays closed on this device.
function Announcement({ title, tag, action, onDismiss, dismissLabel, rememberKey, restoreLabel, className, children }: Omit<AlertProps, "version">) {
  const [dismissed, setDismissed] = useState(() => (rememberKey ? readDismissed(rememberKey) : false));
  const [status, setStatus] = useState("");
  const restoreRef = useRef<HTMLButtonElement>(null);
  const movedFocus = useRef(false);

  // After closing, focus goes to the restore button (if there is one) so keyboard focus is not lost.
  useEffect(() => {
    if (dismissed && movedFocus.current) {
      restoreRef.current?.focus();
      movedFocus.current = false;
    }
  }, [dismissed]);

  const close = () => {
    if (rememberKey) {
      try {
        localStorage.setItem(rememberKey, "1");
      } catch {
        /* storage unavailable: it closes for this visit only */
      }
    }
    movedFocus.current = true;
    setDismissed(true);
    setStatus("Announcement dismissed.");
    onDismiss?.();
  };
  const reopen = () => {
    if (rememberKey) {
      try {
        localStorage.removeItem(rememberKey);
      } catch {
        /* nothing to clear */
      }
    }
    setDismissed(false);
    setStatus("Announcement shown again.");
  };

  return (
    <div>
      {dismissed ? (
        restoreLabel ? (
          <Button ref={restoreRef} variant="secondary" size={32} onClick={reopen}>
            {restoreLabel}
          </Button>
        ) : null
      ) : (
        <section aria-label="Announcement" className={["fl-alr-banner", className ?? ""].filter(Boolean).join(" ")} data-fl="c.alert@announcement">
          <div className="fl-alr-banner__row">
            <p className="fl-alr-banner__msg">
              {tag ? <span className="fl-alr-banner__tag">{tag}</span> : null}
              <span>
                {title}
                {children ? <> {children}</> : null}
              </span>
              {action}
            </p>
            <button type="button" className="fl-alr__close" aria-label={dismissLabel ?? "Dismiss announcement"} onClick={close}>
              <CloseGlyph width={1.75} />
            </button>
          </div>
        </section>
      )}
      <span className="fl-sr" role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}

// c.alert@neobrutal: the neobrutalism kit's alert, a thick-ink box with a colored icon tile and a hard shadow.
function NeobrutalAlert({ variant = "info", title, onDismiss, dismissible, dismissLabel, icon, action, className, children, ...rest }: Omit<AlertProps, "version">) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const close = onDismiss || dismissible ? () => { onDismiss?.(); setGone(true); } : undefined;
  const { bleed: _b, tag: _t, placement: _p, actionLabel: _a, onAction: _o, rememberKey: _r, restoreLabel: _rl, ...attrs } = rest as AlertProps;
  return (
    <div role={variant === "danger" ? "alert" : undefined} {...(attrs as HTMLAttributes<HTMLDivElement>)} className={["fl-nb", "fl-nb-box", "fl-nb-alert", NB_TONE[variant], className ?? ""].filter(Boolean).join(" ")} data-fl="c.alert@neobrutal">
      <span className="fl-nb-alert__icon" aria-hidden="true">
        <Icon name={icon ?? NB_ICON[variant]} />
      </span>
      <div className="fl-nb-alert__body">
        <p className="fl-nb-alert__title">{title}</p>
        {children ? <p className="fl-nb-alert__text">{children}</p> : null}
        {action}
      </div>
      {close ? (
        <button type="button" className="fl-nb-close" aria-label={dismissLabel ?? `Dismiss: ${title}`} onClick={close}>
          <CloseGlyph width={2.5} />
        </button>
      ) : null}
    </div>
  );
}

function BaseAlert({ variant = "info", placement = "inline", title, onDismiss, dismissLabel, action, bleed, tag, className, children, dismissible: _d, actionLabel: _a, onAction: _o, icon: _i, rememberKey: _r, restoreLabel: _rl, ...rest }: Omit<AlertProps, "version">) {
  const cls = [PLACE[placement], TONE[variant], className ?? ""].filter(Boolean).join(" ");
  const icon = (
    <span className="fl-ctl-alert-icon" aria-hidden="true">
      <Icon name={TONE_ICON[variant]} />
    </span>
  );
  const own = { className: cls, "data-fl": `c.alert.${variant}` };
  if (placement === "toast") {
    return (
      <li {...(rest as HTMLAttributes<HTMLLIElement>)} {...own}>
        {icon}
        {children ? (
          <span className="fl-ctl-alert-text">
            <strong>{title}</strong>
            <span className="fl-ctl-matrix-what">{children}</span>
          </span>
        ) : (
          title
        )}
        {action}
        {onDismiss ? (
          <button type="button" className="fl-ctl-toast-x" aria-label={dismissLabel ?? `Dismiss: ${title}`} onClick={onDismiss}>
            <Icon name="close" />
          </button>
        ) : null}
      </li>
    );
  }
  if (placement === "banner" && bleed) {
    return (
      <div role="status" {...rest} className={["fl-alr-banner", className ?? ""].filter(Boolean).join(" ")} data-fl={own["data-fl"]}>
        <div className="fl-alr-banner__row">
          <p className="fl-alr-banner__msg">
            {tag ? <span className="fl-alr-banner__tag">{tag}</span> : null}
            <span>
              <strong>{title}</strong> {children}
            </span>
            {action}
          </p>
          {onDismiss ? (
            <button type="button" className="fl-alr__close" aria-label={dismissLabel ?? "Dismiss announcement"} onClick={onDismiss}>
              <Icon name="close" />
            </button>
          ) : null}
        </div>
      </div>
    );
  }
  if (placement === "banner") {
    return (
      <div role="status" {...rest} {...own}>
        {icon}
        <span>
          <strong>{title}</strong> {children}
        </span>
        {action}
        {onDismiss ? (
          <Button variant="tertiary" size={32} icon="close" iconOnly onClick={onDismiss}>
            {dismissLabel ?? "Dismiss this notice"}
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div role={variant === "danger" ? "alert" : "status"} {...rest} {...own}>
      {icon}
      <span className="fl-ctl-alert-text">
        <strong>{title}</strong>
        {children ? <span className="fl-ctl-matrix-what">{children}</span> : null}
      </span>
      {action}
      {onDismiss ? (
        <Button variant="tertiary" size={32} icon="close" iconOnly onClick={onDismiss}>
          {dismissLabel ?? `Dismiss: ${title}`}
        </Button>
      ) : null}
    </div>
  );
}

// ── c.toast-stack: the region toasts arrive in. Each one counts down and leaves; hover or focus pauses it. ──

export type ToastItem = {
  id: number;
  variant?: AlertVariant;
  title: string;
  /** A second line under the title. */
  text?: string;
  /** Set it and an Undo button appears; pressing it runs this, then closes the toast. */
  onUndo?: () => void;
};

// Written out in full so a build finds every class.
const TOAST_TONE: Record<AlertVariant, string> = { info: "fl-alr-tone-info", success: "fl-alr-tone-success", warning: "fl-alr-tone-warning", danger: "fl-alr-tone-error" };

function ToastRow({ toast, duration, onClose }: { toast: ToastItem; duration: number; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const variant = toast.variant ?? "info";

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onClose(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.id, onClose]);

  const onKey = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === "Escape") onClose(toast.id);
  };

  return (
    <li
      className={`fl-alr-toast ${TOAST_TONE[variant]}`}
      data-fl={`c.toast-stack.${variant}`}
      data-paused={paused}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      onKeyDown={onKey}
    >
      <span className="fl-alr__icon" aria-hidden="true">
        <Icon name={TONE_ICON[variant]} />
      </span>
      <div className="fl-alr__body" style={{ paddingTop: 0 }}>
        <p className="fl-alr__title">{toast.title}</p>
        {toast.text ? <p className="fl-alr__text">{toast.text}</p> : null}
        {toast.onUndo ? (
          <button
            type="button"
            className="fl-alr-toast__undo"
            onClick={() => {
              toast.onUndo?.();
              onClose(toast.id);
            }}
          >
            Undo
          </button>
        ) : null}
      </div>
      <button type="button" className="fl-alr__close" aria-label={`Close: ${toast.title}`} onClick={() => onClose(toast.id)}>
        <Icon name="close" />
      </button>
      <span className="fl-alr-toast__bar" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
    </li>
  );
}

export type ToastStackVersion = "default" | "cards";

export function ToastStack({ toasts, onDismiss, max = 4, duration = 5000, contained, label = "Notifications", version = "default" }: {
  /** "cards" names the toast cards with a countdown bar (c.toast-stack@cards), which is also what "default" draws. */
  version?: ToastStackVersion;
  toasts: ToastItem[];
  /** Called with the toast's id when it times out, is closed, or Escape is pressed on it. */
  onDismiss: (id: number) => void;
  /** At most this many show, the newest kept. */
  max?: number;
  /** Milliseconds a toast stays; hover or focus pauses the count. */
  duration?: number;
  /** Sit inside the nearest positioned box (a stage) instead of the page corner. */
  contained?: boolean;
  label?: string;
}) {
  const style = contained ? { position: "absolute" as const, right: "var(--space-4)", bottom: "var(--space-4)", width: "min(24rem, calc(100% - 2 * var(--space-4)))" } : undefined;
  return (
    <div role="region" aria-label={label} data-fl={version === "cards" ? "c.toast-stack@cards" : undefined}>
      <ol className="fl-alr-toasts" style={style} aria-live="polite" aria-relevant="additions">
        {toasts.slice(-max).map((t) => (
          <ToastRow key={t.id} toast={t} duration={duration} onClose={onDismiss} />
        ))}
      </ol>
    </div>
  );
}

// c.toast-stack@cards in use: a basket whose actions each confirm with a toast (toast-stack wraps this).
export type ToastBasketProps = {
  title: string;
  lede: string;
  basket: string[];
  durationMs: number;
  /** Sit the toasts inside the nearest positioned box instead of the page corner. */
  contained?: boolean;
  toasts: Record<"saved" | "removed" | "failed" | "reminder", { tone: string; title: string; text: string }>;
};

export function ToastBasket({ title, lede, basket: initial, durationMs, contained, toasts: copy }: ToastBasketProps) {
  const [basket, setBasket] = useState<string[]>(initial);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const close = useRef((id: number) => setToasts((t) => t.filter((x) => x.id !== id))).current;
  const push = (t: Omit<ToastItem, "id">) => setToasts((all) => [...all, { ...t, id: nextId.current++ }].slice(-4));
  const asVariant = (tone: string): AlertVariant => (tone === "error" ? "danger" : tone === "success" || tone === "warning" ? tone : "info");

  const removeLast = () => {
    const item = basket[basket.length - 1];
    if (!item) return;
    const index = basket.length - 1;
    setBasket((b) => b.slice(0, -1));
    push({ variant: "info", title: copy.removed.title, text: item, onUndo: () => setBasket((b) => [...b.slice(0, index), item, ...b.slice(index)]) });
  };
  const show = (key: "saved" | "failed" | "reminder") => {
    const t = copy[key];
    push({ variant: asVariant(t.tone), title: t.title, text: t.text });
  };

  return (
    <section className="fl-section" aria-labelledby="toast-basket-title" style={contained ? { position: "relative" } : undefined}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id="toast-basket-title" className="fl-title fl-title--md">
            {title}
          </h2>
          <p className="fl-text">{lede}</p>
        </div>
        <div className="fl-card" style={{ gap: "var(--space-5)" }}>
          {basket.length === 0 ? (
            <p className="fl-text">Your basket is empty. Undo the last removal to get a class back.</p>
          ) : (
            <ul className="fl-alr-log" aria-label="Classes in your basket">
              {basket.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <div className="fl-actions">
            <Button onClick={() => show("saved")}>Save details</Button>
            <Button variant="secondary" onClick={removeLast} disabled={basket.length === 0}>
              Remove last class
            </Button>
            <Button variant="secondary" onClick={() => show("reminder")}>
              Set reminder
            </Button>
            <Button variant="secondary" onClick={() => show("failed")}>
              Try a failed payment
            </Button>
          </div>
        </div>
      </div>
      <ToastStack version="cards" toasts={toasts} onDismiss={close} duration={durationMs} contained={contained} />
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  basket: {
    title: "Your basket",
    lede: "Try the buttons: each one confirms with a toast.",
    items: ["Pottery for beginners · Sat 11:00", "Life drawing · Tue 19:00", "Printmaking taster · Sun 14:00"],
    durationMs: 5000,
    toasts: {
      saved: { tone: "success", title: "Details saved", text: "Your name and phone number are up to date." },
      removed: { tone: "info", title: "Class removed", text: "" },
      failed: { tone: "error", title: "Payment didn't go through", text: "Nothing was charged. Check the card details and try again." },
      reminder: { tone: "info", title: "Reminder set", text: "We'll text you the evening before each class." },
    },
  },
  tones: [
    { id: "info" as const, label: "Information", icon: "info", title: "Your plan renews on 1 July", body: "Nothing to do. We will email the invoice when it is ready." },
    { id: "success" as const, label: "Success", icon: "check", title: "Shoot saved", body: "Riverside wedding is in your calendar for 12 June." },
    { id: "warning" as const, label: "Warning", icon: "alert", title: "This shoot is in three days", body: "Changing the date now will email the client straight away." },
    { id: "danger" as const, label: "Error", icon: "close", title: "We could not save that", body: "The deposit has to be a number. Nothing else was lost." },
  ],
};

export default function AlertsStates() {
  const d = SAMPLE;
  const [gone, setGone] = useState<AlertVariant[]>([]);
  const [banner, setBanner] = useState<AlertVariant | "">("warning");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [strip, setStrip] = useState(true);
  const [cardGone, setCardGone] = useState<AlertVariant[]>([]);
  const [nbGone, setNbGone] = useState<AlertVariant[]>([]);
  const seq = useRef(0);

  // A toast says its piece and leaves (ToastStack counts it down); anything that needs acting on belongs inline.
  const close = useRef((id: number) => setToasts((v) => v.filter((x) => x.id !== id))).current;
  const toast = (variant: AlertVariant, title: string, text?: string, onUndo?: () => void) => {
    seq.current += 1;
    setToasts((v) => [...v, { id: seq.current, variant, title, text, onUndo }]);
  };

  const bannerTone = d.tones.find((t) => t.id === banner);

  return (
    <section className="fl-section fl-section--specimen">
      <h3>Inline</h3>
      <p className="fl-ctl-btn-what">In the flow, next to what it is about. It stays until the thing it describes changes.</p>
      <ul className="fl-ctl-alert-list">
        {d.tones.filter((t) => !gone.includes(t.id)).map((t) => (
          <li key={t.id}>
            <Alert
              variant={t.id}
              title={t.title}
              onDismiss={t.id === "danger" ? undefined : () => setGone((v) => [...v, t.id])}
              action={
                t.id === "danger" ? (
                  <Button variant="secondary" size={32}>
                    Fix it
                  </Button>
                ) : undefined
              }
            >
              {t.body}
            </Alert>
            <p className="fl-ctl-matrix-what">
              {t.label} &middot; {t.id === "danger" ? 'role="alert", announced at once' : 'role="status", announced in a gap'}
            </p>
          </li>
        ))}
      </ul>

      {gone.length ? (
        <Button variant="tertiary" size={32} onClick={() => setGone([])}>
          Bring back the dismissed alerts
        </Button>
      ) : null}

      <div className="fl-ctl-sizes">
        <h3>Banner</h3>
        <p className="fl-ctl-btn-what">Across the top of the page, about the whole app rather than one field. It can be dismissed; it should not come back on the next page.</p>
        <div className="fl-ctl-alert-pick">
          {d.tones.map((t) => (
            <Button key={t.id} variant="tertiary" size={32} className={banner === t.id ? "is-on" : undefined} aria-pressed={banner === t.id} onClick={() => setBanner(t.id)}>
              {t.label}
            </Button>
          ))}
          <Button variant="tertiary" size={32} aria-pressed={banner === ""} onClick={() => setBanner("")}>
            None
          </Button>
        </div>
        {bannerTone ? (
          <Alert
            variant={bannerTone.id}
            placement="banner"
            title={bannerTone.title}
            action={<a href="#timetable">See details</a>}
            onDismiss={() => setBanner("")}
          >
            {bannerTone.body}
          </Alert>
        ) : (
          <p className="fl-ctl-matrix-what">Dismissed. Pick a tone to bring it back.</p>
        )}
        <p className="fl-ctl-btn-what">
          For a promotion or news rather than a status, the full-width strip: <code>bleed</code>, with an optional tag.
        </p>
        {strip ? (
          <Alert placement="banner" bleed tag="New" title="Autumn term bookings are open." action={<a href="#timetable">See the timetable &rarr;</a>} onDismiss={() => setStrip(false)} />
        ) : (
          <Button variant="tertiary" size={32} onClick={() => setStrip(true)}>
            Show the strip again
          </Button>
        )}
      </div>

      <div className="fl-ctl-sizes">
        <h3>Toast</h3>
        <p className="fl-ctl-btn-what">
          Arrives in a corner, says one thing and goes after a few seconds. Only for things that need no reply, and never an
          error. An Undo button is fine: the person has the length of the count to change their mind.
        </p>
        <div className="fl-ctl-alert-pick">
          <Button variant="secondary" size={32} onClick={() => toast("success", "Shoot saved")}>
            Save something
          </Button>
          <Button variant="secondary" size={32} onClick={() => toast("info", "Class removed", "Pottery for beginners, Sat 11:00", () => toast("success", "Class restored"))}>
            Remove something
          </Button>
          <Button variant="secondary" size={32} onClick={() => toast("info", "Copied to the clipboard")}>
            Copy something
          </Button>
          <Button variant="secondary" size={32} onClick={() => toast("warning", "Working offline")}>
            Lose the connection
          </Button>
        </div>
        <div className="fl-ctl-toast-stage">
          <ToastStack toasts={toasts} onDismiss={close} max={4} duration={5000} contained />
          {toasts.length ? null : <p className="fl-ctl-matrix-what">Nothing showing. Press one of the buttons above.</p>}
        </div>
        <p className="fl-ctl-btn-what">
          Each toast counts down along its bottom edge. Hover or focus pauses the count; Escape or the x closes it at
          once. Four at most show, newest kept. The compact pill (placement toast) is for a one-line message:
        </p>
        <ul className="fl-ctl-toasts" style={{ position: "static", justifyItems: "start" }} aria-label="Compact toast">
          <Alert variant="success" placement="toast" title="Shoot saved" />
        </ul>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Versions</h3>
        <p className="fl-ctl-btn-what">
          Other designs of the same alert, chosen with <code>version</code>. Each keeps the four tones; pick the one that suits the app.
        </p>

        <p className="fl-ctl-matrix-kind">c.alert@tone-card</p>
        <p className="fl-ctl-btn-what">A list card with a colored left edge; the tone is also a hidden word. Actions are small text buttons.</p>
        <div className="fl-alr-stack">
          {d.tones.filter((t) => !cardGone.includes(t.id)).map((t) => (
            <Alert
              key={t.id}
              version="tone-card"
              variant={t.id}
              title={t.title}
              actionLabel={t.id === "danger" ? "Fix it" : t.id === "info" ? "See details" : undefined}
              onDismiss={t.id === "danger" ? undefined : () => setCardGone((v) => [...v, t.id])}
            >
              {t.body}
            </Alert>
          ))}
        </div>
        {cardGone.length ? (
          <Button variant="tertiary" size={32} onClick={() => setCardGone([])}>
            Show the cards again
          </Button>
        ) : null}

        <p className="fl-ctl-matrix-kind">c.alert@announcement</p>
        <p className="fl-ctl-btn-what">
          The full-width strip for one short, time-limited notice. Once closed it stays closed on this device
          (<code>rememberKey</code>); <code>restoreLabel</code> adds a button to bring it back.
        </p>
        <Alert version="announcement" rememberKey="alerts-states-sheet-announcement" restoreLabel="Show the announcement again" tag="New" title="Autumn term bookings are open." action={<a href="#timetable">See the timetable &rarr;</a>} />

        <p className="fl-ctl-matrix-kind">c.alert@neobrutal</p>
        <p className="fl-ctl-btn-what">The neobrutalism kit's alert: a thick ink border, a hard shadow and a colored icon tile.</p>
        <div className="fl-nb-alerts">
          {d.tones.filter((t) => !nbGone.includes(t.id)).map((t) => (
            <Alert key={t.id} version="neobrutal" variant={t.id} title={t.title} onDismiss={() => setNbGone((v) => [...v, t.id])}>
              {t.body}
            </Alert>
          ))}
        </div>
        {nbGone.length ? (
          <Button variant="tertiary" size={32} onClick={() => setNbGone([])}>
            Show the neobrutal alerts again
          </Button>
        ) : null}

        <p className="fl-ctl-matrix-kind">c.toast-stack@cards</p>
        <p className="fl-ctl-btn-what">Toast cards with a countdown bar, stacked in a corner (the version of the toast region above). Try the buttons.</p>
        <div className="fl-ctl-toast-stage">
          <ToastBasket
            contained
            title={SAMPLE.basket.title}
            lede={SAMPLE.basket.lede}
            basket={SAMPLE.basket.items}
            durationMs={SAMPLE.basket.durationMs}
            toasts={SAMPLE.basket.toasts}
          />
        </div>
      </div>
    </section>
  );
}
