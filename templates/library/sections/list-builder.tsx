/** @flowcode-library list-builder · List builder: lists tied to a place, with what it carries (Forms)
 * Catalog ID: p.list-builder (pattern)
 * Function: The list builder (p.list-builder): the person's lists for a "find it and where to get it" app (a grocery list, a library run, a pharmacy list), each tied to one place, showing for every item whether that place carries it and, when it doesn't, the nearest place that does. Two screens: the index of lists (with an inline New list) and one list (rename, change the place, add items by type-ahead, quantities, check off, remove with Undo, share, duplicate, delete with an inline confirm). Built on the look-up layer: pass the look-up store (createLookup from ./lookup-data beside the app's store).
 * Use it as: import { ListIndex, ListBuilder } from "./list-builder"; <ListIndex lookup={lookup} onOpen={(id) => go("list", id)} title?="Your lists" />; <ListBuilder lookup={lookup} id={listId} onBack?={() => go("lists")} onOpenEntry?={(id) => go("book", id)} onChoosePlace?={(listId) => go("places")} onOpenList?={(id) => go("list", id)} />
 * Variants: p.list-builder.index - the person's lists as rows: name, place, "6 of 14 done" with a thin progress bar, when it last changed, New list inline (a name, then a place near them), empty and signed-out states; p.list-builder.list - one list: inline-editable name, its place with Change (a solid picker of nearby places, or a ZIP code field), "6 of 14 done" and "11 of 14 at this library", Add items type-ahead, rows with a checkbox, quantity stepper, where to get it and Remove with Undo, checked items under Done, Share, Duplicate and Delete
 * Built from: c.button, c.checkbox, c.text-field, c.select, c.combobox, c.stepper, c.empty-state
 * Look: Plain rows on the app's surface: a bold list name, a pin line with the place and a quiet Change, a thin accent progress line, a search box that drops a solid list of matches, then rows with a checkbox, the title and author, a small green "At Bernal Heights Branch" or an amber "Not here" line, a − 1 + stepper and a trash button; done rows sit dimmed under a Done label.
 * Tokens: --surface-bg --surface-border --surface-shadow --surface-blur --surface-radius --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-success --color-warning --color-danger --field-radius --overlay-border --surface-shadow-overlay --radius-sm --radius-md --pill-radius --focus-ring --duration-fast --easing
 * Use cases: grocery list for one store; library run; pharmacy list; hardware store trip; school supplies list; garden center list; pantry restock
 * Jobs to be done: make a list for one place; see what that place has before I go; find where to get what it doesn't have; check things off as I go; share a list with someone
 * Keywords: list builder, shopping list, grocery list, checklist, saved list, list, place, availability, in stock, quantity stepper, type-ahead
 */
/**
 * List builder: the lists a person keeps in a look-up app, each tied to one place (a store, a library, a pharmacy).
 * ListIndex shows every list with how far along it is; ListBuilder is one list. Every item says whether the list's place
 * carries it; when it doesn't, it names the nearest place that does (from the person's ZIP code). Checked items move to
 * the bottom under Done, so what is left to get is always on top. Changes go straight to the look-up store, so every
 * other look-up piece (the catalog, the entry page, the place finder) sees them at once.
 *
 * Keyboard: the type-ahead is a combobox (arrow keys move through the matches, Enter adds, Escape closes); the
 * quantity is a spin button (arrow keys, Page Up/Down, Home/End); the place picker moves with the arrow keys and closes
 * with Escape. Removing an item leaves an Undo row; deleting a list asks inline first. Reduced motion turns the row
 * fades off.
 *
 * Written for FlowCode.
 * Make it the app's own: pass your look-up store (its config names the entries, the places and their words, like
 * "store" and "carries"); onOpen and onOpenList go to a list's page, onOpenEntry to an entry's page, onChoosePlace to
 * the place finder.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { toast, Toaster, type RecordData } from "./app-data";
import { formatMiles, linkFor, shareLink, useLookup, type EntryList, type ListItem, type LookupStore } from "./lookup-data";
import { sampleLookup } from "./lookup-sample";

// ── Helpers ──

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "just now", "5 min ago", "3 h ago", "yesterday", "28 Sep". */
function ago(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "yesterday";
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(t));
}

