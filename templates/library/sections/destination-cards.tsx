/** @flowcode-library destination-cards · Destination cards (Cards)
 * Catalog ID: b.destination-cards (block)
 * Function: The destination cards block (b.destination-cards): trips as picture cards you filter by region and season, sort by popularity, price or length, save to a list kept on this device, and open; each card reveals its highlights on hover or focus.
 * Use it as: import { DestinationCards } from "./destination-cards"; <DestinationCards items={[{ id, name, country, region, seasons: ["spring"], from: 124000 (cents), nights: 7, rating?: 4.8, blurb, highlights: ["..."], picture?: { src?, alt }, href? }]} regions={["Europe", "Asia"]} seasons={[{ id: "spring", label: "Spring" }]} storageKey?="my-trips" onSave?={(id, saved) => ...} currency?="USD" />
 * Built from: c.media-frame, c.chip.filter, c.select.outlined, c.button.secondary
 * Look: A row of region tabs on a thin rule with an accent underline that slides to the chosen one, then season chips, a Saved chip with a count and a sort select. Below, a three-across grid of white cards: a rounded picture with a round heart button in its corner and a dark scrim that slides up with three highlights on hover, then the place name, country, nights and rating, and "from $1,240" in bold. Cards lift on hover and glide to their new places when the filters change.
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-md --text-lg --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: travel destinations; tour operator trips; where to go; travel agency packages; holiday ideas; adventure trips; travel blog destinations; seasonal getaways
 * Jobs to be done: find a trip in the part of the world i want; see what fits the season i can travel; compare prices and lengths; save trips to look at later
 * Keywords: travel, destinations, trips, tours, cards, filter, region, season, save, wishlist, sort, price, nights, holiday, vacation
 */
/**
 * Destination cards: browse trips the way people plan them, by where and when. Region tabs are real radios (arrow keys
 * move between them) with one underline that slides to the chosen tab; season and Saved are filter chips; sort is a
 * select. The cards glide to their new places when anything changes (FLIP), new ones fade in. Each card lifts on hover
 * and slides up its highlights over the picture (on focus too; always shown on touch screens). The heart saves a trip
 * with a small pop and is kept on this device. When nothing matches, one button clears the filters.
 * Make it the app's own: replace SAMPLE with the real trips and prices, and point href at each trip's page.
 * Adapted from Tailblocks (MIT, Copyright (c) 2020 Mert Cukuren): its ecommerce block's picture-card grid.
 */
/**
 * How to try it
 * - Press Asia (or Tab to the tabs and use the arrows): the underline slides and the cards glide into place.
 * - Press Winter: only winter trips stay; press it again for any season.
 * - Hover a card or Tab into it: it lifts and its highlights slide up over the picture.
 * - Press a heart: it pops and fills, and Saved counts up; Saved shows only those. Reload: they're still saved.
 * - Sort by Lowest price: the cards glide into the new order.
 * - Pick a region and season with no trips: "No trips match" with Clear filters.
 * - Narrow the window to a phone: one card across and the tabs scroll sideways.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's MediaFrame, Chip, Select and
 * Button ("./media-frames", "./chips-tags", "./dropdowns-states", "./buttons-variants") and its inline icon set
 * ("./icons"). Nothing else: no package and nothing fetched. Saved trips stay in this browser's localStorage under
 * storageKey. The styles are the library's own fl- classes in templates/library/css/r6d-destination-cards.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Chip } from "./chips-tags";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

export type Destination = {
  id: string;
  name: string;
  country: string;
  region: string;
  seasons: string[];
  /** Lowest price per person, in cents. */
  from: number;
  nights: number;
  rating?: number;
  blurb: string;
  highlights: string[];
  picture?: { src?: string; alt: string };
  href?: string;
};

export type DestinationCardsProps = {
  items: Destination[];
  regions: string[];
  seasons: { id: string; label: string }[];
  allLabel?: string;
  storageKey?: string;
  onSave?: (id: string, saved: boolean) => void;
  currency?: string;
  locale?: string;
};

type Sort = "popular" | "price" | "short";

const still = () =>
  typeof window === "undefined" || document.documentElement.dataset.motion === "off" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Entrance once: plays now when already on screen, else on view, and never later than 1.2s. */
