/** @flowcode-library fundraising-progress · Fundraising progress (Stats)
 * Catalog ID: b.fundraising-progress (block)
 * Function: The fundraising progress block (b.fundraising-progress): a campaign's raised amount against its goal as a filling bar with milestone ticks, donors, percent and days left that count up, the milestones it unlocks, Give and Share, and recent supporters you can sort by newest or largest and open in full.
 * Use it as: import { FundraisingProgress } from "./fundraising-progress"; <FundraisingProgress campaign={{ title, raised: 8412000 (cents), goal: 12000000, donors: 1284, endsAt: "2026-11-30T23:59:00Z", match?: { by: "Hart Family Fund", upTo: 2500000 } }} milestones?={[{ id, at: 5000000, label }]} supporters={[{ id, name, amount (cents), at: ISO, note?, monthly? }]} give?={{ label, href }} shareUrl? onShare?={async (url) => ...} visible?={4} currency?="USD" now?={new Date()} />  // use the campaign's real totals
 * Built from: c.button.primary, c.button.secondary, c.animated-number, c.avatar.initials
 * Look: A white card. On top a large bold raised figure with "raised of $120,000" beside it and three small figures (donors, percent, days left) to the right; under them a thick rounded track with an accent fill and thin straight ticks where the milestones sit, then the milestones as a row of small items with a check when reached, Give and Share buttons. Under the card, "Recent supporters" with a pill switch (Newest / Largest) whose thumb slides, rows of initials, name, note, time and a bold amount, and "Show all".
 * Tokens: --color-accent --color-accent-hover --color-on-accent --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-success --surface-bg --surface-radius --surface-shadow --pill-radius --radius-sm --radius-md --space-1 --space-2 --space-3 --space-4 --space-5 --space-6 --space-7 --text-xs --text-sm --text-md --text-lg --text-2xl --text-3xl --font-display --weight-semibold --weight-bold --duration-fast --duration-base --duration-slow --ease-out --ease-spring --enter-distance --stagger --stagger-max --focus-ring
 * Use cases: fundraising campaign; donation thermometer; nonprofit appeal; giving day; crowdfunding progress; matching gift campaign; capital campaign; impact tracker
 * Jobs to be done: see how close the campaign is to its goal; see that other people are giving; know how long is left; share the campaign; give now
 * Keywords: fundraising, goal, progress, thermometer, donors, raised, campaign, supporters, milestones, match, nonprofit, charity, share
 */
/**
 * Fundraising progress: the proof a giving page needs. The raised amount, donors and percent count up the first time
 * the card is on screen while the bar fills to the same point; milestone ticks light up as the fill passes them. Share
 * copies the campaign link and says so. Recent supporters switch between Newest and Largest with a sliding thumb, and
 * the rows glide to their new places (FLIP); Show all opens the rest with a grid-rows reveal, inert while closed.
 * Make it the app's own: replace SAMPLE with the campaign's real totals and supporters (only those who agreed to be
 * named).
 * Adapted from AstroWind (MIT, Copyright (c) 2023 onWidget): its Stats widget (figures that count up once in view).
 */
/**
 * How to try it
 * - Load the page: the raised figure, donors and percent count up and the bar fills; reached milestones light up.
 * - Press Largest: the thumb slides and the supporter rows glide into order by amount. Newest puts them back.
 * - Press Show all: the rest of the supporters open below; Show fewer closes them.
 * - Press Share: the link is copied and the button says Copied for a moment.
 * - Narrow the window to a phone: the figures wrap under the raised amount and the milestones stack.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useRef, useState), the library's Button and AnimatedNumber
 * ("./buttons-variants", "./data-animated-number") and its inline icon set ("./icons"). Nothing else: no package and
 * nothing fetched. The styles are the library's own fl- classes in templates/library/css/r6d-fundraising-progress.css.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { AnimatedNumber } from "./data-animated-number";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";

export type Supporter = { id: string; name: string; amount: number; at: string; note?: string; monthly?: boolean };
export type FundraisingMilestone = { id: string; at: number; label: string };

export type FundraisingProgressProps = {
  campaign: {
    title?: string;
    /** Cents. */
    raised: number;
    goal: number;
    donors: number;
    endsAt?: string;
    match?: { by: string; upTo: number };
  };
  milestones?: FundraisingMilestone[];
  supporters: Supporter[];
  supportersTitle?: string;
  give?: { label: string; href: string };
  shareUrl?: string;
  onShare?: (url: string) => Promise<void> | void;
  /** Rows shown before Show all. */
  visible?: number;
  currency?: string;
  locale?: string;
  now?: Date;
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