/** Names and words the pieces need, from the look-up store's config and the app's schema. */
function useWords(lookup: LookupStore) {
  const { app, config } = lookup;
  const entryE = app.entity(config.entries);
  const placeE = app.entity(config.places);
  const placeWord = config.placeWord ?? "place";
  return {
    entryE,
    placeE,
    placeWord,
    entries: (): RecordData[] => app.get().records[config.entries] ?? [],
    entry: (id: string) => (app.get().records[config.entries] ?? []).find((e) => e.id === id),
    place: (id?: string) => (id ? (app.get().records[config.places] ?? []).find((p) => p.id === id) : undefined),
    title: (r: RecordData | undefined, fallback = "") => (r ? String(r[entryE.titleField] ?? r.id) : fallback),
    sub: (r: RecordData | undefined) => (r && entryE.subtitleField ? String(r[entryE.subtitleField] ?? "") : ""),
    placeName: (p: RecordData | undefined) => (p ? String(p[placeE.titleField] ?? p.id) : ""),
    placeSub: (p: RecordData | undefined) => (p && placeE.subtitleField ? String(p[placeE.subtitleField] ?? "") : ""),
  };
}

/** How many items are done and how many the list's place carries. */
function tally(lookup: LookupStore, list: EntryList) {
  const done = list.items.filter((i) => i.done).length;
  const here = list.placeId ? list.items.filter((i) => lookup.carries(list.placeId!, i.entryId)).length : 0;
  return { done, here, total: list.items.length };
}

/** A thin bar for how much of a list is done (the text beside it says the same). */
function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span className="fl-lst-bar" aria-hidden="true">
      <span className="fl-lst-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Signed out: lists are personal, so they wait behind the (one-tap, demo) sign-in. */
function SignedOut({ lookup, framed }: { lookup: LookupStore; framed: boolean }) {
  return (
    <div className={`fl-lst-root${framed ? " fl-lst-root--framed" : ""}`}>
      <div className="fl-lst-empty">
        <span className="fl-lst-empty-icon"><Icon name="lock" /></span>
        <p className="fl-lst-empty-title">Sign in to see your lists</p>
        <p className="fl-lst-empty-text">Your lists are kept with your account, so they follow you to any device.</p>
        <Button size={40} onClick={() => lookup.signIn()}>Sign in</Button>
      </div>
    </div>
  );
}

/** A native select with the chevron drawn 8px from its right edge. */
function Select({ label, value, onChange, children, id }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode; id?: string }) {
  return (
    <span className="fl-lst-select">
      <select id={id} aria-label={id ? undefined : label} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <Icon name="chevron-down" />
    </span>
  );
}

// ── The index ──

export type ListIndexProps = {
  lookup: LookupStore;
  /** A list was opened (its row, or a list just made). */
  onOpen: (listId: string) => void;
  /** The heading; "Your lists" when left out. */
  title?: string;
  /** The list that is open beside the index, marked as current. */
  current?: string;
  /** Draws the piece as its own panel (on by default); off when it already sits in one. */
  framed?: boolean;
};

