/**
 * More building blocks for full screens (dashboards, home and settings), styled only with the design tokens via
 * src/styles/screen-parts.css. Use them with the blocks in ./index.tsx. Those marked with an ID draw the FlowCode
 * catalog's component (src/sections/, styled by src/styles/library.css); the rest are the kit's own:
 *
 *   <Grid>          responsive columns: "stats" (key numbers), "cards", "split" (wide + narrow), "halves"
 *   <Trend>         change since last time, as text and arrow (never color alone)
 *   <Progress>      c.progress (bar): labelled progress bar with its value in words
 *   <BarChart>      a small bar chart whose values are also readable as text
 *   <DataTable>     p.data-table: a captioned table that scrolls sideways on phones
 *   <ActivityList>  recent events: who, what and when
 *   <Checklist>     a short to-do list, done or not said in words too
 *   <Avatar>        c.avatar: initials in a circle
 *   <Hero>          the home screen's welcome: h1, description, actions and an optional side panel
 *   <ActionTile>    a large button for a main task ("Start a lesson")
 *   <Tabs>          c.tabs: switch between panels of one screen (arrow keys move between tabs)
 *   <SettingsList>  a list of <SettingRow>s with dividers
 *   <SettingRow>    a setting's name, explanation and control (pass a <Switch>, select or input)
 *   <Switch>        c.switch: an on/off control
 */
import { useEffect, useId, useRef, type ReactElement, type ReactNode } from "react";
import { Avatar as CatalogAvatar } from "../../sections/AvatarsVariants";
import { Progress as CatalogProgress } from "../../sections/ProgressIndicators";
import { Switch as CatalogSwitch } from "../../sections/SwitchesStates";
import { DataTable as CatalogTable, type TableColumn } from "../../sections/TablesStates";
import { Tabs as CatalogTabs } from "../../sections/TabsVariants";
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

/** c.progress (bar) under its label and value in words. The bar reads as a percentage of `max`. */
export function Progress({ label, value, max = 100, valueText }: { label: string; value: number; max?: number; valueText?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const text = valueText ?? `${Math.round(pct)}%`;
  return (
    <div className="ui-progress">
      <div className="ui-progress__head" aria-hidden="true">
        <span className="ui-progress__label">{label}</span>
        <span className="ui-progress__value">{text}</span>
      </div>
      <CatalogProgress variant="bar" value={Math.round(pct)} label={`${label}: ${text}`} />
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

/**
 * p.data-table, in its fixed order (no sort buttons). The first column is each row's header for screen readers.
 * `showCaption={false}` keeps the caption for screen readers only, when a Section title above already says it.
 */
export function DataTable<T extends Record<string, unknown>>({ caption, columns, rows, rowKey, empty, showCaption = true }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: ReactNode; showCaption?: boolean }) {
  if (!rows.length && empty) return <>{empty}</>;
  // The catalog table keys rows by `id`; each keeps the caller's row whole, so a column named "id" still shows its own value.
  const keyed = rows.map((row) => ({ id: rowKey(row), row }));
  const cols: TableColumn<(typeof keyed)[number]>[] = columns.map((c) => ({ id: c.key, label: c.label, num: c.align === "end", render: (k) => (c.render ? c.render(k.row) : String(k.row[c.key] ?? "")) }));
  return (
    <div className="ui-table">
      {showCaption ? (
        <p className="ui-table__caption" aria-hidden="true">
          {caption}
        </p>
      ) : null}
      <CatalogTable caption={caption} columns={cols} rows={keyed} sortable={false} emptyTitle="Nothing here yet" emptyHint="" />
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

const AVATAR_SIZE = { sm: 32, md: 40, lg: 48 } as const;

/** c.avatar: initials in a circle. Decorative: the name it stands for is written beside it. */
export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return <CatalogAvatar name={name} size={AVATAR_SIZE[size]} decorative />;
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

/**
 * c.tabs, controlled: the open tab's panel is `children`. Arrow keys, Home and End move between tabs, as screen-reader
 * users expect. A vertical rail also shows the open tab's label as its panel's heading.
 */
export function Tabs({ label, tabs, current, onChange, orientation = "horizontal", children }: { label: string; tabs: Array<{ id: string; label: string }>; current: string; onChange: (id: string) => void; orientation?: "horizontal" | "vertical"; children: ReactNode }) {
  return <CatalogTabs label={label} orientation={orientation} value={current} onChange={onChange} tabs={tabs.map((t) => ({ id: t.id, label: t.label, panel: t.id === current ? children : null }))} />;
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

/**
 * c.switch. Inside a SettingRow it takes the row's id and description, so the row's <label> names it; elsewhere give it
 * an aria-label.
 */
export function Switch({ checked, onChange, id, "aria-describedby": describedBy, "aria-label": ariaLabel }: { checked: boolean; onChange: (next: boolean) => void; id?: string; "aria-describedby"?: string; "aria-label"?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  // The catalog switch names itself with aria-label only: the row's id and description go onto its checkbox here.
  useEffect(() => {
    const input = host.current?.querySelector("input");
    if (!input) return;
    if (id) input.id = id;
    else input.removeAttribute("id");
    if (describedBy) input.setAttribute("aria-describedby", describedBy);
    else input.removeAttribute("aria-describedby");
  }, [id, describedBy]);
  return (
    <span ref={host} style={{ display: "contents" }}>
      {/* An empty aria-label is skipped, so a SettingRow's <label for> names it. */}
      <CatalogSwitch on={checked} onToggle={onChange} label={ariaLabel ?? ""} />
    </span>
  );
}
