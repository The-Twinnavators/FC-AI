/**
 * More building blocks for full screens (dashboards, home and settings), styled only with the design tokens via
 * src/styles/screen-parts.css. Use them with the blocks in ./index.tsx:
 *
 *   <Grid>          responsive columns: "stats" (key numbers), "cards", "split" (wide + narrow), "halves"
 *   <Trend>         change since last time, as text and arrow (never color alone)
 *   <Progress>      labelled progress bar with its value in words
 *   <BarChart>      a small bar chart whose values are also readable as text
 *   <DataTable>     a captioned table that scrolls sideways on phones
 *   <ActivityList>  recent events: who, what and when
 *   <Checklist>     a short to-do list, done or not said in words too
 *   <Avatar>        initials in a circle
 *   <Hero>          the home screen's welcome: h1, description, actions and an optional side panel
 *   <ActionTile>    a large button for a main task ("Start a lesson")
 *   <Tabs>          switch between panels of one screen (arrow keys move between tabs)
 *   <SettingsList>  a list of <SettingRow>s with dividers
 *   <SettingRow>    a setting's name, explanation and control (pass a <Switch>, select or input)
 *   <Switch>        an on/off control
 */
import { useId, useRef, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import "../../styles/screen-parts.css";

export function Grid({ kind = "cards", children, as = "div", label }: { kind?: "stats" | "cards" | "split" | "halves"; children: ReactNode; as?: "div" | "ul"; label?: string }) {
  const Tag = as;
  return (
    <Tag className={`ui-grid ui-grid--${kind}`} aria-label={label}>
      {children}
    </Tag>
  );
}

/** Change since last time. `goodWhen` says which direction is good news, so a drop in costs reads as positive. */
export function Trend({ value, unit = "%", label, goodWhen = "up" }: { value: number; unit?: string; label?: string; goodWhen?: "up" | "down" }) {
  const dir = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const tone = dir === "flat" ? "flat" : dir === goodWhen ? "good" : "bad";
  const amount = `${Math.abs(value)}${unit}`;
  return (
    <span className={`ui-trend ui-trend--${tone}`}>
      <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "▬"}</span>
      <span>{dir === "flat" ? "No change" : `${dir === "up" ? "Up" : "Down"} ${amount}`}</span>
      {label ? <span className="ui-trend__label">{label}</span> : null}
    </span>
  );
}

