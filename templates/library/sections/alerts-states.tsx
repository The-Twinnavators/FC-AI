/** @flowcode-library alerts-states · Alerts: four tones, inline, banner and toast (Alerts and states)
 * Catalog ID: c.alert (component)
 * Function: The alert (c.alert) in four tones and three places (inline, banner, toast); the reference sheet shows each, the roles that announce them, and a live banner and toast stack.
 * Use it as: import { Alert } from "./alerts-states"; <Alert variant?="info"|"success"|"warning"|"danger" placement?="inline"|"banner"|"toast" title="Shoot saved" onDismiss? dismissLabel? action?>Detail text</Alert>
 * Variants: c.alert.info - neutral news that needs no action: accent tint with an i icon; c.alert.success - something worked: green tint with a check icon; c.alert.warning - take care before going on: amber tint with an alert icon; c.alert.danger - something failed and needs a fix: red tint, announced at once (role alert)
 * Look: A rounded, tinted box with a round tone icon, a bold title and a line of detail; inline it can carry an action button, as a banner it spans the page with a dismiss button, as a toast it is a one-line pill with a small x.
 * Tokens: --color-accent --color-success --color-warning --color-danger --color-border --color-surface --color-surface-sunken --color-text-muted --radius-lg --radius-md --space-1 --space-2 --space-3 --space-4 --duration-med --easing
 * Use cases: form saved; something failed; a warning before an action; a tip; a site-wide notice
 * Jobs to be done: know something happened; understand what went wrong; get told without losing my place
 * Keywords: alert, toast, banner, notice, success, warning, error, info, dismiss
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
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.alert: the one alert. Every piece's messages are this component; the specimen below shows every tone and place. ──

export type AlertVariant = "info" | "success" | "warning" | "danger";
export type AlertPlacement = "inline" | "banner" | "toast";

// Written out in full (not built from the variant name) so a build finds every class the alert needs.
const TONE: Record<AlertVariant, string> = {
  info: "fl-ctl-alert--info",
  success: "fl-ctl-alert--success",
  warning: "fl-ctl-alert--warning",
  danger: "fl-ctl-alert--danger",
};
const TONE_ICON: Record<AlertVariant, string> = { info: "info", success: "check", warning: "alert", danger: "close" };
const PLACE: Record<AlertPlacement, string> = { inline: "fl-ctl-alert", banner: "fl-ctl-banner", toast: "fl-ctl-toast" };

type AlertProps = {
  variant?: AlertVariant;
  /** Inline sits in the flow; banner spans the page; toast is a one-line pill (render it inside a <ul>). */
  placement?: AlertPlacement;
  title: string;
  /** Set it and a dismiss button appears (banner and toast). */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** A button for the person to act on, inline only. */
  action?: ReactNode;
  className?: string;
  /** The detail line under (inline) or after (banner) the title. */
  children?: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "title" | "children" | "className">;

export function Alert({ variant = "info", placement = "inline", title, onDismiss, dismissLabel, action, className, children, ...rest }: AlertProps) {
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
        {title}
        {onDismiss ? (
          <button type="button" className="fl-ctl-toast-x" aria-label={dismissLabel ?? `Dismiss: ${title}`} onClick={onDismiss}>
            <Icon name="close" />
          </button>
        ) : null}
      </li>
    );
  }
  if (placement === "banner") {
    return (
      <div role="status" {...rest} {...own}>
        {icon}
        <span>
          <strong>{title}</strong> {children}
        </span>
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
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  tones: [
    { id: "info" as const, label: "Information", icon: "info", title: "Your plan renews on 1 July", body: "Nothing to do. We will email the invoice when it is ready." },
    { id: "success" as const, label: "Success", icon: "check", title: "Shoot saved", body: "Riverside wedding is in your calendar for 12 June." },
    { id: "warning" as const, label: "Warning", icon: "alert", title: "This shoot is in three days", body: "Changing the date now will email the client straight away." },
    { id: "danger" as const, label: "Error", icon: "close", title: "We could not save that", body: "The deposit has to be a number. Nothing else was lost." },
  ],
};

export default function AlertsStates() {
  const d = SAMPLE;
  const [banner, setBanner] = useState<AlertVariant | "">("warning");
  const [toasts, setToasts] = useState<{ id: number; tone: AlertVariant; title: string }[]>([]);
  const seq = useRef(0);

  // A toast says its piece and leaves; anything that needs acting on belongs inline.
  useEffect(() => {
    if (!toasts.length) return;
    const t = window.setTimeout(() => setToasts((v) => v.slice(1)), 3200);
    return () => window.clearTimeout(t);
  }, [toasts]);

  const toast = (tone: AlertVariant, title: string) => {
    seq.current += 1;
    setToasts((v) => [...v, { id: seq.current, tone, title }].slice(-3));
  };

  const bannerTone = d.tones.find((t) => t.id === banner);

  return (
    <section className="fl-section fl-section--specimen">
      <h3>Inline</h3>
      <p className="fl-ctl-btn-what">In the flow, next to what it is about. It stays until the thing it describes changes.</p>
      <ul className="fl-ctl-alert-list">
        {d.tones.map((t) => (
          <li key={t.id}>
            <Alert
              variant={t.id}
              title={t.title}
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
          <Alert variant={bannerTone.id} placement="banner" title={bannerTone.title} onDismiss={() => setBanner("")}>
            {bannerTone.body}
          </Alert>
        ) : (
          <p className="fl-ctl-matrix-what">Dismissed. Pick a tone to bring it back.</p>
        )}
      </div>

      <div className="fl-ctl-sizes">
        <h3>Toast</h3>
        <p className="fl-ctl-btn-what">
          Arrives in a corner, says one thing and goes after a few seconds. Only for things that need no reply: three at
          most, oldest first, and never an error.
        </p>
        <div className="fl-ctl-alert-pick">
          <Button variant="secondary" size={32} onClick={() => toast("success", "Shoot saved")}>
            Save something
          </Button>
          <Button variant="secondary" size={32} onClick={() => toast("info", "Copied to the clipboard")}>
            Copy something
          </Button>
          <Button variant="secondary" size={32} onClick={() => toast("warning", "Working offline")}>
            Lose the connection
          </Button>
        </div>
        <div className="fl-ctl-toast-stage">
          <ul className="fl-ctl-toasts" role="status" aria-live="polite" aria-label="Notifications">
            {toasts.map((t) => (
              <Alert key={t.id} variant={t.tone} placement="toast" title={t.title} onDismiss={() => setToasts((v) => v.filter((x) => x.id !== t.id))} />
            ))}
          </ul>
          {toasts.length ? null : <p className="fl-ctl-matrix-what">Nothing showing. Press one of the buttons above.</p>}
        </div>
      </div>
    </section>
  );
}