/** A CSS duration token in ms, for the Web Animations the FLIP glide uses. */
function tokenMs(el: Element, name: string, fallback: number) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith("ms") ? n : v.endsWith("s") ? n * 1000 : n;
}

/** FLIP: rows keyed by data-flip glide from where they were to where they are after `key` changes. */
function useFlip(host: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, { x: number; y: number; hidden: boolean }>());
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number; hidden: boolean }>();
    const rows = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      next.set(r.dataset.flip!, { x: b.left - base.left, y: b.top - base.top, hidden: !!r.closest("[inert]") });
    }
    if (last.current.size && !still()) {
      const dur = tokenMs(el, "--duration-slow", 320);
      for (const r of rows) {
        const a = last.current.get(r.dataset.flip!);
        const b = next.get(r.dataset.flip!)!;
        if (b.hidden) continue;
        if (!a || a.hidden) {
          r.animate(
            [
              { opacity: 0, transform: "translateY(6px)" },
              { opacity: 1, transform: "none" },
            ],
            { duration: dur, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
          );
        } else if (a.x !== b.x || a.y !== b.y) {
          r.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: "none" }], {
            duration: dur,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          });
        }
      }
    }
    last.current = next;
  }, [host, key]);
}

/** Clipboard API first; a selected hidden field as the fallback where the API is blocked. */
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

