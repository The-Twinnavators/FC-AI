/** @flowcode-library stock-watchlist · Stock watchlist (Charts and data)
 * Catalog ID: p.stock-watchlist (pattern)
 * Function: The stock watchlist pattern (p.stock-watchlist): followed symbols with a sparkline, price and change over a chosen range, sortable and removable with undo, under summary cards for the average, best and worst movers.
 * Use it as: import { StockWatchlist } from "./stock-watchlist"; <StockWatchlist title symbols={[{ symbol, name, price, series: { "1d": [prices oldest first] } }]} ranges={[{ id: "1d", label: "1D", period: "the day" }]} currency?="USD" locale? labels?={{ range, sort, byMove, byName, byPrice, average, best, worst, remove, removed, undo, empty }} onRemove?={(symbol) => ...} />
 * Built from: c.kpi, c.segmented.toggle, c.avatar.organization, c.button.tertiary
 * Look: Three KPI cards (average move, best and worst mover) over a panel of symbols: a lettered mark, the symbol in bold over the company, a tiny green or red price line, the price and an up or down change pill, and a remove button; range and sort switches sit in the panel's header.
 * Tokens: --color-surface --color-border --color-text-muted --color-success --color-danger --color-danger-surface --color-surface-sunken --space-2 --space-3 --space-4 --space-5 --radius-lg --text-xs --text-sm
 * Use cases: stock watchlist; investing dashboard; crypto prices; portfolio overview; market tracker; price watch; finance dashboard; trading app
 * Jobs to be done: see how my stocks moved today; find the biggest movers; compare price changes over a week or month; stop following a symbol
 * Keywords: watchlist, stocks, prices, sparkline, finance, portfolio, market, dashboard
 */
/**
 * Stock watchlist: summary cards above a list of followed symbols. Each row shows the symbol and company, a tiny SVG
 * line of the price over the chosen range, the price and its change; green when it rose, red when it fell, and the
 * words up or down beside the arrow so color is never the only signal. A range switch (day, week, month) redraws the
 * lines and changes; a sort switch orders by biggest move, name or price; Remove takes a symbol off the list with an
 * Undo. The summary cards (c.kpi) show the average move and the best and worst movers for the range. Use it on a
 * finance, investing or crypto dashboard. Make it the app's own: replace SAMPLE with the person's symbols and prices
 * from the app's market data, and save removals through onRemove.
 * Built from c.kpi, c.segmented.toggle, c.avatar.organization and c.button.tertiary.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin), its watchlist and top card group.
 */
import { useId, useMemo, useState } from "react";
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Kpi } from "./card-kpi";
import { Segmented } from "./segmented-control";

// ── p.stock-watchlist: summary cards, then followed symbols with a sparkline, price and change. ──

export type WatchRange = { id: string; label: string; /** What the change is against, for the cards: "the day". */ period: string };
export type WatchSymbol = {
  symbol: string;
  name: string;
  /** The latest price. */
  price: number;
  /** Earlier prices per range id, oldest first; the change is measured from the first one to `price`. */
  series: Record<string, number[]>;
};

export type StockWatchlistProps = {
  title: string;
  symbols: WatchSymbol[];
  ranges: WatchRange[];
  /** ISO currency code for prices: "USD". */
  currency?: string;
  locale?: string;
  labels?: { range?: string; sort?: string; byMove?: string; byName?: string; byPrice?: string; average?: string; best?: string; worst?: string; remove?: string; removed?: string; undo?: string; empty?: string };
  /** Called with the symbol taken off the list. */
  onRemove?: (symbol: string) => void;
};

type SortKey = "move" | "name" | "price";

const changeOf = (s: WatchSymbol, range: string) => {
  const first = s.series[range]?.[0] ?? s.price;
  return first ? ((s.price - first) / first) * 100 : 0;
};

