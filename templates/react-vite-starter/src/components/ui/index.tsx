/**
 * Ready-made building blocks. Every app screen is composed from these, styled only with the design tokens
 * (src/styles/tokens.css). Prefer them over new one-off markup.
 *
 * One component kit: where the FlowCode catalog has the part, the kit draws the catalog's component (copied into
 * src/sections/ and styled by src/styles/library.css) under the kit's own name and props. Use either name; it is the
 * same implementation:
 *
 *   <Card>          c.card (surface)         a surface for one item or one group of related things
 *   <Button>        c.button                 primary (one per screen), secondary, ghost, danger
 *   <EmptyState>    c.empty-state            what to do when there's nothing yet, with the next action
 *   <Skeleton>      c.skeleton               loading placeholder shaped like the content
 *   <Stat>          c.kpi                    a key number with its label
 *   <Badge>         c.badge (status)         a short status label (never color alone)
 *   <Notice>        c.alert (inline)         an inline message: info, success, warning, error
 *   <Dialog>        c.modal                  a modal dialog with a title and actions
 *   Progress (c.progress bar), DataTable (p.data-table), Avatar (c.avatar), Tabs (c.tabs) and Switch (c.switch) in
 *   ./screen-parts.tsx are the catalog's too.
 *
 * The frame pieces are the kit's own (styled by src/styles/components.css and screen-parts.css); catalog parts go
 * inside them:
 *
 *   <AppShell>      header with the product name, navigation, one screen at a time
 *   <PageHeader>    the screen's h1, a short description and its main action
 *   <Section>       a titled group on a screen (h2)
 *   <Field>         label + control + hint + error, wired for screen readers
 *   <DataState>     loading, error (with Try again), empty and ready for any data area, in one wrapper
 *
 * Screen parts for dashboards, home and settings screens (Grid, Trend, Progress, BarChart, DataTable, ActivityList, Checklist,
 * Avatar, Hero, ActionTile, Tabs, SettingsList, SettingRow, Switch) are in ./screen-parts.tsx and exported here too.
 */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { Alert } from "../../sections/AlertsStates";
import { Badge as CatalogBadge } from "../../sections/BadgesStatus";
import { Button as CatalogButton, type ButtonSize, type ButtonVariant as CatalogButtonVariant } from "../../sections/ButtonsVariants";
import { Kpi } from "../../sections/CardKpi";
import { Card as CatalogCard } from "../../sections/CardsVariants";
import { EmptyState as CatalogEmptyState } from "../../sections/EmptyStates";
import { Modal } from "../../sections/ModalsDialogs";
import { Skeleton as CatalogSkeleton } from "../../sections/SkeletonLoading";

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