function ago(iso: string, now: Date) {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

export function FundraisingProgress({
  campaign,
  milestones = [],
  supporters,
  supportersTitle = "Recent supporters",
  give,
  shareUrl,
  onShare,
  visible = 4,
  currency = "USD",
  locale = "en-US",
  now = new Date(),
}: FundraisingProgressProps) {
  const uid = useId();
  const money = (c: number) => (c / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const [root, enter] = useEnterOnce<HTMLDivElement>();
  const [order, setOrder] = useState<"newest" | "largest">("newest");
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const list = useRef<HTMLDivElement>(null);

  const pct = campaign.goal > 0 ? Math.min(100, (campaign.raised / campaign.goal) * 100) : 0;
  const daysLeft = campaign.endsAt ? Math.max(0, Math.ceil((new Date(campaign.endsAt).getTime() - now.getTime()) / 86400000)) : null;
  // The bar starts empty and fills once the card has entered; with motion off it is full at once.
  const [calm, setCalm] = useState(false);
  useEffect(() => setCalm(still() || !("IntersectionObserver" in window)), []);
  const filled = enter === "in" || calm;

  const sorted = [...supporters].sort((a, b) => (order === "newest" ? b.at.localeCompare(a.at) : b.amount - a.amount));
  const first = sorted.slice(0, visible);
  const rest = sorted.slice(visible);
  useFlip(list, `${order}-${all}`);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = shareUrl ?? (typeof location !== "undefined" ? location.href : "");
    try {
      if (onShare) await onShare(url);
      else await copyText(url);
      setCopied(true);
      setStatus("Link copied.");
    } catch {
      setStatus(`Couldn't copy. The link is ${url}`);
    }
  };

  const row = (s: Supporter) => (
    <li key={s.id} data-flip={s.id} className="fl-fgp-row">
      <span className="fl-fgp-avatar" aria-hidden="true" data-fl="c.avatar.initials">
        {initials(s.name)}
      </span>
      <span className="fl-fgp-who">
        <span className="fl-fgp-name">
          {s.name}
          {s.monthly ? <span className="fl-fgp-badge">Monthly</span> : null}
        </span>
        {s.note ? <span className="fl-fgp-note">{s.note}</span> : null}
      </span>
      <span className="fl-fgp-amt">
        <strong>{money(s.amount)}</strong>
        <time dateTime={s.at}>{ago(s.at, now)}</time>
      </span>
    </li>
  );

  const cls = ["fl-fgp", enter === "wait" ? "is-waiting" : "", enter === "in" ? "is-entering" : ""].filter(Boolean).join(" ");
  return (
    <div ref={root} className={cls} data-fl="b.fundraising-progress">
      <div className="fl-fgp-card fl-fgp-rise" style={{ "--i": 0 } as CSSProperties}>
        {campaign.title ? <h3 className="fl-fgp-title">{campaign.title}</h3> : null}
        <div className="fl-fgp-top">
          <p className="fl-fgp-raised">
            <AnimatedNumber value={campaign.raised / 100} format={(v) => money(Math.round(v) * 100)} duration={1100} className="fl-fgp-big" />
            <span className="fl-fgp-of">raised of {money(campaign.goal)}</span>
          </p>
          <dl className="fl-fgp-figs">
            <div className="fl-fgp-rise" style={{ "--i": 1 } as CSSProperties}>
              <dt>Donors</dt>
              <dd>
                <AnimatedNumber value={campaign.donors} className="fl-fgp-fig" />
              </dd>
            </div>
            <div className="fl-fgp-rise" style={{ "--i": 2 } as CSSProperties}>
              <dt>Of goal</dt>
              <dd>
                <AnimatedNumber value={pct} format={(v) => `${Math.round(v)}%`} className="fl-fgp-fig" />
              </dd>
            </div>
            {daysLeft !== null ? (
              <div className="fl-fgp-rise" style={{ "--i": 3 } as CSSProperties}>
                <dt>{daysLeft === 1 ? "Day left" : "Days left"}</dt>
                <dd>
                  <AnimatedNumber value={daysLeft} className="fl-fgp-fig" />
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div
          className="fl-fgp-track"
          role="progressbar"
          aria-label="Raised so far"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-valuetext={`${money(campaign.raised)} of ${money(campaign.goal)}`}
        >
          <span className="fl-fgp-fill" style={{ width: filled ? `${pct}%` : 0 }} />
          {milestones.map((m, i) => {
            const at = Math.min(100, (m.at / campaign.goal) * 100);
            return (
              <span
                key={m.id}
                className={["fl-fgp-tick", filled && campaign.raised >= m.at ? "is-hit" : ""].filter(Boolean).join(" ")}
                style={{ left: `${at}%`, "--d": `${Math.round(at * 9)}ms`, "--j": i } as CSSProperties}
                aria-hidden="true"
              />
            );
          })}
        </div>

        {campaign.match ? (
          <p className="fl-fgp-match">
            <Icon name="sparkle" />
            <span>
              Gifts are matched by <strong>{campaign.match.by}</strong>, up to {money(campaign.match.upTo)}.
            </span>
          </p>
        ) : null}

        {milestones.length ? (
          <ol className="fl-fgp-miles" aria-label="Milestones">
            {milestones.map((m, i) => {
              const hit = campaign.raised >= m.at;
              return (
                <li key={m.id} className={hit ? "is-hit" : undefined} style={{ "--j": i } as CSSProperties}>
                  <span className="fl-fgp-mark" aria-hidden="true">
                    <Icon name={hit ? "check" : "dot"} />
                  </span>
                  <span>
                    <strong>{money(m.at)}</strong> {m.label}
                    <span className="fl-sr">{hit ? " (reached)" : " (not yet)"}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        <div className="fl-fgp-actions">
          {give ? (
            <Button href={give.href} icon="heart" size={48}>
              {give.label}
            </Button>
          ) : null}
          <Button variant="secondary" size={48} icon={copied ? "check" : "share"} onClick={share} className={copied ? "fl-fgp-copied" : undefined}>
            {copied ? "Copied" : "Share"}
          </Button>
        </div>
        <p className="fl-sr" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      <section className="fl-fgp-people fl-fgp-rise" style={{ "--i": 4 } as CSSProperties} aria-labelledby={`${uid}-s`}>
        <div className="fl-fgp-people-head">
          <h3 id={`${uid}-s`} className="fl-fgp-h">
            {supportersTitle}
          </h3>
          <div className="fl-fgp-switch" role="radiogroup" aria-label="Sort supporters" style={{ "--at": order === "largest" ? 1 : 0 } as CSSProperties}>
            <span className="fl-fgp-thumb" aria-hidden="true" />
            {(["newest", "largest"] as const).map((o) => (
              <label key={o} className={order === o ? "is-on" : undefined}>
                <input type="radio" className="fl-sr" name={`${uid}-o`} checked={order === o} onChange={() => setOrder(o)} />
                {o === "newest" ? "Newest" : "Largest"}
              </label>
            ))}
          </div>
        </div>
        {supporters.length ? (
          <div ref={list}>
            <ul className="fl-fgp-list">{first.map(row)}</ul>
            {rest.length ? (
              <>
                <div id={`${uid}-more`} className={["fl-fgp-reveal", all ? "is-open" : ""].filter(Boolean).join(" ")}>
                  <div className="fl-fgp-reveal-in" inert={!all}>
                    <ul className="fl-fgp-list">{rest.map(row)}</ul>
                  </div>
                </div>
                <button type="button" className="fl-fgp-more" aria-expanded={all} aria-controls={`${uid}-more`} onClick={() => setAll((a) => !a)}>
                  {all ? "Show fewer" : `Show all ${supporters.length}`}
                  <Icon name="chevron-down" />
                </button>
              </>
            ) : null}
          </div>
        ) : (
          <p className="fl-fgp-empty">Be the first to give.</p>
        )}
      </section>
    </div>
  );
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const daysAhead = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

// flowcode:sample
const SAMPLE = {
  eyebrow: "Winter appeal",
  title: "Warm coats for every kid in Eastfield",
  lede: "We're buying new coats, boots and gloves for children in the district's free lunch program.",
  campaign: {
    title: "Winter Coat Drive 2026",
    raised: 8412000,
    goal: 12000000,
    donors: 1284,
    endsAt: daysAhead(19),
    match: { by: "the Hart Family Fund", upTo: 2500000 },
  },
  milestones: [
    { id: "m1", at: 3000000, label: "coats for 400 kids" },
    { id: "m2", at: 7500000, label: "boots and gloves too" },
    { id: "m3", at: 12000000, label: "every school in the district" },
  ],
  supporters: [
    { id: "s1", name: "Priya Shah", amount: 5000, at: minsAgo(4), note: "For Ms. Lopez's class", monthly: false },
    { id: "s2", name: "Marcus Bell", amount: 2500, at: minsAgo(22), monthly: true },
    { id: "s3", name: "Eastfield Rotary", amount: 100000, at: minsAgo(95), note: "Proud to help" },
    { id: "s4", name: "Jen Okafor", amount: 7500, at: minsAgo(180) },
    { id: "s5", name: "Tom and Lia Reyes", amount: 25000, at: minsAgo(320), note: "In memory of Grandpa Joe" },
    { id: "s6", name: "Dana Kim", amount: 1500, at: minsAgo(610), monthly: true },
    { id: "s7", name: "Northside Bakery", amount: 50000, at: minsAgo(1500) },
    { id: "s8", name: "Sam Patel", amount: 4000, at: minsAgo(2900) },
  ],
};

export default function FundraisingProgressPreview() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="fundraising-progress-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="fundraising-progress-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <FundraisingProgress
          campaign={d.campaign}
          milestones={d.milestones}
          supporters={d.supporters}
          give={{ label: "Give now", href: "#give" }}
          shareUrl="https://example.org/coat-drive"
        />
      </div>
    </section>
  );
}
