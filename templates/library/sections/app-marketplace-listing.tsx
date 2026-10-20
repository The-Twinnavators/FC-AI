/** @flowcode-library app-marketplace-listing · Marketplace listing (App screens)
 * Catalog ID: t.app-marketplace-listing (template)
 * Function: An app screen: a two-sided marketplace's single-listing page with a switchable photo gallery, price, condition, posted date and place on a drawn map, a seller card with rating and verified badge, an inline offer form that checks the amount, save and share, item details, safety tips and related listings.
 * Use it as: Copy app-marketplace-listing.tsx (FlowCode brings the components it uses); replace SAMPLE with the listing, its seller and related listings from the app's data, send offers and messages through the app's inbox, and keep saved listings in the user's account.
 * Built from: c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.breadcrumbs.full
 * Look: The marketplace's top bar and breadcrumbs over a large drawn photo with thumbnails, beside a price card with condition, place, Save and Share and a seller card with rating, verified badge, Make an offer and Message seller; then the description, a details table, a drawn map of the pickup area, safety tips, and rows of more listings from the seller and similar listings.
 * Use cases: marketplace listing page; classifieds item page; secondhand item detail; peer-to-peer marketplace; rental listing detail; local services listing; listing detail
 * Jobs to be done: look at an item's photos and details; check whether a seller is trustworthy; make an offer on an item; message the seller; see where to pick it up; find similar listings
 * Keywords: app, marketplace, listing, classifieds, product detail, sellers, offers, two-sided
 */
/**
 * App screen: one listing on a two-sided marketplace, the page a buyer opens from the browse grid (t.app-marketplace,
 * same brand, top bar, sellers and drawn pictures). The top bar with search, location, Sign in and "List an item";
 * breadcrumbs and a link back to the results; a photo gallery (a big picture and four thumbnails, switched by click or
 * the arrow keys); the title, price, condition, when it was posted and where, with a save toggle and share; a seller
 * card (initials, name, rating and review count, response time, "Verified seller", member since) with Message seller
 * and Make an offer, each opening an inline form: the offer checks its amount and shows a sent state; the description
 * and an item details table; the pickup area on a simple drawn map; safety tips; then "More from this seller" and
 * "Similar listings" rows with their own save hearts. On narrow widths everything stacks into one column with the price
 * and the actions right under the photos.
 * Use it as the listing detail screen of a peer-to-peer marketplace (secondhand goods, rentals, local services). Make it
 * the app's own: replace SAMPLE with the listing, its seller and related listings from the app's data, send offers and
 * messages through the app's inbox, and keep saved listings in the user's account instead of this screen's memory.
 */
