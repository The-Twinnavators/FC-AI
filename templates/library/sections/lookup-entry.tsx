/** @flowcode-library lookup-entry · Look-up entry: details, where to find it near you, like, save, share, ratings (Cards)
 * Catalog ID: p.lookup-entry (pattern)
 * Function: The look-up entry page (p.lookup-entry): one entry in a "find it and where to get it" app (a product and the stores near you that carry it, a book and the libraries that hold it). Its picture, details and about text; Like, Save, Share (the device's share sheet, or copy link, email and social links) and Add to list (with a quantity and a new list made on the spot); the places near the person's ZIP code that carry it, nearest first, or the nearest one anywhere; and ratings with a star picker, comments, Helpful votes, and editing or deleting your own. Built on the look-up layer (createLookup from ./lookup-data beside the app's store). Also exports RatingsPanel and WhereToFind.
 * Use it as: import { LookupEntry, RatingsPanel, WhereToFind } from "./lookup-entry"; <LookupEntry lookup={lookup} id={routeId} onBack?={() => go("catalog")} backLabel? onOpenPlace?={(placeId) => go("place", placeId)} onOpenList?={(listId) => go("list", listId)} detailFields?={["ages", "pages"]} badgeField?="award" imageField?="cover" shareScreen?="book" loading? />; <RatingsPanel lookup={lookup} id={id} />; <WhereToFind lookup={lookup} id={id} onOpenPlace? />
 * Variants: p.lookup-entry.page - the whole page for one entry: header, actions, where to find it and ratings; p.lookup-entry.ratings - the ratings on their own: average, a 5-to-1 breakdown, a star picker to rate with an optional comment, your own rating with Edit and Delete, and everyone's comments with Helpful; p.lookup-entry.where - where to find it on its own: a ZIP code field, then the places near it that carry it with distance, address and hours, one of them chosen
 * Built from: c.button, c.text-field, c.menu, p.lookup-data
 * Look: A picture (or a tinted tile with the initials) beside the title, subtitle, category and a badge line, the key details in a row between hairlines and the about text; a row of quiet Like, Save, Share and Add to list buttons with counts; then "Where to find it" as a list of places with distances and a Choose button, and "Ratings" with a big average, gold stars, thin bars and the comments under it. Menus open below their button on a solid surface.
 * Tokens: --surface-bg --surface-border --surface-shadow --surface-blur --surface-radius --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-warning --color-danger --color-success --overlay-border --surface-shadow-overlay --radius-md --radius-sm --pill-radius --focus-ring --duration-fast --duration-base
 * Use cases: product page with stores near you; book page with libraries that hold it; medicine and the pharmacies that stock it; clinic service and where it is offered; farm shop product finder; parts finder; plant nursery stock
 * Jobs to be done: find out if a place near me has it; decide whether it is worth getting; keep it for later; put it on my shopping or reading list; tell a friend about it; say what I thought of it
 * Keywords: product page, item detail, where to buy, store finder, near me, zip code, availability, like, save, share, add to list, ratings, reviews, stars, comments, helpful
 */
/**
 * Look-up entry: the page for one entry in a look-up app. A header with the entry's picture (or a tinted tile when
 * there is none), title, subtitle, category, a badge line (an award, a certification) and its key details; then the
 * actions: Like and Save (toggles with counts that change at once, one per person), Share (the device's share sheet where
 * there is one; otherwise a small menu with Copy link, Email and a few social links) and Add to list (the person's lists
 * with a quantity, or a new list named on the spot). "Where to find it" asks for a ZIP code and lists the places near it
 * that carry the entry, nearest first, or names the nearest one anywhere; any of them can be chosen or opened. "Ratings"
 * shows the average and a 5-to-1 breakdown, a star picker (a radio group, arrow keys) with an optional comment, your own
 * rating with Edit and Delete (confirmed in place) and everyone's comments, newest first, with Helpful.
 * Signed out, every action says to sign in first. A missing id shows a calm not-found page; `loading` shows a skeleton.
 *
 * Written for FlowCode.
 *
 * Make it the app's own: make the look-up layer once (createLookup(store, config, seed) from ./lookup-data) and pass it
 * with the id from the address (useHashId). Pick the details shown with detailFields, the badge with badgeField and the
 * picture with imageField; wire onBack, onOpenPlace and onOpenList to your screens. The words for places ("library",
 * "has") come from the look-up config, so there is nothing to change here when the app changes.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { TextField } from "./text-fields-states";
import { Toaster, fieldOf, formatValue, toast, type EntityDef, type FieldDef, type RecordData } from "./app-data";
import { formatMiles, linkFor, shareLink, useLookup, type LookupStore, type NearbyPlace, type Rating } from "./lookup-data";
import { sampleLookup } from "./lookup-sample";

export type LookupEntryProps = {
  lookup: LookupStore;
  /** The entry's id; one that isn't there shows the not-found page. */
  id: string;
  /** Back to the catalog. The back link and the not-found page's button call it. */
  onBack?: () => void;
  /** The back link's words; "Back to <plural>" when left out. */
  backLabel?: string;
  /** Opens a place's page (the place finder). */
  onOpenPlace?: (placeId: string) => void;
  /** Opens one of the person's lists (the list builder). */
  onOpenList?: (listId: string) => void;
  /** The key details, by field key. The entry's short fields (choices, numbers, dates) when left out, up to four. */
  detailFields?: string[];
  /** A field shown as a badge line (an award, a certification). A field named like award or certification when left out. */
  badgeField?: string;
  /** A field holding the picture's address. A tinted tile with the initials when left out or empty. */
  imageField?: string;
  /** The screen name in the shared link (#/<screen>/<id>); the entries' key when left out. */
  shareScreen?: string;
  /** Still fetching: a skeleton in the page's shape. */
  loading?: boolean;
  /** What this app leaves out (a slice without them): their controls and panels aren't shown. Saving always stays. */
  omit?: Array<"likes" | "sharing" | "lists" | "places" | "ratings" | "comments">;
};

// ── Small helpers ──

