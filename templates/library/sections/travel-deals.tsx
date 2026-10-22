/** @flowcode-library travel-deals · Travel deals with countdown (Shop)
 * Catalog ID: b.travel-deals (block)
 * Function: The travel deals block (b.travel-deals): a limited-time sale with a live countdown to its end, a promo code you copy, and a strip of deal cards (was and now price, percent off, departure, seats left) you scroll with Previous and Next; when the sale ends it says so and the deals close.
 * Use it as: import { TravelDeals } from "./travel-deals"; <TravelDeals endsAt="2026-10-24T06:59:00Z" label?="Fall flash sale" code?={{ code: "FALL24", note: "Extra $50 off" }} deals={[{ id, destination, kind: "Flight + hotel", nights, departs: ISO, was: 189000 (cents), now: 129000, seatsLeft?: 4, seats?: 20, picture?: { src?, alt }, href }]} onCopy?={async (code) => ...} onEnd?={() => ...} currency?="USD" />  // use the sale's real end time and prices
 * Built from: c.media-frame, c.button.primary, c.button.secondary
 * Look: A white band with the sale's name and "Ends in" beside four square tiles (days, hours, minutes, seconds) whose digits roll as they change, and a dashed promo-code pill with Copy. Under it a sideways strip of white deal cards: a rounded picture with a percent-off badge, the destination, trip kind, nights and date, the old price with a line drawn through it beside the new price in bold, a thin "4 seats left" bar and View deal. Round Previous and Next buttons sit at the strip's top right.
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-danger --color-success --color-warning --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --text-xs --text-sm --text-md --text-lg --text-xl --text-2xl --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: travel flash sale; last-minute deals; holiday offers; limited-time promotion; airline fare sale; hotel deals; tour discounts; black friday travel
 * Jobs to be done: see the best current trip deals; know how long the sale lasts; get the promo code; compare savings at a glance; book before seats run out
 * Keywords: travel, deals, sale, countdown, timer, discount, promo code, flash sale, offers, last minute, carousel, price drop, seats left
 */
/**
 * Travel deals: a sale strip that earns its urgency honestly. The countdown ticks every second to the real end time;
 * each digit rolls as it changes, screen readers get one calm sentence instead of a ticking timer. Copy puts the code on
 * the clipboard and says Copied. The deal cards lift on hover; their old prices get a line drawn through them and the
 * percent badges pop in once as the block enters. Previous and Next scroll the strip by a card and turn off at the
 * ends; the strip also scrolls by touch and keyboard. At zero the countdown says the sale has ended, the cards close
 * and onEnd fires once. Make it the app's own: replace SAMPLE with the real sale, end time and prices.
 * Adapted from AstroWind (MIT, Copyright (c) 2023 onWidget): its Countdown widget (time units to a set date, an
 * "ended" message after it).
 */
/**
 * How to try it
 * - Watch the countdown: the seconds digits roll every second.
 * - Press Copy: the code is copied and the button says Copied.
 * - Press Next and Previous: the strip glides a card at a time; each turns off at its end.
 * - Hover a card: it lifts and its picture zooms a little.
 * - Set endsAt a few seconds ahead: at zero it says "This sale has ended" and View deal turns off.
 * - Narrow the window to a phone: the countdown wraps under the title and one and a bit cards show.
 *
 * Dependencies: React (useEffect, useId, useRef, useState), the library's MediaFrame and Button ("./media-frames",
 * "./buttons-variants") and its inline icon set ("./icons"). Nothing else: no package and nothing fetched. The styles
 * are the library's own fl- classes in templates/library/css/r6d-travel-deals.css.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { MediaFrame, type MediaArt } from "./media-frames";

export type TravelDeal = {
  id: string;
  destination: string;
  kind: string;
  nights: number;
  departs: string;
  /** Cents. */
  was: number;
  now: number;
  seats?: number;
  seatsLeft?: number;
  picture?: { src?: string; alt: string };
  href: string;
};

export type TravelDealsProps = {
  endsAt: string;
  label?: string;
  code?: { code: string; note?: string };
  deals: TravelDeal[];
  onCopy?: (code: string) => Promise<void> | void;
  onEnd?: () => void;
  currency?: string;
  locale?: string;
};

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

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (!ok) throw new Error("copy failed");
  }
}