/** c.card (surface). `as="li"` or `"article"` puts the card inside that element, so lists and feeds keep their semantics. */
export function Card({ title, children, footer, as = "div", interactive = false }: { title?: ReactNode; children: ReactNode; footer?: ReactNode; as?: "div" | "article" | "li"; interactive?: boolean }) {
  const card = (
    <CatalogCard variant="surface" className={interactive ? "ui-card--interactive" : undefined}>
      {title ? <h3>{title}</h3> : null}
      <div className="ui-card__body">{children}</div>
      {footer ? <div className="ui-card__footer">{footer}</div> : null}
    </CatalogCard>
  );
  if (as === "div") return card;
  const Tag = as;
  return <Tag className="ui-card-host">{card}</Tag>;
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
// The kit's names for the catalog button's variants and heights.
const BUTTON_VARIANT: Record<ButtonVariant, CatalogButtonVariant> = { primary: "primary", secondary: "secondary", ghost: "tertiary", danger: "destructive" };
const BUTTON_SIZE: Record<"sm" | "md" | "lg" | "xl", ButtonSize> = { sm: 32, md: 40, lg: 48, xl: 56 };

/** c.button. `icon` is any element (an svg or a lucide icon), drawn before the label. */
export function Button({ variant = "secondary", size = "md", icon, children, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" | "xl"; icon?: ReactNode }) {
  return (
    <CatalogButton {...rest} type={type} variant={BUTTON_VARIANT[variant]} size={BUTTON_SIZE[size]}>
      {icon}
      {children}
    </CatalogButton>
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

/** c.empty-state (first use). `icon` is drawn in place of the catalog's round icon. */
export function EmptyState({ title, message, action, icon }: { title: string; message: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <CatalogEmptyState title={title} headingLevel={3} art={icon} action={action}>
      {message}
    </CatalogEmptyState>
  );
}

/** c.skeleton: loading placeholder shaped like the content. Announces "Loading" once for screen readers. */
export function Skeleton({ lines = 3, card = false, label = "Loading" }: { lines?: number; card?: boolean; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      {card ? <CatalogSkeleton variant="card" /> : <CatalogSkeleton variant="text" lines={lines} />}
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
      <Notice
        tone="error"
        title="Couldn't load this"
        action={
          onRetry ? (
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : undefined
        }
      >
        {error}
      </Notice>
    );
  if (empty) return <>{empty}</>;
  return <>{children}</>;
}

/** c.kpi: a key number with its label; `note` is drawn under the number. */
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  // The KPI takes text; any node renders in the same place.
  return <Kpi label={label} value={value as string} emptyNote={note as string | undefined} />;
}

const BADGE_TONE = { neutral: "neutral", accent: "info", success: "success", danger: "danger" } as const;

/** c.badge (status). */
export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "success" | "danger"; children: ReactNode }) {
  return <CatalogBadge tone={BADGE_TONE[tone]}>{children}</CatalogBadge>;
}

const NOTICE_TONE = { info: "info", success: "success", warning: "warning", error: "danger" } as const;

/** c.alert (inline). Without a title the message is the alert's one line. `action` is a button for the person to act on. */
export function Notice({ tone = "info", title, action, children }: { tone?: "info" | "success" | "warning" | "error"; title?: string; action?: ReactNode; children: ReactNode }) {
  return title ? (
    <Alert variant={NOTICE_TONE[tone]} title={title} action={action}>
      {children}
    </Alert>
  ) : (
    // The alert's title line takes text; a message of any kind renders in the same place.
    <Alert variant={NOTICE_TONE[tone]} title={children as string} action={action} />
  );
}

/**
 * c.modal: focus moves in and stays inside, Escape and the backdrop close it, focus returns on close.
 * Give it `confirmLabel` (and `onConfirm`) and it is the catalog's dialog as is: Cancel and the main button. Or give it
 * `actions` (any buttons) and those replace the catalog's two buttons; with neither, the corner's Close button is the way out.
 */
export function Dialog({ open, title, onClose, actions, children, description, variant = "confirm", confirmLabel, cancelLabel, onConfirm }: { open: boolean; title: string; onClose: () => void; actions?: ReactNode; children: ReactNode; description?: ReactNode; variant?: "confirm" | "danger" | "form"; confirmLabel?: string; cancelLabel?: string; onConfirm?: (data: FormData) => void | false }) {
  const host = useRef<HTMLDivElement>(null);
  const own = !confirmLabel;
  useEffect(() => {
    // The catalog's own two buttons give way to yours: hidden (for screen readers and tests too) and out of the focus order.
    if (!open || !own) return;
    const foot = host.current?.querySelector<HTMLElement>(".ui-dialog--own-actions > .fl-ctl-dlg-foot");
    if (!foot) return;
    foot.hidden = true;
    foot.querySelectorAll("button").forEach((b) => (b.disabled = true));
  }, [open, own]);
  if (!open) return null;
  return (
    <div ref={host} style={{ display: "contents" }}>
      {own ? (
        <Modal variant={variant === "danger" ? "danger" : "confirm"} title={title} description={description} confirmLabel="Close" onClose={onClose} className="ui-dialog--own-actions">
          {children}
          {/* No actions: the close button in the corner is the way out. */}
          {actions ? <div className="fl-ctl-dlg-foot">{actions}</div> : null}
        </Modal>
      ) : (
        <Modal variant={variant} title={title} description={description} confirmLabel={confirmLabel} cancelLabel={cancelLabel} onConfirm={onConfirm} onClose={onClose}>
          {children}
        </Modal>
      )}
    </div>
  );
}
