/** @flowcode-library tabs-variants · Horizontal tabs: underline, pills and enclosed (Tabs, breadcrumbs and paging)
 * Catalog ID: c.tabs (component)
 * Function: The one tabs control (c.tabs), horizontal or vertical; this sheet shows the three horizontal looks and three heights, with arrow-key navigation. It also shows controlled tabs driven by an outside button and a trailing button sharing the bar.
 * Use it as: import { Tabs } from "./tabs-variants"; <Tabs tabs={[{ id, label, count?, icon?, disabled?, panel? }]} label="Sections" orientation?="horizontal"|"vertical" variant?="underline"|"pills"|"enclosed"|"plain"|"filled" size?={32|40|44} defaultId? value? onChange?={(id) => ...} trailing?={node at the end of the bar} />
 * Variants: c.tabs.underline - the default across an app (horizontal): a rule under the selected tab; c.tabs.pills - tabs on a tinted surface (horizontal): a filled accent pill marks the selected tab; c.tabs.enclosed - tabs joined to the panel below (horizontal): folder tabs; c.tabs.plain - a long list of sections (vertical rail): a line down the side marks the selected tab; c.tabs.filled - a vertical rail on a busy page: the selected row is a tinted accent block
 * Look: A row or vertical rail of text tabs with an optional icon and count; the selected tab is marked and its panel sits below or beside the list.
 * Tokens: --color-accent --color-on-accent --color-text --color-text-muted --color-border --color-surface --color-surface-sunken --radius-md --radius-lg --space-2 --space-4 --weight-medium --text-sm --focus-ring
 * Use cases: record detail sections; settings groups; report views; inbox filters; dashboard ranges; section tabs; profile tabs; inbox folders; order status tabs; settings sections; project views; dashboard views; order queue; status tabs; order fulfilment; pipeline stages; ticket queue; task stages; filtered list views; kitchen orders; faq; class details; plan comparison; product details; help section; tabbed content; policies
 * Jobs to be done: move between parts of one thing; see which part I am on; count what is in each part; switch between views quickly; see how many items are in each group; find the right section of a page; sort work into stages; move an order to the next stage; see how many items are waiting; focus on one group at a time; find answers to my questions; compare details between options; read only the part i need
 * Keywords: tabs, underline, pills, enclosed, selected, disabled, badge, navigation, counts, tablist, keyboard, accordion, faq, disclosure, neobrutalism
 */
/**
 * Three looks for one control, and all three work: click a tab or use the arrow keys, and the panel below changes.
 * Tabs switch between parts of one thing. If the parts are separate pages, that is navigation, not tabs.
 *
 * Make it the app's own: keep one look across the app, and keep the counts only on tabs that filter a list.
 */
/**
 * How to try it
 * - Press any tab, or focus one and use the arrow keys: the panel below it changes.
 * - Only one tab in each set is in the tab order; the arrows move between them.
 *
 * Dependencies: React (useId, useRef, useState), and the library's own inline icon set ("./icons"), which is a table of SVG
 * paths rather than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are
 * the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built
 * app exactly as it runs here.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.tabs: the one tabs control, horizontal or vertical. The sheet below shows the horizontal looks. ──

export type TabsOrientation = "horizontal" | "vertical";
export type TabsVariant = "underline" | "pills" | "enclosed" | "plain" | "filled";
export type TabsSize = 32 | 40 | 44;
export type TabItem = {
  id: string;
  label: string;
  /** An icon name from ./icons; shown in a vertical rail. */
  icon?: string;
  /** A count after the label. In a vertical rail, 0 shows nothing. */
  count?: number;
  disabled?: boolean;
  /** The panel content. A vertical rail also shows the label as the panel's heading. */
  panel?: ReactNode;
};

// Written out in full (not built from the variant name) so a build finds every class the tabs need.
const LOOK: Record<TabsVariant, string> = {
  underline: "fl-ctl-tabset--underline",
  pills: "fl-ctl-tabset--pills",
  enclosed: "fl-ctl-tabset--enclosed",
  plain: "fl-ctl-vtabs--plain",
  filled: "fl-ctl-vtabs--filled",
};
const SIZE: Record<TabsSize, string> = { 32: "fl-ctl-tabset--32", 40: "fl-ctl-tabset--40", 44: "fl-ctl-tabset--44" };

type TabsProps = {
  tabs: TabItem[];
  /** The name screen readers give the tab list. */
  label: string;
  orientation?: TabsOrientation;
  /** Horizontal: underline (default), pills or enclosed. Vertical: plain (default) or filled. */
  variant?: TabsVariant;
  /** Tab height in px, horizontal only; 40 when left out. */
  size?: TabsSize;
  /** The tab open at first; the first usable one when left out. */
  defaultId?: string;
  /** Controlled: the open tab. Pair with onChange; defaultId is ignored. */
  value?: string;
  /** Called with the tab id when the person picks a tab (click or arrow keys). */
  onChange?: (id: string) => void;
  /** Content at the end of the tab bar (a copy button, say), outside the tab list. Horizontal only. */
  trailing?: ReactNode;
  className?: string;
};