const MAX_COMMENT = 1000;
const STAR_WORDS = ["", "Didn't like it", "It was okay", "Liked it", "Really liked it", "Loved it"];
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** "Sep 28, 2026". */
function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/** "4.5" (one decimal, none when whole). */
const avgText = (n: number) => (Math.round(n * 10) / 10).toLocaleString(undefined, { maximumFractionDigits: 1 });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
/** "has" → "have", "carries" → "carry": the verb for several places. */
const pluralVerb = (w: string) => (w === "has" ? "have" : w === "is" ? "are" : w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.endsWith("es") && /(ch|sh|ss|x)es$/.test(w) ? w.slice(0, -2) : w.replace(/s$/, ""));
const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w) && !/^(the|a|an|of|and)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || s.slice(0, 1).toUpperCase();
/** A steady tint (0 to 3) from an id, so the same entry always gets the same tile. */
const toneOf = (id: string) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4;

/** The key details worth a glance: choices, numbers and dates, not the title, subtitle, category, about text or badge. */
function defaultDetails(e: EntityDef, skip: string[]): FieldDef[] {
  return e.fields.filter((f) => !skip.includes(f.key) && f.key !== e.titleField && f.key !== e.subtitleField && ["select", "number", "money", "percent", "date", "boolean"].includes(f.type)).slice(0, 4);
}

/** The words a look-up app uses for its places. */
function wordsOf(lookup: LookupStore) {
  const pe = lookup.app.entity(lookup.config.places);
  const one = lookup.config.placeWord ?? pe.label.toLowerCase();
  const many = pe.plural.toLowerCase();
  const carry = lookup.config.carryWord ?? "carries";
  return { pe, one, many, carry, carryMany: pluralVerb(carry) };
}

/** Closes a popup on a click outside it, and gives back nothing else. */
function useOutside(open: boolean, refs: Array<RefObject<HTMLElement | null>>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const on = (ev: PointerEvent) => {
      if (refs.every((r) => !r.current?.contains(ev.target as Node))) close();
    };
    document.addEventListener("pointerdown", on);
    return () => document.removeEventListener("pointerdown", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}

/** Up/Down/Home/End move between the popup's items (those marked data-item). */
function moveFocus(ev: ReactKeyboardEvent, root: HTMLElement | null) {
  if (!root || !["ArrowDown", "ArrowUp", "Home", "End"].includes(ev.key)) return false;
  const items = [...root.querySelectorAll<HTMLElement>("[data-item]")].filter((el) => !el.hasAttribute("disabled"));
  if (!items.length) return false;
  ev.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next = ev.key === "Home" ? 0 : ev.key === "End" ? items.length - 1 : ev.key === "ArrowDown" ? (at + 1) % items.length : (at - 1 + items.length) % items.length;
  items[next]!.focus();
  return true;
}

/** A bookmark, drawn here (the shared icon set has none). Filled while saved. */
function Bookmark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-6-4.5L6 21z" />
    </svg>
  );
}

