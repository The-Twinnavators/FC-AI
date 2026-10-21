/** @flowcode-library event-listing · Event listing with RSVP (Cards)
 * Catalog ID: b.event-listing (block)
 * Function: A list of upcoming local events (b.event-listing) with a search box, date and category filters and a "My RSVPs" view; each card shows the date, time, place, price and how full it is, opens its details, and takes an RSVP for a party (capped by the spots left) or a place on the waitlist once it is full, with cancel after a confirm.
 * Use it as: import { EventListing } from "./event-listing"; <EventListing title lede? categories={["Music","Food"]} events={[{ id, title, category, start: "2026-10-24T19:00", minutes, venue, host, summary, price(cents), capacity, going, waitlist, art?: "a"|"b"|"c"|"d"|"e" }]} maxParty?={4} loading? onRsvp?={async ({ eventId, name, email, party, waitlist }) => ({ ref })} onCancel?={async (eventId) => ...} />
 * Built from: c.text-field.outlined, c.segmented.segmented, c.quantity, c.badge.status, c.media-frame, c.modal.form, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A gray page with one white card: the title, a search field, a date segmented control and category pills, then a column of event cards. Each card has a stacked date (weekday over a straight rule, day number, month), a square picture, the category, title, time and place, a straight capacity bar with "12 spots left", the price and an RSVP button; Details opens the description under it. Going and waitlist show as tinted badges with a Cancel link.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --easing --enter-distance --stagger
 * Use cases: event listing; community calendar; venue events page; meetups; workshops and classes; local happenings; RSVP list
 * Jobs to be done: find something to do this week; see if there is room before I plan; save a spot for me and a friend; get on the waitlist when it is full; cancel if I can't make it
 * Keywords: events, listing, rsvp, capacity, waitlist, filter, category, date, free, tickets, local, community
 */
/**
 * Event listing with RSVP: a venue's or a neighborhood's upcoming events, soonest first. The search matches title,
 * venue and host; the date control narrows to this week, the weekend or the next 30 days; category pills can be
 * combined; "My RSVPs" shows only what you are going to or waiting for. Cards glide into place when the list changes
 * and the count is read out. RSVP opens a short form (name, email, party size up to the spots left); a full event
 * offers the waitlist instead and says your place in line. Your RSVP shows on the card with Cancel, which asks first
 * and gives the spots back. Prices are in cents; 0 is Free. Make it the app's own: replace SAMPLE with the events and
 * make onRsvp and onCancel call the real booking service.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren): its blog block with a stacked date column.
 */
/**
 * How to try it
 * - Type "park" in Search: the cards glide and the count is read. Clear it.
 * - Pick This weekend, then the Music pill: the list narrows. Pick a filter with nothing in it: Clear filters shows.
 * - Press Details on a card: the description opens; press it again to close.
 * - RSVP to an event with spots, press RSVP with the fields empty: the errors show. Fill them, set 2 people, RSVP.
 * - Use an email starting with "fail" (fail@example.com): the save fails and the form stays filled.
 * - On a full event press Join waitlist: you get a place in line. Press Cancel on a card: it asks first.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's TextField,
 * Segmented, Quantity, Badge, MediaFrame, Modal and Button ("./text-fields-states", "./segmented-control",
 * "./input-quantity", "./badges-status", "./media-frames", "./modals-dialogs", "./buttons-variants") and its inline icon
 * set ("./icons"). Nothing else: no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css/r4b-event-listing.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.event-listing: upcoming events with filters, capacity, RSVP and waitlist. ──

export type EventItem = {
  id: string;
  title: string;
  category: string;
  /** Local start, "YYYY-MM-DDTHH:MM". */
  start: string;
  minutes: number;
  venue: string;
  host: string;
  summary: string;
  /** cents; 0 is free */
  price: number;
  capacity: number;
  going: number;
  waitlist: number;
  art?: MediaArt;
};
export type RsvpRequest = { eventId: string; name: string; email: string; party: number; waitlist: boolean };
type Mine = { kind: "going" | "waitlist"; party: number; place?: number; ref: string };
type When = "any" | "week" | "weekend" | "month";

