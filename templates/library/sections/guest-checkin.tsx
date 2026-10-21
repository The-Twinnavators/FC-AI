/** @flowcode-library guest-checkin · Guest list check-in (Tables and lists)
 * Catalog ID: b.guest-checkin (block)
 * Function: The door list for an event or a reservation night (b.guest-checkin): how many are in against the total, search by name, email or code, filter by arrival and ticket type, check a guest and their party in (with Undo), scan or type a ticket code with found, already-in and not-found answers, add a walk-in, and remove a guest after a confirm.
 * Use it as: import { GuestCheckin } from "./guest-checkin"; <GuestCheckin event="Fall supper club" when="Doors 6:30 PM" ticketTypes={["General","VIP"]} guests={[{ id, name, email, ticket, party, code, checkedAt?: "2026-10-21T18:42" }]} onCheckIn?={async (id) => ...} onUndo?={async (id) => ...} onAdd?={async (guest) => ...} onRemove?={async (id) => ...} />
 * Built from: c.text-field.outlined, c.segmented.segmented, c.select.outlined, c.quantity, c.avatar.person, c.badge.status, c.modal.form, c.modal.danger, c.button.primary, c.button.secondary, c.button.tertiary, c.empty-state
 * Look: A gray page with one white card: the event name and doors time, a big "38 of 64 in" count over a straight progress bar with a count per ticket type, Scan code and Add walk-in buttons; then a search field, an All / Not here / Here control and a ticket type select over the guest rows (initials, name and email with the match highlighted, ticket tag, party size, code, and a Check in button or a green "In 6:42 PM" badge with Undo). The scan dialog has a framed camera stand-in with a sweeping line and a code field.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: event check-in; guest list; door list; ticket scanning; restaurant reservation arrivals; workshop sign-in; conference badge pickup
 * Jobs to be done: find a guest fast at the door; check in a whole party at once; scan a ticket and know if it is good; fix a mistaken check-in; add someone who shows up without a ticket; see how many are in
 * Keywords: check-in, guest list, door list, scan, ticket code, QR, attendance, walk-in, event, reservation, arrivals, undo
 */
/**
 * Guest list check-in: what the person at the door uses. The count and bar show who is in (parties count in full);
 * each ticket type shows its own count. Search matches name, email or code and marks the match; the filters combine;
 * rows glide when the list changes and the count is read out. Check in marks the whole party with the time; Undo puts
 * them back. Scan code opens a dialog (a framed camera stand-in: no camera is used) where a code is typed or a sample
 * is tapped; it answers checked in, already in (with the time) or not found, and stays open for the next one. Add
 * walk-in takes a name, an optional email, a ticket type and a party size, and checks them in. Remove asks first.
 * Make it the app's own: replace SAMPLE with the guest list, wire a real scanner to the code field, and make the
 * callbacks save to the event's list.
 * Adapted from Meraki UI (MIT License, Copyright (c) 2021 Khatab Wedaa): its table with filters and search.
 */
/**
 * How to try it
 * - Type "kim" in Search: the match is marked and the count is read. Pick Here, then Not here; pick VIP in Type.
 * - Press Check in on a row: the count and bar move and Undo shows. Press Undo.
 * - Press Scan code, tap a sample code: checked in. Tap it again: already in. Type ZZ-0000 and Check: not found.
 * - Press Add walk-in, submit it empty, then add a name and party of 2: they are on the list, checked in.
 * - Press the trash button on a row: it asks first; Keep closes it, Remove takes the guest off the list.
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's TextField
 * ("./text-fields-states"), Segmented ("./segmented-control"), Select ("./dropdowns-states"), Quantity
 * ("./input-quantity"), Avatar ("./avatars-variants"), Badge ("./badges-status"), Marked ("./search-field"), Modal
 * ("./modals-dialogs"), Button ("./buttons-variants") and its inline icon set ("./icons"). Nothing else: no package to
 * install, no camera and nothing fetched at run time. The styles are the library's own fl- classes in
 * templates/library/css/r4b-guest-checkin.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Select } from "./dropdowns-states";
import { Icon } from "./icons";
import { Quantity } from "./input-quantity";
import { Modal } from "./modals-dialogs";
import { Marked } from "./search-field";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";

// ── b.guest-checkin: count, search and filters, check in with undo, scan a code, walk-ins. ──

export type Guest = { id: string; name: string; email: string; ticket: string; party: number; code: string; /** local time checked in, "YYYY-MM-DDTHH:MM" */ checkedAt?: string };
export type GuestCheckinProps = {
  event: string;
  when: string;
  ticketTypes: string[];
  guests: Guest[];
  /** Most people one walk-in can bring. */
  maxParty?: number;
  locale?: string;
  onCheckIn?: (id: string) => Promise<void>;
  onUndo?: (id: string) => Promise<void>;
  onAdd?: (guest: Guest) => Promise<void>;
  onRemove?: (id: string) => Promise<void>;
};

