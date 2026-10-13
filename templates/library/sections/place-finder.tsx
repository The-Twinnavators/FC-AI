/** @flowcode-library place-finder · Place finder: places near a ZIP code, on a list and a simple map (Navigation)
 * Catalog ID: p.place-finder (pattern)
 * Function: The place finder (p.place-finder): for "find it and where to get it" apps. Enter a 5-digit ZIP code (checked, with the problem said in plain words, and quick "Use 94110" suggestions), see the area and the places near it nearest first (name, distance, address, hours, a phone link, how many entries each carries, and whether it carries the one being looked at), and choose one. A schematic map drawn from the places' coordinates sits beside the list (above it on a phone, and it folds away). Also exports ZipPrompt, the first-visit "Find it near you" banner, and PlaceBadge, the top-bar chip that changes the ZIP code or the place in one tap. Built on the look-up layer (createLookup from ./lookup-data beside the app's store).
 * Use it as: import { PlaceFinder, ZipPrompt, PlaceBadge } from "./place-finder"; <PlaceFinder lookup={lookup} title? description? entryId? onChoose?={(placeId) => ...} onOpenPlace?={(placeId) => go("place", placeId)} />; <ZipPrompt lookup={lookup} />; <PlaceBadge lookup={lookup} onChange?={() => ...} />
 * Variants: p.place-finder.page - the full finder: ZIP field, area, the nearby places nearest first with Choose, and the map; p.place-finder.prompt - an inline banner asking for the ZIP code once on a first visit, with Skip; hidden once answered; p.place-finder.badge - a compact chip for the top bar ("Near 94110 · Bernal Heights Branch") that opens a small solid popover to change the ZIP code or the place
 * Built from: c.button, c.text-field
 * Look: A short ZIP field with a Find button and suggestion chips, then a numbered list of places in one panel (name, miles, address, hours, phone, "Has 14 of 20 books", a Choose toggle) beside a light map panel: a faint grid, the ZIP's centre as a ring, numbered dots for the places with the chosen one filled in the accent color, and a mile scale.
 * Tokens: --surface-bg --surface-border --surface-shadow --surface-blur --surface-radius --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-danger --overlay-border --surface-shadow-overlay --field-radius --pill-radius --focus-ring --duration-fast
 * Use cases: library finder; store locator; clinic finder; pharmacy near me; where to buy it; pick-up point; branch finder; food bank finder
 * Jobs to be done: find the places near me; see which one is closest; see which one has what I want; choose my usual place; change where I am
 * Keywords: store locator, place finder, near me, ZIP code, postal code, map, locations, branches, nearest, pick a store
 */