function useEnterOnce<T extends Element>() {
  const ref = useRef<T>(null);
  const [state, setState] = useState<"idle" | "wait" | "in">("idle");
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || still()) return;
    const box = el.getBoundingClientRect();
    if (box.top < innerHeight && box.bottom > 0) {
      setState("in");
      return;
    }
    setState("wait");
    const show = () => {
      setState("in");
      io.disconnect();
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && show(), { threshold: 0.1 });
    io.observe(el);
    const t = setTimeout(show, 1200);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return [ref, state] as const;
}

function tokenMs(el: Element, name: string, fallback: number) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n;
}

/** FLIP: cards keyed by data-flip glide from where they were to where they are after `key` changes; new ones fade in. */
function useFlip(host: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const c of cards) {
      const b = c.getBoundingClientRect();
      next.set(c.dataset.flip!, { x: b.left - base.left, y: b.top - base.top });
    }
    if (last.current.size && !still()) {
      const dur = tokenMs(el, "--duration-slow", 320);
      cards.forEach((c, i) => {
        const a = last.current.get(c.dataset.flip!);
        const b = next.get(c.dataset.flip!)!;
        if (!a) {
          c.animate(
            [
              { opacity: 0, transform: "scale(0.96)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: dur, delay: Math.min(i * 30, 150), easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" },
          );
        } else if (a.x !== b.x || a.y !== b.y) {
          c.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: "none" }], {
            duration: dur + 60,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          });
        }
      });
    }
    last.current = next;
  }, [host, key]);
}