export function Progress({ label, value, max = 100, valueText }: { label: string; value: number; max?: number; valueText?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const text = valueText ?? `${Math.round(pct)}%`;
  const id = useId();
  return (
    <div className="ui-progress">
      <div className="ui-progress__head">
        <span id={id} className="ui-progress__label">
          {label}
        </span>
        <span className="ui-progress__value">{text}</span>
      </div>
      <div className="ui-progress__track" role="progressbar" aria-labelledby={id} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}>
        <span className="ui-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Bars with their values written on them, so the numbers are readable without the chart. */
export function BarChart({ title, data, format = (n) => String(n) }: { title: string; data: Array<{ label: string; value: number }>; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="ui-chart">
      <figcaption className="ui-chart__title">{title}</figcaption>
      <ol className="ui-chart__bars">
        {data.map((d) => (
          <li key={d.label} className="ui-chart__item">
            <span className="ui-chart__value">{format(d.value)}</span>
            <span className="ui-chart__bar" style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }} aria-hidden="true" />
            <span className="ui-chart__label">{d.label}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  align?: "start" | "end";
  render?: (row: T) => ReactNode;
}

/** `showCaption={false}` keeps the caption for screen readers only, when a Section title above already says it. */
export function DataTable<T extends Record<string, unknown>>({ caption, columns, rows, rowKey, empty, showCaption = true }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: ReactNode; showCaption?: boolean }) {
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className="ui-table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="ui-table">
        <caption className={showCaption ? "ui-table__caption" : "ui-sr-only"}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === "end" ? "ui-table__num" : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === "end" ? "ui-table__num" : undefined}>
                  {c.render ? c.render(r) : String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A short list of things to do, each marked done or not in words as well as with a tick. */
export function Checklist({ items, label }: { items: Array<{ id: string; title: ReactNode; meta?: ReactNode; done?: boolean }>; label: string }) {
  return (
    <ul className="ui-checklist" aria-label={label}>
      {items.map((i) => (
        <li key={i.id} className={`ui-checklist__item${i.done ? " ui-checklist__item--done" : ""}`}>
          <span className="ui-checklist__mark" aria-hidden="true">
            {i.done ? "✓" : ""}
          </span>
          <span className="ui-checklist__text">
            <span className="ui-checklist__title">
              {i.title}
              {i.done ? <span className="ui-checklist__state ui-sr-only"> (done)</span> : null}
            </span>
            {i.meta ? <span className="ui-checklist__meta">{i.meta}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={`ui-avatar ui-avatar--${size}`} aria-hidden="true">
      {initials || "?"}
    </span>
  );
}

export function ActivityList({ items, label = "Recent activity" }: { items: Array<{ id: string; who: string; what: ReactNode; when: string }>; label?: string }) {
  return (
    <ul className="ui-activity" aria-label={label}>
      {items.map((i) => (
        <li key={i.id} className="ui-activity__item">
          <Avatar name={i.who} size="sm" />
          <div className="ui-activity__text">
            <span>
              <strong>{i.who}</strong> {i.what}
            </span>
            <span className="ui-activity__when">{i.when}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The home screen's opening: one h1 (use it instead of PageHeader on that screen), the main actions and an optional side panel. */
export function Hero({ eyebrow, title, description, actions, aside }: { eyebrow?: string; title: string; description: ReactNode; actions?: ReactNode; aside?: ReactNode }) {
  return (
    <div className={`ui-hero${aside ? " ui-hero--split" : ""}`}>
      <div className="ui-hero__copy">
        {eyebrow ? <span className="ui-hero__eyebrow">{eyebrow}</span> : null}
        <h1 className="ui-hero__title">{title}</h1>
        <p className="ui-hero__desc">{description}</p>
        {actions ? <div className="ui-hero__actions">{actions}</div> : null}
      </div>
      {aside ? <div className="ui-hero__aside">{aside}</div> : null}
    </div>
  );
}

export function ActionTile({ title, description, icon, onClick }: { title: string; description: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="ui-tile" onClick={onClick}>
      {icon ? (
        <span className="ui-tile__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span className="ui-tile__title">{title}</span>
      <span className="ui-tile__desc">{description}</span>
    </button>
  );
}

/** Tabs for panels of one screen. Arrow keys, Home and End move between tabs, as screen-reader users expect. */
export function Tabs({ label, tabs, current, onChange, orientation = "horizontal", children }: { label: string; tabs: Array<{ id: string; label: string }>; current: string; onChange: (id: string) => void; orientation?: "horizontal" | "vertical"; children: ReactNode }) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (e: KeyboardEvent, index: number) => {
    const next = { ArrowRight: index + 1, ArrowDown: index + 1, ArrowLeft: index - 1, ArrowUp: index - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  };
  return (
    <div className={`ui-tabs ui-tabs--${orientation}`}>
      <div className="ui-tabs__list" role="tablist" aria-label={label} aria-orientation={orientation}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${t.id}`}
            aria-controls={`${base}-panel`}
            aria-selected={t.id === current}
            tabIndex={t.id === current ? 0 : -1}
            className="ui-tabs__tab"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => move(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="ui-tabs__panel" role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${current}`} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}

export function SettingsList({ children }: { children: ReactNode }) {
  return <div className="ui-settings">{children}</div>;
}

/** One setting: its name (a real <label>), what it does, and its control. The control gets the id and description wiring. */
export function SettingRow({ label, description, children }: { label: string; description?: ReactNode; children: (props: { id: string; "aria-describedby"?: string }) => ReactElement }) {
  const id = useId();
  const descId = description ? `${id}-desc` : undefined;
  return (
    <div className="ui-setting">
      <div className="ui-setting__text">
        <label className="ui-setting__label" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <p id={descId} className="ui-setting__desc">
            {description}
          </p>
        ) : null}
      </div>
      <div className="ui-setting__control">{children({ id, "aria-describedby": descId })}</div>
    </div>
  );
}

export function Switch({ checked, onChange, id, ...aria }: { checked: boolean; onChange: (next: boolean) => void; id?: string; "aria-describedby"?: string; "aria-label"?: string }) {
  return (
    <button type="button" role="switch" id={id} aria-checked={checked} className="ui-switch" onClick={() => onChange(!checked)} {...aria}>
      <span className="ui-switch__thumb" aria-hidden="true" />
      <span className="ui-switch__text">{checked ? "On" : "Off"}</span>
    </button>
  );
}