/**
 * Place finder: where a look-up app answers "where can I get it near me". The ZIP field checks for five digits and says
 * what is wrong in plain words; a valid ZIP code the prototype doesn't know says so and suggests the ones it does. The
 * places come nearest first, each with its distance, address, hours, a phone link and how many of the app's entries it
 * carries; with an entry id, each also says whether it carries that one. Choose marks the person's place, which every
 * look-up piece then uses. The map is a drawing from the places' coordinates (no map tiles, nothing downloaded): each
 * dot shows its list row; screen readers and keyboards use the list, which carries the same information.
 *
 * ZipPrompt asks for the ZIP code once, inline (not a modal), with Skip. PlaceBadge is the top-bar chip: it opens a
 * small solid popover (Esc closes it, Tab stays inside, focus goes back to the chip) to change the ZIP or the place.
 *
 * Written for FlowCode.
 * Make it the app's own: pass your look-up layer (createLookup with your places, ZIP areas and words like "store" and
 * "carries"); set title and description for your app, onOpenPlace to the place's page, and entryId on an entry's page.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { toast, Toaster, type RecordData } from "./app-data";
import { formatMiles, pluralOf, useLookup, type LookupStore, type NearbyPlace } from "./lookup-data";
import { sampleLookup } from "./lookup-sample";

// ── Words and helpers ──

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The words the app uses: "library" / "libraries", "has" / "have", "books". */
function wordsOf(lookup: LookupStore) {
  const c = lookup.config;
  const placeEntity = lookup.app.entity(c.places);
  const entryEntity = lookup.app.entity(c.entries);
  const one = (c.placeWord ?? placeEntity.label).toLowerCase();
  const many = c.placeWord ? pluralOf(one) : placeEntity.plural.toLowerCase();
  const carry = c.carryWord ?? "carries";
  const carryBase = carry === "has" ? "have" : carry.replace(/ies$/, "y").replace(/s$/, "");
  return { one, many, carry, carryBase, entries: entryEntity.plural.toLowerCase(), placeTitle: placeEntity.titleField, entryTitle: entryEntity.titleField };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const telOf = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const nameOf = (lookup: LookupStore, place: RecordData) => String(place[wordsOf(lookup).placeTitle] ?? place.id);

/** What the finder says about a ZIP code (the same facts setZip reports, with the app's plural). */
function zipNote(lookup: LookupStore, zip: string): string {
  const w = wordsOf(lookup);
  const a = lookup.area(zip);
  const others = lookup.config.areas.map((x) => x.zip).filter((z) => z !== zip);
  if (!a) return `There are no ${w.many} near ${zip} in this prototype yet. Try ${others.join(", ")}.`;
  const n = lookup.nearby(zip).length;
  return n ? `${n} ${n === 1 ? w.one : w.many} near ${zip} (${a.label}).` : `No ${w.many} within ${lookup.config.nearMiles ?? 10} miles of ${zip} yet. Try ${others.join(", ")}.`;
}

/** How many entries each place carries: one pass over the entries. */
function carryCounts(lookup: LookupStore): { total: number; by: Map<string, number> } {
  const list = lookup.app.get().records[lookup.config.entries] ?? [];
  const by = new Map<string, number>();
  for (const e of list) {
    const v = e[lookup.config.placesField];
    if (Array.isArray(v)) for (const id of v) by.set(String(id), (by.get(String(id)) ?? 0) + 1);
  }
  return { total: list.length, by };
}

// ── The ZIP field (shared by the finder, the prompt and the badge) ──

function ZipForm({
  lookup,
  submit = "Find",
  chips,
  compact,
  autoFocus,
  skip,
  onDone,
}: {
  lookup: LookupStore;
  submit?: string;
  chips?: boolean;
  compact?: boolean;
  autoFocus?: boolean;
  skip?: () => void;
  onDone?: (message: string, zip: string) => void;
}) {
  const { zip } = useLookup(lookup);
  const id = useId();
  const [value, setValue] = useState(zip ?? "");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // Follow a ZIP code set elsewhere (the badge, the prompt).
  useEffect(() => setValue(zip ?? ""), [zip]);

  const go = (raw: string) => {
    const r = lookup.setZip(raw);
    if (!r.ok) {
      setError(r.message);
      input.current?.focus();
      return;
    }
    setError("");
    const z = raw.trim();
    setValue(z);
    onDone?.(zipNote(lookup, z), z);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };
  const suggestions = lookup.config.areas.filter((a) => a.zip !== zip);
  return (
    <form className={`fl-plc-zip${compact ? " fl-plc-zip--compact" : ""}`} onSubmit={onSubmit} noValidate>
      <label className="fl-plc-label" htmlFor={`${id}-zip`}>
        ZIP code
      </label>
      <div className="fl-plc-zip-row">
        <span className="fl-plc-field">
          <Icon name="pin" />
          <input
            ref={input}
            id={`${id}-zip`}
            className="fl-plc-input"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            enterKeyHint="search"
            placeholder="94110"
            value={value}
            autoFocus={autoFocus}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-err` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
          />
        </span>
        <Button type="submit" variant="primary" size={compact ? 40 : 44}>
          {submit}
        </Button>
        {skip ? (
          <Button variant="tertiary" size={compact ? 40 : 44} onClick={skip}>
            Skip
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="fl-plc-error" id={`${id}-err`} role="alert">
          {error}
        </p>
      ) : null}
      {chips && suggestions.length ? (
        <div className="fl-plc-chips" role="group" aria-label="ZIP codes in this prototype">
          {suggestions.map((a) => (
            <button key={a.zip} type="button" className="fl-plc-chip" onClick={() => go(a.zip)}>
              Use {a.zip}
              <span className="fl-plc-chip-note">{a.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}

// ── The map ──

type Projected = { id: string; x: number; y: number };

/** Places and the ZIP's centre on a 4:3 box, in percent, with room around them and a mile scale. */
function project(centre: { lat: number; lng: number }, places: NearbyPlace[]) {
  const k = Math.cos((centre.lat * Math.PI) / 180);
  const pts = places.map((n) => ({ id: n.place.id, x: (Number(n.place.lng) - centre.lng) * k, y: -(Number(n.place.lat) - centre.lat) })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const xs = [0, ...pts.map((p) => p.x)];
  const ys = [0, ...pts.map((p) => p.y)];
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let W = Math.max(maxX - minX, 0.01) * 1.4;
  let H = Math.max(maxY - minY, 0.01) * 1.4;
  if (W / H < 4 / 3) W = (H * 4) / 3;
  else H = (W * 3) / 4;
  const left = (minX + maxX) / 2 - W / 2;
  const top = (minY + maxY) / 2 - H / 2;
  const at = (x: number, y: number) => ({ x: ((x - left) / W) * 100, y: ((y - top) / H) * 100 });
  const mile = 1 / 69 / W; // one mile as a share of the width
  const miles = [0.25, 0.5, 1, 2, 5, 10, 20].filter((m) => m * mile <= 0.3).pop() ?? 0.25;
  return { centre: at(0, 0), dots: pts.map((p) => ({ id: p.id, ...at(p.x, p.y) })) as Projected[], scale: { miles, pct: miles * mile * 100 } };
}

function PlaceMap({ lookup, zip, places, chosen, active, onDot }: { lookup: LookupStore; zip: string; places: NearbyPlace[]; chosen?: string; active?: string; onDot: (id: string) => void }) {
  const area = lookup.area(zip)!;
  const { centre, dots, scale } = useMemo(() => project(area, places), [area, places]);
  const grid = [1, 2, 3, 4, 5, 6, 7].map((i) => i * 50);
  return (
    <div className="fl-plc-map" aria-hidden="true">
      <svg className="fl-plc-map-art" viewBox="0 0 400 300" preserveAspectRatio="none" focusable="false">
        {grid.map((x) => (
          <line key={`v${x}`} x1={x} y1={0} x2={x} y2={300} />
        ))}
        {grid.slice(0, 5).map((y) => (
          <line key={`h${y}`} x1={0} y1={y} x2={400} y2={y} />
        ))}
      </svg>
      <span className="fl-plc-map-centre" style={{ left: `${centre.x}%`, top: `${centre.y}%` }}>
        <span className="fl-plc-map-centre-label">{zip}</span>
      </span>
      {dots.map((d, i) => (
        <button
          key={d.id}
          type="button"
          tabIndex={-1}
          className="fl-plc-dot"
          data-chosen={d.id === chosen || undefined}
          data-active={d.id === active || undefined}
          style={{ left: `${d.x}%`, top: `${d.y}%` }}
          title={nameOf(lookup, places[i]!.place)}
          onClick={() => onDot(d.id)}
        >
          {i + 1}
        </button>
      ))}
      <span className="fl-plc-map-scale" style={{ width: `${scale.pct}%` }}>
        <span className="fl-plc-map-bar" />
        {scale.miles} mi
      </span>
      <span className="fl-plc-map-area">{area.label}</span>
    </div>
  );
}

// ── The finder ──

export type PlaceFinderProps = {
  lookup: LookupStore;
  /** The heading; "Find a library near you" (with the app's word) when left out. */
  title?: string;
  description?: string;
  /** A place was chosen (pressing Chosen again unchooses it and does not call this). */
  onChoose?: (placeId: string) => void;
  /** The place's name becomes a link to its page. */
  onOpenPlace?: (placeId: string) => void;
  /** On an entry's page: each place says whether it carries this entry. */
  entryId?: string;
};

export function PlaceFinder({ lookup, title, description, onChoose, onOpenPlace, entryId }: PlaceFinderProps) {
  const { zip, placeId } = useLookup(lookup);
  const w = wordsOf(lookup);
  const id = useId();
  const [note, setNote] = useState<{ zip: string; text: string } | null>(null);
  const [active, setActive] = useState<string | undefined>();
  const [mapOpen, setMapOpen] = useState(true);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const area = zip ? lookup.area(zip) : undefined;
  const places = zip ? lookup.nearby(zip) : [];
  const counts = carryCounts(lookup);
  const entry = entryId ? (lookup.app.get().records[lookup.config.entries] ?? []).find((e) => e.id === entryId) : undefined;
  const entryName = entry ? String(entry[w.entryTitle] ?? entry.id) : "";
  const message = zip ? (note?.zip === zip ? note.text : zipNote(lookup, zip)) : "";
  const carrying = entryId ? places.filter((n) => lookup.carries(n.place.id, entryId)).length : 0;

  const showRow = (pid: string) => {
    setActive(pid);
    const li = rows.current.get(pid);
    li?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    li?.querySelector<HTMLButtonElement>("[data-plc-choose]")?.focus({ preventScroll: true });
  };
  const choose = (pid: string) => {
    if (placeId === pid) {
      lookup.choosePlace(undefined);
      toast(`No ${w.one} chosen.`, "info");
      return;
    }
    lookup.choosePlace(pid);
    onChoose?.(pid);
  };

  return (
    <div className="fl-plc-root" data-fl="p.place-finder.page">
      <div className="fl-plc-head">
        <h2 className="fl-plc-title">{title ?? `Find a ${w.one} near you`}</h2>
        {description ? <p className="fl-plc-lede">{description}</p> : null}
      </div>
      <ZipForm lookup={lookup} chips onDone={(text, z) => setNote({ zip: z, text })} />

      <p className="fl-plc-status" role="status">
        {message}
        {entry && area && places.length ? ` ${carrying} of them ${carrying === 1 ? w.carry : w.carryBase} ${entryName}.` : ""}
      </p>

      {!zip ? (
        <div className="fl-plc-empty">
          <span className="fl-plc-empty-icon">
            <Icon name="map" />
          </span>
          <p className="fl-plc-empty-title">Where are you?</p>
          <p className="fl-plc-empty-text">Enter your ZIP code to see the {w.many} near you, nearest first, and choose the one you use.</p>
        </div>
      ) : area && places.length ? (
        <div className="fl-plc-body" data-map={mapOpen ? "open" : "closed"}>
          <div className="fl-plc-area">
            <p className="fl-plc-area-label">
              <Icon name="pin" />
              <span>
                Near <strong>{zip}</strong> · {area.label}
              </span>
            </p>
            <button type="button" className="fl-plc-maptoggle" aria-expanded={mapOpen} aria-controls={`${id}-map`} onClick={() => setMapOpen((o) => !o)}>
              <Icon name="map" />
              {mapOpen ? "Hide map" : "Show map"}
            </button>
          </div>
          <div className="fl-plc-mapwrap" id={`${id}-map`}>
            <PlaceMap lookup={lookup} zip={zip} places={places} chosen={placeId} active={active} onDot={showRow} />
          </div>
          <ol className="fl-plc-list" aria-label={`${cap(w.many)} near ${zip}, nearest first`}>
            {places.map((n, i) => {
              const p = n.place;
              const name = nameOf(lookup, p);
              const isChosen = p.id === placeId;
              const has = entryId ? lookup.carries(p.id, entryId) : undefined;
              const count = counts.by.get(p.id) ?? 0;
              return (
                <li
                  key={p.id}
                  ref={(el) => {
                    if (el) rows.current.set(p.id, el);
                    else rows.current.delete(p.id);
                  }}
                  className="fl-plc-row"
                  data-chosen={isChosen || undefined}
                  data-active={active === p.id || undefined}
                  onMouseEnter={() => setActive(p.id)}
                  onFocus={() => setActive(p.id)}
                >
                  <span className="fl-plc-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="fl-plc-info">
                    <div className="fl-plc-name-line">
                      <h3 className="fl-plc-name">
                        {onOpenPlace ? (
                          <button type="button" className="fl-plc-name-link" onClick={() => onOpenPlace(p.id)}>
                            {name}
                          </button>
                        ) : (
                          name
                        )}
                      </h3>
                      <span className="fl-plc-miles">{formatMiles(n.miles)}</span>
                      {isChosen ? <span className="fl-plc-tag">Your {w.one}</span> : null}
                    </div>
                    {p.address ? <p className="fl-plc-line">{String(p.address)}</p> : null}
                    <p className="fl-plc-meta">
                      {p.hours ? (
                        <span>
                          <Icon name="clock" />
                          {String(p.hours)}
                        </span>
                      ) : null}
                      {p.phone ? (
                        <a className="fl-plc-phone" href={telOf(String(p.phone))} aria-label={`Call ${name}, ${String(p.phone)}`}>
                          <Icon name="phone" />
                          {String(p.phone)}
                        </a>
                      ) : null}
                    </p>
                    <p className="fl-plc-carry">
                      {cap(w.carry)} {count} of {counts.total} {w.entries}
                      {has !== undefined ? (
                        <span className="fl-plc-has" data-has={has ? "yes" : "no"}>
                          <Icon name={has ? "check" : "close"} />
                          {has ? `${cap(w.carry)} ${entryName}` : `Doesn't ${w.carryBase} ${entryName}`}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="fl-plc-act">
                    <Button data-plc-choose="" variant={isChosen ? "primary" : "secondary"} size={40} icon={isChosen ? "check" : undefined} pressed={isChosen} aria-label={isChosen ? `${name} is your ${w.one}. Press to unchoose` : `Choose ${name}`} onClick={() => choose(p.id)}>
                      {isChosen ? "Chosen" : "Choose"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="fl-plc-empty">
          <span className="fl-plc-empty-icon">
            <Icon name="pin" />
          </span>
          <p className="fl-plc-empty-title">Nothing near {zip} yet</p>
          <p className="fl-plc-empty-text">Try another ZIP code, or one of the suggestions above.</p>
        </div>
      )}
    </div>
  );
}

