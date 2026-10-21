/** @flowcode-library rental-detail · Rental listing detail (Shop)
 * Catalog ID: b.rental-detail (block)
 * Function: One rental's page (b.rental-detail): a photo gallery with thumbnails and arrow keys, save and share, the key facts, a folding description and amenities, an availability calendar that picks check-in and check-out around booked nights with a minimum stay, a price card that works out nights, weekly discount, cleaning, service fee, taxes and the total for the guests chosen, and an inquiry form to the host with sending, sent and failed states.
 * Use it as: import { RentalDetail } from "./rental-detail"; <RentalDetail title location rating reviews host={{ name, since }} photos={[{ art: "a", alt }]} facts={{ guests, bedrooms, beds, baths }} about amenities={[{ icon, label }]} nightly(cents) cleaning(cents) serviceRate?={12} taxRate?={10} weeklyDiscount?={10} minNights?={2} maxGuests booked={["2026-11-02"]} onInquire?={async (inquiry) => ...} />
 * Built from: c.media-frame, c.date-picker.range, c.quantity, c.text-field.outlined, c.segmented.segmented, c.badge.status, c.button.primary, c.button.secondary, c.button.tertiary
 * Look: A gray page: a wide picture with previous and next buttons and a counter over a row of square thumbnails, then two columns. On the left a white card with the title, place and stars, Save and Share, fact chips, the description with Read more, an amenities grid with Show all, the month calendar with the chosen nights shaded and the inquiry form. On the right a white price card that stays in view: the nightly price, check-in and check-out boxes, a guests stepper, the money lines and a bold total over Request these dates.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance
 * Use cases: vacation rental page; holiday cottage listing; apartment for short stays; cabin booking; room listing; property inquiry; host website
 * Jobs to be done: see what the place looks like; check it has what I need; find nights it is free; know the full price before I ask; send the host a question with my dates
 * Keywords: rental, listing, property, vacation rental, gallery, amenities, availability, calendar, check-in, check-out, price breakdown, inquiry, host
 */
/**
 * Rental listing detail: the page a guest reads before asking to stay. The gallery steps with its buttons, the
 * thumbnails or the arrow keys (Home and End too); the picture fades over. Save toggles; Share copies the page link
 * and says so (or says it couldn't). Read more and Show all open in place. The calendar marks booked nights as
 * unavailable; the first pick is check-in, the second check-out, and a stay that crosses a booked night or is shorter
 * than the minimum is refused with the reason (the day a booking starts can still be a check-out day). The price card
 * works in cents: nights × rate, the weekly discount from 7 nights, cleaning, a service fee and taxes. Request these
 * dates checks the dates and takes you to the inquiry form; Send checks name, email and a message and shows sending,
 * then sent or failed. Make it the app's own: replace SAMPLE with the listing and its booked nights, and make
 * onInquire send the message to the host.
 * Adapted from Tailblocks (MIT License, Copyright (c) 2020 Mert Cukuren): its product detail and gallery blocks.
 */
/**
 * How to try it
 * - Press the arrow buttons or a thumbnail; then focus a thumbnail and use Left, Right, Home and End.
 * - Press Save, then Share: the status says the link was copied (or that it couldn't be).
 * - In the calendar pick a check-in, then a check-out past a struck-out booked night: it is refused. Pick one night:
 *   the minimum stay message shows. Pick 7 or more nights: the weekly discount appears.
 * - Raise Guests to the limit. Press Request these dates with no dates: you are told to pick them.
 * - Pick dates, press Request these dates: the form gets focus. Send it empty, then fill it; set Test reply to Fails.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's MediaFrame ("./media-frames"),
 * Calendar, toIso and fromIso ("./date-picker"), Quantity ("./input-quantity"), TextField ("./text-fields-states"),
 * Segmented ("./segmented-control"), Button ("./buttons-variants") and its inline icon set ("./icons"). Nothing else:
 * no package to install and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r4b-rental-detail.css.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Calendar, fromIso, toIso, type IsoDate } from "./date-picker";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { MediaFrame, type MediaArt } from "./media-frames";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.rental-detail: gallery, facts, amenities, availability, price and an inquiry to the host. ──

export type RentalPhoto = { art: MediaArt; alt: string };
export type RentalAmenity = { icon: string; label: string };
export type RentalInquiry = { checkIn: IsoDate; checkOut: IsoDate; nights: number; guests: number; name: string; email: string; message: string; total: number; test: "ok" | "fail" };

export type RentalDetailProps = {
  title: string;
  location: string;
  rating: number;
  reviews: number;
  host: { name: string; since: string };
  photos: RentalPhoto[];
  facts: { guests: number; bedrooms: number; beds: number; baths: number };
  about: string;
  amenities: RentalAmenity[];
  /** cents per night */
  nightly: number;
  /** cents, once per stay */
  cleaning: number;
  /** percent of the nights after discount */
  serviceRate?: number;
  /** percent of nights after discount plus cleaning */
  taxRate?: number;
  /** percent off the nights for 7 or more */
  weeklyDiscount?: number;
  minNights?: number;
  maxGuests: number;
  /** Nights already taken (the night starting that day). */
  booked: IsoDate[];
  currency?: string;
  locale?: string;
  /** Sends the inquiry; throw to show the failed message. A test stand-in when left out. */
  onInquire?: (inquiry: RentalInquiry) => Promise<void>;
};

