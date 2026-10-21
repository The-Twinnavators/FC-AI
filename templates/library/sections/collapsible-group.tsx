/** @flowcode-library collapsible-group · Collapsible sections (Small components)
 * Catalog ID: c.collapsible (component)
 * Function: A show-and-hide section with a header button that opens content in place, and a group of them with one Expand all / Collapse all button, an open count and arrow keys between headers; shown on an order summary and a project's settings page.
 * Use it as: import { Collapsible, CollapsibleGroup } from "./collapsible-group"; <Collapsible title meta?={node} icon? open?/defaultOpen? onOpenChange?={(open) => ...} disabled? disabledNote? openLabel? closeLabel? variant?="row"|"card">content</Collapsible>; <CollapsibleGroup label="Settings" items={[{ id, title, meta?, icon?, disabled?, disabledNote?, content }]} defaultOpen?={["id"]} open?/onOpenChange?={(ids) => ...} labels?={{ expandAll, collapseAll, count }} />
 * Built from: c.button.tertiary, c.badge.status
 * Look: Rows divided by hairlines inside one bordered card; each header has an optional icon, a title, a quiet meta pill and a chevron 8px from the right edge that turns as the content slides open beneath; the group's top bar carries an open count and an Expand all button.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --surface-radius --radius-sm --space-2 --space-3 --space-4 --text-sm --text-xs --duration-base --ease-out --focus-ring
 * Use cases: order summary; settings page; environment variables; release notes; filters panel; long form sections; project details
 * Jobs to be done: see the details only when I need them; open everything to scan or search the page; keep a long page short; check one section without losing my place
 * Keywords: collapsible, disclosure, expand all, collapse all, show more, details, toggle section, order summary
 */
/**
 * Collapsible: a header button that shows or hides the content right under it. Unlike an accordion, opening one never
 * closes another, and a group of them gets one Expand all button so people can open everything to scan, print or
 * search with Ctrl+F. The header is a real button with aria-expanded; the content slides open on grid rows and is
 * inert while closed, so Tab never lands inside hidden content. In a group Up and Down move between headers, Home and
 * End jump, and the open count is announced when Expand all runs.
 * Make it the app's own: put the real sections in items; keep each title short and put a count or status in meta.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its collapsible's anatomy (trigger, content, default
 * open, disabled, with icon) and its order summary and environment variables examples, rewritten without its
 * dependencies.
 */
/**
 * How to try it
 * - Press "Show order details": the items slide open; press again to hide them.
 * - Press Expand all: every open-able section opens and the count says so; it turns into Collapse all.
 * - Tab to a header and use Up, Down, Home and End to move between headers; Enter or Space opens one.
 * - In Environment variables, reveal a value with the eye and copy it.
 * - Webhooks is turned off: it says why instead of opening.
 *
 * Dependencies: React (useId, useRef, useState), the library's Button ("./buttons-variants"), Badge
 * ("./badges-status") and its inline icon set ("./icons"), which is a table of SVG paths rather than an icon package.
 * Nothing else — no package to install and nothing fetched at run time. The styles are the library's own fl- classes
 * in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as it runs here.
 */
import { useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";

// ── c.collapsible: one header button and the content it shows. ──

export type CollapsibleProps = {
  title: ReactNode;
  /** A short count or status at the end of the header ("3", "Shipped"). */
  meta?: ReactNode;
  icon?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Said in place of the content when disabled ("Upgrade to add webhooks"). */
  disabledNote?: string;
  /** Header text that changes with the state ("Show order details" / "Hide order details"); title is used when left out. */
  openLabel?: string;
  closeLabel?: string;
  /** "row": a divided row (inside a group or a card); "card": its own bordered box. */
  variant?: "row" | "card";
  headingLevel?: 2 | 3 | 4;
  children: ReactNode;
  className?: string;
  /** Used by the group for arrow keys between headers. */
  onHeaderKeyDown?: (e: ReactKeyboardEvent<HTMLButtonElement>) => void;
};

export function Collapsible({
  title,
  meta,
  icon,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled,
  disabledNote,
  openLabel,
  closeLabel,
  variant = "card",
  headingLevel = 3,
  children,
  className,
  onHeaderKeyDown,
}: CollapsibleProps) {
  const uid = useId().replace(/:/g, "");
  const [own, setOwn] = useState(defaultOpen);
  const open = openProp ?? own;
  const toggle = () => {
    if (disabled) return;
    if (openProp === undefined) setOwn(!open);
    onOpenChange?.(!open);
  };
  const H = `h${headingLevel}` as "h3";
  const text = open ? (closeLabel ?? title) : (openLabel ?? title);
  return (
    <div className={["fl-clp", `fl-clp--${variant}`, open ? "is-open" : "", disabled ? "is-disabled" : "", className ?? ""].filter(Boolean).join(" ")} data-fl="c.collapsible">
      <H className="fl-clp-h">
        <button
          type="button"
          className="fl-clp-trigger"
          id={`${uid}-t`}
          aria-expanded={open}
          aria-controls={`${uid}-c`}
          aria-disabled={disabled || undefined}
          aria-describedby={disabled && disabledNote ? `${uid}-n` : undefined}
          onClick={toggle}
          onKeyDown={onHeaderKeyDown}
          data-clp-header=""
        >
          {icon ? (
            <span className="fl-clp-icon" aria-hidden="true">
              <Icon name={icon} />
            </span>
          ) : null}
          <span className="fl-clp-title">{text}</span>
          {meta !== undefined ? <span className="fl-clp-meta">{meta}</span> : null}
          <span className="fl-clp-chev" aria-hidden="true">
            <Icon name={disabled ? "lock" : "chevron-down"} />
          </span>
        </button>
      </H>
      {disabled && disabledNote ? (
        <p id={`${uid}-n`} className="fl-clp-note">
          {disabledNote}
        </p>
      ) : null}
      <div className="fl-clp-panel" id={`${uid}-c`} role="region" aria-labelledby={`${uid}-t`} inert={!open} hidden={disabled || undefined}>
        <div className="fl-clp-clip">
          <div className="fl-clp-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

// ── The group: one Expand all for many collapsibles, and arrow keys between their headers. ──

export type CollapsibleItem = { id: string; title: string; meta?: ReactNode; icon?: string; disabled?: boolean; disabledNote?: string; content: ReactNode };

export function CollapsibleGroup({
  label,
  items,
  defaultOpen = [],
  open: openProp,
  onOpenChange,
  labels,
  className,
}: {
  label: string;
  items: CollapsibleItem[];
  defaultOpen?: string[];
  open?: string[];
  onOpenChange?: (ids: string[]) => void;
  labels?: { expandAll?: string; collapseAll?: string; count?: string };
  className?: string;
}) {
  const L = { expandAll: "Expand all", collapseAll: "Collapse all", count: "{n} of {total} open", ...labels };
  const [own, setOwn] = useState<string[]>(defaultOpen);
  const open = openProp ?? own;
  const [said, setSaid] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const usable = items.filter((i) => !i.disabled);
  const allOpen = usable.length > 0 && usable.every((i) => open.includes(i.id));
  const count = (n: number) => L.count.replace("{n}", String(n)).replace("{total}", String(usable.length));
  const put = (ids: string[], announce = false) => {
    if (openProp === undefined) setOwn(ids);
    onOpenChange?.(ids);
    setSaid(announce ? count(ids.length) : "");
  };
  const onHeaderKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const heads = [...(list.current?.querySelectorAll<HTMLButtonElement>("[data-clp-header]") ?? [])];
    const i = heads.indexOf(e.currentTarget);
    const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? heads.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    heads[(to + heads.length) % heads.length]?.focus();
  };
  return (
    <div className={["fl-clp-group", className ?? ""].filter(Boolean).join(" ")} role="group" aria-label={label}>
      <div className="fl-clp-bar">
        <span className="fl-clp-count">{count(open.filter((id) => usable.some((i) => i.id === id)).length)}</span>
        <Button variant="tertiary" size={32} icon={allOpen ? "chevron-down" : "layers"} className={allOpen ? "fl-clp-all is-all" : "fl-clp-all"} onClick={() => put(allOpen ? [] : usable.map((i) => i.id), true)}>
          {allOpen ? L.collapseAll : L.expandAll}
        </Button>
      </div>
      <div ref={list} className="fl-clp-list">
        {items.map((it) => (
          <Collapsible
            key={it.id}
            variant="row"
            title={it.title}
            meta={it.meta}
            icon={it.icon}
            disabled={it.disabled}
            disabledNote={it.disabledNote}
            open={open.includes(it.id)}
            onOpenChange={(o) => put(o ? [...open, it.id] : open.filter((x) => x !== it.id))}
            onHeaderKeyDown={onHeaderKeyDown}
          >
            {it.content}
          </Collapsible>
        ))}
      </div>
      <p className="fl-clp-sr" role="status">
        {said}
      </p>
    </div>
  );
}

// ── The reference sheet: an order summary and a project's settings. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Small components",
  title: "Show it when it's needed",
  lede: "Open one section, or all of them at once.",
  order: {
    number: "Order #4291",
    placed: "Oct 14, 2026 · $94.00",
    status: "Shipped",
    show: "Show order details",
    hide: "Hide order details",
    items: [
      { name: "Speckled mug, set of 2", price: "$48.00" },
      { name: "Glaze sampler", price: "$31.00" },
      { name: "Shipping", price: "$15.00" },
    ],
    address: "Delivered to 418 Alder St, Portland OR 97205",
  },
  settings: {
    label: "Project settings",
    general: { name: "Kiln Room shop", region: "US West", created: "Mar 3, 2026" },
    env: [
      { key: "DATABASE_URL", value: "postgres://shop:example@db.internal/shop" },
      { key: "PUBLIC_API_URL", value: "https://api.kilnroom.example/v1" },
      { key: "PAYMENTS_KEY", value: "pk_test_51Hx_example_only" },
    ],
    build: [
      { label: "Build command", value: "npm run build" },
      { label: "Output folder", value: "dist" },
      { label: "Node version", value: "22" },
    ],
    domains: [
      { host: "kilnroom.example", state: "Live" },
      { host: "www.kilnroom.example", state: "Redirects" },
    ],
    webhooksNote: "Webhooks come with the Team plan.",
  },
};

function EnvRows({ rows }: { rows: Array<{ key: string; value: string }> }) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [said, setSaid] = useState("");
  const copy = async (key: string, value: string) => {
    try {
      // Some browsers wait on a permission prompt that never shows; give up after a moment and say so.
      await Promise.race([navigator.clipboard.writeText(value), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 1500))]);
      setSaid(`${key} copied.`);
    } catch {
      setSaid(`Couldn't copy ${key}. Select it and copy instead.`);
      setShown((s) => ({ ...s, [key]: true }));
    }
  };
  return (
    <>
      <ul className="fl-clp-env">
        {rows.map((r) => (
          <li key={r.key}>
            <code className="fl-clp-key">{r.key}</code>
            <code className="fl-clp-val">{shown[r.key] ? r.value : "••••••••••••"}</code>
            <span className="fl-clp-acts">
              <Button variant="tertiary" size={32} icon={shown[r.key] ? "eye-off" : "eye"} iconOnly onClick={() => setShown((s) => ({ ...s, [r.key]: !s[r.key] }))}>
                {shown[r.key] ? `Hide ${r.key}` : `Show ${r.key}`}
              </Button>
              <Button variant="tertiary" size={32} icon="copy" iconOnly onClick={() => void copy(r.key, r.value)}>
                {`Copy ${r.key}`}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="fl-clp-said" role="status">
        {said}
      </p>
    </>
  );
}

export default function CollapsibleGroupPreview() {
  const d = SAMPLE;
  const s = d.settings;
  const items: CollapsibleItem[] = [
    {
      id: "general",
      title: "General",
      icon: "settings",
      content: (
        <dl className="fl-clp-facts">
          <div>
            <dt>Name</dt>
            <dd>{s.general.name}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{s.general.region}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{s.general.created}</dd>
          </div>
        </dl>
      ),
    },
    { id: "env", title: "Environment variables", icon: "lock", meta: s.env.length, content: <EnvRows rows={s.env} /> },
    {
      id: "build",
      title: "Build",
      icon: "bolt",
      content: (
        <dl className="fl-clp-facts">
          {s.build.map((b) => (
            <div key={b.label}>
              <dt>{b.label}</dt>
              <dd>
                <code>{b.value}</code>
              </dd>
            </div>
          ))}
        </dl>
      ),
    },
    {
      id: "domains",
      title: "Domains",
      icon: "globe",
      meta: s.domains.length,
      content: (
        <ul className="fl-clp-domains">
          {s.domains.map((x) => (
            <li key={x.host}>
              <span>{x.host}</span>
              <Badge tone={x.state === "Live" ? "success" : "neutral"} led>
                {x.state}
              </Badge>
            </li>
          ))}
        </ul>
      ),
    },
    { id: "hooks", title: "Webhooks", icon: "send", disabled: true, disabledNote: s.webhooksNote, content: null },
  ];
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="collapsible-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="collapsible-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-clp-sheet">
          <div className="fl-clp-order">
            <div className="fl-clp-order-top">
              <div>
                <p className="fl-clp-order-no">{d.order.number}</p>
                <p className="fl-clp-order-when">{d.order.placed}</p>
              </div>
              <Badge tone="success">{d.order.status}</Badge>
            </div>
            <Collapsible variant="row" title={d.order.show} openLabel={d.order.show} closeLabel={d.order.hide}>
              <ul className="fl-clp-lines">
                {d.order.items.map((i) => (
                  <li key={i.name}>
                    <span>{i.name}</span>
                    <span>{i.price}</span>
                  </li>
                ))}
              </ul>
              <p className="fl-clp-addr">{d.order.address}</p>
            </Collapsible>
          </div>
          <CollapsibleGroup label={s.label} items={items} defaultOpen={["general"]} />
        </div>
      </div>
    </section>
  );
}