export type EventListingProps = {
  title: string;
  lede?: string;
  categories: string[];
  events: EventItem[];
  /** Most people one RSVP can hold. */
  maxParty?: number;
  /** Shows placeholder cards while the events load. */
  loading?: boolean;
  currency?: string;
  locale?: string;
  /** Saves an RSVP or a waitlist place; throw to show the error in the form. A test stand-in when left out. */
  onRsvp?: (req: RsvpRequest) => Promise<{ ref: string }>;
  onCancel?: (eventId: string) => Promise<void>;
};

const SPOTS_FEW = 5;

function motionOff() {
  if (typeof window === "undefined") return true;
  return document.documentElement.dataset.motion === "off" || Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}
function tokenMs(name: string, fallback: number) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return raw.endsWith("ms") ? n : raw.endsWith("s") ? n * 1000 : n;
}
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** FLIP: cards marked data-flip glide from where they were to where they are now whenever `key` changes. */
function useFlip(box: RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const now = new Map<string, number>();
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-flip]"));
    for (const n of nodes) now.set(n.dataset.flip!, n.getBoundingClientRect().top - top);
    if (!motionOff()) {
      for (const n of nodes) {
        const was = last.current.get(n.dataset.flip!);
        const dy = was === undefined ? 0 : was - now.get(n.dataset.flip!)!;
        if (dy) n.animate([{ translate: `0 ${dy}px` }, { translate: "0 0" }], { duration: tokenMs("--duration-slow", 320), easing: "cubic-bezier(0.2, 0, 0, 1)" });
      }
    }
    last.current = now;
  }, [key, box]);
}

/** Focuses an element once React has drawn it. */
function useFocusLater() {
  const want = useRef<(() => HTMLElement | null | undefined) | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const find = want.current;
    if (!find) return;
    const el = find();
    if (el) {
      want.current = null;
      el.focus();
    }
  });
  return (find: () => HTMLElement | null | undefined) => {
    want.current = find;
    setTick((t) => t + 1);
  };
}