export function ListIndex({ lookup, onOpen, title = "Your lists", current, framed = true }: ListIndexProps) {
  const state = useLookup(lookup);
  const w = useWords(lookup);
  const [making, setMaking] = useState(false);
  const [name, setName] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const newRef = useRef<HTMLButtonElement>(null);
  const ids = { name: useId(), place: useId(), err: useId() };

  const nearby = lookup.nearby();
  const chosen = w.place(state.placeId);
  // The place choices: the person's chosen place first, then the places near their ZIP code.
  const choices = useMemo(() => {
    const out: Array<{ id: string; label: string }> = [];
    if (chosen) out.push({ id: chosen.id, label: `${w.placeName(chosen)} (your ${w.placeWord})` });
    for (const n of nearby) if (n.place.id !== chosen?.id) out.push({ id: n.place.id, label: `${w.placeName(n.place)}, ${formatMiles(n.miles)}` });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.placeId, state.zip, nearby.length]);

  useEffect(() => {
    if (making) nameRef.current?.focus();
  }, [making]);

  if (!state.signedIn) return <SignedOut lookup={lookup} framed={framed} />;

  const start = () => {
    setName("");
    setError("");
    setPlaceId(choices[0]?.id ?? "");
    setMaking(true);
  };
  const close = () => {
    setMaking(false);
    requestAnimationFrame(() => newRef.current?.focus());
  };
  const create = () => {
    if (!name.trim()) {
      setError("Give the list a name, like \"Saturday run\".");
      nameRef.current?.focus();
      return;
    }
    const l = lookup.createList(name, placeId || undefined);
    if (!l) return;
    close();
    onOpen(l.id);
  };

  const lists = state.lists;
  return (
    <div className={`fl-lst-root${framed ? " fl-lst-root--framed" : ""}`} data-fl="p.list-builder.index">
      <div className="fl-lst-head">
        <div className="fl-lst-head-text">
          <h2 className="fl-lst-title">{title}</h2>
          <p className="fl-lst-lede">{lists.length === 0 ? "None yet" : `${lists.length} list${lists.length === 1 ? "" : "s"}`}</p>
        </div>
        {!making ? (
          <Button ref={newRef} size={32} icon="plus" onClick={start}>
            New list
          </Button>
        ) : null}
      </div>

      {making ? (
        <form
          className="fl-lst-new"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        >
          <div className="fl-lst-field">
            <label className="fl-lst-label" htmlFor={ids.name}>List name</label>
            <input
              ref={nameRef}
              id={ids.name}
              className="fl-lst-input"
              value={name}
              maxLength={60}
              placeholder="Saturday run"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ids.err : undefined}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
            />
            {error ? <p id={ids.err} className="fl-lst-error">{error}</p> : null}
          </div>
          <div className="fl-lst-field">
            <label className="fl-lst-label" htmlFor={ids.place}>{cap(w.placeWord)}</label>
            {choices.length ? (
              <Select id={ids.place} label={cap(w.placeWord)} value={placeId} onChange={setPlaceId}>
                {choices.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
                <option value="">Choose later</option>
              </Select>
            ) : (
              <p className="fl-lst-hint" id={ids.place}>No {w.placeWord} yet. You can choose one on the list once you add your ZIP code.</p>
            )}
          </div>
          <div className="fl-lst-new-actions">
            <Button type="submit" size={32}>Make list</Button>
            <Button variant="tertiary" size={32} onClick={close}>Cancel</Button>
          </div>
        </form>
      ) : null}

      {lists.length === 0 && !making ? (
        <div className="fl-lst-empty">
          <span className="fl-lst-empty-icon"><Icon name="check" /></span>
          <p className="fl-lst-empty-title">No lists yet</p>
          <p className="fl-lst-empty-text">Make one for each trip: pick the {w.placeWord}, add what you need, and see what it {lookup.config.carryWord ?? "carries"} before you go.</p>
          <Button size={32} icon="plus" onClick={start}>New list</Button>
        </div>
      ) : (
        <ul className="fl-lst-lists">
          {lists.map((l) => {
            const t = tally(lookup, l);
            const p = w.place(l.placeId);
            return (
              <li key={l.id}>
                <button type="button" className="fl-lst-listrow" aria-current={current === l.id ? "true" : undefined} onClick={() => onOpen(l.id)}>
                  <span className="fl-lst-listrow-top">
                    <span className="fl-lst-listrow-name">{l.name}</span>
                    <span className="fl-lst-listrow-when">{ago(l.updatedAt)}</span>
                  </span>
                  <span className="fl-lst-listrow-place">
                    <Icon name="pin" />
                    {p ? w.placeName(p) : `No ${w.placeWord} chosen`}
                  </span>
                  <span className="fl-lst-listrow-progress">
                    <Progress done={t.done} total={t.total} />
                    <span className="fl-lst-listrow-count">{t.total ? `${t.done} of ${t.total} done` : "Empty"}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── One list ──

export type ListBuilderProps = {
  lookup: LookupStore;
  /** The list's id. */
  id: string;
  /** Back to the lists (also where Delete goes). */
  onBack?: () => void;
  /** An entry's page (its title, and "See where" on items this place doesn't carry). */
  onOpenEntry?: (entryId: string) => void;
  /** The place finder, offered in the place picker. */
  onChoosePlace?: (listId: string) => void;
  /** Another list (the copy Duplicate makes). */
  onOpenList?: (listId: string) => void;
  /** Draws the piece as its own panel (on by default); off when it already sits in one. */
  framed?: boolean;
};

export function ListBuilder({ lookup, id, onBack, onOpenEntry, onChoosePlace, onOpenList, framed = true }: ListBuilderProps) {
  const state = useLookup(lookup);
  const w = useWords(lookup);
  const list = state.lists.find((l) => l.id === id);
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [undo, setUndo] = useState<{ item: ListItem; index: number; title: string } | null>(null);
  // The link, shown to copy by hand when neither a share sheet nor the clipboard was available.
  const [link, setLink] = useState<string | null>(null);
  const linkRef = useRef<HTMLInputElement>(null);
  const nameBtn = useRef<HTMLButtonElement>(null);
  const changeBtn = useRef<HTMLButtonElement>(null);
  const deleteBtn = useRef<HTMLButtonElement>(null);
  const undoBtn = useRef<HTMLButtonElement>(null);
  const keepBtn = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // A different list: start fresh.
  useEffect(() => {
    setEditing(false);
    setPicking(false);
    setConfirming(false);
    setUndo(null);
    setLink(null);
  }, [id]);
  useEffect(() => {
    if (link) linkRef.current?.select();
  }, [link]);
  // The Undo row goes away on its own after a while.
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(t);
  }, [undo]);
  useEffect(() => {
    if (confirming) keepBtn.current?.focus();
  }, [confirming]);

  if (!state.signedIn) return <SignedOut lookup={lookup} framed={framed} />;
  if (!list) {
    return (
      <div className={`fl-lst-root${framed ? " fl-lst-root--framed" : ""}`}>
        <div className="fl-lst-empty">
          <p className="fl-lst-empty-title">This list isn't here</p>
          <p className="fl-lst-empty-text">It may have been deleted.</p>
          {onBack ? <Button size={32} variant="secondary" icon="arrow-left" onClick={onBack}>Your lists</Button> : null}
        </div>
      </div>
    );
  }

  const place = w.place(list.placeId);
  const t = tally(lookup, list);
  const ordered = [...list.items.filter((i) => !i.done), ...list.items.filter((i) => i.done)];
  const firstDone = ordered.findIndex((i) => i.done);
  const placeMiles = place ? lookup.nearby().find((n) => n.place.id === place.id)?.miles : undefined;

  const rename = (v: string) => {
    if (v.trim() && v.trim() !== list.name) lookup.renameList(list.id, v);
    setEditing(false);
    requestAnimationFrame(() => nameBtn.current?.focus());
  };
  const remove = (item: ListItem) => {
    const index = list.items.findIndex((i) => i.entryId === item.entryId);
    lookup.removeFromList(list.id, item.entryId, { silent: true });
    setUndo({ item, index, title: w.title(w.entry(item.entryId), item.entryId) });
    requestAnimationFrame(() => undoBtn.current?.focus());
  };
  // The Undo row is going: focus goes to Add items rather than being lost.
  const dismissUndo = () => {
    setUndo(null);
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(".fl-lst-search input")?.focus());
  };
  const restore = () => {
    if (!undo) return;
    lookup.restoreToList(list.id, undo.item, undo.index);
    dismissUndo();
  };
  const share = () => {
    const where = place ? ` at ${w.placeName(place)}` : "";
    const url = linkFor("list", list.id);
    void shareLink(list.name, url, `${t.total} item${t.total === 1 ? "" : "s"}${where}`).then((r) => setLink(r === "failed" ? url : null));
  };
  const duplicate = () => {
    const copy = lookup.duplicateList(list.id);
    if (copy && onOpenList) onOpenList(copy.id);
  };
  const del = () => {
    lookup.deleteList(list.id);
    setConfirming(false);
    onBack?.();
  };

  return (
    <div ref={root} className={`fl-lst-root${framed ? " fl-lst-root--framed" : ""}`} data-fl="p.list-builder.list">
      <div className="fl-lst-head">
        <div className="fl-lst-head-text">
          {onBack ? (
            <button type="button" className="fl-lst-back" onClick={onBack}>
              <Icon name="arrow-left" />
              Your lists
            </button>
          ) : null}
          {editing ? (
            <input
              className="fl-lst-input fl-lst-name-input"
              aria-label="List name"
              defaultValue={list.name}
              maxLength={60}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => rename(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  rename(e.currentTarget.value);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(false);
                  requestAnimationFrame(() => nameBtn.current?.focus());
                }
              }}
            />
          ) : (
            <h2 className="fl-lst-title">
              <button ref={nameBtn} type="button" className="fl-lst-name" onClick={() => setEditing(true)} aria-label={`${list.name}, rename`}>
                {list.name}
                <Icon name="pencil" />
              </button>
            </h2>
          )}
        </div>
        {!confirming ? (
          <div className="fl-lst-actions">
            <Button variant="tertiary" size={32} icon="share" onClick={share}>Share</Button>
            <Button variant="tertiary" size={32} icon="duplicate" onClick={duplicate}>Duplicate</Button>
            <Button ref={deleteBtn} variant="tertiary" size={32} icon="trash" className="fl-lst-danger" onClick={() => setConfirming(true)}>Delete</Button>
          </div>
        ) : null}
      </div>

      {confirming ? (
        <div className="fl-lst-confirm" role="group" aria-label="Delete this list">
          <p className="fl-lst-confirm-text">
            Delete "{list.name}"? {t.total ? `Its ${t.total} item${t.total === 1 ? "" : "s"} go with it.` : ""}
          </p>
          <div className="fl-lst-confirm-actions">
            <Button variant="destructive" size={32} onClick={del}>Delete list</Button>
            <Button
              ref={keepBtn}
              variant="secondary"
              size={32}
              onClick={() => {
                setConfirming(false);
                requestAnimationFrame(() => deleteBtn.current?.focus());
              }}
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : null}

      {link ? (
        <div className="fl-lst-sharelink">
          <label className="fl-lst-label" htmlFor={`${list.id}-link`}>Link to this list</label>
          <div className="fl-lst-zip-row">
            <input ref={linkRef} id={`${list.id}-link`} className="fl-lst-input" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <Button variant="tertiary" size={40} onClick={() => setLink(null)}>Done</Button>
          </div>
        </div>
      ) : null}

      <div className="fl-lst-place">
        <span className="fl-lst-place-icon"><Icon name="pin" /></span>
        <span className="fl-lst-place-text">
          <span className="fl-lst-place-name">{place ? w.placeName(place) : `No ${w.placeWord} chosen`}</span>
          <span className="fl-lst-place-sub">
            {place ? [w.placeSub(place), placeMiles !== undefined ? formatMiles(placeMiles) : ""].filter(Boolean).join(" · ") : `Choose a ${w.placeWord} to see what it ${lookup.config.carryWord ?? "carries"}.`}
          </span>
        </span>
        <Button ref={changeBtn} variant="secondary" size={32} aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
          {place ? "Change" : "Choose"}
        </Button>
      </div>

      {picking ? (
        <PlacePicker
          lookup={lookup}
          list={list}
          onChoosePlace={onChoosePlace}
          onClose={(focusBack) => {
            setPicking(false);
            if (focusBack) requestAnimationFrame(() => changeBtn.current?.focus());
          }}
        />
      ) : null}

      <div className="fl-lst-summary">
        <Progress done={t.done} total={t.total} />
        <p className="fl-lst-summary-text">
          <strong>{t.total ? `${t.done} of ${t.total} done` : "Nothing on it yet"}</strong>
          {place && t.total ? <span>{`${t.here} of ${t.total} at this ${w.placeWord}`}</span> : null}
        </p>
      </div>

      <AddItems lookup={lookup} list={list} />

      {undo ? (
        <div className="fl-lst-undo">
          <span>Removed {undo.title}.</span>
          <button ref={undoBtn} type="button" className="fl-lst-link" onClick={restore}>Undo</button>
          <button type="button" className="fl-lst-icon-btn" aria-label="Dismiss" onClick={dismissUndo}>
            <Icon name="close" />
          </button>
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <div className="fl-lst-empty fl-lst-empty--compact">
          <p className="fl-lst-empty-title">Nothing on this list yet</p>
          <p className="fl-lst-empty-text">
            Type in Add items to find {w.entryE.plural.toLowerCase()}. Each one shows whether {place ? w.placeName(place) : `the ${w.placeWord}`} {lookup.config.carryWord ?? "carries"} it.
          </p>
        </div>
      ) : (
        <ul className="fl-lst-items" aria-label="Items">
          {ordered.map((item, i) => (
            <ItemRow
              key={item.entryId}
              lookup={lookup}
              list={list}
              item={item}
              doneLabel={i === firstDone}
              onRemove={() => remove(item)}
              onOpenEntry={onOpenEntry}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** The solid inline picker of places near the person (with how much of the list each has), or a ZIP code field. */
function PlacePicker({ lookup, list, onChoosePlace, onClose }: { lookup: LookupStore; list: EntryList; onChoosePlace?: (listId: string) => void; onClose: (focusBack: boolean) => void }) {
  const state = useLookup(lookup);
  const w = useWords(lookup);
  const [zip, setZip] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [askZip, setAskZip] = useState(!state.zip);
  const box = useRef<HTMLDivElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);
  const ids = { zip: useId(), msg: useId(), head: useId() };
  const nearby = lookup.nearby();
  const area = lookup.area();

  useEffect(() => {
    if (askZip) zipRef.current?.focus();
    else (box.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? box.current?.querySelector<HTMLButtonElement>(".fl-lst-option"))?.focus();
  }, [askZip]);

  const choose = (placeId: string | undefined) => {
    lookup.setListPlace(list.id, placeId);
    onClose(true);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const opts = [...(box.current?.querySelectorAll<HTMLButtonElement>(".fl-lst-option") ?? [])];
    const at = opts.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    e.preventDefault();
    opts[(at + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length]?.focus();
  };
  const submitZip = () => {
    const r = lookup.setZip(zip);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) setAskZip(false);
  };

  return (
    <div ref={box} className="fl-lst-menu" role="group" aria-labelledby={ids.head} onKeyDown={onKey}>
      <div className="fl-lst-menu-head">
        <p id={ids.head} className="fl-lst-menu-title">
          {askZip ? `Find a ${w.placeWord} near you` : `${cap(w.placeWord)}s near ${state.zip}${area ? ` (${area.label})` : ""}`}
        </p>
        <button type="button" className="fl-lst-icon-btn" aria-label="Close" onClick={() => onClose(true)}>
          <Icon name="close" />
        </button>
      </div>
      {askZip ? (
        <form
          className="fl-lst-zip"
          onSubmit={(e) => {
            e.preventDefault();
            submitZip();
          }}
        >
          <label className="fl-lst-label" htmlFor={ids.zip}>ZIP code</label>
          <div className="fl-lst-zip-row">
            <input
              ref={zipRef}
              id={ids.zip}
              className="fl-lst-input fl-lst-zip-input"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              placeholder="94110"
              value={zip}
              aria-invalid={msg && !msg.ok ? true : undefined}
              aria-describedby={msg ? ids.msg : undefined}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            />
            <Button type="submit" size={40}>Show {w.placeWord === "library" ? "libraries" : `${w.placeWord}s`}</Button>
          </div>
          {msg ? <p id={ids.msg} className={msg.ok ? "fl-lst-hint" : "fl-lst-error"} role={msg.ok ? undefined : "alert"}>{msg.text}</p> : null}
        </form>
      ) : (
        <>
          {msg?.ok ? <p className="fl-lst-hint" role="status">{msg.text}</p> : null}
          {nearby.length ? (
            <ul className="fl-lst-options">
              {nearby.map((n) => {
                const has = list.items.filter((i) => lookup.carries(n.place.id, i.entryId)).length;
                const on = n.place.id === list.placeId;
                return (
                  <li key={n.place.id}>
                    <button type="button" className="fl-lst-option" aria-pressed={on} onClick={() => choose(n.place.id)}>
                      <span className="fl-lst-option-check">{on ? <Icon name="check" /> : null}</span>
                      <span className="fl-lst-option-text">
                        <span className="fl-lst-option-name">{w.placeName(n.place)}</span>
                        <span className="fl-lst-option-sub">
                          {formatMiles(n.miles)}
                          {list.items.length ? ` · ${lookup.config.carryWord ?? "carries"} ${has} of ${list.items.length}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="fl-lst-hint">No {w.placeWord === "library" ? "libraries" : `${w.placeWord}s`} near {state.zip} in this prototype yet.</p>
          )}
          <div className="fl-lst-menu-foot">
            <button type="button" className="fl-lst-link" onClick={() => { setMsg(null); setAskZip(true); }}>Change ZIP code</button>
            {list.placeId ? <button type="button" className="fl-lst-link" onClick={() => choose(undefined)}>No {w.placeWord}</button> : null}
            {onChoosePlace ? <button type="button" className="fl-lst-link" onClick={() => onChoosePlace(list.id)}>See them on the map</button> : null}
          </div>
        </>
      )}
    </div>
  );
}

/** Add items: a combobox over the entries; Enter adds the highlighted one. */
function AddItems({ lookup, list }: { lookup: LookupStore; list: EntryList }) {
  useLookup(lookup);
  const w = useWords(lookup);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const ids = { input: useId(), list: useId(), hint: useId() };
  const place = w.place(list.placeId);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [] as RecordData[];
    const cat = lookup.config.categoryField;
    const scored = w
      .entries()
      .map((e) => {
        const t = w.title(e).toLowerCase();
        const hay = `${t} ${w.sub(e).toLowerCase()} ${String(e[cat] ?? "").toLowerCase()}`;
        const score = t.startsWith(s) ? 0 : t.includes(s) ? 1 : hay.includes(s) ? 2 : 9;
        return { e, score };
      })
      .filter((x) => x.score < 9)
      .sort((a, b) => a.score - b.score || w.title(a.e).localeCompare(w.title(b.e)));
    return scored.slice(0, 8).map((x) => x.e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, lookup]);

  const shown = open && q.trim().length > 0;
  const add = (e: RecordData | undefined) => {
    if (!e) return;
    lookup.addToList(list.id, e.id);
    setQ("");
    setOpen(false);
    setActive(0);
    input.current?.focus();
  };
  const onKey = (ev: ReactKeyboardEvent<HTMLInputElement>) => {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      if (!open) setOpen(true);
      if (!results.length) return;
      setActive((a) => (a + (ev.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (ev.key === "Enter") {
      if (shown && results.length) {
        ev.preventDefault();
        add(results[active]);
      }
    } else if (ev.key === "Escape") {
      if (shown) {
        ev.preventDefault();
        setOpen(false);
      } else if (q) {
        ev.preventDefault();
        setQ("");
      }
    } else if (ev.key === "Home" && shown && results.length) {
      setActive(0);
    }
  };

  return (
    <div className="fl-lst-add">
      <label className="fl-lst-label" htmlFor={ids.input}>Add items</label>
      <div className="fl-lst-search">
        <Icon name="search" />
        <input
          ref={input}
          id={ids.input}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={shown}
          aria-controls={ids.list}
          aria-activedescendant={shown && results[active] ? `${ids.list}-${results[active]!.id}` : undefined}
          aria-describedby={ids.hint}
          placeholder={`Search ${w.entryE.plural.toLowerCase()} by title or ${w.entryE.subtitleField ? (w.entryE.fields.find((f) => f.key === w.entryE.subtitleField)?.label ?? "name").toLowerCase() : "name"}`}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKey}
        />
        <span id={ids.hint} className="fl-lst-sr">Use the up and down arrows to move through the matches and Enter to add one.</span>
        {shown ? (
          <ul id={ids.list} className="fl-lst-results" role="listbox" aria-label={`Matching ${w.entryE.plural.toLowerCase()}`}>
            {results.length === 0 ? (
              <li className="fl-lst-results-none" role="option" aria-disabled="true" aria-selected="false">No {w.entryE.plural.toLowerCase()} match "{q.trim()}".</li>
            ) : (
              results.map((e, i) => {
                const on = list.items.find((x) => x.entryId === e.id);
                const here = place ? lookup.carries(place.id, e.id) : undefined;
                return (
                  <li
                    key={e.id}
                    id={`${ids.list}-${e.id}`}
                    role="option"
                    aria-selected={i === active}
                    className="fl-lst-result"
                    onMouseDown={(ev) => ev.preventDefault()}
                    onMouseMove={() => setActive(i)}
                    onClick={() => add(e)}
                  >
                    <span className="fl-lst-result-text">
                      <span className="fl-lst-result-title">{w.title(e)}</span>
                      <span className="fl-lst-result-sub">{w.sub(e)}</span>
                    </span>
                    <span className="fl-lst-result-meta">
                      {on ? <span className="fl-lst-tag">On the list{on.qty > 1 ? ` (${on.qty})` : ""}</span> : null}
                      {here === undefined ? null : here ? <span className="fl-lst-tag fl-lst-tag--yes">Here</span> : <span className="fl-lst-tag fl-lst-tag--no">Not here</span>}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** One item: done box, title, where to get it, quantity, remove. */
function ItemRow({ lookup, list, item, doneLabel, onRemove, onOpenEntry }: { lookup: LookupStore; list: EntryList; item: ListItem; doneLabel: boolean; onRemove: () => void; onOpenEntry?: (id: string) => void }) {
  const w = useWords(lookup);
  const e = w.entry(item.entryId);
  const title = w.title(e, item.entryId);
  const place = w.place(list.placeId);
  const here = place ? lookup.carries(place.id, item.entryId) : undefined;
  const nearest = here === false ? lookup.nearestCarrier(item.entryId) : undefined;
  const checkId = useId();

  let where: ReactNode;
  if (!place) where = <span className="fl-lst-where">Choose a {w.placeWord} to see if it {lookup.config.carryWord ?? "carries"} this.</span>;
  else if (here) where = <span className="fl-lst-where fl-lst-where--yes"><Icon name="check" />At {w.placeName(place)}</span>;
  else
    where = (
      <span className="fl-lst-where fl-lst-where--no">
        <Icon name="alert" />
        <span>
          {nearest && nearest.place.id !== place.id ? `Not here — nearest: ${w.placeName(nearest.place)}, ${formatMiles(nearest.miles)}` : lookup.get().zip ? `Not here, and no other ${w.placeWord} near you has it` : "Not here. Add your ZIP code to find one that has it"}
          {onOpenEntry && nearest ? (
            <>
              {" "}
              <button type="button" className="fl-lst-link" onClick={() => onOpenEntry(item.entryId)} aria-label={`See where to get ${title}`}>
                See where
              </button>
            </>
          ) : null}
        </span>
      </span>
    );

  return (
    <>
      {doneLabel ? (
        <li className="fl-lst-done-label" role="presentation" aria-hidden="true">
          Done
        </li>
      ) : null}
      <li className={`fl-lst-item${item.done ? " is-done" : ""}`} data-motion={reducedMotion() ? "off" : undefined}>
        <Checkbox id={checkId} checked={item.done} onChange={() => lookup.toggleDone(list.id, item.entryId)} aria-label={`${title}${item.done ? ", done" : ""}`} />
        <span className="fl-lst-item-text">
          {onOpenEntry ? (
            <button type="button" className="fl-lst-item-title fl-lst-item-open" onClick={() => onOpenEntry(item.entryId)}>{title}</button>
          ) : (
            <label className="fl-lst-item-title" htmlFor={checkId}>{title}</label>
          )}
          {w.sub(e) ? <span className="fl-lst-item-sub">{w.sub(e)}</span> : null}
          {item.done ? null : where}
        </span>
        <Stepper value={item.qty} label={`Quantity of ${title}`} onChange={(n) => lookup.setQty(list.id, item.entryId, n)} />
        <button type="button" className="fl-lst-icon-btn fl-lst-remove" aria-label={`Remove ${title}`} title="Remove" onClick={onRemove}>
          <Icon name="trash" />
        </button>
      </li>
    </>
  );
}

/** − 1 + : a spin button between 1 and 99 (arrow keys, Page Up/Down, Home/End, or type a number). */
function Stepper({ value, label, onChange }: { value: number; label: string; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const set = (n: number) => onChange(Math.max(1, Math.min(99, n)));
  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isFinite(n)) set(n);
    else setDraft(String(value));
  };
  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const step: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (e.key in step) {
      e.preventDefault();
      set(value + step[e.key]!);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      set(e.key === "Home" ? 1 : 99);
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  };
  return (
    <span className="fl-lst-qty" role="group" aria-label={label}>
      <button type="button" className="fl-lst-qty-btn" aria-label="One fewer" disabled={value <= 1} onClick={() => set(value - 1)} tabIndex={-1}>
        <span aria-hidden="true">−</span>
      </button>
      <input
        className="fl-lst-qty-input"
        role="spinbutton"
        inputMode="numeric"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={1}
        aria-valuemax={99}
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={commit}
        onKeyDown={onKey}
      />
      <button type="button" className="fl-lst-qty-btn" aria-label="One more" disabled={value >= 99} onClick={() => set(value + 1)} tabIndex={-1}>
        <Icon name="plus" />
      </button>
    </span>
  );
}

// flowcode:sample
const SAMPLE = {
  zips: ["94110", "78704"],
  first: "LST-1001",
};

export default function ListBuilderSheet() {
  const state = useLookup(sampleLookup);
  const [open, setOpen] = useState<string | null>(SAMPLE.first);
  const shownId = open && state.lists.some((l) => l.id === open) ? open : null;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>List builder</h3>
        <p className="fl-ctl-btn-what">Lists for one library each. Open a list on the left; add books, change the library, check things off. Pick a ZIP code to see the nearest library that has what this one doesn't.</p>
        <div className="fl-lst-demo-bar">
          <span className="fl-lst-demo-label">ZIP code</span>
          {SAMPLE.zips.map((z) => (
            <Button key={z} variant="secondary" size={32} pressed={state.zip === z} onClick={() => sampleLookup.setZip(z)}>
              {z}
            </Button>
          ))}
          <Button variant="tertiary" size={32} onClick={() => sampleLookup.clearZip()} disabled={!state.zip}>No ZIP</Button>
          <Button variant="tertiary" size={32} onClick={() => (state.signedIn ? sampleLookup.signOut() : sampleLookup.signIn())}>{state.signedIn ? "Sign out" : "Sign in"}</Button>
          <Button variant="tertiary" size={32} icon="refresh" onClick={() => { sampleLookup.reset(); setOpen(SAMPLE.first); }}>Reset sample</Button>
        </div>
        <div className="fl-lst-demo">
          <ListIndex lookup={sampleLookup} framed={false} current={shownId ?? undefined} onOpen={setOpen} />
          <div className="fl-lst-demo-open">
            {shownId ? (
              <ListBuilder
                lookup={sampleLookup}
                id={shownId}
                framed={false}
                onBack={() => setOpen(null)}
                onOpenList={setOpen}
                onOpenEntry={(id) => toast(`The page for ${id} opens here.`, "info")}
                onChoosePlace={() => toast("The place finder opens here.", "info")}
              />
            ) : (
              <div className="fl-lst-empty fl-lst-empty--compact">
                <p className="fl-lst-empty-title">No list open</p>
                <p className="fl-lst-empty-text">Open one of your lists to see it here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster />
    </section>
  );
}