/** One countdown tile; the digits roll when the value changes. */
function Unit({ value, label }: { value: number; label: string }) {
  const text = String(value).padStart(2, "0");
  return (
    <span className="fl-tdl-unit">
      <span className="fl-tdl-digits">
        <span key={text} className="fl-tdl-roll">
          {text}
        </span>
      </span>
      <span className="fl-tdl-unit-label">{label}</span>
    </span>
  );
}

const ARTS: MediaArt[] = ["d", "a", "e", "b", "c"];

export function TravelDeals({ endsAt, label = "Flash sale", code, deals, onCopy, onEnd, currency = "USD", locale = "en-US" }: TravelDealsProps) {
  const uid = useId();
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const strip = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const ended = Number.isFinite(end) && now >= end;
  const fired = useRef(false);

  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ended]);

  useEffect(() => {
    if (ended && !fired.current) {
      fired.current = true;
      onEnd?.();
    }
  }, [ended, onEnd]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const left = Math.max(0, Math.floor((end - now) / 1000));
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const plain =
    d > 0 ? `${d} ${d === 1 ? "day" : "days"} ${h} ${h === 1 ? "hour" : "hours"}` : h > 0 ? `${h} ${h === 1 ? "hour" : "hours"} ${m} min` : `${m} min`;

  const measure = () => {
    const el = strip.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };
  useEffect(() => {
    measure();
    const el = strip.current;
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(measure) : null;
    if (ro && el) ro.observe(el);
    return () => ro?.disconnect();
  }, [deals.length]);

  const step = (dir: 1 | -1) => {
    const el = strip.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".fl-tdl-card");
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: dir * ((card?.offsetWidth ?? el.clientWidth) + gap), behavior: still() ? "auto" : "smooth" });
  };

  const copy = async () => {
    if (!code) return;
    try {
      if (onCopy) await onCopy(code.code);
      else await copyText(code.code);
      setCopied(true);
      setStatus(`Code ${code.code} copied.`);
    } catch {
      setStatus(`Couldn't copy. The code is ${code.code}.`);
    }
  };

  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
  const cls = ["fl-tdl", ended ? "is-ended" : "", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ");

  return (
    <div ref={root} className={cls} data-fl="b.travel-deals">
      <div className="fl-tdl-band fl-tdl-rise" style={{ "--i": 0 } as CSSProperties}>
        <div className="fl-tdl-sale">
          <span className="fl-tdl-flag">
            <Icon name="bolt" filled />
            {label}
          </span>
          {ended ? (
            <p className="fl-tdl-over">This sale has ended.</p>
          ) : (
            <div className="fl-tdl-timer">
              <span className="fl-tdl-ends" id={`${uid}-ends`}>
                Ends in
              </span>
              <span className="fl-tdl-units" aria-hidden="true">
                <Unit value={d} label="Days" />
                <Unit value={h} label="Hrs" />
                <Unit value={m} label="Min" />
                <Unit value={s} label="Sec" />
              </span>
              <span className="fl-sr">
                Ends in {plain}, on{" "}
                {new Date(end).toLocaleString(locale, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}.
              </span>
            </div>
          )}
        </div>
        {code && !ended ? (
          <div className="fl-tdl-code">
            <span className="fl-tdl-code-text">
              <span className="fl-tdl-code-label">{code.note ?? "Use code"}</span>
              <code>{code.code}</code>
            </span>
            <Button variant="secondary" size={40} icon={copied ? "check" : "copy"} onClick={copy} className={copied ? "fl-tdl-copied" : undefined}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="fl-tdl-strip-head fl-tdl-rise" style={{ "--i": 1 } as CSSProperties}>
        <p className="fl-tdl-count">
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
        </p>
        <div className="fl-tdl-nav">
          <Button variant="secondary" size={40} icon="chevron-left" iconOnly onClick={() => step(-1)} disabled={edge.start} aria-controls={`${uid}-strip`}>
            Previous deals
          </Button>
          <Button variant="secondary" size={40} icon="chevron-right" iconOnly onClick={() => step(1)} disabled={edge.end} aria-controls={`${uid}-strip`}>
            Next deals
          </Button>
        </div>
      </div>

      <ul id={`${uid}-strip`} ref={strip} className="fl-tdl-strip" onScroll={measure} tabIndex={0} aria-label="Deals">
        {deals.map((x, i) => {
          const off = x.was > 0 ? Math.round((1 - x.now / x.was) * 100) : 0;
          const few = x.seatsLeft !== undefined && x.seatsLeft <= 5;
          return (
            <li key={x.id} className="fl-tdl-card fl-tdl-rise" style={{ "--i": Math.min(i + 2, 6) } as CSSProperties}>
              <div className="fl-tdl-pic">
                <MediaFrame ratio="16-9" src={x.picture?.src} alt={x.picture?.alt ?? ""} art={ARTS[i % ARTS.length]} />
                {off > 0 ? <span className="fl-tdl-off">−{off}%</span> : null}
              </div>
              <div className="fl-tdl-body">
                <h3 className="fl-tdl-dest">{x.destination}</h3>
                <p className="fl-tdl-meta">
                  {x.kind} · {x.nights} nights · Departs {day(x.departs)}
                </p>
                <p className="fl-tdl-price">
                  <s className="fl-tdl-was" aria-hidden="true">
                    {money(x.was)}
                  </s>
                  <strong className="fl-tdl-now" aria-hidden="true">
                    {money(x.now)}
                  </strong>
                  <span className="fl-sr">
                    Was {money(x.was)}, now {money(x.now)}, {off}% off.
                  </span>
                  <span className="fl-tdl-pp">per person</span>
                </p>
                {x.seatsLeft !== undefined ? (
                  <div className={["fl-tdl-seats", few ? "is-few" : ""].filter(Boolean).join(" ")}>
                    <span>{x.seatsLeft === 0 ? "Sold out" : `${x.seatsLeft} ${x.seatsLeft === 1 ? "seat" : "seats"} left`}</span>
                    {x.seats ? (
                      <span className="fl-tdl-seat-bar" aria-hidden="true">
                        <span style={{ "--fill": Math.min(1, (x.seats - x.seatsLeft) / x.seats) } as CSSProperties} />
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {ended || x.seatsLeft === 0 ? (
                  <Button variant="secondary" size={40} disabled block>
                    {ended ? "Sale ended" : "Sold out"}
                  </Button>
                ) : (
                  <Button href={x.href} variant="primary" size={40} icon="arrow" iconAt="end" block aria-label={`View deal: ${x.destination}`}>
                    View deal
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="fl-sr" role="status" aria-live="polite">
        {ended ? "This sale has ended." : status}
      </p>
    </div>
  );
}

const fromNow = (days: number, hours = 0) => new Date(Date.now() + (days * 24 + hours) * 3600000).toISOString();

// flowcode:sample
const SAMPLE = {
  eyebrow: "Deals",
  title: "Last-minute fall getaways",
  lede: "Hand-picked trips with seats to fill. Prices drop until the timer runs out.",
  label: "Fall flash sale",
  endsAt: fromNow(2, 7),
  code: { code: "FALL50", note: "Extra $50 off with" },
  deals: [
    {
      id: "lisbon",
      destination: "Lisbon and Sintra",
      kind: "Flight + hotel",
      nights: 5,
      departs: fromNow(12),
      was: 168000,
      now: 112900,
      seats: 24,
      seatsLeft: 3,
      picture: { alt: "Yellow tram on a steep Lisbon street" },
      href: "#lisbon",
    },
    {
      id: "cancun",
      destination: "Tulum beach week",
      kind: "All-inclusive",
      nights: 7,
      departs: fromNow(18),
      was: 214000,
      now: 159900,
      seats: 30,
      seatsLeft: 9,
      picture: { alt: "White sand beach with palm trees" },
      href: "#tulum",
    },
    {
      id: "iceland",
      destination: "Iceland ring road",
      kind: "Self-drive tour",
      nights: 8,
      departs: fromNow(25),
      was: 289000,
      now: 219000,
      seats: 16,
      seatsLeft: 5,
      picture: { alt: "A waterfall over black cliffs" },
      href: "#iceland",
    },
    {
      id: "hanoi",
      destination: "Hanoi and Ha Long Bay",
      kind: "Small-group tour",
      nights: 9,
      departs: fromNow(31),
      was: 248000,
      now: 179500,
      seats: 14,
      seatsLeft: 2,
      picture: { alt: "Limestone islands in a green bay" },
      href: "#hanoi",
    },
    {
      id: "napa",
      destination: "Napa harvest weekend",
      kind: "Hotel + tastings",
      nights: 3,
      departs: fromNow(9),
      was: 98000,
      now: 72900,
      seats: 20,
      seatsLeft: 11,
      picture: { alt: "Vineyard rows in autumn colors" },
      href: "#napa",
    },
  ] as TravelDeal[],
};

export default function TravelDealsPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="travel-deals-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="travel-deals-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <TravelDeals endsAt={d.endsAt} label={d.label} code={d.code} deals={d.deals} />
      </div>
    </section>
  );
}