const parseLocal = (s: string) => {
  const [d, t = "00:00"] = s.split("T");
  const [y, m, day] = d!.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  return new Date(y!, m! - 1, day!, hh!, mm!);
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function inWindow(start: Date, when: When, now: Date) {
  if (when === "any") return true;
  const today = startOfDay(now);
  const diff = (startOfDay(start).getTime() - today.getTime()) / 86400000;
  if (when === "week") return diff >= 0 && diff < 7;
  if (when === "month") return diff >= 0 && diff < 30;
  // The coming weekend: Saturday and Sunday (today counts when it is one of them).
  const dow = today.getDay();
  const toSat = dow === 0 ? -1 : 6 - dow;
  return diff >= toSat && diff <= toSat + 1;
}

async function testRsvp(req: RsvpRequest) {
  await wait(900);
  if (req.email.trim().toLowerCase().startsWith("fail")) throw new Error("We couldn't save that. Check your connection and try again.");
  return { ref: `RS-${String(Date.now()).slice(-4)}` };
}
async function testCancel() {
  await wait(600);
}

export function EventListing({ title, lede, categories, events: given, maxParty = 4, loading, currency = "USD", locale = "en-US", onRsvp = testRsvp, onCancel = testCancel }: EventListingProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const list = useRef<HTMLOListElement>(null);
  const [events, setEvents] = useState(given);
  const [mine, setMine] = useState<Record<string, Mine>>({});
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<When>("any");
  const [cats, setCats] = useState<string[]>([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [rsvpFor, setRsvpFor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [party, setParty] = useState(1);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [said, setSaid] = useState("");
  const [now] = useState(() => new Date());

  const money = (cents: number) => (cents === 0 ? "Free" : (cents / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 }));
  const fmtWeek = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const fmtMonth = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short" }), [locale]);
  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }), [locale]);

  const q = query.trim().toLowerCase();
  const shown = events
    .filter((e) => {
      if (q && ![e.title, e.venue, e.host, e.category].some((s) => s.toLowerCase().includes(q))) return false;
      if (cats.length && !cats.includes(e.category)) return false;
      if (onlyMine && !mine[e.id]) return false;
      return inWindow(parseLocal(e.start), when, now);
    })
    .sort((a, b) => a.start.localeCompare(b.start));
  const key = shown.map((e) => e.id).join("|");
  useFlip(list, key);

  // The count is read out after the list changes (not on first draw).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSaid(shown.length === 0 ? "No events match." : shown.length === 1 ? "1 event." : `${shown.length} events.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const filtered = Boolean(q) || when !== "any" || cats.length > 0 || onlyMine;
  const clear = () => {
    setQuery("");
    setWhen("any");
    setCats([]);
    setOnlyMine(false);
    focusLater(() => document.getElementById(`${uid}-q`));
  };
  const toggleCat = (c: string) => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const toggleOpen = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const left = (e: EventItem) => Math.max(0, e.capacity - e.going);
  const active = rsvpFor ? events.find((e) => e.id === rsvpFor) : undefined;
  const activeFull = active ? left(active) === 0 : false;
  const partyMax = active ? (activeFull ? maxParty : Math.min(maxParty, left(active))) : maxParty;

  const startRsvp = (id: string) => {
    setRsvpFor(id);
    setParty(1);
    setErrors({});
    setFormError("");
  };

  const submit = async () => {
    if (!active || busy) return;
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Enter your name.";
    if (!email.trim()) e.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = "Enter an email like name@example.com.";
    setErrors(e);
    setFormError("");
    if (e.name || e.email) {
      document.getElementById(`${uid}-${e.name ? "name" : "email"}`)?.focus();
      return;
    }
    // Someone else may have taken the last spots while the form was open.
    if (!activeFull && party > left(active)) {
      setFormError(`Only ${left(active)} left now. Lower the number of people.`);
      return;
    }
    setBusy(true);
    try {
      const res = await onRsvp({ eventId: active.id, name: name.trim(), email: email.trim(), party, waitlist: activeFull });
      const id = active.id;
      if (activeFull) {
        const place = active.waitlist + 1;
        setEvents((list) => list.map((x) => (x.id === id ? { ...x, waitlist: x.waitlist + 1 } : x)));
        setMine((m) => ({ ...m, [id]: { kind: "waitlist", party, place, ref: res.ref } }));
        setSaid(`You're number ${place} on the waitlist for ${active.title}.`);
      } else {
        setEvents((list) => list.map((x) => (x.id === id ? { ...x, going: x.going + party } : x)));
        setMine((m) => ({ ...m, [id]: { kind: "going", party, ref: res.ref } }));
        setSaid(`You're going to ${active.title}. ${party === 1 ? "1 spot" : `${party} spots`} held.`);
      }
      setRsvpFor(null);
      focusLater(() => document.getElementById(`${uid}-cancel-${id}`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "That didn't go through. Try again.";
      setFormError(msg);
      setSaid(msg);
    } finally {
      setBusy(false);
    }
  };

  const confirmCancel = async () => {
    const ev = events.find((e) => e.id === cancelFor);
    const m = cancelFor ? mine[cancelFor] : undefined;
    if (!ev || !m) return;
    setCancelBusy(true);
    try {
      await onCancel(ev.id);
      setEvents((list) =>
        list.map((x) => (x.id !== ev.id ? x : m.kind === "going" ? { ...x, going: Math.max(0, x.going - m.party) } : { ...x, waitlist: Math.max(0, x.waitlist - 1) })),
      );
      setMine((all) => {
        const next = { ...all };
        delete next[ev.id];
        return next;
      });
      setSaid(m.kind === "going" ? `RSVP for ${ev.title} cancelled.` : `You left the waitlist for ${ev.title}.`);
      setCancelFor(null);
      focusLater(() => document.getElementById(`${uid}-rsvp-${ev.id}`));
    } catch {
      setSaid("That didn't go through. Try again.");
    } finally {
      setCancelBusy(false);
    }
  };

  const myCount = Object.keys(mine).length;
  const cancelEvent = cancelFor ? events.find((e) => e.id === cancelFor) : undefined;
  const cancelMine = cancelFor ? mine[cancelFor] : undefined;

  return (
    <div className="fl-evl" data-fl="b.event-listing">
      <header className="fl-evl-head">
        <div>
          <h3 className="fl-evl-title">{title}</h3>
          {lede ? <p className="fl-evl-lede">{lede}</p> : null}
        </div>
        <button type="button" className="fl-evl-mine" aria-pressed={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
          <Icon name="calendar" />
          My RSVPs
          <span className="fl-evl-mine-n">{myCount}</span>
        </button>
      </header>

      <div className="fl-evl-tools" role="search">
        <div className="fl-evl-search">
          <label htmlFor={`${uid}-q`} className="fl-sr">
            Search events
          </label>
          <Icon name="search" />
          <TextField id={`${uid}-q`} size={44} type="search" placeholder="Search events, places, hosts" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Segmented
          label="When"
          size="sm"
          value={when}
          onChange={(v) => setWhen(v as When)}
          options={[
            { value: "any", label: "Any time" },
            { value: "week", label: "This week" },
            { value: "weekend", label: "Weekend" },
            { value: "month", label: "30 days" },
          ]}
        />
        <div className="fl-evl-cats" role="group" aria-label="Categories">
          {categories.map((c) => (
            <button key={c} type="button" className="fl-evl-cat" aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>
              {cats.includes(c) ? <Icon name="check" /> : null}
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="fl-evl-count" aria-hidden="true">
        <span>{loading ? "Loading events…" : shown.length === 1 ? "1 event" : `${shown.length} events`}</span>
        {filtered && !loading ? (
          <button type="button" className="fl-evl-link" onClick={clear}>
            Clear filters
          </button>
        ) : null}
      </div>

      {loading ? (
        <ul className="fl-evl-list" aria-busy="true" aria-label="Loading events">
          {[0, 1, 2].map((i) => (
            <li key={i} className="fl-evl-card is-skel">
              <span className="fl-ctl-skel fl-evl-skel-date" />
              <span className="fl-evl-skel-lines">
                <span className="fl-ctl-skel" />
                <span className="fl-ctl-skel" />
                <span className="fl-ctl-skel" />
              </span>
            </li>
          ))}
        </ul>
      ) : shown.length === 0 ? (
        <div className="fl-evl-empty" data-fl="c.empty-state">
          <Icon name="calendar" />
          <strong>{onlyMine && !myCount ? "No RSVPs yet" : "No events match"}</strong>
          <p>{onlyMine && !myCount ? "RSVP to an event and it shows here." : "Try another date or fewer filters."}</p>
          <Button variant="secondary" size={40} onClick={clear}>
            {onlyMine && !myCount ? "See all events" : "Clear filters"}
          </Button>
        </div>
      ) : (
        <ol className="fl-evl-list" ref={list} aria-label="Events">
          {shown.map((e, i) => {
            const d = parseLocal(e.start);
            const end = new Date(d.getTime() + e.minutes * 60000);
            const spots = left(e);
            const full = spots === 0;
            const m = mine[e.id];
            const isOpen = open.includes(e.id);
            const fill = Math.min(1, e.going / Math.max(1, e.capacity));
            const tone = full ? "is-full" : spots <= SPOTS_FEW ? "is-few" : "";
            return (
              <li key={e.id} data-flip={e.id} className="fl-evl-card" style={{ ["--fl-evl-i" as string]: Math.min(i, 6) }}>
                <div className="fl-evl-row">
                  <p className="fl-evl-date" aria-hidden="true">
                    <span>{fmtWeek.format(d)}</span>
                    <strong>{d.getDate()}</strong>
                    <span>{fmtMonth.format(d)}</span>
                  </p>
                  <span className="fl-evl-pic">
                    <MediaFrame ratio="1-1" art={e.art ?? "a"} alt="" />
                  </span>
                  <div className="fl-evl-body">
                    <span className="fl-evl-cat-label">{e.category}</span>
                    <h4 id={`${uid}-t-${e.id}`}>{e.title}</h4>
                    <p className="fl-evl-meta">
                      <span>
                        <Icon name="clock" />
                        <span className="fl-sr">{fmtLong.format(d)}, </span>
                        {fmtTime.format(d)}–{fmtTime.format(end)}
                      </span>
                      <span>
                        <Icon name="pin" />
                        {e.venue}
                      </span>
                    </p>
                    <div className={`fl-evl-cap ${tone}`}>
                      <span className="fl-evl-bar" aria-hidden="true">
                        <span style={{ ["--fl-evl-fill" as string]: fill }} />
                      </span>
                      <span>
                        {full ? (e.waitlist ? `Full · ${e.waitlist} waiting` : "Full") : spots <= SPOTS_FEW ? `${spots} ${spots === 1 ? "spot" : "spots"} left` : `${spots} of ${e.capacity} spots left`}
                      </span>
                    </div>
                  </div>
                  <div className="fl-evl-side">
                    <strong className="fl-evl-price">{money(e.price)}</strong>
                    {m ? (
                      <div className="fl-evl-mine-state">
                        <Badge tone={m.kind === "going" ? "success" : "warning"} led>
                          {m.kind === "going" ? `Going${m.party > 1 ? ` · ${m.party}` : ""}` : `Waitlist #${m.place}`}
                        </Badge>
                        <button type="button" id={`${uid}-cancel-${e.id}`} className="fl-evl-link fl-evl-link--muted" onClick={() => setCancelFor(e.id)}>
                          {m.kind === "going" ? "Cancel RSVP" : "Leave waitlist"}
                          <span className="fl-sr"> for {e.title}</span>
                        </button>
                      </div>
                    ) : (
                      <Button id={`${uid}-rsvp-${e.id}`} variant={full ? "secondary" : "primary"} size={40} aria-describedby={`${uid}-t-${e.id}`} onClick={() => startRsvp(e.id)}>
                        {full ? "Join waitlist" : "RSVP"}
                      </Button>
                    )}
                    <button type="button" className="fl-evl-more" aria-expanded={isOpen} aria-controls={`${uid}-d-${e.id}`} onClick={() => toggleOpen(e.id)}>
                      Details
                      <span className="fl-sr"> for {e.title}</span>
                      <Icon name="chevron-down" />
                    </button>
                  </div>
                </div>
                <div id={`${uid}-d-${e.id}`} className={isOpen ? "fl-evl-fold is-open" : "fl-evl-fold"} inert={!isOpen}>
                  <div>
                    <p>{e.summary}</p>
                    <dl className="fl-evl-facts">
                      <div>
                        <dt>When</dt>
                        <dd>
                          {fmtLong.format(d)}, {fmtTime.format(d)}–{fmtTime.format(end)}
                        </dd>
                      </div>
                      <div>
                        <dt>Host</dt>
                        <dd>{e.host}</dd>
                      </div>
                      {m ? (
                        <div>
                          <dt>Your ref</dt>
                          <dd>{m.ref}</dd>
                        </div>
                      ) : null}
                    </dl>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {active ? (
        <Modal
          variant="form"
          title={activeFull ? "Join the waitlist" : "RSVP"}
          description={`${active.title} · ${fmtLong.format(parseLocal(active.start))}, ${fmtTime.format(parseLocal(active.start))}`}
          confirmLabel={activeFull ? "Join waitlist" : party > 1 ? `RSVP for ${party}` : "RSVP"}
          busy={busy}
          busyLabel="Saving…"
          onConfirm={() => {
            void submit();
            return false;
          }}
          onClose={() => setRsvpFor(null)}
          className="fl-evl-dlg"
        >
          <div className="fl-evl-form">
            {activeFull ? (
              <p className="fl-evl-note">
                <Icon name="info" />
                It's full. We'll email you if a spot opens; you'd be number {active.waitlist + 1}.
              </p>
            ) : null}
            <div className="fl-evl-field">
              <label htmlFor={`${uid}-name`}>Name</label>
              <TextField
                id={`${uid}-name`}
                size={44}
                autoComplete="name"
                value={name}
                invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${uid}-name-err` : undefined}
                data-autofocus
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((x) => ({ ...x, name: undefined }));
                }}
              />
              {errors.name ? (
                <p className="fl-evl-err" id={`${uid}-name-err`}>
                  <Icon name="alert" />
                  {errors.name}
                </p>
              ) : null}
            </div>
            <div className="fl-evl-field">
              <label htmlFor={`${uid}-email`}>Email</label>
              <TextField
                id={`${uid}-email`}
                size={44}
                type="email"
                autoComplete="email"
                value={email}
                invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${uid}-email-err` : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((x) => ({ ...x, email: undefined }));
                }}
              />
              {errors.email ? (
                <p className="fl-evl-err" id={`${uid}-email-err`}>
                  <Icon name="alert" />
                  {errors.email}
                </p>
              ) : null}
            </div>
            <div className="fl-evl-field fl-evl-party">
              <label htmlFor={`${uid}-party`}>People</label>
              <Quantity id={`${uid}-party`} label="People" size="sm" min={1} max={partyMax} value={party} onChange={(v) => setParty(v)} />
              <span className="fl-evl-hint">
                {activeFull ? `Up to ${maxParty}` : left(active) < maxParty ? `Only ${left(active)} left` : `Up to ${maxParty}`}
                {active.price ? ` · ${money(active.price * party)} at the door` : ""}
              </span>
            </div>
            {formError ? (
              <div className="fl-evl-alert" role="alert">
                <Icon name="alert" />
                <span>{formError}</span>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {cancelEvent && cancelMine ? (
        <Modal
          variant="danger"
          icon="calendar"
          title={cancelMine.kind === "going" ? "Cancel your RSVP?" : "Leave the waitlist?"}
          description={
            cancelMine.kind === "going"
              ? `Your ${cancelMine.party === 1 ? "spot" : `${cancelMine.party} spots`} at ${cancelEvent.title} go back to others.`
              : `You lose your place (#${cancelMine.place}) for ${cancelEvent.title}.`
          }
          confirmLabel={cancelMine.kind === "going" ? "Cancel RSVP" : "Leave waitlist"}
          cancelLabel="Keep it"
          busy={cancelBusy}
          busyLabel="Cancelling…"
          onConfirm={() => {
            void confirmCancel();
            return false;
          }}
          onClose={() => setCancelFor(null)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

/** Sample dates: days from today at a local time, so the list never looks stale. */
const at = (days: number, time: string) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${time}`;
};
/** The next Saturday (today when it is one), as days from today. */
const sat = (() => {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : 6 - dow;
})();

// flowcode:sample
const SAMPLE: EventListingProps = {
  title: "What's on nearby",
  lede: "Free and low-cost events around Mission Street.",
  categories: ["Music", "Food", "Outdoors", "Workshops", "Family"],
  maxParty: 4,
  events: [
    { id: "jazz", title: "Jazz on the patio", category: "Music", start: at(1, "19:00"), minutes: 120, venue: "Ritual Coffee, Valencia St", host: "Ritual Coffee", summary: "A trio plays standards on the back patio. Bring a sweater; coffee and pastries until 9.", price: 0, capacity: 60, going: 41, waitlist: 0, art: "b" },
    { id: "dumplings", title: "Dumpling folding class", category: "Workshops", start: at(2, "18:30"), minutes: 90, venue: "Mission Community Kitchen", host: "Chef Lin Zhao", summary: "Make pork and veggie dumplings from scratch, then eat them. All supplies included.", price: 3500, capacity: 16, going: 16, waitlist: 3, art: "c" },
    { id: "cleanup", title: "Dolores Park cleanup", category: "Outdoors", start: at(sat, "09:00"), minutes: 180, venue: "Dolores Park, 19th St entrance", host: "Friends of Dolores Park", summary: "Gloves, grabbers and bags provided. Meet at the 19th St entrance; breakfast tacos after.", price: 0, capacity: 40, going: 22, waitlist: 0, art: "d" },
    { id: "market", title: "Night market", category: "Food", start: at(sat, "17:00"), minutes: 240, venue: "Bartlett St Plaza", host: "Mission Merchants", summary: "Twenty food stalls, a DJ and late shopping on Bartlett Street. Entry is free; bring cash for vendors.", price: 0, capacity: 300, going: 212, waitlist: 0, art: "a" },
    { id: "storytime", title: "Saturday story time", category: "Family", start: at(sat + 1, "10:30"), minutes: 45, venue: "Mission Branch Library", host: "SF Public Library", summary: "Picture books and songs for ages 2–6 with a grown-up. Seating is on the carpet.", price: 0, capacity: 25, going: 21, waitlist: 0, art: "e" },
    { id: "printing", title: "Screen printing night", category: "Workshops", start: at(9, "19:00"), minutes: 120, venue: "Little Paper Press", host: "Little Paper Press", summary: "Print two tote bags with our designs or your own. Aprons provided; wear clothes you don't mind inking.", price: 4800, capacity: 12, going: 9, waitlist: 0, art: "b" },
    { id: "salsa", title: "Salsa social", category: "Music", start: at(13, "20:00"), minutes: 180, venue: "El Rio", host: "El Rio", summary: "A beginners' lesson at 8, then a live band from 9. No partner needed.", price: 1500, capacity: 120, going: 64, waitlist: 0, art: "c" },
    { id: "tasting", title: "Natural wine tasting", category: "Food", start: at(20, "18:00"), minutes: 120, venue: "Bodega Wines", host: "Bodega Wines", summary: "Six pours from small California makers with snacks. Must be 21+.", price: 2800, capacity: 24, going: 24, waitlist: 0, art: "a" },
  ],
};

export default function EventListingPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <EventListing {...SAMPLE} />
      </div>
    </section>
  );
}
