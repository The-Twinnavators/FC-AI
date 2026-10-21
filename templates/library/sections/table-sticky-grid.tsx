/** @flowcode-library table-sticky-grid · Wide table with sticky header and first column (Tables and lists)
 * Catalog ID: p.wide-table (pattern)
 * Function: The wide table pattern (p.wide-table): a report with more columns than the screen holds, scrolling inside its own box while the header row, the first column and a totals row stay put; columns can be hidden or shown, rows sorted by any column, and the density switched.
 * Use it as: import { WideTable } from "./table-sticky-grid"; <WideTable title lede? columns={[{ key, label, kind?: "text"|"number"|"currency"|"percent", total?: boolean, hideable?: boolean, signed?: boolean }]} rows={[{ id, [key]: string | number }]} currency?="USD" locale? maxHeight?="26rem" density?="comfortable"|"compact" totalLabel?="Total" labels?={{ columns, showAll, density, comfortable, compact, rows, empty }} />
 * Built from: c.button.secondary, c.button.tertiary, c.checkbox, c.segmented.toggle
 * Look: A title with a Columns button, a density switch and a row count over a bordered box: a tinted header row and bold first column that stay in place while the rest scrolls under them, soft shadows on the edges that have content past them, striped rows, right-aligned tabular numbers, small sort arrows in the headers and a bold totals row pinned to the bottom.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-border-strong --color-text --color-text-muted --color-accent --color-success --color-danger --space-1 --space-2 --space-3 --space-4 --radius-md --radius-lg --text-xs --text-sm --weight-semibold --focus-ring --duration-fast --duration-base --ease-out --easing --enter-distance
 * Use cases: sales report; regional performance; financial statement; spreadsheet view; analytics export; inventory by location; payroll summary; comparison report; admin data grid; quarterly results
 * Jobs to be done: read a wide report on a small screen; keep row names in view while scrolling across; sort by any number; hide columns I don't need; fit more rows on screen; see the totals
 * Keywords: table, sticky, header, frozen column, wide, scroll, data grid, report, columns, sort, totals, density
 */
/**
 * Wide table: a report wider and taller than its box. The table scrolls inside a focusable region (arrow keys scroll it
 * once it has focus) while the header row stays on top, the first column stays at the left and the totals row stays at
 * the bottom; soft shadows appear on the edges with content past them. Columns lets you hide or show columns (the first
 * one always stays), each header sorts its column (ascending, descending, then back to the original order) and rows
 * glide to their new places, and the density switch fits more rows on screen. Numbers are right-aligned in tabular
 * figures; growth columns show up or down in words as well as color. Make it the app's own: replace SAMPLE with the
 * report's columns and rows from the app's data; mark the columns that sum with total.
 * Built from c.button.secondary, c.button.tertiary, c.checkbox and c.segmented.toggle.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its tables with sticky headings and a sticky first column.
 */
/**
 * How to try it
 * - Scroll the table sideways and down: the store names, the header and the totals stay where they are.
 * - Press a column header (Q3, Growth...) to sort; press again to reverse, a third time to put the rows back.
 * - Press Columns and untick a few; Show all brings them back.
 * - Switch to Compact. Tab into the table and use the arrow keys to scroll it.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Button, Checkbox and
 * Segmented ("./buttons-variants", "./checkboxes-radios", "./segmented-control") and its inline icon set ("./icons").
 * Nothing else: no package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/stickygrid.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Segmented } from "./segmented-control";

// ── p.wide-table: sticky header, first column and totals over a scrolling box. ──

export type WideColumn = {
  key: string;
  label: string;
  /** How values are written; text when left out. percent takes 12.5 for 12.5%. */
  kind?: "text" | "number" | "currency" | "percent";
  /** Sum this column in the totals row (number and currency), or average it (percent). */
  total?: boolean;
  /** Can be hidden from the Columns menu; true for every column but the first. */
  hideable?: boolean;
  /** Color the value green or red by its sign, with up or down for screen readers (growth, change). */
  signed?: boolean;
};
export type WideRow = { id: string } & Record<string, string | number>;
export type WideDensity = "comfortable" | "compact";

