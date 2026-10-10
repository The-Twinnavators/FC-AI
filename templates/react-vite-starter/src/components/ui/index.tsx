/**
 * Ready-made building blocks. Every app screen is composed from these, styled only with the design tokens
 * (src/styles/tokens.css) via src/styles/components.css. Prefer them over new one-off markup:
 *
 *   <AppShell>      header with the product name, navigation, one screen at a time
 *   <PageHeader>    the screen's h1, a short description and its main action
 *   <Section>       a titled group on a screen (h2)
 *   <Card>          a surface for one item or one group of related things
 *   <Button>        primary (one per screen), secondary, ghost, danger
 *   <Field>         label + control + hint + error, wired for screen readers
 *   <EmptyState>    what to do when there's nothing yet, with the next action
 *   <Skeleton>      loading placeholder shaped like the content
 *   <DataState>     loading, error (with Try again), empty and ready for any data area, in one wrapper
 *   <Stat>          a key number with its label
 *   <Badge>         a short status label (never color alone)
 *   <Notice>        an inline message: info, success, warning, error
 *   <Dialog>        a modal dialog with a title and actions (native <dialog>)
 *
 * Screen parts for dashboards, home and settings screens (Grid, Trend, Progress, BarChart, DataTable, ActivityList, Checklist,
 * Avatar, Hero, ActionTile, Tabs, SettingsList, SettingRow, Switch) are in ./screen-parts.tsx and exported here too.
 */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";

export * from "./screen-parts";

export interface Screen {
  id: string;
  label: string;
  icon?: ReactNode;
}

export function AppShell({ name, tagline, screens, current, onNavigate, actions, children }: { name: string; tagline?: string; screens: Screen[]; current: string; onNavigate: (id: string) => void; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-shell">
      <a className="ui-skip" href="#main">
        Skip to content
      </a>
      <header className="ui-shell__header">
        <div className="ui-shell__brand">
          <span className="ui-shell__name">{name}</span>
          {tagline ? <span className="ui-shell__tagline">{tagline}</span> : null}
        </div>
        {screens.length > 1 ? (
          <nav className="ui-shell__nav" aria-label="Main">
            {screens.map((s) => (
              <a
                key={s.id}
                href={`#/${s.id}`}
                className="ui-shell__link"
                aria-current={s.id === current ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(s.id);
                }}
              >
                {s.icon}
                {s.label}
              </a>
            ))}
          </nav>
        ) : null}
        {actions ? <div className="ui-shell__actions">{actions}</div> : null}
      </header>
      <main id="main" className="ui-shell__main" tabIndex={-1}>
        {/* Keyed by screen, so each screen animates in when you go to it. */}
        <div className="ui-screen" key={current}>
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ui-page-header">
      <div className="ui-page-header__text">
        <h1 className="ui-page-header__title">{title}</h1>
        {description ? <p className="ui-page-header__desc">{description}</p> : null}
      </div>
      {action ? <div className="ui-page-header__action">{action}</div> : null}
    </div>
  );
}

export function Section({ title, description, action, children }: { title: string; description?: ReactNode; action?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section className="ui-section" aria-labelledby={id}>
      <div className="ui-section__head">
        <div>
          <h2 id={id} className="ui-section__title">
            {title}
          </h2>
          {description ? <p className="ui-section__desc">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Card({ title, children, footer, as = "div", interactive = false }: { title?: ReactNode; children: ReactNode; footer?: ReactNode; as?: "div" | "article" | "li"; interactive?: boolean }) {
  const Tag = as;
  return (
    <Tag className={`ui-card${interactive ? " ui-card--interactive" : ""}`}>
      {title ? <h3 className="ui-card__title">{title}</h3> : null}
      <div className="ui-card__body">{children}</div>
      {footer ? <div className="ui-card__footer">{footer}</div> : null}
    </Tag>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "secondary", size = "md", icon, children, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" | "xl"; icon?: ReactNode }) {
  return (
    <button type={type} className={`ui-btn ui-btn--${variant} ui-btn--${size}`} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/** Label, control, hint and error. Pass a single input, textarea or select as the child; it gets the id and aria wiring. */
export function Field({ label, hint, error, required, children }: { label: string; hint?: ReactNode; error?: ReactNode; required?: boolean; children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean; required?: boolean; className: string }) => ReactElement }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`ui-field${error ? " ui-field--error" : ""}`}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {required ? <span className="ui-field__req"> (required)</span> : null}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, required, className: "ui-input" })}
      {hint ? (
        <p id={hintId} className="ui-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="ui-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, message, action, icon }: { title: string; message: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="ui-empty">
      {icon ? <div className="ui-empty__icon" aria-hidden="true">{icon}</div> : null}
      <h3 className="ui-empty__title">{title}</h3>
      <p className="ui-empty__message">{message}</p>
      {action ? <div className="ui-empty__action">{action}</div> : null}
    </div>
  );
}

/** Loading placeholder shaped like the content. Announces "Loading" once for screen readers. */
export function Skeleton({ lines = 3, card = false, label = "Loading" }: { lines?: number; card?: boolean; label?: string }) {
  return (
    <div className={`ui-skeleton${card ? " ui-skeleton--card" : ""}`} role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="ui-skeleton__line" style={{ width: `${i === lines - 1 ? 60 : 100}%` }} />
      ))}
    </div>
  );
}

/**
 * Every data area's states in one place, so no screen shows only the happy path:
 *  loading → a skeleton shaped like the content (with what is loading, for screen readers);
 *  error   → what went wrong and a Retry, while the rest of the screen and anything typed stay put;
 *  empty   → the EmptyState you pass (what belongs here and how to start);
 *  ready   → the content.
 * Example: <DataState loading={loading} error={error} onRetry={reload} empty={items.length ? undefined : <EmptyState … />}>…</DataState>
 */
export function DataState({ loading, error, onRetry, empty, loadingLabel = "Loading", skeleton = { lines: 3 }, children }: { loading?: boolean; error?: ReactNode; onRetry?: () => void; empty?: ReactNode; loadingLabel?: string; skeleton?: { lines?: number; card?: boolean }; children?: ReactNode }) {
  if (loading) return <Skeleton lines={skeleton.lines} card={skeleton.card} label={loadingLabel} />;
  if (error)
    return (
      <div className="ui-notice ui-notice--error" role="alert">
        <strong className="ui-notice__title">Couldn&apos;t load this</strong>
        <div>{error}</div>
        {onRetry ? (
          <div className="ui-notice__actions">
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        ) : null}
      </div>
    );
  if (empty) return <>{empty}</>;
  return <>{children}</>;
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="ui-stat">
      <span className="ui-stat__label">{label}</span>
      <span className="ui-stat__value">{value}</span>
      {note ? <span className="ui-stat__note">{note}</span> : null}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "success" | "danger"; children: ReactNode }) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "error"; title?: string; children: ReactNode }) {
  return (
    <div className={`ui-notice ui-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title ? <strong className="ui-notice__title">{title}</strong> : null}
      <div>{children}</div>
    </div>
  );
}

/** Modal dialog on the native <dialog> element: focus trap, Escape to close and backdrop for free. */
export function Dialog({ open, title, onClose, actions, children }: { open: boolean; title: string; onClose: () => void; actions?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="ui-dialog" aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      <h2 id={titleId} className="ui-dialog__title">
        {title}
      </h2>
      <div className="ui-dialog__body">{children}</div>
      <div className="ui-dialog__actions">{actions ?? <Button onClick={onClose}>Close</Button>}</div>
    </dialog>
  );
}