export function Tabs({ tabs, label, orientation = "horizontal", variant, size = 40, defaultId, value, onChange, trailing, className }: TabsProps) {
  const vertical = orientation === "vertical";
  const look: TabsVariant = variant ?? (vertical ? "plain" : "underline");
  const uid = useId();
  const usable = tabs.filter((t) => !t.disabled);
  const [own, setOwn] = useState(defaultId ?? usable[0]?.id ?? "");
  const on = value ?? own;
  const setOn = (id: string) => {
    if (value === undefined) setOwn(id);
    onChange?.(id);
  };
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const here = tabs.find((t) => t.id === on) ?? tabs[0];
  const tabId = (id: string) => `tab-${uid}-${id}`;
  const panelId = `panel-${uid}`;

  // Roving focus: arrows (along the orientation), Home and End move between usable tabs and focus the new one.
  const onKey = (e: KeyboardEvent) => {
    const i = usable.findIndex((t) => t.id === on);
    let to = -1;
    if (e.key === (vertical ? "ArrowDown" : "ArrowRight")) to = (i + 1) % usable.length;
    else if (e.key === (vertical ? "ArrowUp" : "ArrowLeft")) to = (i - 1 + usable.length) % usable.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = usable.length - 1;
    const next = usable[to];
    if (!next) return;
    e.preventDefault();
    setOn(next.id);
    refs.current[next.id]?.focus();
  };

  const list = (
    <div
      className={vertical ? "fl-ctl-vtabs-rail" : `fl-ctl-tabset ${LOOK[look]} ${SIZE[size]}`}
      role="tablist"
      aria-orientation={vertical ? "vertical" : undefined}
      aria-label={label}
      onKeyDown={onKey}
    >
      {tabs.map((t) => {
        const sel = t.id === here?.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={sel}
            aria-controls={panelId}
            aria-disabled={vertical ? t.disabled || undefined : undefined}
            disabled={vertical ? undefined : t.disabled}
            tabIndex={sel ? 0 : -1}
            className={vertical ? `fl-ctl-vtab${sel ? " is-on" : ""}${t.disabled ? " is-off" : ""}` : `fl-spec-tab${sel ? " is-on" : ""}`}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            onClick={() => !t.disabled && setOn(t.id)}
          >
            {vertical && t.icon ? <Icon name={t.icon} /> : null}
            {vertical ? <span>{t.label}</span> : t.label}
            {vertical ? (
              t.count ? <span className="fl-ctl-vtab-count">{t.count}</span> : null
            ) : t.count !== undefined ? (
              <span className="fl-ctl-tab-count">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  if (vertical) {
    return (
      <div className={["fl-ctl-vtabs", LOOK[look], className ?? ""].filter(Boolean).join(" ")} data-fl={`c.tabs.${look}`}>
        {list}
        <div className="fl-ctl-vtabs-panel" role="tabpanel" id={panelId} aria-labelledby={here ? tabId(here.id) : undefined} tabIndex={0}>
          {here ? <h4>{here.label}</h4> : null}
          {typeof here?.panel === "string" ? <p className="fl-ctl-matrix-what">{here.panel}</p> : here?.panel}
        </div>
      </div>
    );
  }
  return (
    <div className={className} data-fl={`c.tabs.${look}`}>
      {trailing ? (
        <div className="fl-ctl-tabbar">
          {list}
          <div className="fl-ctl-tabbar-end">{trailing}</div>
        </div>
      ) : (
        list
      )}
      <div className="fl-ctl-tabpanel" role="tabpanel" id={panelId} aria-labelledby={here ? tabId(here.id) : undefined} tabIndex={0}>
        {typeof here?.panel === "string" ? <span className="fl-ctl-matrix-what">{here.panel}</span> : here?.panel}
      </div>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  looks: [
    { id: "underline" as const, label: "Underline", what: "A rule under the selected tab" },
    { id: "pills" as const, label: "Pills", what: "A filled pill: good on a tinted surface" },
    { id: "enclosed" as const, label: "Enclosed", what: "Folder tabs joined to the panel" },
  ],
  tabs: [
    { id: "all", label: "All", count: 24, panel: "Every booking, newest first." },
    { id: "open", label: "Open", count: 6, panel: "Six bookings still waiting on someone." },
    { id: "done", label: "Done", count: 18, panel: "Eighteen finished and delivered." },
    { id: "archive", label: "Archive", count: 0, panel: "Nothing archived yet.", disabled: true },
  ],
  sizes: [32 as const, 40 as const, 44 as const],
};

export default function TabsVariants() {
  const d = SAMPLE;
  const [picked, setPicked] = useState("open");
  const [copied, setCopied] = useState(false);
  return (
    <section className="fl-section fl-section--specimen">
      <ul className="fl-ctl-tabs-list">
        {d.looks.map((l) => (
          <li key={l.id}>
            <p className="fl-ctl-matrix-kind">{l.label}</p>
            <p className="fl-ctl-matrix-what">{l.what} · click a tab, or use the arrow keys.</p>
            <Tabs tabs={d.tabs} label={`${l.label} tabs`} variant={l.id} defaultId="open" />
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
        <h3>Controlled, and a button sharing the bar</h3>
        <p className="fl-ctl-btn-what">
          value and onChange let the page own which tab is open, so a button elsewhere can switch it. trailing puts content at the end
          of the bar, outside the tab list.
        </p>
        <div className="fl-ctl-tbl-bar">
          <Button variant="secondary" size={32} onClick={() => setPicked("all")}>
            Show All
          </Button>
          <Button variant="secondary" size={32} onClick={() => setPicked("done")}>
            Show Done
          </Button>
          <span className="fl-ctl-matrix-what">Open: {picked}</span>
        </div>
        <Tabs
          tabs={d.tabs}
          label="Controlled tabs"
          value={picked}
          onChange={setPicked}
          trailing={
            <Button variant="tertiary" size={32} icon="copy" onClick={() => setCopied(true)}>
              {copied ? "Copied" : "Copy"}
            </Button>
          }
        />
      </div>

      <div className="fl-ctl-sizes">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">Three of the button heights. Tabs sit above content, so they rarely need to be taller than 44.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((px) => (
            <li key={px}>
              <span className="fl-ctl-tab-sample">
                <Tabs tabs={d.tabs} label={`${px} px tabs`} size={px} defaultId="open" />
              </span>
              <span className="fl-ctl-btn-what">{px} px</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