/** Five stars, read out as one value ("4.5 out of 5"). */
function Stars({ value, label, size = "md" }: { value: number; label?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span className={`fl-ent-stars fl-ent-stars--${size}`} role="img" aria-label={label ?? `${avgText(value)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="fl-ent-star" aria-hidden="true">
            <Icon name="star" />
            {fill > 0 ? (
              <span className="fl-ent-star-fill" style={{ width: `${Math.round(fill * 100)}%` }}>
                <Icon name="star" filled />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

// ── The star picker: a radio group, arrow keys move and choose ──

function StarPicker({ value, onChange, labelId, describedBy, invalid, pickerRef }: { value: number; onChange: (n: number) => void; labelId: string; describedBy?: string; invalid?: boolean; pickerRef?: RefObject<HTMLDivElement | null> }) {
  const [hover, setHover] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const shown = hover || value;
  const set = (n: number) => {
    const v = Math.max(1, Math.min(5, n));
    onChange(v);
    refs.current[v - 1]?.focus();
  };
  const onKey = (ev: ReactKeyboardEvent, n: number) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowUp") set(n + 1);
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") set(n - 1);
    else if (ev.key === "Home") set(1);
    else if (ev.key === "End") set(5);
    else if (ev.key === " " || ev.key === "Enter") set(n);
    else return;
    ev.preventDefault();
  };
  return (
    <div className="fl-ent-picker-row">
      <div ref={pickerRef} className="fl-ent-picker" role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} aria-invalid={invalid || undefined} aria-required="true" onPointerLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${STAR_WORDS[n]!.toLowerCase()}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
            className={`fl-ent-pick${n <= shown ? " is-on" : ""}`}
            onClick={() => set(n)}
            onPointerEnter={() => setHover(n)}
            onKeyDown={(ev) => onKey(ev, n)}
          >
            <Icon name="star" filled={n <= shown} />
          </button>
        ))}
      </div>
      <span className="fl-ent-picker-word" aria-hidden="true">
        {shown ? STAR_WORDS[shown] : "Choose 1 to 5 stars"}
      </span>
    </div>
  );
}

// ── The rate form: new, or editing your own ──

function RateForm({ lookup, id, mine, onDone }: { lookup: LookupStore; id: string; mine?: Rating; onDone?: () => void }) {
  const uid = useId();
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [text, setText] = useState(mine?.text ?? "");
  const [error, setError] = useState("");
  const picker = useRef<HTMLDivElement>(null);
  const signedIn = useLookup(lookup).signedIn;
  const left = MAX_COMMENT - text.length;
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (!stars) {
      setError("Choose 1 to 5 stars first. The comment is optional.");
      picker.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
      return;
    }
    const res = mine ? lookup.editRating(mine.id, stars, text) : lookup.rate(id, stars, text);
    if (!res.ok) {
      setError(signedIn ? res.message : "");
      return;
    }
    toast(res.message);
    setError("");
    if (!mine) {
      setStars(0);
      setText("");
    }
    onDone?.();
  };
  return (
    <form className="fl-ent-rate" onSubmit={submit} noValidate>
      <p id={`${uid}-l`} className="fl-ent-rate-title">
        {mine ? "Change your rating" : "Rate it"}
      </p>
      <StarPicker
        value={stars}
        onChange={(n) => {
          setStars(n);
          setError("");
        }}
        labelId={`${uid}-l`}
        describedBy={error ? `${uid}-err` : undefined}
        invalid={!!error && !stars}
        pickerRef={picker}
      />
      <label className="fl-ent-label" htmlFor={`${uid}-c`}>
        Comment <span className="fl-ent-optional">(optional)</span>
      </label>
      <TextField multiline autoGrow id={`${uid}-c`} rows={3} maxLength={MAX_COMMENT} value={text} placeholder="What did you think?" aria-describedby={`${uid}-n`} onChange={(ev) => setText(ev.target.value.slice(0, MAX_COMMENT))} />
      <p id={`${uid}-n`} className={`fl-ent-counter${left <= 50 ? " is-near" : ""}`} aria-live={left <= 50 ? "polite" : "off"}>
        {left <= 50 ? `${left} characters left` : `${text.length.toLocaleString()} / ${MAX_COMMENT.toLocaleString()}`}
      </p>
      {error ? (
        <p id={`${uid}-err`} className="fl-ent-error" role="alert">
          <Icon name="alert" />
          {error}
        </p>
      ) : null}
      <div className="fl-ent-rate-bar">
        {!signedIn ? <span className="fl-ent-hint">Sign in to post a rating.</span> : null}
        {mine ? (
          <Button variant="secondary" size={40} onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" size={40}>
          {mine ? "Save changes" : "Post rating"}
        </Button>
      </div>
    </form>
  );
}

// ── Ratings: average, breakdown, the form or your own, and everyone's comments ──

export function RatingsPanel({ lookup, id }: { lookup: LookupStore; id: string }) {
  const uid = useId();
  const st = useLookup(lookup);
  const me = lookup.me();
  const sum = lookup.summary(id);
  const all = lookup.ratingsFor(id);
  const mine = st.signedIn ? all.find((r) => r.who === me) : undefined;
  const others = all.filter((r) => r !== mine);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const editBtn = useRef<HTMLButtonElement>(null);
  const deleteBtn = useRef<HTMLButtonElement>(null);
  const keepBtn = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Where focus goes once the page has re-rendered (the control that had it may be gone).
  const focusNext = useRef<"edit" | "delete" | "heading" | null>(null);
  useEffect(() => {
    if (confirming) keepBtn.current?.focus();
  }, [confirming]);
  useEffect(() => {
    const to = focusNext.current;
    if (!to) return;
    focusNext.current = null;
    (to === "edit" ? editBtn : to === "delete" ? deleteBtn : heading).current?.focus();
  });
  const shown = showAll ? others : others.slice(0, 4);
  const max = Math.max(1, ...Object.values(sum.breakdown));
  return (
    <section className="fl-ent-section fl-ent-ratings" aria-labelledby={`${uid}-h`} data-fl="p.lookup-entry.ratings">
      <h2 id={`${uid}-h`} ref={heading} tabIndex={-1} className="fl-ent-h2">
        Ratings
      </h2>
      <div className="fl-ent-ratings-top">
        <div className="fl-ent-summary">
          {sum.count ? (
            <>
              <p className="fl-ent-avg" aria-hidden="true">
                {avgText(sum.average)}
              </p>
              <Stars value={sum.average} size="lg" label={`${avgText(sum.average)} out of 5, ${plural(sum.count, "rating", "ratings")}`} />
              <p className="fl-ent-muted" aria-hidden="true">
                {plural(sum.count, "rating", "ratings")}
              </p>
            </>
          ) : (
            <p className="fl-ent-muted">No ratings yet. Be the first.</p>
          )}
          <ul className="fl-ent-bars" aria-label="How people rated it">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <li key={n} className="fl-ent-bar-row">
                <span className="fl-ent-bar-label">{n} ★<span className="fl-ent-sr"> {n === 1 ? "star" : "stars"}:</span></span>
                <span className="fl-ent-bar" aria-hidden="true">
                  <span className="fl-ent-bar-fill" style={{ width: `${(sum.breakdown[n] / max) * 100}%` }} />
                </span>
                <span className="fl-ent-bar-count">
                  {sum.breakdown[n]}
                  <span className="fl-ent-sr"> {sum.breakdown[n] === 1 ? "rating" : "ratings"}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="fl-ent-yours">
          {mine && !editing ? (
            <div className="fl-ent-mine">
              <p className="fl-ent-rate-title">Your rating</p>
              <div className="fl-ent-mine-head">
                <Stars value={mine.stars} label={`You gave it ${mine.stars} out of 5`} />
                <span className="fl-ent-muted">
                  {day(mine.editedAt ?? mine.at)}
                  {mine.editedAt ? " (edited)" : ""}
                </span>
              </div>
              {mine.text ? <p className="fl-ent-text">{mine.text}</p> : <p className="fl-ent-muted">No comment.</p>}
              {confirming ? (
                <div className="fl-ent-confirm" role="group" aria-labelledby={`${uid}-cf`}>
                  <p id={`${uid}-cf`} className="fl-ent-confirm-text">
                    Delete your rating{mine.text ? " and comment" : ""}? This can't be undone.
                  </p>
                  <div className="fl-ent-row">
                    <Button
                      ref={keepBtn}
                      variant="secondary"
                      size={40}
                      onClick={() => {
                        focusNext.current = "delete";
                        setConfirming(false);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === "Escape") {
                          focusNext.current = "delete";
                          setConfirming(false);
                        }
                      }}
                    >
                      Keep it
                    </Button>
                    <Button
                      variant="destructive"
                      size={40}
                      icon="trash"
                      onKeyDown={(ev) => {
                        if (ev.key === "Escape") {
                          focusNext.current = "delete";
                          setConfirming(false);
                        }
                      }}
                      onClick={() => {
                        focusNext.current = "heading";
                        lookup.deleteRating(mine.id);
                        setConfirming(false);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="fl-ent-row">
                  <Button ref={editBtn} variant="secondary" size={40} icon="pencil" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button ref={deleteBtn} variant="tertiary" size={40} icon="trash" onClick={() => setConfirming(true)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <RateForm
              key={mine ? `edit-${mine.id}` : "new"}
              lookup={lookup}
              id={id}
              mine={editing ? mine : undefined}
              onDone={() => {
                // Posted or saved: focus goes to your rating's Edit button, which replaces the form.
                focusNext.current = "edit";
                setEditing(false);
              }}
            />
          )}
        </div>
      </div>

      {others.length ? (
        <>
          <h3 className="fl-ent-h3">What people say</h3>
          <ol className="fl-ent-comments">
            {shown.map((r) => {
              const helped = r.helpedBy.includes(me) && st.signedIn;
              return (
                <li key={r.id} className="fl-ent-comment">
                  <div className="fl-ent-comment-head">
                    <span className="fl-ent-avatar" aria-hidden="true">
                      {initials(r.who)}
                    </span>
                    <span className="fl-ent-who">{r.who}</span>
                    <Stars value={r.stars} size="sm" />
                    <time className="fl-ent-muted" dateTime={r.at}>
                      {day(r.at)}
                      {r.editedAt ? " (edited)" : ""}
                    </time>
                  </div>
                  {r.text ? <p className="fl-ent-text">{r.text}</p> : null}
                  <button
                    type="button"
                    className={`fl-ent-helpful${helped ? " is-on" : ""}`}
                    aria-pressed={helped}
                    aria-disabled={helped || undefined}
                    onClick={() => {
                      if (helped) return;
                      lookup.markHelpful(r.id);
                    }}
                  >
                    <Icon name="thumbs-up" filled={helped} />
                    {helped ? "You found this helpful" : "Helpful"} ({r.helpful})
                  </button>
                </li>
              );
            })}
          </ol>
          {others.length > 4 ? (
            <Button variant="tertiary" size={40} aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${others.length} comments`}
            </Button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

// ── Where to find it: a ZIP code, then the places near it that carry the entry ──

function ZipForm({ lookup, onResult, autoFocus }: { lookup: LookupStore; onResult: (msg: string) => void; autoFocus?: boolean }) {
  const uid = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const focusInput = () => document.getElementById(`${uid}-z`)?.focus();
  useEffect(() => {
    if (autoFocus) focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);
  return (
    <form
      className="fl-ent-zip"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const res = lookup.setZip(value);
        if (!res.ok) {
          setError(res.message);
          focusInput();
          return;
        }
        setError("");
        onResult(res.message);
      }}
    >
      <label className="fl-ent-label" htmlFor={`${uid}-z`}>
        Your ZIP code
      </label>
      <div className="fl-ent-zip-row">
        <TextField
          id={`${uid}-z`}
          size={40}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          placeholder="94110"
          value={value}
          invalid={!!error}
          aria-describedby={error ? `${uid}-e` : `${uid}-h`}
          className="fl-ent-zip-input"
          onChange={(ev) => {
            setValue(ev.target.value.replace(/\D/g, "").slice(0, 5));
            if (error) setError("");
          }}
        />
        <Button type="submit" variant="primary" size={40} icon="search">
          Find near me
        </Button>
      </div>
      {error ? (
        <p id={`${uid}-e`} className="fl-ent-error" role="alert">
          <Icon name="alert" />
          {error}
        </p>
      ) : (
        <p id={`${uid}-h`} className="fl-ent-hint">
          Five digits. We use it only to sort what's near you.
        </p>
      )}
    </form>
  );
}

function PlaceRow({ lookup, near, chosen, onOpenPlace, nearest }: { lookup: LookupStore; near: NearbyPlace; chosen: boolean; onOpenPlace?: (id: string) => void; nearest?: boolean }) {
  const { pe } = wordsOf(lookup);
  const p = near.place;
  const name = String(p[pe.titleField] ?? p.id);
  const address = pe.subtitleField ? String(p[pe.subtitleField] ?? "") : "";
  const hours = fieldOf(pe, "hours") ? String(p.hours ?? "") : "";
  return (
    <li className={`fl-ent-place${chosen ? " is-chosen" : ""}`}>
      <div className="fl-ent-place-main">
        <p className="fl-ent-place-name">
          {name}
          {chosen ? (
            <span className="fl-ent-chosen">
              <Icon name="check" />
              Your {wordsOf(lookup).one}
            </span>
          ) : null}
          {nearest ? <span className="fl-ent-tag">Nearest</span> : null}
        </p>
        <p className="fl-ent-place-meta">
          <span className="fl-ent-miles">
            <Icon name="pin" />
            {formatMiles(near.miles)}
          </span>
          {address ? <span>{address}</span> : null}
          {hours ? (
            <span className="fl-ent-hours">
              <Icon name="clock" />
              {hours}
            </span>
          ) : null}
        </p>
      </div>
      <div className="fl-ent-place-acts">
        <Button variant={chosen ? "secondary" : "tertiary"} size={32} pressed={chosen} aria-label={chosen ? `${name} is chosen` : `Choose ${name}`} onClick={() => lookup.choosePlace(chosen ? undefined : p.id)}>
          {chosen ? "Chosen" : "Choose"}
        </Button>
        {onOpenPlace ? (
          <Button variant="tertiary" size={32} icon="chevron-right" iconAt="end" aria-label={`Open ${name}`} onClick={() => onOpenPlace(p.id)}>
            Open
          </Button>
        ) : null}
      </div>
    </li>
  );
}

export function WhereToFind({ lookup, id, onOpenPlace }: { lookup: LookupStore; id: string; onOpenPlace?: (placeId: string) => void }) {
  const uid = useId();
  const st = useLookup(lookup);
  const w = wordsOf(lookup);
  // setZip's answer, kept with the ZIP code it was about (the ZIP code can also change elsewhere).
  const [said, setMessage] = useState<{ zip?: string; text: string }>({ text: "" });
  const message = said.zip && said.zip === st.zip ? said.text : "";
  const [changing, setChanging] = useState(false);
  const changeBtn = useRef<HTMLButtonElement>(null);
  // Once the ZIP form gives way to the list, focus goes to "Change" (the form's field is gone).
  const focusChange = useRef(false);
  useEffect(() => {
    if (!focusChange.current) return;
    focusChange.current = false;
    changeBtn.current?.focus();
  });
  const area = st.zip ? lookup.area(st.zip) : undefined;
  const carriers = st.zip ? lookup.carriers(id, st.zip) : [];
  const nearest = st.zip && !carriers.length ? lookup.nearestCarrier(id, st.zip) : undefined;
  // The person's chosen place, when it doesn't carry this entry: worth saying, so they don't make the trip.
  const chosenLacks = st.zip && st.placeId && !lookup.carries(st.placeId, id) ? lookup.app.get().records[lookup.config.places]?.find((p) => p.id === st.placeId) : undefined;
  const ask = !st.zip || changing;
  return (
    <section className="fl-ent-section fl-ent-where" aria-labelledby={`${uid}-h`} data-fl="p.lookup-entry.where">
      <div className="fl-ent-where-head">
        <h2 id={`${uid}-h`} className="fl-ent-h2">
          Where to find it
        </h2>
        {st.zip && !changing ? (
          <p className="fl-ent-near">
            <Icon name="pin" />
            <span>
              Near <strong>{st.zip}</strong>
              {area ? ` (${area.label})` : ""}
            </span>
            <button ref={changeBtn} type="button" className="fl-ent-link" onClick={() => setChanging(true)}>
              Change
            </button>
          </p>
        ) : null}
      </div>
      {ask ? (
        <>
          <p className="fl-ent-muted">Enter your ZIP code to see which {w.many} near you {w.carryMany} it.</p>
          <ZipForm
            lookup={lookup}
            autoFocus={changing}
            onResult={(msg) => {
              setMessage({ zip: lookup.get().zip, text: msg });
              focusChange.current = true;
              setChanging(false);
            }}
          />
          {changing ? (
            <div className="fl-ent-row">
              <Button
                variant="tertiary"
                size={32}
                onClick={() => {
                  focusChange.current = true;
                  setChanging(false);
                }}
              >
                Keep {st.zip}
              </Button>
              <Button
                variant="tertiary"
                size={32}
                onClick={() => {
                  lookup.clearZip();
                  setChanging(false);
                  setMessage({ text: "" });
                }}
              >
                Forget my ZIP code
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <p className="fl-ent-status" role="status">
            {area ? message : ""}
          </p>
          {carriers.length ? (
            <>
              <p className="fl-ent-muted">
                {carriers.length === 1 ? `1 ${w.one} near you ${w.carry} it.` : `${carriers.length} ${w.many} near you ${w.carryMany} it, nearest first.`}
              </p>
              <ul className="fl-ent-places">
                {carriers.map((c) => (
                  <PlaceRow key={c.place.id} lookup={lookup} near={c} chosen={c.place.id === st.placeId} onOpenPlace={onOpenPlace} />
                ))}
              </ul>
            </>
          ) : nearest ? (
            <>
              <p className="fl-ent-none">
                <Icon name="info" />
                <span>
                  None of the {w.many} near {st.zip} {w.carryMany} it. Nearest: <strong>{String(nearest.place[w.pe.titleField] ?? nearest.place.id)}</strong>, {formatMiles(nearest.miles)}.
                </span>
              </p>
              <ul className="fl-ent-places">
                <PlaceRow lookup={lookup} near={nearest} chosen={nearest.place.id === st.placeId} onOpenPlace={onOpenPlace} nearest />
              </ul>
            </>
          ) : area ? (
            <p className="fl-ent-none">
              <Icon name="info" />
              <span>
                No {w.one} anywhere {w.carry} it yet.
              </span>
            </p>
          ) : (
            <p className="fl-ent-none" role="status">
              <Icon name="info" />
              <span>
                We don't know any {w.many} near {st.zip} yet. Try {lookup.config.areas.map((a) => a.zip).join(", ")}.
              </span>
            </p>
          )}
          {chosenLacks ? (
            <p className="fl-ent-muted">
              Your {w.one}, {String(chosenLacks[w.pe.titleField] ?? chosenLacks.id)}, doesn't {w.carryMany} it.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

// ── Share: the device's share sheet, or a menu ──

function ShareMenu({ title, url, text }: { title: string; url: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const close = (focus = true) => {
    setOpen(false);
    if (focus) trigger.current?.focus();
  };
  useOutside(open, [menu, trigger], () => setOpen(false));
  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>("[data-item]")?.focus();
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(t);
  }, [copied]);
  const e = encodeURIComponent;
  const links = [
    { name: "Email", icon: "mail", href: `mailto:?subject=${e(title)}&body=${e(`${text}\n\n${url}`)}`, newTab: false },
    { name: "X", icon: "send", href: `https://twitter.com/intent/tweet?text=${e(title)}&url=${e(url)}`, newTab: true },
    { name: "Facebook", icon: "globe", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`, newTab: true },
    { name: "WhatsApp", icon: "phone", href: `https://wa.me/?text=${e(`${title} ${url}`)}`, newTab: true },
    { name: "Pinterest", icon: "image", href: `https://pinterest.com/pin/create/button/?url=${e(url)}&description=${e(title)}`, newTab: true },
  ];
  // The device's share sheet on phones and tablets; on a computer the menu (with the sheet as one of its items).
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const hasSheet = canShare && typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
  /** Copies the link; the older copy command where the clipboard API is refused (an embedded frame). True when it worked. */
  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (ok) {
      toast("Link copied.");
      setCopied(true);
    } else toast("Couldn't copy the link. Select it in the menu and copy it instead.", "warning");
    return ok;
  };
  return (
    <div className="fl-ent-pop-wrap">
      <Button
        ref={trigger}
        variant="secondary"
        size={40}
        icon="share"
        aria-haspopup={hasSheet ? undefined : "menu"}
        aria-expanded={hasSheet ? undefined : open}
        aria-controls={open ? menuId : undefined}
        onClick={async () => {
          if (hasSheet) {
            await shareLink(title, url, text);
            return;
          }
          setOpen((v) => !v);
        }}
        onKeyDown={(ev) => {
          if (!hasSheet && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
            ev.preventDefault();
            setOpen(true);
          }
        }}
      >
        {copied ? "Link copied" : "Share"}
      </Button>
      {open ? (
        <div
          ref={menu}
          id={menuId}
          className="fl-ent-menu"
          role="menu"
          aria-label="Share"
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              ev.stopPropagation();
              close();
            } else if (ev.key === "Tab") setOpen(false);
            else moveFocus(ev, menu.current);
          }}
        >
          <button
            type="button"
            role="menuitem"
            data-item
            className="fl-ent-menu-item"
            onClick={async () => {
              // Left open when copying fails, so the link can be selected by hand.
              if (await copy()) close();
            }}
          >
            <Icon name="link" />
            Copy link
          </button>
          {canShare ? (
            <button
              type="button"
              role="menuitem"
              data-item
              className="fl-ent-menu-item"
              onClick={() => {
                close();
                void shareLink(title, url, text);
              }}
            >
              <Icon name="share" />
              Share with an app…
            </button>
          ) : null}
          <p className="fl-ent-menu-url" title={url}>
            {url}
          </p>
          <div className="fl-ent-menu-sep" role="separator" />
          {links.map((l) => (
            <a key={l.name} role="menuitem" data-item className="fl-ent-menu-item" href={l.href} {...(l.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})} onClick={() => close()}>
              <Icon name={l.icon} />
              {l.name}
              {l.newTab ? <span className="fl-ent-sr"> (opens in a new tab)</span> : null}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Add to list: the person's lists with a quantity, or a new one ──

function AddToList({ lookup, id, title }: { lookup: LookupStore; id: string; title: string }) {
  const st = useLookup(lookup);
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const focusName = () => document.getElementById(`${uid}-n`)?.focus();
  const close = (focus = true) => {
    setOpen(false);
    setMaking(false);
    setName("");
    setError("");
    if (focus) trigger.current?.focus();
  };
  useOutside(open, [pop, trigger], () => close(false));
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>("[data-item]")?.focus();
  }, [open]);
  useEffect(() => {
    if (making) focusName();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [making]);
  const add = (listId: string) => {
    lookup.addToList(listId, id, qty);
    setQty(1);
    close();
  };
  const make = (ev: FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) {
      setError("Give the list a name.");
      focusName();
      return;
    }
    const list = lookup.createList(name);
    if (list) add(list.id);
  };
  const qtyOf = (listId: string) => st.lists.find((l) => l.id === listId)?.items.find((i) => i.entryId === id)?.qty;
  return (
    <div className="fl-ent-pop-wrap">
      <Button
        ref={trigger}
        variant="secondary"
        size={40}
        icon="plus"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (open) return close();
          if (lookup.needsSignIn("add it to a list")) return;
          setOpen(true);
        }}
      >
        Add to list
      </Button>
      {open ? (
        <div
          ref={pop}
          className="fl-ent-pop"
          role="dialog"
          aria-label={`Add ${title} to a list`}
          onKeyDown={(ev) => {
            if (ev.key === "Escape") {
              ev.stopPropagation();
              close();
              return;
            }
            const t = ev.target as HTMLElement;
            if (t.tagName !== "INPUT") moveFocus(ev, pop.current);
          }}
        >
          <div className="fl-ent-qty">
            <span id={`${uid}-q`} className="fl-ent-label">
              Quantity
            </span>
            <div className="fl-ent-stepper" role="group" aria-labelledby={`${uid}-q`}>
              <button type="button" className="fl-ent-step" aria-label="One fewer" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <output className="fl-ent-step-value" aria-live="polite" aria-label={`Quantity ${qty}`}>
                {qty}
              </output>
              <button type="button" className="fl-ent-step" aria-label="One more" disabled={qty >= 99} onClick={() => setQty((q) => Math.min(99, q + 1))}>
                +
              </button>
            </div>
          </div>
          <p className="fl-ent-pop-title">Your lists</p>
          {st.lists.length ? (
            <ul className="fl-ent-pop-lists">
              {st.lists.map((l) => {
                const has = qtyOf(l.id);
                return (
                  <li key={l.id}>
                    <button type="button" data-item className="fl-ent-menu-item" onClick={() => add(l.id)}>
                      <Icon name={has ? "check" : "folder"} />
                      <span className="fl-ent-menu-text">
                        {l.name}
                        <span className="fl-ent-menu-note">{has ? `Has ${has}, adds ${qty} more` : plural(l.items.length, "item", "items")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fl-ent-muted">No lists yet.</p>
          )}
          <div className="fl-ent-menu-sep" role="separator" />
          {making ? (
            <form className="fl-ent-newlist" onSubmit={make} noValidate>
              <label className="fl-ent-label" htmlFor={`${uid}-n`}>
                New list name
              </label>
              <TextField
                id={`${uid}-n`}
                size={40}
                maxLength={60}
                value={name}
                placeholder="Weekend reading"
                invalid={!!error}
                aria-describedby={error ? `${uid}-ne` : undefined}
                onChange={(ev) => {
                  setName(ev.target.value);
                  if (error) setError("");
                }}
              />
              {error ? (
                <p id={`${uid}-ne`} className="fl-ent-error" role="alert">
                  <Icon name="alert" />
                  {error}
                </p>
              ) : null}
              <div className="fl-ent-row">
                <Button variant="tertiary" size={32} onClick={() => setMaking(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size={32}>
                  Make it and add
                </Button>
              </div>
            </form>
          ) : (
            <button type="button" data-item className="fl-ent-menu-item" onClick={() => setMaking(true)}>
              <Icon name="plus" />
              New list…
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── The page ──

function Skeleton() {
  return (
    <div className="fl-ent-page fl-ent-skel" aria-busy="true" data-fl="p.lookup-entry.page">
      <p className="fl-ent-sr" role="status">
        Loading…
      </p>
      <div className="fl-ent-head" aria-hidden="true">
        <span className="fl-ent-skel-pic" />
        <div className="fl-ent-skel-lines">
          <span className="fl-ent-skel-line" style={{ width: "30%" }} />
          <span className="fl-ent-skel-line fl-ent-skel-line--big" style={{ width: "70%" }} />
          <span className="fl-ent-skel-line" style={{ width: "45%" }} />
          <span className="fl-ent-skel-line" style={{ width: "90%" }} />
          <span className="fl-ent-skel-line" style={{ width: "80%" }} />
        </div>
      </div>
      <div className="fl-ent-skel-row" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="fl-ent-skel-btn" />
        ))}
      </div>
      <div className="fl-ent-skel-lines" aria-hidden="true">
        <span className="fl-ent-skel-line fl-ent-skel-line--big" style={{ width: "40%" }} />
        <span className="fl-ent-skel-line" style={{ width: "100%" }} />
        <span className="fl-ent-skel-line" style={{ width: "100%" }} />
      </div>
    </div>
  );
}

export function LookupEntry({ lookup, id, onBack, backLabel, onOpenPlace, onOpenList, detailFields, badgeField, imageField, shareScreen, loading, omit = [] }: LookupEntryProps) {
  const st = useLookup(lookup);
  const e = lookup.app.entity(lookup.config.entries);
  const rec: RecordData | undefined = (lookup.app.get().records[e.key] ?? []).find((r) => r.id === id);
  const heading = useRef<HTMLHeadingElement>(null);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [id]);

  const aboutField = useMemo(() => e.fields.find((f) => f.type === "longtext"), [e]);
  const badgeKey = badgeField ?? e.fields.find((f) => /award|certif|badge|label/i.test(`${f.key} ${f.label}`) && f.type === "text")?.key;
  const catField = fieldOf(e, lookup.config.categoryField);
  const details = useMemo(() => {
    const skip = [lookup.config.categoryField, lookup.config.placesField, aboutField?.key ?? "", badgeKey ?? "", imageField ?? ""];
    return detailFields ? detailFields.map((k) => fieldOf(e, k)).filter((f): f is FieldDef => !!f) : defaultDetails(e, skip);
  }, [e, detailFields, lookup.config, aboutField, badgeKey, imageField]);

  if (loading) return <Skeleton />;

  const back = onBack ? (
    <button type="button" className="fl-ent-back" onClick={onBack}>
      <Icon name="arrow-left" />
      {backLabel ?? `Back to ${e.plural.toLowerCase()}`}
    </button>
  ) : null;

  if (!rec) {
    return (
      <div className="fl-ent-page" data-fl="p.lookup-entry.page">
        {back}
        <div className="fl-ent-missing">
          <span className="fl-ent-missing-icon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <h1 className="fl-ent-missing-title">We couldn't find that {e.label.toLowerCase()}</h1>
          <p className="fl-ent-muted">
            There is no {e.label.toLowerCase()} {id ? <span className="fl-ent-id">{id}</span> : null} here. It may have been removed, or the link may be missing a part.
          </p>
          {onBack ? (
            <Button variant="primary" size={40} icon="arrow-left" onClick={onBack}>
              {backLabel ?? `Back to ${e.plural.toLowerCase()}`}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const title = String(rec[e.titleField] ?? rec.id);
  const subtitle = e.subtitleField ? String(rec[e.subtitleField] ?? "") : "";
  const category = rec[lookup.config.categoryField] ? formatValue(catField, rec[lookup.config.categoryField]) : "";
  const badge = badgeKey && rec[badgeKey] ? String(rec[badgeKey]) : "";
  const about = aboutField && rec[aboutField.key] ? String(rec[aboutField.key]) : "";
  const img = imageField && typeof rec[imageField] === "string" && rec[imageField] && !imgFailed ? String(rec[imageField]) : "";
  const likes = lookup.likes(rec.id);
  const saves = lookup.saves(rec.id);
  const url = linkFor(shareScreen ?? e.key, rec.id);
  const inLists = st.signedIn ? st.lists.filter((l) => l.items.some((i) => i.entryId === rec.id)) : [];

  return (
    <article className="fl-ent-page" aria-labelledby={`fl-ent-${rec.id}`} data-fl="p.lookup-entry.page">
      {back}
      <header className="fl-ent-head">
        <div className="fl-ent-pic" data-tone={toneOf(rec.id)}>
          {img ? <img src={img} alt="" onError={() => setImgFailed(true)} /> : <span className="fl-ent-pic-initials" aria-hidden="true">{initials(title)}</span>}
        </div>
        <div className="fl-ent-titles">
          {category ? <p className="fl-ent-cat">{category}</p> : null}
          <h1 id={`fl-ent-${rec.id}`} ref={heading} tabIndex={-1} className="fl-ent-title">
            {title}
          </h1>
          {subtitle ? <p className="fl-ent-sub">{subtitle}</p> : null}
          {badge ? (
            <p className="fl-ent-badge">
              <Icon name="sparkle" />
              {badge}
            </p>
          ) : null}
          {details.length ? (
            <dl className="fl-ent-facts">
              {details.map((f) => (
                <div key={f.key} className="fl-ent-fact">
                  <dt>{f.label}</dt>
                  <dd>{formatValue(f, rec[f.key])}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {about ? <p className="fl-ent-about">{about}</p> : null}
        </div>
      </header>

      <div className="fl-ent-actions" role="group" aria-label="Actions">
        {omit.includes("likes") ? null : <Button variant="secondary" size={40} icon="heart" pressed={likes.mine} aria-label={`Like, ${plural(likes.count, "like", "likes")}`} onClick={() => lookup.toggleLike(rec.id)}>
          {likes.mine ? "Liked" : "Like"} <span className="fl-ent-count">{likes.count.toLocaleString()}</span>
        </Button>}
        <Button variant="secondary" size={40} pressed={saves.mine} aria-label={`Save, ${plural(saves.count, "save", "saves")}`} onClick={() => lookup.toggleSave(rec.id)}>
          <Bookmark on={saves.mine} />
          {saves.mine ? "Saved" : "Save"} <span className="fl-ent-count">{saves.count.toLocaleString()}</span>
        </Button>
        {omit.includes("sharing") ? null : <ShareMenu title={title} url={url} text={[subtitle, about].filter(Boolean).join(". ").slice(0, 200)} />}
        {omit.includes("lists") ? null : <AddToList lookup={lookup} id={rec.id} title={title} />}
      </div>
      {!st.signedIn ? (
        <p className="fl-ent-signin">
          <Icon name="lock" />
          <span>Sign in to {[!omit.includes("likes") && "like", "save", !omit.includes("ratings") && "rate it", !omit.includes("lists") && "add it to a list"].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " or $1")}.</span>
          <Button variant="primary" size={32} onClick={() => lookup.signIn()}>
            Sign in
          </Button>
        </p>
      ) : inLists.length && !omit.includes("lists") ? (
        <p className="fl-ent-inlists">
          <Icon name="folder" />
          <span>In your lists:</span>
          {inLists.map((l, i) => {
            const q = l.items.find((x) => x.entryId === rec.id)?.qty ?? 1;
            const label = `${l.name}${q > 1 ? ` (${q})` : ""}`;
            return (
              <span key={l.id}>
                {onOpenList ? (
                  <button type="button" className="fl-ent-link" onClick={() => onOpenList(l.id)}>
                    {label}
                  </button>
                ) : (
                  label
                )}
                {i < inLists.length - 1 ? ", " : ""}
              </span>
            );
          })}
        </p>
      ) : null}

      {omit.includes("places") ? null : <WhereToFind lookup={lookup} id={rec.id} onOpenPlace={onOpenPlace} />}
      {omit.includes("ratings") && omit.includes("comments") ? null : <RatingsPanel lookup={lookup} id={rec.id} />}
    </article>
  );
}

// flowcode:sample
const SAMPLE = {
  id: "BK-1001",
  missing: "BK-9999",
  ratingsId: "BK-1011",
  whereId: "BK-1016",
  zips: ["94110", "78704"],
  heading: "Look-up entry",
  what: "A book's page in a library finder: like, save, share and add it to a list, see which libraries near a ZIP code have it, and rate it. Try the ZIP codes, clearing it and typing one (a ZIP code with no libraries nearby names the nearest one anywhere), and signing out. Changes are kept in this browser and show on the other look-up pieces.",
  ratingsHeading: "Ratings on their own",
  ratingsWhat: "The same ratings panel for another book: the average, the breakdown, a star picker you can use with the arrow keys, and Helpful on other people's comments.",
  whereHeading: "Where to find it on its own",
  whereWhat: "The same place list for another book, following the ZIP code set above.",
};

export default function LookupEntrySheet() {
  const s = SAMPLE;
  const st = useLookup(sampleLookup);
  const [view, setView] = useState<"page" | "missing" | "loading">("page");
  const [zipMsg, setZipMsg] = useState("");
  useEffect(() => {
    if (view !== "loading") return;
    const t = window.setTimeout(() => setView("page"), reducedMotion() ? 2400 : 1800);
    return () => window.clearTimeout(t);
  }, [view]);
  const views: Array<[typeof view, string]> = [
    ["page", "The page"],
    ["missing", "Not found"],
    ["loading", "Loading"],
  ];
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>{s.heading}</h3>
        <p className="fl-ctl-btn-what">{s.what}</p>
        <div className="fl-ent-demo">
          <div className="fl-ent-demo-group" role="group" aria-label="ZIP code">
            <span className="fl-ent-demo-label">ZIP code</span>
            {s.zips.map((z) => (
              <Button key={z} variant={st.zip === z ? "primary" : "secondary"} size={32} pressed={st.zip === z} onClick={() => setZipMsg(sampleLookup.setZip(z).message)}>
                {z}
              </Button>
            ))}
            <Button
              variant="tertiary"
              size={32}
              disabled={!st.zip}
              onClick={() => {
                sampleLookup.clearZip();
                setZipMsg("ZIP code cleared.");
              }}
            >
              Clear
            </Button>
          </div>
          <div className="fl-ent-demo-group" role="group" aria-label="Signed in">
            <span className="fl-ent-demo-label">{st.signedIn ? `Signed in as ${sampleLookup.me()}` : "Signed out"}</span>
            <Button variant="secondary" size={32} icon={st.signedIn ? undefined : "user"} onClick={() => (st.signedIn ? sampleLookup.signOut() : sampleLookup.signIn())}>
              {st.signedIn ? "Sign out" : "Sign in"}
            </Button>
          </div>
          <div className="fl-ent-demo-group" role="group" aria-label="Show">
            <span className="fl-ent-demo-label">Show</span>
            {views.map(([v, label]) => (
              <Button key={v} variant={view === v ? "primary" : "tertiary"} size={32} pressed={view === v} onClick={() => setView(v)}>
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant="tertiary"
            size={32}
            icon="refresh"
            onClick={() => {
              sampleLookup.reset();
              setZipMsg("");
              toast("Sample data is back to how it started.", "neutral");
            }}
          >
            Reset sample data
          </Button>
          <p className="fl-ent-sr" role="status">
            {zipMsg}
          </p>
        </div>
        <LookupEntry
          lookup={sampleLookup}
          id={view === "missing" ? s.missing : s.id}
          loading={view === "loading"}
          onBack={() => (view === "missing" ? setView("page") : toast("This would go back to the catalog.", "info"))}
          backLabel="Back to books"
          onOpenPlace={(pid) => toast(`This would open ${pid} in the place finder.`, "info")}
          onOpenList={(lid) => toast(`This would open list ${lid} in the list builder.`, "info")}
          detailFields={["ages", "pages", "published"]}
          badgeField="award"
        />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>{s.ratingsHeading}</h3>
        <p className="fl-ctl-btn-what">{s.ratingsWhat}</p>
        <div className="fl-ent-page">
          <RatingsPanel lookup={sampleLookup} id={s.ratingsId} />
        </div>
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>{s.whereHeading}</h3>
        <p className="fl-ctl-btn-what">{s.whereWhat}</p>
        <div className="fl-ent-page">
          <WhereToFind lookup={sampleLookup} id={s.whereId} onOpenPlace={(pid) => toast(`This would open ${pid} in the place finder.`, "info")} />
        </div>
      </div>
      <Toaster />
    </section>
  );
}