type Show = "all" | "waiting" | "in";
type ScanResult = { kind: "ok" | "again" | "missing" | "blank"; text: string } | null;

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
const quick = async () => undefined;
const stamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const normCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** FLIP: rows marked data-flip glide from where they were to where they are now whenever `key` changes. */
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

export function GuestCheckin({ event, when, ticketTypes, guests: given, maxParty = 6, locale = "en-US", onCheckIn = quick, onUndo = quick, onAdd = quick, onRemove = quick }: GuestCheckinProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const list = useRef<HTMLUListElement>(null);
  const [guests, setGuests] = useState(given);
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [type, setType] = useState("");
  const [working, setWorking] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);
  const [said, setSaid] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [code, setCode] = useState("");
  const [scan, setScan] = useState<ScanResult>(null);
  const [scanKey, setScanKey] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [walk, setWalk] = useState({ name: "", email: "", ticket: ticketTypes[0] ?? "", party: 1 });
  const [walkErr, setWalkErr] = useState<{ name?: string; email?: string }>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const timeOf = (s: string) => {
    const [d, t] = s.split("T");
    const [y, m, day] = d!.split("-").map(Number);
    return fmtTime.format(new Date(y!, m! - 1, day!, Number(t!.slice(0, 2)), Number(t!.slice(3, 5))));
  };

  const total = guests.reduce((n, g) => n + g.party, 0);
  const inside = guests.reduce((n, g) => n + (g.checkedAt ? g.party : 0), 0);
  const byType = ticketTypes.map((t) => {
    const of = guests.filter((g) => g.ticket === t);
    return { t, in: of.reduce((n, g) => n + (g.checkedAt ? g.party : 0), 0), all: of.reduce((n, g) => n + g.party, 0) };
  });

  const q = query.trim().toLowerCase();
  const qCode = normCode(query);
  const shown = guests
    .filter((g) => {
      if (q && !(g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q) || (qCode && normCode(g.code).includes(qCode)))) return false;
      if (type && g.ticket !== type) return false;
      if (show === "waiting" && g.checkedAt) return false;
      if (show === "in" && !g.checkedAt) return false;
      return true;
    })
    .sort((a, b) => (show === "in" ? (b.checkedAt ?? "").localeCompare(a.checkedAt ?? "") : a.name.localeCompare(b.name)));
  const key = shown.map((g) => g.id).join("|");
  useFlip(list, key);

  const firstDraw = useRef(true);
  useEffect(() => {
    if (firstDraw.current) {
      firstDraw.current = false;
      return;
    }
    setSaid(shown.length === 0 ? "No guests match." : shown.length === 1 ? "1 guest." : `${shown.length} guests.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, show, type]);

  const setIn = (id: string, at: string | undefined) => setGuests((all) => all.map((g) => (g.id === id ? { ...g, checkedAt: at } : g)));

  const checkIn = async (g: Guest) => {
    setWorking(g.id);
    setRowError(null);
    try {
      await onCheckIn(g.id);
      setIn(g.id, stamp());
      setSaid(`${g.name}${g.party > 1 ? ` and ${g.party - 1} more` : ""} checked in.`);
      focusLater(() => document.getElementById(`${uid}-undo-${g.id}`));
    } catch {
      setRowError({ id: g.id, text: "Couldn't check in. Try again." });
      setSaid(`Couldn't check in ${g.name}. Try again.`);
    } finally {
      setWorking(null);
    }
  };
  const undo = async (g: Guest) => {
    setWorking(g.id);
    setRowError(null);
    try {
      await onUndo(g.id);
      setIn(g.id, undefined);
      setSaid(`${g.name} is back to not here.`);
      focusLater(() => document.getElementById(`${uid}-in-${g.id}`) ?? document.getElementById(`${uid}-q`));
    } catch {
      setRowError({ id: g.id, text: "Couldn't undo. Try again." });
    } finally {
      setWorking(null);
    }
  };

  const runScan = async (raw: string) => {
    const c = normCode(raw);
    if (!c) {
      setScan({ kind: "blank", text: "Type or scan a code." });
      document.getElementById(`${uid}-code`)?.focus();
      return;
    }
    const g = guests.find((x) => normCode(x.code) === c);
    setScanKey((k) => k + 1);
    if (!g) {
      const r = { kind: "missing" as const, text: `No ticket with code ${raw.trim().toUpperCase()}. Check the code or search by name.` };
      setScan(r);
      setSaid(r.text);
      return;
    }
    if (g.checkedAt) {
      const r = { kind: "again" as const, text: `${g.name} is already in, since ${timeOf(g.checkedAt)}.` };
      setScan(r);
      setSaid(r.text);
      return;
    }
    try {
      await onCheckIn(g.id);
      setIn(g.id, stamp());
      const r = { kind: "ok" as const, text: `${g.name} · ${g.ticket}${g.party > 1 ? ` · party of ${g.party}` : ""}` };
      setScan(r);
      setSaid(`Checked in: ${r.text}.`);
      setCode("");
    } catch {
      setScan({ kind: "missing", text: "Couldn't check in. Try again." });
    }
    document.getElementById(`${uid}-code`)?.focus();
  };

  const addWalkIn = async () => {
    const e: typeof walkErr = {};
    if (!walk.name.trim()) e.name = "Enter a name.";
    if (walk.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(walk.email.trim())) e.email = "Enter an email like name@example.com, or leave it empty.";
    setWalkErr(e);
    if (e.name || e.email) {
      document.getElementById(`${uid}-w-${e.name ? "name" : "email"}`)?.focus();
      return;
    }
    const g: Guest = {
      id: `walk-${Date.now()}`,
      name: walk.name.trim(),
      email: walk.email.trim(),
      ticket: walk.ticket,
      party: walk.party,
      code: `WI-${String(Date.now()).slice(-4)}`,
      checkedAt: stamp(),
    };
    await onAdd(g);
    setGuests((all) => [g, ...all]);
    setAddOpen(false);
    setWalk({ name: "", email: "", ticket: ticketTypes[0] ?? "", party: 1 });
    setSaid(`${g.name} added and checked in.`);
    focusLater(() => document.getElementById(`${uid}-undo-${g.id}`));
  };

  const removing = removeId ? guests.find((g) => g.id === removeId) : undefined;
  const doRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await onRemove(removing.id);
      setGuests((all) => all.filter((g) => g.id !== removing.id));
      setSaid(`${removing.name} removed from the list.`);
      setRemoveId(null);
      focusLater(() => document.getElementById(`${uid}-q`));
    } catch {
      setSaid("Couldn't remove. Try again.");
    } finally {
      setRemoveBusy(false);
    }
  };

  const clear = () => {
    setQuery("");
    setShow("all");
    setType("");
    focusLater(() => document.getElementById(`${uid}-q`));
  };

  const samples = guests.filter((g) => !g.id.startsWith("walk-")).slice(0, 12).filter((_, i) => i % 4 === 1).slice(0, 3);

  return (
    <div className="fl-gck" data-fl="b.guest-checkin">
      <header className="fl-gck-head">
        <div>
          <h3 className="fl-gck-title">{event}</h3>
          <p className="fl-gck-when">{when}</p>
        </div>
        <div className="fl-gck-head-actions">
          <Button
            variant="primary"
            size={44}
            icon="eye"
            onClick={() => {
              setScan(null);
              setCode("");
              setScanOpen(true);
            }}
          >
            Scan code
          </Button>
          <Button variant="secondary" size={44} icon="plus" onClick={() => setAddOpen(true)}>
            Add walk-in
          </Button>
        </div>
      </header>

      <div className="fl-gck-count">
        <p>
          <strong>{inside}</strong> of {total} in
          <span className="fl-gck-pct">{total ? Math.round((inside / total) * 100) : 0}%</span>
        </p>
        <span className="fl-gck-bar" role="progressbar" aria-label="Checked in" aria-valuemin={0} aria-valuemax={total} aria-valuenow={inside} aria-valuetext={`${inside} of ${total} people in`}>
          <span style={{ ["--fl-gck-fill" as string]: total ? inside / total : 0 }} />
        </span>
        <ul className="fl-gck-types" aria-label="By ticket type">
          {byType.map((b) => (
            <li key={b.t}>
              {b.t} <strong>{b.in}</strong>/{b.all}
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-gck-tools" role="search">
        <div className="fl-gck-search">
          <label htmlFor={`${uid}-q`} className="fl-sr">
            Search guests
          </label>
          <Icon name="search" />
          <TextField id={`${uid}-q`} size={44} type="search" placeholder="Name, email or code" value={query} autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Segmented
          label="Show"
          size="sm"
          value={show}
          onChange={(v) => setShow(v as Show)}
          options={[
            { value: "all", label: "All" },
            { value: "waiting", label: "Not here" },
            { value: "in", label: "Here" },
          ]}
        />
        <div className="fl-gck-type">
          <label htmlFor={`${uid}-type`} className="fl-sr">
            Ticket type
          </label>
          <Select id={`${uid}-type`} value={type} options={[{ value: "", label: "All types" }, ...ticketTypes.map((t) => ({ value: t, label: t }))]} onChange={(e) => setType(e.target.value)} />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="fl-gck-empty" data-fl="c.empty-state">
          <Icon name="users" />
          <strong>{guests.length ? "No guests match" : "No guests yet"}</strong>
          <p>{guests.length ? "Check the spelling or clear the filters." : "Add a walk-in to start the list."}</p>
          {guests.length ? (
            <Button variant="secondary" size={40} onClick={clear}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="fl-gck-list" ref={list} aria-label="Guests">
          {shown.map((g, i) => (
            <li key={g.id} data-flip={g.id} className={g.checkedAt ? "fl-gck-row is-in" : "fl-gck-row"} style={{ ["--fl-gck-i" as string]: Math.min(i, 8) }}>
              <Avatar name={g.name} size={40} tone={(["a", "b", "c", "d", "e"] as const)[g.name.length % 5]} decorative />
              <div className="fl-gck-who">
                <strong>
                  <Marked text={g.name} query={q} />
                  {g.party > 1 ? <span className="fl-gck-party">+{g.party - 1}</span> : null}
                </strong>
                <span>{g.email ? <Marked text={g.email} query={q} /> : "No email"}</span>
              </div>
              <div className="fl-gck-meta">
                <span className={`fl-gck-ticket${g.ticket === ticketTypes[0] ? "" : " is-alt"}`}>{g.ticket}</span>
                <code>{g.code}</code>
              </div>
              <div className="fl-gck-act">
                {g.checkedAt ? (
                  <div className="fl-gck-inbox">
                    <Badge tone="success" led>
                      In {timeOf(g.checkedAt)}
                    </Badge>
                    <button type="button" id={`${uid}-undo-${g.id}`} className="fl-gck-link" disabled={working === g.id} onClick={() => void undo(g)}>
                      Undo<span className="fl-sr"> check-in for {g.name}</span>
                    </button>
                  </div>
                ) : (
                  <Button id={`${uid}-in-${g.id}`} variant="primary" size={40} busy={working === g.id} onClick={() => void checkIn(g)} aria-label={`Check in ${g.name}${g.party > 1 ? `, party of ${g.party}` : ""}`}>
                    Check in
                  </Button>
                )}
                <Button variant="tertiary" size={40} icon="trash" iconOnly aria-label={`Remove ${g.name}`} onClick={() => setRemoveId(g.id)}>
                  Remove
                </Button>
              </div>
              {rowError?.id === g.id ? (
                <p className="fl-gck-err" role="alert">
                  <Icon name="alert" />
                  {rowError.text}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {scanOpen ? (
        <Modal
          variant="form"
          title="Scan a ticket"
          description="Point the camera at the code, or type it."
          confirmLabel="Check"
          cancelLabel="Done"
          onConfirm={() => {
            void runScan(code);
            return false;
          }}
          onClose={() => setScanOpen(false)}
          className="fl-gck-dlg"
        >
          <div className="fl-gck-scan">
            <div className={`fl-gck-cam${scan && scan.kind !== "blank" ? ` is-${scan.kind}` : ""}`} aria-hidden="true" key={`cam-${scanKey}`}>
              <span className="fl-gck-corners" />
              <span className="fl-gck-sweep" />
              <Icon name={scan?.kind === "ok" ? "check" : scan?.kind === "again" ? "clock" : scan?.kind === "missing" ? "close" : "image"} />
            </div>
            <div className="fl-gck-field">
              <label htmlFor={`${uid}-code`}>Ticket code</label>
              <TextField
                id={`${uid}-code`}
                size={44}
                value={code}
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. FS-2041"
                data-autofocus
                aria-describedby={scan ? `${uid}-scan-res` : undefined}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {scan ? (
              <p className={`fl-gck-res is-${scan.kind === "blank" ? "missing" : scan.kind}`} id={`${uid}-scan-res`} key={`res-${scanKey}`}>
                <Icon name={scan.kind === "ok" ? "check" : "alert"} />
                <span>
                  <strong>{scan.kind === "ok" ? "Checked in" : scan.kind === "again" ? "Already in" : scan.kind === "blank" ? "No code yet." : "Not found"}</strong> {scan.text}
                </span>
              </p>
            ) : null}
            <div className="fl-gck-samples">
              <span>Try a sample:</span>
              {samples.map((g) => (
                <button key={g.id} type="button" className="fl-gck-chip" onClick={() => void runScan(g.code)}>
                  {g.code}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}

      {addOpen ? (
        <Modal
          variant="form"
          title="Add a walk-in"
          description="They're checked in as soon as they're added."
          confirmLabel={walk.party > 1 ? `Add party of ${walk.party}` : "Add and check in"}
          onConfirm={() => {
            void addWalkIn();
            return false;
          }}
          onClose={() => {
            setAddOpen(false);
            setWalkErr({});
          }}
        >
          <div className="fl-gck-form">
            <div className="fl-gck-field">
              <label htmlFor={`${uid}-w-name`}>Name</label>
              <TextField
                id={`${uid}-w-name`}
                size={44}
                autoComplete="off"
                value={walk.name}
                invalid={Boolean(walkErr.name)}
                aria-describedby={walkErr.name ? `${uid}-w-name-err` : undefined}
                data-autofocus
                onChange={(e) => {
                  setWalk((w) => ({ ...w, name: e.target.value }));
                  setWalkErr((x) => ({ ...x, name: undefined }));
                }}
              />
              {walkErr.name ? (
                <p className="fl-gck-err" id={`${uid}-w-name-err`}>
                  <Icon name="alert" />
                  {walkErr.name}
                </p>
              ) : null}
            </div>
            <div className="fl-gck-field">
              <label htmlFor={`${uid}-w-email`}>
                Email <span>(optional)</span>
              </label>
              <TextField
                id={`${uid}-w-email`}
                size={44}
                type="email"
                autoComplete="off"
                value={walk.email}
                invalid={Boolean(walkErr.email)}
                aria-describedby={walkErr.email ? `${uid}-w-email-err` : undefined}
                onChange={(e) => {
                  setWalk((w) => ({ ...w, email: e.target.value }));
                  setWalkErr((x) => ({ ...x, email: undefined }));
                }}
              />
              {walkErr.email ? (
                <p className="fl-gck-err" id={`${uid}-w-email-err`}>
                  <Icon name="alert" />
                  {walkErr.email}
                </p>
              ) : null}
            </div>
            <div className="fl-gck-pair">
              <div className="fl-gck-field">
                <label htmlFor={`${uid}-w-type`}>Ticket</label>
                <Select id={`${uid}-w-type`} value={walk.ticket} options={ticketTypes} onChange={(e) => setWalk((w) => ({ ...w, ticket: e.target.value }))} />
              </div>
              <div className="fl-gck-field">
                <label htmlFor={`${uid}-w-party`}>Party</label>
                <Quantity id={`${uid}-w-party`} label="Party size" size="sm" min={1} max={maxParty} value={walk.party} onChange={(v) => setWalk((w) => ({ ...w, party: v }))} />
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {removing ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Remove ${removing.name}?`}
          description={`They come off the guest list${removing.party > 1 ? ` with their party of ${removing.party}` : ""}. Their code ${removing.code} stops working at the door.`}
          confirmLabel="Remove"
          cancelLabel="Keep"
          busy={removeBusy}
          busyLabel="Removing…"
          onConfirm={() => {
            void doRemove();
            return false;
          }}
          onClose={() => setRemoveId(null)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

/** A check-in time some minutes before now, so the sample looks like the door opened a little while ago. */
const ago = (min: number) => stamp(new Date(Date.now() - min * 60000));

// flowcode:sample
const SAMPLE: GuestCheckinProps = {
  event: "Fall supper club",
  when: "Tonight · doors 6:30 PM · Alder & Rye, 2nd floor",
  ticketTypes: ["General", "VIP", "Staff"],
  maxParty: 6,
  guests: [
    { id: "g1", name: "Ana Ruiz", email: "ana.ruiz@example.com", ticket: "VIP", party: 2, code: "FS-2041", checkedAt: ago(34) },
    { id: "g2", name: "Ben Carter", email: "ben.c@example.com", ticket: "General", party: 1, code: "FS-2042" },
    { id: "g3", name: "Chloe Kim", email: "chloe.kim@example.com", ticket: "General", party: 3, code: "FS-2043" },
    { id: "g4", name: "Daniel Osei", email: "dan.osei@example.com", ticket: "General", party: 1, code: "FS-2044", checkedAt: ago(21) },
    { id: "g5", name: "Elena Petrova", email: "elena.p@example.com", ticket: "VIP", party: 1, code: "FS-2045" },
    { id: "g6", name: "Farah Haddad", email: "farah.h@example.com", ticket: "General", party: 2, code: "FS-2046" },
    { id: "g7", name: "Grace Liu", email: "grace.liu@example.com", ticket: "Staff", party: 1, code: "FS-2047", checkedAt: ago(52) },
    { id: "g8", name: "Hiro Tanaka", email: "hiro.t@example.com", ticket: "General", party: 1, code: "FS-2048" },
    { id: "g9", name: "Isaac Brooks", email: "isaac.b@example.com", ticket: "VIP", party: 2, code: "FS-2049", checkedAt: ago(9) },
    { id: "g10", name: "Jasmine Kimura", email: "jas.kimura@example.com", ticket: "General", party: 1, code: "FS-2050" },
    { id: "g11", name: "Liam O'Neill", email: "liam.oneill@example.com", ticket: "General", party: 4, code: "FS-2051" },
    { id: "g12", name: "Maya Singh", email: "maya.s@example.com", ticket: "General", party: 1, code: "FS-2052", checkedAt: ago(15) },
  ],
};

export default function GuestCheckinPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.event}>
      <div className="fl-wrap">
        <GuestCheckin {...SAMPLE} />
      </div>
    </section>
  );
}