function readSaved(key?: string): string[] {
  if (!key) return [];
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const ARTS: MediaArt[] = ["a", "b", "c", "d", "e"];

export function DestinationCards({ items, regions, seasons, allLabel = "All", storageKey, onSave, currency = "USD", locale = "en-US" }: DestinationCardsProps) {
  const uid = useId();
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const [region, setRegion] = useState(allLabel);
  const [season, setSeason] = useState<string | null>(null);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sort, setSort] = useState<Sort>("popular");
  const [saved, setSaved] = useState<string[]>([]);
  const [popped, setPopped] = useState<string | null>(null);
  const grid = useRef<HTMLUListElement>(null);
  const tabs = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState({ x: 0, w: 0 });

  useEffect(() => setSaved(readSaved(storageKey)), [storageKey]);

  const allRegions = [allLabel, ...regions];
  useLayoutEffect(() => {
    const measure = () => {
      const on = tabs.current?.querySelector<HTMLElement>(".fl-dst-tab.is-on");
      if (on) setBar({ x: on.offsetLeft, w: on.offsetWidth });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" && tabs.current ? new ResizeObserver(measure) : null;
    if (ro && tabs.current) ro.observe(tabs.current);
    return () => ro?.disconnect();
  }, [region]);

  const shown = items
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => (region === allLabel || d.region === region) && (!season || d.seasons.includes(season)) && (!onlySaved || saved.includes(d.id)))
    .sort((a, b) => (sort === "price" ? a.d.from - b.d.from : sort === "short" ? a.d.nights - b.d.nights || a.d.from - b.d.from : a.i - b.i))
    .map(({ d }) => d);

  useFlip(grid, `${region}|${season}|${onlySaved}|${sort}|${shown.length}`);

  const toggleSave = (id: string) => {
    const on = !saved.includes(id);
    const next = on ? [...saved, id] : saved.filter((x) => x !== id);
    setSaved(next);
    setPopped(on ? id : null);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Saving still works for this visit when storage is blocked. */
      }
    }
    onSave?.(id, on);
  };

  const clear = () => {
    setRegion(allLabel);
    setSeason(null);
    setOnlySaved(false);
  };

  const seasonLabel = (id: string) => seasons.find((s) => s.id === id)?.label ?? id;
  const cls = ["fl-dst", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ");

  return (
    <div ref={root} className={cls} data-fl="b.destination-cards">
      <div className="fl-dst-bar fl-dst-rise" style={{ "--i": 0 } as CSSProperties}>
        <div ref={tabs} className="fl-dst-tabs" role="radiogroup" aria-label="Region">
          {allRegions.map((r) => (
            <label key={r} className={["fl-dst-tab", region === r ? "is-on" : ""].filter(Boolean).join(" ")}>
              <input type="radio" className="fl-sr" name={`${uid}-region`} checked={region === r} onChange={() => setRegion(r)} />
              {r}
            </label>
          ))}
          <span className="fl-dst-line" aria-hidden="true" style={{ transform: `translateX(${bar.x}px)`, width: bar.w }} />
        </div>
        <div className="fl-dst-tools">
          <div className="fl-dst-chips" role="group" aria-label="Season">
            {seasons.map((s) => (
              <Chip key={s.id} selected={season === s.id} onClick={() => setSeason((x) => (x === s.id ? null : s.id))}>
                {s.label}
              </Chip>
            ))}
            <Chip selected={onlySaved} onClick={() => setOnlySaved((x) => !x)}>
              <Icon name="heart" filled={onlySaved} /> Saved{" "}
              <span key={saved.length} className="fl-dst-count">
                {saved.length}
              </span>
            </Chip>
          </div>
          <label className="fl-dst-sort">
            <span className="fl-sr">Sort</span>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              options={[
                { value: "popular", label: "Most popular" },
                { value: "price", label: "Lowest price" },
                { value: "short", label: "Shortest trip" },
              ]}
            />
          </label>
        </div>
      </div>

      <p className="fl-dst-count-line" aria-live="polite">
        {shown.length} {shown.length === 1 ? "trip" : "trips"}
        {region !== allLabel ? ` in ${region}` : ""}
        {season ? ` for ${seasonLabel(season).toLowerCase()}` : ""}
      </p>

      {shown.length ? (
        <ul ref={grid} className="fl-dst-grid">
          {shown.map((d, i) => {
            const on = saved.includes(d.id);
            return (
              <li key={d.id} data-flip={d.id} className="fl-dst-card fl-dst-rise" style={{ "--i": Math.min(i + 1, 6) } as CSSProperties}>
                <div className="fl-dst-pic">
                  <MediaFrame ratio="4-3" src={d.picture?.src} alt={d.picture?.alt ?? ""} art={ARTS[items.indexOf(d) % ARTS.length]} />
                  <div className="fl-dst-scrim">
                    <p className="fl-dst-blurb">{d.blurb}</p>
                    <ul className="fl-dst-hl">
                      {d.highlights.slice(0, 3).map((h) => (
                        <li key={h}>
                          <Icon name="check" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    className={["fl-dst-save", on ? "is-on" : "", popped === d.id ? "is-pop" : ""].filter(Boolean).join(" ")}
                    aria-pressed={on}
                    aria-label={`Save ${d.name}`}
                    onClick={() => toggleSave(d.id)}
                    onAnimationEnd={() => setPopped(null)}
                  >
                    <Icon name="heart" filled={on} />
                  </button>
                </div>
                <div className="fl-dst-body">
                  <h3 className="fl-dst-name">
                    {d.href ? (
                      <a href={d.href} className="fl-dst-link">
                        {d.name}
                      </a>
                    ) : (
                      d.name
                    )}
                  </h3>
                  <p className="fl-dst-meta">
                    <span>
                      <Icon name="pin" />
                      {d.country}
                    </span>
                    <span>
                      <Icon name="calendar" />
                      {d.nights} nights
                    </span>
                    {d.rating ? (
                      <span>
                        <Icon name="star" filled />
                        {d.rating.toFixed(1)}
                      </span>
                    ) : null}
                  </p>
                  <p className="fl-dst-price">
                    <span>from</span> <strong>{money(d.from)}</strong> <span>per person</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="fl-dst-empty">
          <Icon name="map" />
          <p>
            <strong>No trips match</strong>
            <span>{onlySaved && !saved.length ? "Press a heart to save a trip." : "Try another region or season."}</span>
          </p>
          <Button variant="secondary" size={40} icon="refresh" onClick={clear}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  eyebrow: "Destinations",
  title: "Where to next?",
  lede: "Small-group trips with local guides. Prices include stays, transfers and most meals.",
  regions: ["Europe", "Asia", "Americas", "Africa"],
  seasons: [
    { id: "spring", label: "Spring" },
    { id: "summer", label: "Summer" },
    { id: "fall", label: "Fall" },
    { id: "winter", label: "Winter" },
  ],
  items: [
    {
      id: "amalfi",
      name: "Amalfi Coast walks",
      country: "Italy",
      region: "Europe",
      seasons: ["spring", "fall"],
      from: 248000,
      nights: 7,
      rating: 4.9,
      blurb: "Cliff paths, lemon groves and boat days between villages.",
      highlights: ["Path of the Gods hike", "Cooking class in Ravello", "Boat to Capri"],
      picture: { alt: "Pastel houses stacked above the sea" },
      href: "#amalfi",
    },
    {
      id: "kyoto",
      name: "Kyoto and the Alps",
      country: "Japan",
      region: "Asia",
      seasons: ["spring", "fall"],
      from: 389000,
      nights: 10,
      rating: 4.8,
      blurb: "Temples at dawn, then trains into the Japanese Alps.",
      highlights: ["Ryokan with hot springs", "Nakasendo trail day", "Tea with a local host"],
      picture: { alt: "A wooden temple among red maples" },
      href: "#kyoto",
    },
    {
      id: "patagonia",
      name: "Patagonia trek",
      country: "Chile",
      region: "Americas",
      seasons: ["winter", "spring"],
      from: 412000,
      nights: 9,
      rating: 4.9,
      blurb: "The W Trek with refugio nights and a glacier cruise.",
      highlights: ["Base of the Towers", "Grey Glacier by boat", "Small group of 10"],
      picture: { alt: "Granite peaks over a turquoise lake" },
      href: "#patagonia",
    },
    {
      id: "lapland",
      name: "Lapland lights",
      country: "Finland",
      region: "Europe",
      seasons: ["winter"],
      from: 196000,
      nights: 5,
      rating: 4.7,
      blurb: "Glass-roof cabins, husky sleds and northern lights.",
      highlights: ["Aurora cabin nights", "Husky safari", "Sauna by a frozen lake"],
      picture: { alt: "Green northern lights over snowy pines" },
      href: "#lapland",
    },
    {
      id: "marrakech",
      name: "Marrakech and the Atlas",
      country: "Morocco",
      region: "Africa",
      seasons: ["spring", "fall", "winter"],
      from: 139000,
      nights: 6,
      rating: 4.6,
      blurb: "Riads, souks and a night in a Berber mountain village.",
      highlights: ["Guided medina walk", "Atlas village homestay", "Hammam visit"],
      picture: { alt: "Lanterns in a market alley at dusk" },
      href: "#marrakech",
    },
    {
      id: "bali",
      name: "Bali slow travel",
      country: "Indonesia",
      region: "Asia",
      seasons: ["summer", "fall"],
      from: 172000,
      nights: 8,
      rating: 4.7,
      blurb: "Rice terraces, reef snorkeling and quiet villa days.",
      highlights: ["Sunrise at Batur", "Snorkel at Amed", "Ubud craft villages"],
      picture: { alt: "Green rice terraces with palm trees" },
      href: "#bali",
    },
    {
      id: "rockies",
      name: "Canadian Rockies",
      country: "Canada",
      region: "Americas",
      seasons: ["summer"],
      from: 298000,
      nights: 8,
      rating: 4.8,
      blurb: "Lake Louise, glacier walks and a scenic rail day.",
      highlights: ["Icefields Parkway", "Moraine Lake sunrise", "Rocky Mountaineer rail"],
      picture: { alt: "A turquoise lake below snowy peaks" },
      href: "#rockies",
    },
    {
      id: "safari",
      name: "Serengeti safari",
      country: "Tanzania",
      region: "Africa",
      seasons: ["summer", "winter"],
      from: 465000,
      nights: 7,
      rating: 5.0,
      blurb: "Game drives with tented camps on the migration route.",
      highlights: ["Ngorongoro Crater", "Migration camps", "Private guide and jeep"],
      picture: { alt: "Giraffes on the savanna at sunset" },
      href: "#safari",
    },
  ] as Destination[],
};

export default function DestinationCardsPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="destination-cards-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="destination-cards-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <DestinationCards items={d.items} regions={d.regions} seasons={d.seasons} storageKey="fl-destination-cards-saved" />
      </div>
    </section>
  );
}