/**
 * Assembled from: top bar (inline: brand, c.text-field search and location, c.button.tertiary Sign in, c.button.primary
 * List an item) > c.breadcrumbs.full and a back link > gallery (inline stage, c.button.tertiary previous and next,
 * thumbnail buttons) > summary (price, c.badge.status condition, c.button.secondary save and share toggles) > seller card
 * (c.badge.status verified, c.button.primary Make an offer, c.button.secondary Message seller, c.text-field offer and
 * message forms) > description and details table > drawn map > safety tips > listing rows (inline cards, heart toggles).
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";
import { Badge } from "./badges-status";
import { TextField } from "./text-fields-states";
import { Breadcrumbs } from "./breadcrumbs-variants";

// flowcode:sample
const SAMPLE = {
  brand: "Swapyard",
  mark: "S",
  searchLabel: "Search listings",
  searchPlaceholder: "Search 12,000 listings",
  locationLabel: "Location",
  location: "Portland, OR",
  searchAction: "Search",
  signIn: "Sign in",
  listItem: "List an item",
  crumbs: [
    { label: "Swapyard", href: "#home" },
    { label: "Furniture near Portland, OR", href: "#results" },
  ],
  backToResults: "Back to results",
  listing: {
    id: "l1",
    title: "Mid-century walnut armchair",
    category: "Furniture",
    price: 240,
    condition: "Like new",
    posted: 45,
    views: 212,
    saves: 18,
    place: "Hawthorne",
    city: "Portland, OR",
    miles: 3.2,
    photos: [
      { label: "Front", hue: 20, d: "M32 26h36v28H32zM28 54h44v8H28zM32 62v14M68 62v14" },
      { label: "Side", hue: 34, d: "M34 24l8 32h28M42 56l-6 20M70 56l4 20M44 44h28v12M34 24h6" },
      { label: "Seat cushion", hue: 12, d: "M18 38h64v26H18zM18 51c12-6 22 5 32 0s20-6 32 0M26 64v8M74 64v8" },
      { label: "Back", hue: 48, d: "M30 22h40v34H30zM36 30h28M36 38h28M36 46h28M28 56h44v6H28zM34 62v14M66 62v14" },
      { label: "Maker's stamp", hue: 28, d: "M24 30h52v40H24zM50 38a12 12 0 1 0 .1 0zM44 50h12M34 64h32" },
    ],
    description: [
      "Solid walnut frame with the original tapered legs, reupholstered last year in an oatmeal wool blend. No wobble, no stains and no pets or smoke in the house.",
      "It sat in a reading corner and was barely used. Pickup in Hawthorne on weekday evenings or Saturday morning; I can help load it into a car or small SUV.",
    ],
    details: [
      { label: "Category", value: "Furniture · Chairs" },
      { label: "Condition", value: "Like new" },
      { label: "Maker", value: "Lane Furniture, 1962" },
      { label: "Dimensions", value: "29 in wide, 31 in deep, 32 in tall" },
      { label: "Seat height", value: "17 in" },
      { label: "Material", value: "Walnut, wool blend upholstery" },
      { label: "Pickup", value: "Hawthorne, Portland · seller can help load" },
      { label: "Listing ID", value: "SY-48213" },
    ],
  },
  seller: {
    name: "Dana Whitfield",
    first: "Dana",
    initials: "DW",
    rating: 4.9,
    reviews: 128,
    response: "Usually replies within an hour",
    memberSince: "Member since 2019",
    sold: "64 items sold",
    verified: true,
  },
  verified: "Verified seller",
  verifiedHint: "ID and payment checked by Swapyard",
  save: "Save",
  saved: "Saved",
  share: "Share",
  linkCopied: "Link copied",
  messageSeller: "Message seller",
  makeOffer: "Make an offer",
  changeOffer: "Change your offer",
  offerLabel: "Your offer",
  offerHint: "Offers start at half the asking price.",
  offerNoteLabel: "Add a note (optional)",
  offerNote: "I can pick it up this Saturday morning.",
  sendOffer: "Send offer",
  messageLabel: "Message",
  messageDraft: "Hi Dana, is the walnut armchair still available? I could pick it up this week.",
  sendMessage: "Send message",
  cancel: "Cancel",
  inboxNote: "Replies show up in your Inbox.",
  aboutTitle: "About this item",
  detailsTitle: "Item details",
  locationTitle: "Pickup area",
  locationNote: "The exact address is shared once you and the seller agree on a pickup.",
  safetyTitle: "Stay safe on Swapyard",
  safetyTips: [
    "Meet in a public place in daylight, or bring a friend.",
    "Look the item over before you pay.",
    "Pay through Swapyard so your purchase is protected.",
    "Never send a deposit or gift cards to someone you haven't met.",
  ],
  reportListing: "Report this listing",
  moreFromSeller: "More from Dana",
  similarTitle: "Similar listings",
  seeAll: "See all",
  more: [
    { id: "m1", title: "Teak side table with drawer", category: "Furniture", price: 120, place: "Hawthorne", posted: 300, hue: 30 },
    { id: "m2", title: "Brass floor lamp, linen shade", category: "Home & garden", price: 75, place: "Hawthorne", posted: 1600, hue: 90 },
    { id: "m3", title: "Yamaha FG800 acoustic guitar", category: "Music", price: 140, place: "Hawthorne", posted: 2900, hue: 340 },
    { id: "m4", title: "Wool area rug, 5 x 8 ft", category: "Home & garden", price: 110, place: "Hawthorne", posted: 4300, hue: 150 },
  ],
  similar: [
    { id: "s1", title: "Danish lounge chair, teak and leather", category: "Furniture", price: 310, place: "Sellwood", posted: 90, hue: 15 },
    { id: "s2", title: "Pair of walnut accent chairs", category: "Furniture", price: 420, place: "Pearl District", posted: 600, hue: 40 },
    { id: "s3", title: "Rattan armchair with cushion", category: "Furniture", price: 95, place: "Alberta Arts", posted: 1300, hue: 60 },
    { id: "s4", title: "Mid-century ottoman, walnut legs", category: "Furniture", price: 80, place: "Beaverton", posted: 2200, hue: 25 },
  ],
};

type Mini = (typeof SAMPLE.more)[number];
type Panel = "none" | "offer" | "message";

const SEARCH = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4";
const PIN = "M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const ago = (min: number) => {
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} hr ago`;
  const days = Math.round(min / 1440);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

/** The browse page's line drawings, so a related listing has a picture without any image file. */
const ART: Record<string, string> = {
  Furniture: "M32 26h36v28H32zM28 54h44v8H28zM32 62v14M68 62v14",
  Electronics: "M26 30h48v32H26zM18 70h64l-4-8H22z",
  Bikes: "M30 66a12 12 0 1 0 0.1 0zM70 66a12 12 0 1 0 0.1 0zM30 66l12-24h18l10 24M42 42l14 24h14M56 34h8",
  "Home & garden": "M36 56h28l-4 22H40zM50 56V36M50 44c-8-10-17-7-17-7s4 10 17 9M50 40c6-10 17-9 17-9s-2 11-17 11",
  Music: "M34 22h32v56H34zM50 62a9 9 0 1 0 0.1 0zM50 34a5 5 0 1 0 0.1 0z",
  Clothing: "M38 24 24 34l6 12 8-4v34h24V42l8 4 6-12-14-10c-2 6-7 8-12 8s-10-2-12-8z",
};