/** A tiny line of the price across a 100 by 28 box; decoration, since the change is written beside it. */
function Spark({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const pts = points.map((n, i) => `${((i / Math.max(points.length - 1, 1)) * 100).toFixed(2)},${(26 - ((n - min) / span) * 24).toFixed(2)}`).join(" ");
  return (
    <svg className="fl-wl-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline points={pts} />
    </svg>
  );
}

export function StockWatchlist({ title, symbols, ranges, currency = "USD", locale = "en-US", labels = {}, onRemove }: StockWatchlistProps) {
  const l = {
    range: "Range",
    sort: "Sort by",
    byMove: "Biggest move",
    byName: "Name",
    byPrice: "Price",
    average: "Average move",
    best: "Best mover",
    worst: "Worst mover",
    remove: "Remove",
    removed: "removed from the watchlist.",
    undo: "Undo",
    empty: "No symbols on the watchlist.",
    ...labels,
  };
  const id = useId();
  const [range, setRange] = useState(ranges[0]?.id ?? "");
  const [sort, setSort] = useState<SortKey>("move");
  const [list, setList] = useState(symbols);
  const [last, setLast] = useState<{ item: WatchSymbol; at: number } | null>(null);

  const money = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const pct = (n: number) => `${Math.abs(n).toFixed(2)}%`;
  const period = ranges.find((r) => r.id === range)?.period;

  const rows = useMemo(() => {
    const withMove = list.map((s) => ({ s, move: changeOf(s, range) }));
    if (sort === "name") return withMove.sort((a, b) => a.s.symbol.localeCompare(b.s.symbol));
    if (sort === "price") return withMove.sort((a, b) => b.s.price - a.s.price);
    return withMove.sort((a, b) => Math.abs(b.move) - Math.abs(a.move));
  }, [list, range, sort]);

  const byMove = [...rows].sort((a, b) => b.move - a.move);
  const best = byMove[0];
  const worst = byMove[byMove.length - 1];
  const average = rows.length ? rows.reduce((t, r) => t + r.move, 0) / rows.length : 0;

  const remove = (item: WatchSymbol) => {
    const at = list.indexOf(item);
    setList((xs) => xs.filter((x) => x !== item));
    setLast({ item, at });
    onRemove?.(item.symbol);
    // The list just lost the row that had focus: the heading takes it, so the keyboard isn't left on nothing.
    document.getElementById(`${id}-title`)?.focus();
  };
  const undo = () => {
    if (!last) return;
    setList((xs) => [...xs.slice(0, last.at), last.item, ...xs.slice(last.at)]);
    setLast(null);
  };

  return (
    <div className="fl-wl" data-fl="p.stock-watchlist">
      {rows.length > 0 ? (
        <div className="fl-wl-cards">
          <Kpi label={l.average} value={`${average >= 0 ? "+" : "-"}${pct(average)}`} change={average} period={period} />
          {best ? <Kpi label={l.best} value={best.s.symbol} change={best.move} period={period} series={[...(best.s.series[range] ?? []), best.s.price]} /> : null}
          {worst && worst !== best ? <Kpi label={l.worst} value={worst.s.symbol} change={worst.move} period={period} series={[...(worst.s.series[range] ?? []), worst.s.price]} /> : null}
        </div>
      ) : null}

      <section className="fl-wl-panel" aria-labelledby={`${id}-title`}>
        <div className="fl-wl-head">
          <h3 id={`${id}-title`} tabIndex={-1}>
            {title}
          </h3>
          <div className="fl-wl-tools">
            <Segmented variant="toggle" size="sm" label={l.range} value={range} onChange={setRange} options={ranges.map((r) => ({ value: r.id, label: r.label }))} />
            <Segmented
              variant="toggle"
              size="sm"
              label={l.sort}
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              options={[
                { value: "move", label: l.byMove },
                { value: "name", label: l.byName },
                { value: "price", label: l.byPrice },
              ]}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="fl-wl-empty">{l.empty}</p>
        ) : (
          <ul className="fl-wl-list">
            {rows.map(({ s, move }) => {
              const dir = move > 0 ? "up" : move < 0 ? "down" : "flat";
              return (
                <li key={s.symbol} className="fl-wl-row">
                  <Avatar variant="organization" name={s.name} label={s.symbol.slice(0, 2)} decorative />
                  <span className="fl-wl-name">
                    <strong>{s.symbol}</strong>
                    <span>{s.name}</span>
                  </span>
                  <span className={`fl-wl-trend fl-wl-trend--${dir}`}>
                    <Spark points={[...(s.series[range] ?? []), s.price]} />
                  </span>
                  <span className="fl-wl-price">
                    <strong>{money.format(s.price)}</strong>
                    <span className={`fl-wl-move fl-wl-move--${dir}`}>
                      <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "–"}</span>
                      <span className="fl-sr">{dir === "up" ? "Up" : dir === "down" ? "Down" : "No change"} </span>
                      {pct(move)}
                    </span>
                  </span>
                  <Button variant="tertiary" size={32} icon="close" iconOnly aria-label={`${l.remove} ${s.symbol}`} onClick={() => remove(s)}>
                    {l.remove}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="fl-wl-status" role="status" aria-live="polite">
          {last ? (
            <>
              <span>
                {last.item.symbol} {l.removed}
              </span>
              <Button variant="tertiary" size={32} onClick={undo}>
                {l.undo}
              </Button>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "My watchlist",
  currency: "USD",
  ranges: [
    { id: "1d", label: "1D", period: "the day" },
    { id: "1w", label: "1W", period: "the week" },
    { id: "1m", label: "1M", period: "the month" },
  ],
  symbols: [
    { symbol: "AAPL", name: "Apple Inc.", price: 231.4, series: { "1d": [228.1, 229.6, 228.9, 230.7, 231.0], "1w": [224.3, 226.8, 225.1, 229.4, 230.2], "1m": [219.5, 222.0, 226.4, 224.8, 228.3] } },
    { symbol: "SPOT", name: "Spotify Technology", price: 412.85, series: { "1d": [398.2, 401.5, 405.9, 409.1, 411.0], "1w": [389.0, 395.4, 401.2, 398.7, 407.5], "1m": [371.6, 380.2, 392.8, 401.1, 405.3] } },
    { symbol: "ABNB", name: "Airbnb, Inc.", price: 128.06, series: { "1d": [128.43, 128.9, 128.2, 127.8, 128.1], "1w": [131.2, 130.4, 129.0, 129.6, 128.5], "1m": [138.9, 135.2, 133.0, 130.4, 129.1] } },
    { symbol: "SHOP", name: "Shopify Inc.", price: 79.52, series: { "1d": [76.6, 77.4, 78.1, 78.8, 79.2], "1w": [74.1, 75.8, 77.0, 76.5, 78.9], "1m": [70.3, 72.6, 74.8, 77.1, 78.4] } },
    { symbol: "ETSY", name: "Etsy, Inc.", price: 52.18, series: { "1d": [54.5, 53.9, 53.1, 52.7, 52.4], "1w": [55.2, 54.8, 53.6, 53.0, 52.6], "1m": [57.9, 56.1, 54.7, 53.8, 52.9] } },
  ] as WatchSymbol[],
};

export default function StockWatchlistSheet() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <StockWatchlist {...SAMPLE} />
      </div>
    </section>
  );
}