export type WideTableProps = {
  title: string;
  lede?: string;
  columns: WideColumn[];
  rows: WideRow[];
  /** ISO currency code for currency columns. */
  currency?: string;
  locale?: string;
  /** The box's tallest height before it scrolls. */
  maxHeight?: string;
  density?: WideDensity;
  /** The first cell of the totals row. */
  totalLabel?: string;
  labels?: {
    columns?: string;
    showAll?: string;
    density?: string;
    comfortable?: string;
    compact?: string;
    rows?: string;
    empty?: string;
    sortAsc?: string;
    sortDesc?: string;
  };
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ms = (el: Element, name: string, fallback: number) => {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  return Number.isFinite(n) ? (v.endsWith("ms") ? n : n * 1000) : fallback;
};

export function WideTable({
  title,
  lede,
  columns,
  rows,
  currency = "USD",
  locale = "en-US",
  maxHeight = "26rem",
  density: startDensity = "comfortable",
  totalLabel = "Total",
  labels = {},
}: WideTableProps) {
  const l = {
    columns: "Columns",
    showAll: "Show all",
    density: "Row height",
    comfortable: "Comfortable",
    compact: "Compact",
    rows: "rows",
    empty: "No rows to show.",
    sortAsc: "ascending",
    sortDesc: "descending",
    ...labels,
  };
  const id = useId();
  const first = columns[0]!;
  const canHide = (c: WideColumn) => c !== first && c.hideable !== false;
  const [hidden, setHidden] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>(null);
  const [density, setDensity] = useState<WideDensity>(startDensity);
  const [menu, setMenu] = useState(false);
  const [edges, setEdges] = useState({
    left: false,
    right: false,
    top: false,
    bottom: false,
  });
  const scroller = useRef<HTMLDivElement>(null);
  const menuWrap = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
  const tbody = useRef<HTMLTableSectionElement>(null);
  const lastTops = useRef(new Map<string, number>());

  const shown = columns.filter((c) => !hidden.includes(c.key));
  const fmt = useMemo(() => {
    const money = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });
    const num = new Intl.NumberFormat(locale);
    return (c: WideColumn, v: string | number | undefined) => {
      if (v === undefined || v === "") return "—";
      if (typeof v !== "number") return v;
      if (c.kind === "currency") return money.format(v);
      if (c.kind === "percent") return `${c.signed && v > 0 ? "+" : ""}${v.toFixed(1)}%`;
      return num.format(v);
    };
  }, [locale, currency]);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const out = [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      const d = typeof x === "number" && typeof y === "number" ? x - y : String(x ?? "").localeCompare(String(y ?? ""), locale);
      return sort.dir === "asc" ? d : -d;
    });
    return out;
  }, [rows, sort, locale]);

  const totals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of columns) {
      if (!c.total) continue;
      const nums = rows.map((r) => r[c.key]).filter((v): v is number => typeof v === "number");
      const sum = nums.reduce((t, n) => t + n, 0);
      out[c.key] = c.kind === "percent" ? (nums.length ? sum / nums.length : 0) : sum;
    }
    return out;
  }, [columns, rows]);
  const hasTotals = Object.keys(totals).length > 0;

  // Shadows on the edges that have content past them.
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const next = {
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      top: el.scrollTop > 1,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
    };
    setEdges((e) => (e.left === next.left && e.right === next.right && e.top === next.top && e.bottom === next.bottom ? e : next));
  };
  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hidden.length, density]);

  // FLIP: after a sort, each row glides from where it was.
  useLayoutEffect(() => {
    const body = tbody.current;
    if (!body) return;
    const trs = [...body.querySelectorAll<HTMLElement>("tr[data-row]")];
    const tops = new Map(trs.map((tr) => [tr.dataset.row!, tr.offsetTop]));
    if (!reduced() && lastTops.current.size) {
      const duration = ms(body, "--duration-base", 200);
      const easing = getComputedStyle(body).getPropertyValue("--ease-out").trim() || "ease-out";
      for (const tr of trs) {
        const was = lastTops.current.get(tr.dataset.row!);
        const dy = was === undefined ? 0 : was - tops.get(tr.dataset.row!)!;
        if (Math.abs(dy) > 1)
          tr.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], {
            duration,
            easing,
          });
      }
    }
    lastTops.current = tops;
  }, [sorted, density]);

  // The Columns menu: Escape or a press outside closes it; Escape puts focus back on its button.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (menuWrap.current && !menuWrap.current.contains(e.target as Node)) setMenu(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      menuBtn.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const cycleSort = (key: string) => setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  const toggleCol = (key: string) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]));

  const align = (c: WideColumn) => (c.kind && c.kind !== "text" ? "fl-sg-num" : "");
  const sign = (c: WideColumn, v: unknown) => (c.signed && typeof v === "number" ? (v > 0 ? "up" : v < 0 ? "down" : "flat") : "");
  const edgeCls = ["fl-sg-box", edges.left ? "is-left" : "", edges.top ? "is-top" : "", edges.bottom && hasTotals ? "is-bottom" : ""].filter(Boolean).join(" ");

  return (
    <section className={`fl-sg fl-sg--${density}`} aria-labelledby={`${id}-title`} data-fl="p.wide-table">
      <div className="fl-sg-head">
        <div className="fl-sg-heading">
          <h2 id={`${id}-title`}>{title}</h2>
          {lede ? <p>{lede}</p> : null}
        </div>
        <div className="fl-sg-tools">
          <div className="fl-sg-menuwrap" ref={menuWrap}>
            <Button
              ref={menuBtn}
              variant="secondary"
              size={40}
              icon="layers"
              aria-expanded={menu}
              aria-controls={`${id}-cols`}
              onClick={() => setMenu((v) => !v)}
            >
              {l.columns}
              <span className="fl-sg-colcount" aria-hidden="true">
                {shown.length}/{columns.length}
              </span>
              <span className="fl-sr">
                , {shown.length} of {columns.length} shown
              </span>
            </Button>
            {menu ? (
              <div id={`${id}-cols`} className="fl-sg-menu" role="group" aria-label={l.columns}>
                <ul>
                  {columns.map((c) => (
                    <li key={c.key}>
                      <Checkbox label={c.label} size={16} checked={!hidden.includes(c.key)} disabled={!canHide(c)} onChange={() => toggleCol(c.key)} />
                    </li>
                  ))}
                </ul>
                <Button variant="tertiary" size={32} disabled={!hidden.length} onClick={() => setHidden([])}>
                  {l.showAll}
                </Button>
              </div>
            ) : null}
          </div>
          <Segmented
            variant="toggle"
            size="sm"
            label={l.density}
            value={density}
            onChange={(v) => setDensity(v as WideDensity)}
            options={[
              { value: "comfortable", label: l.comfortable },
              { value: "compact", label: l.compact },
            ]}
          />
          <span className="fl-sg-count" aria-live="polite">
            {rows.length} {l.rows}
          </span>
        </div>
      </div>

      <div className={`fl-sg-frame${edges.right ? " is-right" : ""}`}>
        <div ref={scroller} className={edgeCls} style={{ maxHeight }} role="region" aria-labelledby={`${id}-caption`} tabIndex={0} onScroll={measure}>
          <table className="fl-sg-table">
            <caption id={`${id}-caption`} className="fl-sr">
              {title}
              {sort ? `, sorted by ${columns.find((c) => c.key === sort.key)?.label} ${sort.dir === "asc" ? l.sortAsc : l.sortDesc}` : ""}
            </caption>
            <thead>
              <tr>
                {shown.map((c) => {
                  const on = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      className={`${align(c)}${c === first ? " fl-sg-stick" : ""}`}
                      aria-sort={on ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    >
                      <button type="button" className="fl-sg-sort" onClick={() => cycleSort(c.key)}>
                        {c.label}
                        <span className={`fl-sg-arrow${on ? ` is-${sort!.dir}` : ""}`} aria-hidden="true">
                          <Icon name="chevron-down" />
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody ref={tbody}>
              {sorted.length === 0 ? (
                <tr>
                  <td className="fl-sg-empty" colSpan={shown.length}>
                    {l.empty}
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} data-row={r.id}>
                    {shown.map((c) => {
                      const v = r[c.key];
                      const dir = sign(c, v);
                      if (c === first)
                        return (
                          <th key={c.key} scope="row" className="fl-sg-stick">
                            {fmt(c, v)}
                          </th>
                        );
                      return (
                        <td key={c.key} className={[align(c), dir ? `fl-sg-${dir}` : ""].filter(Boolean).join(" ")}>
                          {dir === "up" || dir === "down" ? <span className="fl-sr">{dir === "up" ? "Up " : "Down "}</span> : null}
                          {fmt(c, v)}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {hasTotals && sorted.length ? (
              <tfoot>
                <tr>
                  {shown.map((c) =>
                    c === first ? (
                      <th key={c.key} scope="row" className="fl-sg-stick">
                        {totalLabel}
                      </th>
                    ) : (
                      <td key={c.key} className={align(c)}>
                        {c.key in totals ? fmt(c, totals[c.key]) : ""}
                      </td>
                    ),
                  )}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </section>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Store performance, 2026",
  lede: "Revenue by quarter for every store. Scroll across for orders, returns and growth.",
  currency: "USD",
  totalLabel: "All stores",
  columns: [
    { key: "store", label: "Store" },
    { key: "region", label: "Region" },
    { key: "q1", label: "Q1", kind: "currency", total: true },
    { key: "q2", label: "Q2", kind: "currency", total: true },
    { key: "q3", label: "Q3", kind: "currency", total: true },
    { key: "q4", label: "Q4", kind: "currency", total: true },
    { key: "orders", label: "Orders", kind: "number", total: true },
    { key: "aov", label: "Avg. order", kind: "currency" },
    { key: "returns", label: "Returns", kind: "percent", total: true },
    {
      key: "growth",
      label: "Growth",
      kind: "percent",
      signed: true,
      total: true,
    },
    { key: "manager", label: "Manager" },
  ] as WideColumn[],
  rows: [
    {
      id: "s1",
      store: "Portland Pearl",
      region: "West",
      q1: 182400,
      q2: 196300,
      q3: 204100,
      q4: 251900,
      orders: 9120,
      aov: 91,
      returns: 4.2,
      growth: 12.4,
      manager: "Ana Ruiz",
    },
    {
      id: "s2",
      store: "Austin South",
      region: "South",
      q1: 141200,
      q2: 150800,
      q3: 147300,
      q4: 188600,
      orders: 7340,
      aov: 85,
      returns: 5.1,
      growth: 8.9,
      manager: "Marcus Lee",
    },
    {
      id: "s3",
      store: "Brooklyn Navy Yard",
      region: "Northeast",
      q1: 220900,
      q2: 231400,
      q3: 226800,
      q4: 279300,
      orders: 10880,
      aov: 89,
      returns: 6.3,
      growth: 6.1,
      manager: "Priya Shah",
    },
    {
      id: "s4",
      store: "Denver Union",
      region: "Mountain",
      q1: 98700,
      q2: 104200,
      q3: 99800,
      q4: 121500,
      orders: 4920,
      aov: 86,
      returns: 3.8,
      growth: -2.3,
      manager: "Tom Becker",
    },
    {
      id: "s5",
      store: "Chicago Fulton",
      region: "Midwest",
      q1: 167300,
      q2: 172900,
      q3: 181200,
      q4: 214700,
      orders: 8410,
      aov: 87,
      returns: 4.9,
      growth: 9.7,
      manager: "Lena Morris",
    },
    {
      id: "s6",
      store: "Seattle Capitol Hill",
      region: "West",
      q1: 154800,
      q2: 149100,
      q3: 158600,
      q4: 192300,
      orders: 7650,
      aov: 86,
      returns: 4.4,
      growth: 3.2,
      manager: "Jonas Berg",
    },
    {
      id: "s7",
      store: "Atlanta Westside",
      region: "South",
      q1: 119600,
      q2: 126300,
      q3: 131900,
      q4: 160400,
      orders: 6280,
      aov: 85,
      returns: 5.6,
      growth: 11.8,
      manager: "Dana Brooks",
    },
    {
      id: "s8",
      store: "Boston Seaport",
      region: "Northeast",
      q1: 176500,
      q2: 171200,
      q3: 168900,
      q4: 205800,
      orders: 8030,
      aov: 90,
      returns: 6.8,
      growth: -4.6,
      manager: "Sam Ortiz",
    },
    {
      id: "s9",
      store: "Minneapolis North Loop",
      region: "Midwest",
      q1: 87300,
      q2: 92600,
      q3: 95100,
      q4: 118200,
      orders: 4410,
      aov: 89,
      returns: 3.5,
      growth: 7.3,
      manager: "Kim Nguyen",
    },
    {
      id: "s10",
      store: "Phoenix Roosevelt",
      region: "Mountain",
      q1: 76200,
      q2: 71800,
      q3: 69400,
      q4: 88900,
      orders: 3690,
      aov: 83,
      returns: 4.0,
      growth: -6.9,
      manager: "Ravi Patel",
    },
    {
      id: "s11",
      store: "San Diego Little Italy",
      region: "West",
      q1: 132700,
      q2: 141900,
      q3: 149300,
      q4: 176200,
      orders: 6890,
      aov: 87,
      returns: 4.7,
      growth: 10.2,
      manager: "Grace Kim",
    },
    {
      id: "s12",
      store: "Nashville Gulch",
      region: "South",
      q1: 103400,
      q2: 112700,
      q3: 119800,
      q4: 146100,
      orders: 5520,
      aov: 87,
      returns: 5.3,
      growth: 14.6,
      manager: "Leo Grant",
    },
  ] as WideRow[],
};

export default function WideTableSheet() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <WideTable {...SAMPLE} />
      </div>
    </section>
  );
}