function Art({ d, hue, className }: { d: string; hue: number; className?: string }) {
  return (
    <div className={`fl-mkl-art${className ? ` ${className}` : ""}`} style={{ ["--fl-mkl-hue" as string]: `${hue}deg` }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <path d={d} />
      </svg>
    </div>
  );
}

/** A street map drawn in SVG: blocks, a river and a park, with the approximate area circled. */
function AreaMap({ label }: { label: string }) {
  return (
    <svg className="fl-mkl-map" viewBox="0 0 320 160" role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      <rect className="fl-mkl-map__land" width="320" height="160" />
      <path className="fl-mkl-map__water" d="M0 118c40-10 70 6 108-4s64-30 104-22 72 22 108 12v56H0z" />
      <rect className="fl-mkl-map__park" x="196" y="22" width="56" height="38" rx="4" />
      <path className="fl-mkl-map__road" d="M0 44h320M0 84h320M60 0v160M140 0v160M230 0v160" />
      <path className="fl-mkl-map__street" d="M0 24h320M0 64h320M100 0v110M180 0v100M280 0v104M20 0v120" />
      <circle className="fl-mkl-map__area" cx="150" cy="62" r="34" />
      <circle className="fl-mkl-map__dot" cx="150" cy="62" r="5" />
    </svg>
  );
}

function ListingRow({ id, title, items, saved, onSave, seeAll }: { id: string; title: string; items: Mini[]; saved: string[]; onSave: (m: Mini) => void; seeAll: string }) {
  return (
    <section className="fl-mkl-row" aria-labelledby={id}>
      <div className="fl-mkl-row__head">
        <h2 id={id} className="fl-mkl-h2">
          {title}
        </h2>
        <a className="fl-mkl-link" href={`#${id}-all`}>
          {seeAll}
          <span className="fl-sr">: {title}</span>
        </a>
      </div>
      <ul className="fl-mkl-row__list">
        {items.map((m) => {
          const on = saved.includes(m.id);
          return (
            <li key={m.id}>
              <article className="fl-mkl-mini" aria-labelledby={`fl-mkl-t-${m.id}`}>
                <Art d={ART[m.category] ?? ART.Furniture} hue={m.hue} />
                <span className="fl-mkl-mini__save">
                  <Button variant="tertiary" size={32} icon="heart" iconOnly pressed={on} onClick={() => onSave(m)} aria-label={`${SAMPLE.save} ${m.title}`}>
                    {SAMPLE.save}
                  </Button>
                </span>
                <p className="fl-mkl-mini__price">{money(m.price)}</p>
                <h3 id={`fl-mkl-t-${m.id}`} className="fl-mkl-mini__title">
                  <a href={`#${m.id}`}>{m.title}</a>
                </h3>
                <p className="fl-mkl-mini__meta">
                  {m.place} · {ago(m.posted)}
                </p>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function AppMarketplaceListing() {
  const d = SAMPLE;
  const l = d.listing;
  const s = d.seller;
  const photos = l.photos;
  const minOffer = Math.ceil(l.price / 2);

  const [query, setQuery] = useState("");
  const [place, setPlace] = useState(d.location);
  const [photo, setPhoto] = useState(0);
  const [saved, setSaved] = useState(false);
  const [savedOthers, setSavedOthers] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<Panel>("none");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(d.offerNote);
  const [offerError, setOfferError] = useState("");
  const [offerSent, setOfferSent] = useState<number | null>(null);
  const [message, setMessage] = useState(d.messageDraft);
  const [messageError, setMessageError] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [say, setSay] = useState("");

  const thumbs = useRef<Array<HTMLButtonElement | null>>([]);
  const amountRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Opening a form puts the cursor in its first field.
  useEffect(() => {
    const box = panel === "offer" ? amountRef.current : panel === "message" ? messageRef.current : null;
    box?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")?.focus();
  }, [panel]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(t);
  }, [copied]);

  function show(i: number, focusThumb = false) {
    const n = (i + photos.length) % photos.length;
    setPhoto(n);
    setSay(`Photo ${n + 1} of ${photos.length}: ${photos[n]!.label}.`);
    if (focusThumb) thumbs.current[n]?.focus();
  }

  function onGalleryKey(e: KeyboardEvent<HTMLElement>) {
    const onThumb = (e.target as HTMLElement).dataset.thumb !== undefined;
    const to = e.key === "ArrowRight" ? photo + 1 : e.key === "ArrowLeft" ? photo - 1 : e.key === "Home" ? 0 : e.key === "End" ? photos.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    show(to, onThumb);
  }

  function toggleSave() {
    setSaved((v) => !v);
    setSay(saved ? `Removed ${l.title} from saved.` : `Saved ${l.title}.`);
  }

  function toggleSaveOther(m: Mini) {
    const on = !savedOthers.includes(m.id);
    setSavedOthers((xs) => (on ? [...xs, m.id] : xs.filter((x) => x !== m.id)));
    setSay(on ? `Saved ${m.title}.` : `Removed ${m.title} from saved.`);
  }

  async function share() {
    const link = `${window.location.origin}${window.location.pathname}#listing-${l.id}`;
    try {
      await navigator.clipboard.writeText(link);
      setSay(`${d.linkCopied}.`);
    } catch {
      setSay(`Copy this link: ${link}`);
    }
    setCopied(true);
  }

  function openPanel(p: Panel) {
    setPanel((cur) => (cur === p ? "none" : p));
    setOfferError("");
    setMessageError("");
    if (p === "offer" && offerSent !== null) setAmount(String(offerSent));
  }

  function sendOffer(e: FormEvent) {
    e.preventDefault();
    const raw = amount.replace(/[$,\s]/g, "");
    const n = Number(raw);
    let err = "";
    if (!raw) err = `Enter the amount you'd pay, like ${money(l.price - 20)}.`;
    else if (!/^\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(n)) err = "Enter an amount in dollars, using numbers only.";
    else if (n < minOffer) err = `Offers start at ${money(minOffer)}, half the asking price.`;
    else if (n > l.price) err = `Offer ${money(l.price)} or less; that's the asking price.`;
    setOfferError(err);
    if (err) {
      amountRef.current?.querySelector("input")?.focus();
      return;
    }
    setOfferSent(n);
    setPanel("none");
    setSay(`Offer of ${money(n)} sent to ${s.first}.`);
  }

  function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setMessageError(`Write a message to ${s.first} first.`);
      messageRef.current?.querySelector("textarea")?.focus();
      return;
    }
    setMessageError("");
    setMessageSent(true);
    setPanel("none");
    setSay(`Message sent to ${s.first}.`);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setSay(`Searching ${query.trim() ? `for “${query.trim()}” ` : ""}near ${place.trim() || d.location}.`);
  }

  const current = photos[photo]!;
  const offerTips = [l.price - 40, l.price - 25, l.price - 10].filter((n) => n >= minOffer);

  return (
    <div className="fl-mkl-app">
      <div className="fl-mkl-shell">
        <header className="fl-mkl-top">
          <a className="fl-mkl-brand" href="#home">
            <span className="fl-mkl-mark" aria-hidden="true">
              {d.mark}
            </span>
            <span className="fl-mkl-brand__name">{d.brand}</span>
          </a>
          <form className="fl-mkl-search" role="search" onSubmit={onSearch}>
            <div className="fl-mkl-search__field fl-mkl-search__field--q">
              <label htmlFor="fl-mkl-q" className="fl-sr">
                {d.searchLabel}
              </label>
              <Glyph d={SEARCH} />
              <TextField id="fl-mkl-q" type="search" size={44} placeholder={d.searchPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="fl-mkl-search__field fl-mkl-search__field--loc">
              <label htmlFor="fl-mkl-loc" className="fl-sr">
                {d.locationLabel}
              </label>
              <Glyph d={PIN} />
              <TextField id="fl-mkl-loc" size={44} autoComplete="address-level2" value={place} onChange={(e) => setPlace(e.target.value)} />
            </div>
            <Button type="submit" size={44} icon="search" iconOnly className="fl-mkl-search__go">
              {d.searchAction}
            </Button>
          </form>
          <div className="fl-mkl-top__end">
            <Button variant="tertiary" size={40} href="#sign-in">
              {d.signIn}
            </Button>
            <Button size={40} icon="plus" href="#list-an-item">
              {d.listItem}
            </Button>
          </div>
        </header>

        <div className="fl-mkl-trail">
          <a className="fl-mkl-back" href="#results">
            <Icon name="arrow-left" /> {d.backToResults}
          </a>
          <Breadcrumbs className="fl-mkl-crumbs" size={14} items={[...d.crumbs, { label: l.title }]} />
        </div>

        <p className="fl-sr" aria-live="polite">
          {say}
        </p>

        <main className="fl-mkl-main" aria-labelledby="fl-mkl-title">
          <div className="fl-mkl-col fl-mkl-col--wide">
            <section className="fl-mkl-gallery" aria-label={`Photos of ${l.title}`} onKeyDown={onGalleryKey}>
              <figure className="fl-mkl-stage" tabIndex={0} aria-label={`Photo ${photo + 1} of ${photos.length}: ${current.label}. Use the arrow keys for the other photos.`}>
                <Art key={photo} d={current.d} hue={current.hue} className="fl-mkl-art--stage" />
                <figcaption className="fl-mkl-stage__count" aria-hidden="true">
                  {photo + 1} / {photos.length} · {current.label}
                </figcaption>
                <span className="fl-mkl-stage__nav fl-mkl-stage__nav--prev">
                  <Button variant="tertiary" size={40} icon="chevron-left" iconOnly onClick={() => show(photo - 1)}>
                    Previous photo
                  </Button>
                </span>
                <span className="fl-mkl-stage__nav fl-mkl-stage__nav--next">
                  <Button variant="tertiary" size={40} icon="chevron-right" iconOnly onClick={() => show(photo + 1)}>
                    Next photo
                  </Button>
                </span>
              </figure>
              <div className="fl-mkl-thumbs" role="group" aria-label="Choose a photo">
                {photos.map((p, i) => (
                  <button
                    key={p.label}
                    ref={(el) => {
                      thumbs.current[i] = el;
                    }}
                    type="button"
                    data-thumb=""
                    className="fl-mkl-thumb"
                    aria-current={i === photo ? "true" : undefined}
                    aria-label={`Photo ${i + 1}: ${p.label}`}
                    tabIndex={i === photo ? 0 : -1}
                    onClick={() => show(i)}
                  >
                    <Art d={p.d} hue={p.hue} />
                  </button>
                ))}
              </div>
            </section>

            <section className="fl-mkl-panel fl-mkl-about" aria-labelledby="fl-mkl-about-title">
              <h2 id="fl-mkl-about-title" className="fl-mkl-h2">
                {d.aboutTitle}
              </h2>
              <div className="fl-mkl-prose">
                {l.description.map((p) => (
                  <p key={p.slice(0, 24)}>{p}</p>
                ))}
              </div>
              <h3 className="fl-mkl-h3">{d.detailsTitle}</h3>
              <table className="fl-mkl-details">
                <tbody>
                  {l.details.map((r) => (
                    <tr key={r.label}>
                      <th scope="row">{r.label}</th>
                      <td>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <div className="fl-mkl-col fl-mkl-col--side">
            <section className="fl-mkl-panel fl-mkl-summary" aria-label="Price and actions">
              <h1 id="fl-mkl-title" className="fl-mkl-h1">
                {l.title}
              </h1>
              <p className="fl-mkl-price">{money(l.price)}</p>
              <div className="fl-mkl-facts">
                <Badge tone="neutral">{l.condition}</Badge>
                <span className="fl-mkl-fact">
                  <Icon name="clock" /> Posted {ago(l.posted)}
                </span>
                <span className="fl-mkl-fact">
                  <Icon name="pin" /> {l.place}, {l.city} · {l.miles} mi
                </span>
              </div>
              <p className="fl-mkl-stats">
                {l.views} views · {l.saves + (saved ? 1 : 0)} saves
              </p>
              <div className="fl-mkl-tools">
                <Button variant="secondary" size={40} icon="heart" pressed={saved} onClick={toggleSave} className="fl-mkl-save">
                  {saved ? d.saved : d.save}
                </Button>
                <Button variant="secondary" size={40} icon={copied ? "check" : "share"} onClick={share}>
                  {copied ? d.linkCopied : d.share}
                </Button>
              </div>
            </section>

            <section className="fl-mkl-panel fl-mkl-seller" aria-labelledby="fl-mkl-seller-name">
              <div className="fl-mkl-seller__who">
                <span className="fl-mkl-avatar" aria-hidden="true">
                  {s.initials}
                </span>
                <div className="fl-mkl-seller__text">
                  <h2 id="fl-mkl-seller-name" className="fl-mkl-seller__name">
                    <a href="#seller">{s.name}</a>
                  </h2>
                  <p className="fl-mkl-rating">
                    <span className="fl-mkl-stars" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Icon key={i} name="star" filled={i < Math.round(s.rating)} />
                      ))}
                    </span>
                    <span>
                      {s.rating.toFixed(1)} <span className="fl-mkl-muted">({s.reviews} reviews)</span>
                    </span>
                    <span className="fl-sr"> stars</span>
                  </p>
                </div>
              </div>
              {s.verified ? (
                <p className="fl-mkl-verified">
                  <Badge tone="success">
                    <Icon name="shield" /> {d.verified}
                  </Badge>
                  <span className="fl-mkl-muted">{d.verifiedHint}</span>
                </p>
              ) : null}
              <ul className="fl-mkl-seller__facts">
                <li>
                  <Icon name="clock" /> {s.response}
                </li>
                <li>
                  <Icon name="calendar" /> {s.memberSince}
                </li>
                <li>
                  <Icon name="check" /> {s.sold}
                </li>
              </ul>

              {offerSent !== null && panel !== "offer" ? (
                <div className="fl-mkl-done" role="status">
                  <Icon name="check" />
                  <p>
                    <strong>Offer sent: {money(offerSent)}.</strong> {s.first} {s.response.charAt(0).toLowerCase() + s.response.slice(1)}. {d.inboxNote}
                  </p>
                </div>
              ) : null}
              {messageSent && panel !== "message" ? (
                <div className="fl-mkl-done" role="status">
                  <Icon name="send" />
                  <p>
                    <strong>Message sent to {s.first}.</strong> {d.inboxNote}
                  </p>
                </div>
              ) : null}

              <div className="fl-mkl-actions">
                <Button size={44} icon="send" aria-expanded={panel === "offer"} aria-controls="fl-mkl-offer" onClick={() => openPanel("offer")}>
                  {offerSent !== null ? d.changeOffer : d.makeOffer}
                </Button>
                <Button variant="secondary" size={44} icon="mail" aria-expanded={panel === "message"} aria-controls="fl-mkl-message" onClick={() => openPanel("message")}>
                  {d.messageSeller}
                </Button>
              </div>

              {panel === "offer" ? (
                <form id="fl-mkl-offer" className="fl-mkl-form" onSubmit={sendOffer} noValidate aria-label={d.makeOffer}>
                  <div className="fl-mkl-field" ref={amountRef}>
                    <label htmlFor="fl-mkl-amount" className="fl-mkl-label">
                      {d.offerLabel}
                    </label>
                    <div className="fl-mkl-money">
                      <span aria-hidden="true">$</span>
                      <TextField
                        id="fl-mkl-amount"
                        size={44}
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        invalid={!!offerError}
                        aria-describedby={offerError ? "fl-mkl-amount-err" : "fl-mkl-amount-hint"}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          if (offerError) setOfferError("");
                        }}
                      />
                    </div>
                    {offerError ? (
                      <p id="fl-mkl-amount-err" className="fl-mkl-error">
                        <Icon name="alert" /> {offerError}
                      </p>
                    ) : (
                      <p id="fl-mkl-amount-hint" className="fl-mkl-hint">
                        Asking {money(l.price)}. {d.offerHint}
                      </p>
                    )}
                    <div className="fl-mkl-quick" role="group" aria-label="Suggested offers">
                      {offerTips.map((n) => (
                        <button key={n} type="button" className="fl-mkl-quick__btn" aria-pressed={amount === String(n)} onClick={() => {
                            setAmount(String(n));
                            setOfferError("");
                          }}>
                          {money(n)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="fl-mkl-field">
                    <label htmlFor="fl-mkl-note" className="fl-mkl-label">
                      {d.offerNoteLabel}
                    </label>
                    <TextField id="fl-mkl-note" multiline autoGrow rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                  <div className="fl-mkl-form__end">
                    <Button variant="tertiary" size={40} onClick={() => setPanel("none")}>
                      {d.cancel}
                    </Button>
                    <Button type="submit" size={40}>
                      {d.sendOffer}
                    </Button>
                  </div>
                </form>
              ) : null}

              {panel === "message" ? (
                <form id="fl-mkl-message" className="fl-mkl-form" onSubmit={sendMessage} noValidate aria-label={d.messageSeller}>
                  <div className="fl-mkl-field" ref={messageRef}>
                    <label htmlFor="fl-mkl-msg" className="fl-mkl-label">
                      {d.messageLabel}
                    </label>
                    <TextField
                      id="fl-mkl-msg"
                      multiline
                      autoGrow
                      rows={3}
                      value={message}
                      invalid={!!messageError}
                      aria-describedby={messageError ? "fl-mkl-msg-err" : undefined}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (messageError) setMessageError("");
                      }}
                    />
                    {messageError ? (
                      <p id="fl-mkl-msg-err" className="fl-mkl-error">
                        <Icon name="alert" /> {messageError}
                      </p>
                    ) : null}
                  </div>
                  <div className="fl-mkl-form__end">
                    <Button variant="tertiary" size={40} onClick={() => setPanel("none")}>
                      {d.cancel}
                    </Button>
                    <Button type="submit" size={40}>
                      {d.sendMessage}
                    </Button>
                  </div>
                </form>
              ) : null}
            </section>

            <section className="fl-mkl-panel fl-mkl-where" aria-labelledby="fl-mkl-where-title">
              <h2 id="fl-mkl-where-title" className="fl-mkl-h2">
                {d.locationTitle}
              </h2>
              <AreaMap label={`Map of the area around ${l.place}, ${l.city}`} />
              <p className="fl-mkl-where__place">
                <Icon name="pin" /> {l.place}, {l.city} · {l.miles} mi from you
              </p>
              <p className="fl-mkl-muted">{d.locationNote}</p>
            </section>

            <section className="fl-mkl-panel fl-mkl-safety" aria-labelledby="fl-mkl-safety-title">
              <h2 id="fl-mkl-safety-title" className="fl-mkl-h2">
                <Icon name="shield" /> {d.safetyTitle}
              </h2>
              <ul>
                {d.safetyTips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <a className="fl-mkl-link" href="#report">
                {d.reportListing}
              </a>
            </section>
          </div>
        </main>

        <div className="fl-mkl-rows">
          <ListingRow id="fl-mkl-more" title={d.moreFromSeller} items={d.more} saved={savedOthers} onSave={toggleSaveOther} seeAll={d.seeAll} />
          <ListingRow id="fl-mkl-similar" title={d.similarTitle} items={d.similar} saved={savedOthers} onSave={toggleSaveOther} seeAll={d.seeAll} />
        </div>
      </div>
    </div>
  );
}