const AMENITIES_SHOWN = 6;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
const addDays = (iso: IsoDate, n: number) => {
  const d = fromIso(iso)!;
  return toIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const nightsBetween = (a: IsoDate, b: IsoDate) => Math.round((fromIso(b)!.getTime() - fromIso(a)!.getTime()) / 86400000);

async function testInquire(q: RentalInquiry) {
  await wait(1000);
  if (q.test === "fail") throw new Error("Your message didn't send. Check your connection and try again.");
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

export function RentalDetail({
  title,
  location,
  rating,
  reviews,
  host,
  photos,
  facts,
  about,
  amenities,
  nightly,
  cleaning,
  serviceRate = 12,
  taxRate = 10,
  weeklyDiscount = 0,
  minNights = 1,
  maxGuests,
  booked,
  currency = "USD",
  locale = "en-US",
  onInquire = testInquire,
}: RentalDetailProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [photo, setPhoto] = useState(0);
  const [saved, setSaved] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [allAmenities, setAllAmenities] = useState(false);
  const [checkIn, setCheckIn] = useState<IsoDate | undefined>();
  const [checkOut, setCheckOut] = useState<IsoDate | undefined>();
  const [dateError, setDateError] = useState("");
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [test, setTest] = useState<"ok" | "fail">("ok");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState("");
  const [said, setSaid] = useState("");

  const money = (cents: number) => (cents / 100).toLocaleString(locale, { style: "currency", currency, minimumFractionDigits: cents % 100 ? 2 : 0 });
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
  const show = (iso: IsoDate) => fmtShort.format(fromIso(iso)!);
  const today = toIso(new Date());
  const takenSet = useMemo(() => new Set(booked), [booked]);

  // The first booked night after check-in: the latest possible check-out (that morning, before the next guests).
  const firstBookedAfter = (from: IsoDate) => booked.filter((d) => d > from).sort()[0];
  const isDisabled = (d: IsoDate) => {
    if (!takenSet.has(d)) return false;
    return !(checkIn && !checkOut && d > checkIn && firstBookedAfter(checkIn) === d);
  };

  const pick = (d: IsoDate) => {
    setDateError("");
    if (!checkIn || checkOut || d <= checkIn) {
      if (takenSet.has(d)) return;
      setCheckIn(d);
      setCheckOut(undefined);
      setSaid(`Check-in ${show(d)}. Now pick check-out.`);
      return;
    }
    const blocked = booked.some((b) => b >= checkIn && b < d);
    if (blocked) {
      const msg = `Those dates cross booked nights. Check out by ${show(firstBookedAfter(checkIn)!)} or pick other dates.`;
      setDateError(msg);
      setSaid(msg);
      return;
    }
    const n = nightsBetween(checkIn, d);
    if (n < minNights) {
      const msg = `The minimum stay is ${minNights} nights.`;
      setDateError(msg);
      setSaid(msg);
      return;
    }
    setCheckOut(d);
    setSaid(`${n} nights, ${show(checkIn)} to ${show(d)}.`);
  };
  const clearDates = () => {
    setCheckIn(undefined);
    setCheckOut(undefined);
    setDateError("");
    setSaid("Dates cleared.");
  };

  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;
  const base = nights * nightly;
  const discount = nights >= 7 && weeklyDiscount ? Math.round((base * weeklyDiscount) / 100) : 0;
  const service = nights ? Math.round(((base - discount) * serviceRate) / 100) : 0;
  const taxes = nights ? Math.round(((base - discount + cleaning) * taxRate) / 100) : 0;
  const total = nights ? base - discount + cleaning + service + taxes : 0;

  const go = (i: number) => {
    const n = (i + photos.length) % photos.length;
    setPhoto(n);
    setSaid(`Photo ${n + 1} of ${photos.length}: ${photos[n]!.alt}`);
  };
  const onThumbKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const map: Record<string, number> = { ArrowLeft: photo - 1, ArrowRight: photo + 1, Home: 0, End: photos.length - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const n = (map[e.key]! + photos.length) % photos.length;
    go(n);
    document.getElementById(`${uid}-th-${n}`)?.focus();
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setSaid("Link copied.");
    } catch {
      setSaid("Couldn't copy the link. Copy it from the address bar.");
    }
  };

  const request = () => {
    if (!checkIn || !checkOut) {
      const msg = checkIn ? "Pick a check-out date." : "Pick your dates in the calendar first.";
      setDateError(msg);
      setSaid(msg);
      document.getElementById(`${uid}-avail`)?.scrollIntoView({ block: "start", behavior: "smooth" });
      focusLater(() => document.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-avail`)} [data-day][tabindex="0"]`));
      return;
    }
    if (!message.trim()) setMessage(`Hi ${host.name.split(" ")[0]}, we'd like to stay ${show(checkIn)} to ${show(checkOut)} with ${guests} ${guests === 1 ? "guest" : "guests"}. `);
    setSent(false);
    focusLater(() => document.getElementById(`${uid}-name`));
  };

  const send = async () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Enter your name.";
    if (!email.trim()) e.email = "Enter your email.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = "Enter an email like name@example.com.";
    if (message.trim().length < 20) e.message = message.trim() ? "Say a little more (20 characters or more)." : "Write a message to the host.";
    setErrors(e);
    setFailed("");
    const first = (["name", "email", "message"] as const).find((k) => e[k]);
    if (first) {
      setSaid(e[first]!);
      document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }
    if (!checkIn || !checkOut) {
      setDateError("Pick your dates in the calendar first.");
      setSaid("Pick your dates in the calendar first.");
      focusLater(() => document.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-avail`)} [data-day][tabindex="0"]`));
      return;
    }
    setSending(true);
    setSaid("Sending…");
    try {
      await onInquire({ checkIn, checkOut, nights, guests, name: name.trim(), email: email.trim(), message: message.trim(), total, test });
      setSent(true);
      setSaid(`Sent. ${host.name} usually replies within a day.`);
      focusLater(() => document.getElementById(`${uid}-sent`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "That didn't send. Try again.";
      setFailed(msg);
      setSaid(msg);
      focusLater(() => document.getElementById(`${uid}-failed`));
    } finally {
      setSending(false);
    }
  };

  const shownAmenities = allAmenities ? amenities : amenities.slice(0, AMENITIES_SHOWN);
  const current = photos[photo]!;

  return (
    <div className="fl-rnt" data-fl="b.rental-detail">
      <div className="fl-rnt-gallery" role="group" aria-roledescription="gallery" aria-label={`${title} photos`}>
        <div className="fl-rnt-stage">
          <div className="fl-rnt-photo" key={photo}>
            <MediaFrame ratio="16-9" art={current.art} alt={current.alt} />
          </div>
          <button type="button" className="fl-rnt-nav is-prev" aria-label="Previous photo" onClick={() => go(photo - 1)}>
            <Icon name="chevron-left" />
          </button>
          <button type="button" className="fl-rnt-nav is-next" aria-label="Next photo" onClick={() => go(photo + 1)}>
            <Icon name="chevron-right" />
          </button>
          <span className="fl-rnt-counter" aria-hidden="true">
            {photo + 1} / {photos.length}
          </span>
        </div>
        <div className="fl-rnt-thumbs" role="group" aria-label="Choose a photo">
          {photos.map((p, i) => (
            <button
              key={i}
              id={`${uid}-th-${i}`}
              type="button"
              className="fl-rnt-thumb"
              aria-label={`Photo ${i + 1}: ${p.alt}`}
              aria-current={i === photo || undefined}
              tabIndex={i === photo ? 0 : -1}
              onClick={() => go(i)}
              onKeyDown={onThumbKey}
            >
              <MediaFrame ratio="4-3" art={p.art} alt="" />
            </button>
          ))}
        </div>
      </div>

      <div className="fl-rnt-cols">
        <div className="fl-rnt-card fl-rnt-main">
          <header className="fl-rnt-head">
            <div>
              <h3 className="fl-rnt-title">{title}</h3>
              <p className="fl-rnt-where">
                <Icon name="pin" />
                {location}
                <span className="fl-rnt-stars">
                  <Icon name="star" filled />
                  {rating.toFixed(2)} · {reviews} reviews
                </span>
              </p>
            </div>
            <div className="fl-rnt-head-actions">
              <Button variant="secondary" size={40} icon="heart" pressed={saved} onClick={() => {
                setSaved((s) => !s);
                setSaid(saved ? "Removed from saved." : "Saved.");
              }}>
                {saved ? "Saved" : "Save"}
              </Button>
              <Button variant="secondary" size={40} icon="share" onClick={() => void share()}>
                Share
              </Button>
            </div>
          </header>

          <ul className="fl-rnt-facts" aria-label="At a glance">
            <li>
              <Icon name="users" />
              {facts.guests} guests
            </li>
            <li>
              <Icon name="home" />
              {facts.bedrooms} {facts.bedrooms === 1 ? "bedroom" : "bedrooms"}
            </li>
            <li>
              <Icon name="layers" />
              {facts.beds} {facts.beds === 1 ? "bed" : "beds"}
            </li>
            <li>
              <Icon name="sparkle" />
              {facts.baths} {facts.baths === 1 ? "bath" : "baths"}
            </li>
          </ul>

          <section className="fl-rnt-sec" aria-labelledby={`${uid}-about-h`}>
            <h4 id={`${uid}-about-h`}>About this place</h4>
            <p className="fl-rnt-host">
              Hosted by {host.name} · hosting since {host.since}
            </p>
            <div id={`${uid}-about`} className={aboutOpen ? "fl-rnt-about is-open" : "fl-rnt-about"}>
              <p>{about}</p>
            </div>
            <button type="button" className="fl-rnt-link" aria-expanded={aboutOpen} aria-controls={`${uid}-about`} onClick={() => setAboutOpen((o) => !o)}>
              {aboutOpen ? "Show less" : "Read more"}
            </button>
          </section>

          <section className="fl-rnt-sec" aria-labelledby={`${uid}-am-h`}>
            <h4 id={`${uid}-am-h`}>What's here</h4>
            <ul className="fl-rnt-amen" id={`${uid}-amen`}>
              {shownAmenities.map((a, i) => (
                <li key={a.label} style={{ ["--fl-rnt-i" as string]: Math.max(0, i - AMENITIES_SHOWN) }} className={i >= AMENITIES_SHOWN ? "is-extra" : undefined}>
                  <Icon name={a.icon} />
                  {a.label}
                </li>
              ))}
            </ul>
            {amenities.length > AMENITIES_SHOWN ? (
              <Button variant="secondary" size={40} aria-expanded={allAmenities} aria-controls={`${uid}-amen`} onClick={() => setAllAmenities((o) => !o)}>
                {allAmenities ? "Show fewer" : `Show all ${amenities.length}`}
              </Button>
            ) : null}
          </section>

          <section className="fl-rnt-sec" id={`${uid}-avail`} aria-labelledby={`${uid}-av-h`}>
            <div className="fl-rnt-sec-head">
              <h4 id={`${uid}-av-h`}>Availability</h4>
              {checkIn ? (
                <button type="button" className="fl-rnt-link" onClick={clearDates}>
                  Clear dates
                </button>
              ) : null}
            </div>
            <p className="fl-rnt-host">
              {checkIn && checkOut
                ? `${nights} nights · ${show(checkIn)} – ${show(checkOut)}`
                : checkIn
                  ? `Check-in ${show(checkIn)} · pick check-out`
                  : `Pick check-in, then check-out. ${minNights > 1 ? `${minNights}-night minimum.` : ""}`}
            </p>
            <div className="fl-rnt-cal">
              <Calendar variant="range" range={{ start: checkIn, end: checkOut }} onPick={pick} min={today} isDisabled={isDisabled} label="Stay dates" locale={locale} />
            </div>
            <ul className="fl-rnt-key" aria-hidden="true">
              <li className="is-free">Free</li>
              <li className="is-booked">Unavailable</li>
              <li className="is-chosen">Your stay</li>
            </ul>
            {dateError ? (
              <p className="fl-rnt-err" id={`${uid}-date-err`}>
                <Icon name="alert" />
                {dateError}
              </p>
            ) : null}
          </section>

          <section className="fl-rnt-sec" aria-labelledby={`${uid}-ask-h`}>
            <h4 id={`${uid}-ask-h`}>Ask {host.name.split(" ")[0]}</h4>
            {sent ? (
              <div className="fl-rnt-sent" role="status">
                <span className="fl-rnt-tick" aria-hidden="true">
                  <Icon name="check" />
                </span>
                <div>
                  <strong id={`${uid}-sent`} tabIndex={-1}>
                    Message sent
                  </strong>
                  <p>
                    {host.name} usually replies within a day, to {email.trim()}. Nothing is booked or charged yet.
                  </p>
                  <button
                    type="button"
                    className="fl-rnt-link"
                    onClick={() => {
                      setSent(false);
                      setMessage("");
                      focusLater(() => document.getElementById(`${uid}-message`));
                    }}
                  >
                    Send another message
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="fl-rnt-form"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
              >
                {(
                  [
                    ["name", "Name", "name", "text"],
                    ["email", "Email", "email", "email"],
                  ] as const
                ).map(([k, label, ac, type]) => (
                  <div key={k} className="fl-rnt-field">
                    <label htmlFor={`${uid}-${k}`}>{label}</label>
                    <TextField
                      id={`${uid}-${k}`}
                      size={44}
                      type={type}
                      autoComplete={ac}
                      value={k === "name" ? name : email}
                      invalid={Boolean(errors[k])}
                      aria-describedby={errors[k] ? `${uid}-${k}-err` : undefined}
                      onChange={(e) => {
                        (k === "name" ? setName : setEmail)(e.target.value);
                        if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
                      }}
                    />
                    {errors[k] ? (
                      <p className="fl-rnt-err" id={`${uid}-${k}-err`}>
                        <Icon name="alert" />
                        {errors[k]}
                      </p>
                    ) : null}
                  </div>
                ))}
                <div className="fl-rnt-field is-wide">
                  <label htmlFor={`${uid}-message`}>Message</label>
                  <TextField
                    id={`${uid}-message`}
                    multiline
                    autoGrow
                    rows={3}
                    maxLength={600}
                    value={message}
                    invalid={Boolean(errors.message)}
                    aria-describedby={`${uid}-message-help${errors.message ? ` ${uid}-message-err` : ""}`}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (errors.message) setErrors((x) => ({ ...x, message: undefined }));
                    }}
                  />
                  <span className="fl-rnt-help" id={`${uid}-message-help`}>
                    {checkIn && checkOut ? `About ${show(checkIn)} – ${show(checkOut)}, ${guests} ${guests === 1 ? "guest" : "guests"}` : "Pick dates above so the host can check them"} · {message.length}/600
                  </span>
                  {errors.message ? (
                    <p className="fl-rnt-err" id={`${uid}-message-err`}>
                      <Icon name="alert" />
                      {errors.message}
                    </p>
                  ) : null}
                </div>
                <div className="fl-rnt-test is-wide">
                  <span className="fl-rnt-badge">Test mode</span>
                  <Segmented
                    label="Test reply"
                    size="sm"
                    value={test}
                    onChange={(v) => setTest(v as "ok" | "fail")}
                    options={[
                      { value: "ok", label: "Sends" },
                      { value: "fail", label: "Fails" },
                    ]}
                  />
                </div>
                {failed ? (
                  <div className="fl-rnt-alert is-wide" role="alert" id={`${uid}-failed`} tabIndex={-1}>
                    <Icon name="alert" />
                    <span>{failed}</span>
                  </div>
                ) : null}
                <div className="fl-rnt-form-foot is-wide">
                  <Button type="submit" variant="primary" size={44} icon="send" busy={sending}>
                    {sending ? "Sending…" : "Send message"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="fl-rnt-card fl-rnt-price" aria-label="Price">
          <p className="fl-rnt-rate">
            <strong>{money(nightly)}</strong> night
          </p>
          <div className="fl-rnt-dates">
            <div>
              <span>Check-in</span>
              <strong>{checkIn ? show(checkIn) : "Add date"}</strong>
            </div>
            <div>
              <span>Check-out</span>
              <strong>{checkOut ? show(checkOut) : "Add date"}</strong>
            </div>
          </div>
          <div className="fl-rnt-guests">
            <label htmlFor={`${uid}-guests`}>Guests</label>
            <Quantity id={`${uid}-guests`} label="Guests" size="sm" min={1} max={maxGuests} value={guests} onChange={(v) => setGuests(v)} />
          </div>
          <p className="fl-rnt-help">{guests >= maxGuests ? `${maxGuests} guests is the most this place sleeps.` : `Sleeps up to ${maxGuests}.`}</p>
          {nights ? (
            <dl className="fl-rnt-money" key={nights}>
              <div>
                <dt>
                  {money(nightly)} × {nights} nights
                </dt>
                <dd>{money(base)}</dd>
              </div>
              {discount ? (
                <div className="is-saving">
                  <dt>Weekly discount ({weeklyDiscount}%)</dt>
                  <dd>−{money(discount)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Cleaning</dt>
                <dd>{money(cleaning)}</dd>
              </div>
              <div>
                <dt>Service fee</dt>
                <dd>{money(service)}</dd>
              </div>
              <div>
                <dt>Taxes</dt>
                <dd>{money(taxes)}</dd>
              </div>
              <div className="fl-rnt-total">
                <dt>Total</dt>
                <dd>{money(total)}</dd>
              </div>
            </dl>
          ) : (
            <p className="fl-rnt-help">Pick dates to see the total.{weeklyDiscount ? ` ${weeklyDiscount}% off stays of 7 nights or more.` : ""}</p>
          )}
          <Button variant="primary" size={48} block onClick={request}>
            Request these dates
          </Button>
          <p className="fl-rnt-help fl-rnt-center">You won't be charged yet.</p>
        </aside>
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

/** Sample booked nights, as days from today, so the calendar never looks stale. */
const bookedFromToday = (offsets: number[]) => offsets.map((n) => toIso(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + n)));

// flowcode:sample
const SAMPLE: RentalDetailProps = {
  title: "Cedar cabin by the creek",
  location: "Guerneville, California",
  rating: 4.92,
  reviews: 138,
  host: { name: "Dana Whitfield", since: "2019" },
  photos: [
    { art: "d", alt: "The cabin from the garden, with a wraparound deck" },
    { art: "b", alt: "Living room with a wood stove and big windows" },
    { art: "c", alt: "Kitchen with an island and open shelves" },
    { art: "a", alt: "Main bedroom with a queen bed" },
    { art: "e", alt: "Hot tub on the deck under the redwoods" },
    { art: "d", alt: "The creek a short walk from the door" },
  ],
  facts: { guests: 4, bedrooms: 2, beds: 3, baths: 1 },
  about:
    "A quiet two-bedroom cabin under the redwoods, a five-minute walk to the Russian River and ten minutes from town. Mornings on the deck, evenings by the wood stove. The kitchen has everything you need to cook, and there is fast Wi-Fi if you have to work. The road is steep at the end, so a car with good tires is best in winter. No parties; quiet hours start at 10 PM.",
  amenities: [
    { icon: "bolt", label: "Fast Wi-Fi" },
    { icon: "home", label: "Full kitchen" },
    { icon: "heart", label: "Hot tub" },
    { icon: "sparkle", label: "Wood stove" },
    { icon: "pin", label: "Free parking" },
    { icon: "users", label: "Family friendly" },
    { icon: "refresh", label: "Washer and dryer" },
    { icon: "play", label: "TV with streaming" },
    { icon: "clock", label: "Self check-in" },
    { icon: "shield", label: "Smoke and CO alarms" },
    { icon: "star", label: "Deck with grill" },
    { icon: "layers", label: "Extra blankets" },
  ],
  nightly: 18900,
  cleaning: 9500,
  serviceRate: 12,
  taxRate: 12,
  weeklyDiscount: 10,
  minNights: 2,
  maxGuests: 4,
  booked: bookedFromToday([3, 4, 5, 13, 14, 20, 21, 22, 30, 31]),
};

export default function RentalDetailPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <RentalDetail {...SAMPLE} />
      </div>
    </section>
  );
}