// ── The first-visit prompt ──

export function ZipPrompt({ lookup }: { lookup: LookupStore }) {
  const { zipAsked } = useLookup(lookup);
  const w = wordsOf(lookup);
  const id = useId();
  if (zipAsked) return null;
  return (
    <section className="fl-plc-prompt" aria-labelledby={`${id}-t`} data-fl="p.place-finder.prompt">
      <span className="fl-plc-prompt-icon" aria-hidden="true">
        <Icon name="pin" />
      </span>
      <div className="fl-plc-prompt-text">
        <h2 className="fl-plc-prompt-title" id={`${id}-t`}>
          Find it near you
        </h2>
        <p className="fl-plc-prompt-lede">
          Enter your ZIP code to see the {w.many} near you and which ones {w.carryBase} what you're looking for. We only ask once.
        </p>
      </div>
      <ZipForm
        lookup={lookup}
        submit="Show nearby"
        compact
        skip={() => {
          lookup.skipZip();
          toast("Skipped. You can add your ZIP code any time from the top bar.", "info");
        }}
        onDone={(text) => toast(text, lookup.area() ? "success" : "info")}
      />
    </section>
  );
}

// ── The top-bar badge ──

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export function PlaceBadge({ lookup, onChange }: { lookup: LookupStore; onChange?: () => void }) {
  const { zip, placeId } = useLookup(lookup);
  const w = wordsOf(lookup);
  const id = useId();
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const places = zip ? lookup.nearby(zip) : [];
  const chosen = placeId ? (lookup.app.get().records[lookup.config.places] ?? []).find((p) => p.id === placeId) : undefined;
  const label = zip ? `Near ${zip} · ${chosen ? nameOf(lookup, chosen) : `Choose a ${w.one}`}` : "Add your ZIP code";

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) chip.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    // Keep the popover inside the window (16px clear) when the chip sits near the left edge.
    const el = pop.current;
    if (el) {
      const left = el.getBoundingClientRect().left;
      if (left < 16) el.style.translate = `${16 - left}px 0`;
    }
    el?.querySelector<HTMLInputElement>("input")?.focus();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !pop.current) return;
    const all = [...pop.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = all[0];
    const last = all[all.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="fl-plc-badge-wrap" ref={wrap} data-fl="p.place-finder.badge">
      <button ref={chip} type="button" className="fl-plc-badge" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-pop` : undefined} onClick={() => (open ? close() : setOpen(true))}>
        <Icon name="pin" />
        <span className="fl-plc-badge-text">{label}</span>
        <Icon name="chevron-down" />
      </button>
      {open ? (
        <div ref={pop} id={`${id}-pop`} className="fl-plc-pop" role="dialog" aria-label={`Change your ZIP code or ${w.one}`} onKeyDown={onKey}>
          <ZipForm lookup={lookup} submit="Update" compact onDone={() => onChange?.()} />
          {zip ? (
            places.length ? (
              <div className="fl-plc-pop-places">
                <p className="fl-plc-pop-head" id={`${id}-ph`}>
                  {cap(w.many)} near {zip}
                </p>
                <ul className="fl-plc-pop-list" aria-labelledby={`${id}-ph`}>
                  {places.map((n) => {
                    const on = n.place.id === placeId;
                    return (
                      <li key={n.place.id}>
                        <button
                          type="button"
                          className="fl-plc-pop-place"
                          aria-pressed={on}
                          onClick={() => {
                            if (!on) lookup.choosePlace(n.place.id);
                            onChange?.();
                            close();
                          }}
                        >
                          <span className="fl-plc-pop-check" aria-hidden="true">
                            {on ? <Icon name="check" /> : null}
                          </span>
                          <span className="fl-plc-pop-name">{nameOf(lookup, n.place)}</span>
                          <span className="fl-plc-pop-miles">{formatMiles(n.miles)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="fl-plc-pop-note">{zipNote(lookup, zip)}</p>
            )
          ) : (
            <p className="fl-plc-pop-note">Enter a ZIP code to see the {w.many} near it.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── The reference sheet ──

// flowcode:sample
const SAMPLE = {
  title: "Find a library near you",
  description: "Libraries near your ZIP code, nearest first. Choose the one you use and every book shows whether it's there.",
  entryId: "BK-1001",
  appName: "Story Shelf",
};

function PromptDemo() {
  const { zipAsked, zip } = useLookup(sampleLookup);
  return (
    <>
      <ZipPrompt lookup={sampleLookup} />
      {zipAsked ? (
        <div className="fl-plc-demo-again">
          <p className="fl-plc-demo-note">{zip ? `Answered: ${zip}. The banner stays hidden from now on.` : "Skipped. The banner stays hidden from now on."}</p>
          <Button
            variant="secondary"
            size={32}
            icon="refresh"
            onClick={() => {
              sampleLookup.askZipAgain();
              toast("The prompt is back, as on a first visit.", "info");
            }}
          >
            Show it again
          </Button>
        </div>
      ) : null}
    </>
  );
}

export default function PlaceFinderSheet() {
  const [entryOn, setEntryOn] = useState(false);
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>First-visit prompt</h3>
        <p className="fl-ctl-btn-what">Asks for the ZIP code once, inline, with Skip. Try 1234, abcde or 99999 to see what it says. Answering it fills in the finder below; Show it again brings it back.</p>
        <PromptDemo />
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>Top-bar badge</h3>
        <p className="fl-ctl-btn-what">The chip says where you are. Open it to change the ZIP code or the library in one tap; Esc closes it and focus goes back to the chip.</p>
        <div className="fl-plc-demo-bar">
          <span className="fl-plc-demo-brand">{SAMPLE.appName}</span>
          <PlaceBadge lookup={sampleLookup} />
        </div>
      </div>
      <div className="fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>Place finder</h3>
        <p className="fl-ctl-btn-what">Enter a ZIP code or use a suggestion, then choose a library. A dot on the map shows its row. Turn on the book to see which libraries have it.</p>
        <label className="fl-plc-demo-switch">
          <input type="checkbox" checked={entryOn} onChange={(e) => setEntryOn(e.target.checked)} />
          On the page for The Lantern Fox
        </label>
        <PlaceFinder lookup={sampleLookup} title={SAMPLE.title} description={SAMPLE.description} entryId={entryOn ? SAMPLE.entryId : undefined} onChoose={() => undefined} />
      </div>
      <Toaster />
    </section>
  );
}
