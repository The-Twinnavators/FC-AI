/** @flowcode-library shipment-tracking · Shipment tracking (Cards)
 * Catalog ID: b.shipment-tracking (block)
 * Function: Where a package is (b.shipment-tracking): look up a tracking number (checked for empty and format, with recent numbers), a loading state, not-found and can't-reach answers with Retry; then the status and arrival time, a five-stage progress line, a delivery problem with a fix-the-address form that clears it, the scan history (latest first, the rest behind Show all), shipment details, copy the number, refresh, and Notify me by email or text for chosen events.
 * Use it as: import { ShipmentTracking } from "./shipment-tracking"; <ShipmentTracking shipments?={[{ number, carrier, service, from, to: { name, city }, status: "label"|"picked"|"transit"|"out"|"delivered"|"exception", eta: "2026-10-23", window?: "by 8 PM", weight, items, scans: [{ at: "2026-10-21T07:42", place, text, kind?: "info"|"exception"|"delivered" }], problem?: { title, text } }]} lookup?={async (number) => Shipment | null} start?="1Z…" onNotify?={async (prefs) => void} onFix?={async (number, fix) => void} />
 * Built from: c.text-field.outlined, c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.checkbox, c.switch, c.skeleton, c.empty-state
 * Look: A white card: a tracking-number search with recent-number chips; then a big status line ("Out for delivery") with the arrival day and a status pill, the carrier and number with Copy and Refresh; a five-stage line whose bar draws across to the current stage (a danger stop on a problem); an amber problem box with Fix address that opens a short form; the scans as a vertical list on a straight line with dots, newest on top and the rest behind Show all; beside it a sunken column with details and the Notify me form.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --color-info --surface-bg --surface-radius --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --text-xs --text-sm --text-md --text-lg --text-xl --font-display --font-mono --weight-medium --weight-semibold --focus-ring --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: order tracking; shipment tracking; delivery status; package tracking; returns tracking; freight tracking; customer support lookup
 * Jobs to be done: find out where my package is; know when it will arrive; fix a delivery problem before it's sent back; get told when it's out for delivery; see every scan along the way
 * Keywords: tracking, shipment, package, delivery, carrier, ETA, timeline, scans, exception, notify, order status, logistics
 */
/**
 * Shipment tracking: what a customer or a support agent opens. The number is checked (letters and digits, 8 to 30)
 * before the lookup; the lookup shows a loading card and answers with the shipment, not found, or can't reach the
 * carrier (Retry). The stages run Label, Picked up, In transit, Out for delivery, Delivered; the bar draws to the
 * current one. A problem (a missing apartment number) shows its box with Fix address: the form opens in place and,
 * once saved, the problem clears, a scan is added and the status goes back to In transit. Scans show the latest four;
 * Show all opens the rest. Notify me takes email and/or a text number and which events; it says what it will send.
 * Make it the app's own: replace SAMPLE and the lookup with the carrier's tracking call, and send the notify and fix
 * choices to it.
 * Adapted from HyperUI (MIT License, Copyright (c) Mark Mead): its timeline and steps components.
 */
/**
 * How to try it
 * - Press Track with the field empty, then type "abc": both are checked. Tap a recent number: it loads.
 * - On the first one, press Fix address, save it empty (the unit is required), then type "Apt 4B" and save: the problem clears.
 * - Press Show all scans, then Show fewer. Press Copy and Refresh.
 * - In Notify me, turn on Text, save with an empty phone: it is checked. Fill it in and save.
 * - Type 1Z999AA10000000000 and Track: not found. Type NET-ERROR-123 and Track: can't reach, with Retry.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's TextField ("./text-fields-states"),
 * Button ("./buttons-variants"), Badge ("./badges-status"), Checkbox ("./checkboxes-radios"), Switch
 * ("./switches-states") and its inline icon set ("./icons"). Nothing else: no package to install and nothing fetched at
 * run time (the sample lookup reads SAMPLE after a short pause). The styles are the library's own fl- classes in
 * templates/library/css/r5c-shipment-tracking.css.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Checkbox } from "./checkboxes-radios";
import { Icon } from "./icons";
import { Switch } from "./switches-states";
import { TextField } from "./text-fields-states";

// ── b.shipment-tracking: lookup, status and stages, a problem with a fix, scans, details, notify me. ──

export type ShipStatus = "label" | "picked" | "transit" | "out" | "delivered" | "exception";
export type Scan = { /** local time "YYYY-MM-DDTHH:MM" */ at: string; place: string; text: string; kind?: "info" | "exception" | "delivered" };
export type Shipment = {
  number: string;
  carrier: string;
  service: string;
  from: string;
  to: { name: string; city: string };
  status: ShipStatus;
  /** "YYYY-MM-DD" or null when unknown */
  eta: string | null;
  window?: string;
  weight?: string;
  items?: string;
  /** newest first */
  scans: Scan[];
  problem?: { title: string; text: string };
};
export type NotifyPrefs = { email: string; phone: string | null; events: Array<"out" | "delivered" | "problem"> };
export type ShipmentTrackingProps = {
  title?: string;
  /** Used by the built-in lookup; leave it out when you pass your own. */
  shipments?: Shipment[];
  lookup?: (number: string) => Promise<Shipment | null>;
  /** Looked up on first draw. */
  start?: string;
  recent?: string[];
  locale?: string;
  onNotify?: (number: string, prefs: NotifyPrefs) => Promise<void>;
  onFix?: (number: string, fix: { unit: string; note: string }) => Promise<void>;
};

const STAGES: Array<{ id: Exclude<ShipStatus, "exception">; label: string }> = [
  { id: "label", label: "Label created" },
  { id: "picked", label: "Picked up" },
  { id: "transit", label: "In transit" },
  { id: "out", label: "Out for delivery" },
  { id: "delivered", label: "Delivered" },
];
const STATUS_WORDS: Record<ShipStatus, string> = { label: "Label created", picked: "Picked up", transit: "In transit", out: "Out for delivery", delivered: "Delivered", exception: "Delivery problem" };
const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const stamp = (d: Date) => `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parse = (s: string) => {
  const [d, t] = s.split("T");
  const [y, m, day] = d!.split("-").map(Number);
  return new Date(y!, m! - 1, day!, Number(t?.slice(0, 2) ?? 0), Number(t?.slice(3, 5) ?? 0));
};
const norm = (s: string) => s.toUpperCase().replace(/[\s-]/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Focuses an element once React has drawn it (and after any dialog has handed focus back). */
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

type Phase = { kind: "idle" } | { kind: "loading"; number: string } | { kind: "found"; ship: Shipment } | { kind: "missing"; number: string } | { kind: "failed"; number: string };

export function ShipmentTracking({ title = "Track a package", shipments = [], lookup, start, recent = [], locale = "en-US", onNotify = quick, onFix = quick }: ShipmentTrackingProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const [query, setQuery] = useState(start ?? "");
  const [queryErr, setQueryErr] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [said, setSaid] = useState("");
  const [allScans, setAllScans] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [fix, setFix] = useState({ unit: "", note: "" });
  const [fixErr, setFixErr] = useState("");
  const [fixBusy, setFixBusy] = useState(false);
  const [notify, setNotify] = useState<NotifyPrefs & { text: boolean }>({ email: "", phone: "", text: false, events: ["out", "delivered", "problem"] });
  const [notifyErr, setNotifyErr] = useState<{ email?: string; phone?: string; events?: string }>({});
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifySaved, setNotifySaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const local = useRef(shipments);
  local.current = shipments;
  const req = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const fmtDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }), [locale]);
  const fmtWhen = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), [locale]);
  const dayWords = (iso: string) => {
    const t = isoOf(new Date());
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    return iso === t ? "Today" : iso === isoOf(tm) ? "Tomorrow" : fmtDay.format(parse(iso));
  };

  const find =
    lookup ??
    (async (n: string) => {
      await new Promise((r) => setTimeout(r, 650));
      if (norm(n).startsWith("NETERROR")) throw new Error("offline");
      return local.current.find((s) => norm(s.number) === norm(n)) ?? null;
    });

  const run = async (raw: string) => {
    const n = raw.trim();
    if (!n) {
      setQueryErr("Enter a tracking number.");
      document.getElementById(`${uid}-q`)?.focus();
      return;
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{6,34}[A-Za-z0-9]$/.test(n) || norm(n).length < 8 || norm(n).length > 30) {
      setQueryErr("That doesn't look like a tracking number. Use letters and numbers, 8 to 30 long.");
      document.getElementById(`${uid}-q`)?.focus();
      return;
    }
    setQueryErr("");
    // A button inside the result (Refresh, Retry) is about to go: put focus back on the new result once it's drawn.
    const fromBody = Boolean(bodyRef.current?.contains(document.activeElement));
    const refocus = (target: string) => fromBody && focusLater(() => document.getElementById(target));
    const id = ++req.current;
    setPhase({ kind: "loading", number: n });
    if (fromBody) focusLater(() => bodyRef.current);
    setSaid(`Looking up ${n}…`);
    try {
      const ship = await find(n);
      if (id !== req.current) return;
      if (!ship) {
        setPhase({ kind: "missing", number: n });
        setSaid(`No shipment found for ${n}.`);
        refocus(`${uid}-retry`);
        return;
      }
      setPhase({ kind: "found", ship });
      setAllScans(false);
      setFixOpen(false);
      setNotifySaved(null);
      refocus(`${uid}-status`);
      setSaid(`${STATUS_WORDS[ship.status]}.${ship.eta && ship.status !== "delivered" ? ` Arrives ${dayWords(ship.eta)}${ship.window ? ` ${ship.window}` : ""}.` : ""}`);
    } catch {
      if (id !== req.current) return;
      setPhase({ kind: "failed", number: n });
      setSaid("Couldn't reach the carrier.");
      refocus(`${uid}-retry`);
    }
  };

  useEffect(() => {
    if (start) void run(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ship = phase.kind === "found" ? phase.ship : null;
  const setShip = (s: Shipment) => setPhase({ kind: "found", ship: s });

  const copy = async () => {
    if (!ship) return;
    try {
      await navigator.clipboard.writeText(ship.number);
      setCopied(true);
      setSaid("Tracking number copied.");
    } catch {
      setSaid(`Couldn't copy. The number is ${ship.number}.`);
    }
  };
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);

  const saveFix = async () => {
    if (!ship) return;
    if (!fix.unit.trim()) {
      setFixErr("Enter the apartment, suite or unit.");
      document.getElementById(`${uid}-unit`)?.focus();
      return;
    }
    setFixBusy(true);
    setFixErr("");
    try {
      await onFix(ship.number, { unit: fix.unit.trim(), note: fix.note.trim() });
      const now = new Date();
      const eta = new Date();
      eta.setDate(eta.getDate() + 1);
      setShip({
        ...ship,
        status: "transit",
        problem: undefined,
        eta: isoOf(eta),
        to: { ...ship.to, city: ship.to.city },
        scans: [{ at: stamp(now), place: ship.scans[0]?.place ?? "", text: `Address updated by recipient (${fix.unit.trim()}). Delivery rescheduled.`, kind: "info" }, ...ship.scans],
      });
      setFixOpen(false);
      setFix({ unit: "", note: "" });
      setSaid(`Address updated. Now arriving ${dayWords(isoOf(eta))}.`);
      focusLater(() => document.getElementById(`${uid}-status`));
    } catch {
      setFixErr("Couldn't send the fix. Try again.");
    } finally {
      setFixBusy(false);
    }
  };

  const saveNotify = async () => {
    if (!ship) return;
    const e: typeof notifyErr = {};
    if (!notify.email.trim() && !notify.text) e.email = "Enter an email, or turn on Text.";
    else if (notify.email.trim() && !EMAIL.test(notify.email.trim())) e.email = "Enter an email like name@example.com.";
    if (notify.text && !/^\+?[\d\s().-]{7,20}$/.test(notify.phone ?? "")) e.phone = "Enter a phone number, like (555) 201-3344.";
    if (!notify.events.length) e.events = "Pick at least one update.";
    setNotifyErr(e);
    const first = (["email", "phone", "events"] as const).find((k) => e[k]);
    if (first) {
      document.getElementById(`${uid}-n-${first}`)?.focus();
      return;
    }
    setNotifyBusy(true);
    try {
      await onNotify(ship.number, { email: notify.email.trim(), phone: notify.text ? (notify.phone ?? "").trim() : null, events: notify.events });
      const to = [notify.email.trim(), notify.text ? (notify.phone ?? "").trim() : ""].filter(Boolean).join(" and ");
      const what = notify.events.map((x) => (x === "out" ? "out for delivery" : x === "delivered" ? "delivered" : "a problem")).join(", ");
      setNotifySaved(`We'll send updates to ${to}: ${what}.`);
      setSaid(`Updates on. We'll send them to ${to}.`);
      focusLater(() => document.getElementById(`${uid}-n-off`));
    } catch {
      setNotifyErr({ email: "Couldn't save. Try again." });
    } finally {
      setNotifyBusy(false);
    }
  };

  const stageAt = ship ? (ship.status === "exception" ? 2 : STAGES.findIndex((s) => s.id === ship.status)) : 0;
  const shownScans = ship ? ship.scans.slice(0, 4) : [];
  const moreScans = ship ? ship.scans.slice(4) : [];
  const sampleNumbers = recent.length ? recent : shipments.map((s) => s.number).slice(0, 3);

  return (
    <div className="fl-trk" data-fl="b.shipment-tracking">
      <form
        className="fl-trk-find"
        role="search"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void run(query);
        }}
      >
        <h3 className="fl-trk-title">
          <label htmlFor={`${uid}-q`}>{title}</label>
        </h3>
        <div className="fl-trk-row">
          <div className="fl-trk-q">
            <Icon name="search" />
            <TextField
              id={`${uid}-q`}
              size={44}
              value={query}
              autoComplete="off"
              spellCheck={false}
              placeholder="Tracking number"
              invalid={Boolean(queryErr)}
              aria-describedby={queryErr ? `${uid}-q-err` : undefined}
              onChange={(e) => {
                setQuery(e.target.value);
                setQueryErr("");
              }}
            />
          </div>
          <Button type="submit" variant="primary" size={44} busy={phase.kind === "loading"}>
            Track
          </Button>
        </div>
        {queryErr ? <Err id={`${uid}-q-err`} text={queryErr} /> : null}
        {sampleNumbers.length ? (
          <div className="fl-trk-recent">
            <span>Recent</span>
            {sampleNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className="fl-trk-chip"
                onClick={() => {
                  setQuery(n);
                  setQueryErr("");
                  void run(n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
        ) : null}
      </form>

      <div className="fl-trk-body" ref={bodyRef} tabIndex={-1} id={`${uid}-body`} aria-busy={phase.kind === "loading" || undefined}>
        {phase.kind === "idle" ? (
          <div className="fl-trk-empty" data-fl="c.empty-state">
            <Icon name="map" />
            <strong>Enter a tracking number</strong>
            <p>It's in your shipping email or on the receipt.</p>
          </div>
        ) : phase.kind === "loading" ? (
          <div className="fl-trk-skel" data-fl="c.skeleton" aria-label="Loading shipment">
            <span className="w-40" />
            <span className="w-60 tall" />
            <span className="w-100 bar" />
            <span className="w-80" />
            <span className="w-70" />
          </div>
        ) : phase.kind === "missing" || phase.kind === "failed" ? (
          <div className="fl-trk-empty is-error" role="alert">
            <Icon name="alert" />
            <strong>{phase.kind === "missing" ? "No shipment found" : "Couldn't reach the carrier"}</strong>
            <p>{phase.kind === "missing" ? `Check ${phase.number} against your receipt. New labels can take a few hours to show.` : "Check your connection and try again."}</p>
            <Button id={`${uid}-retry`} variant="secondary" size={40} icon="refresh" onClick={() => void run(phase.number)}>
              {phase.kind === "missing" ? "Search again" : "Retry"}
            </Button>
          </div>
        ) : ship ? (
          <div className="fl-trk-ship" key={ship.number}>
            <section className="fl-trk-main" aria-label="Status">
              <div className="fl-trk-status">
                <div>
                  <p className="fl-trk-big" id={`${uid}-status`} tabIndex={-1}>
                    {STATUS_WORDS[ship.status]}
                  </p>
                  <p className="fl-trk-eta">
                    {ship.status === "delivered"
                      ? `Delivered ${fmtWhen.format(parse(ship.scans[0]?.at ?? stamp(new Date())))}`
                      : ship.eta
                        ? `Arrives ${dayWords(ship.eta)}${ship.window ? `, ${ship.window}` : ""}`
                        : "No arrival date yet"}
                  </p>
                </div>
                <Badge tone={ship.status === "delivered" ? "success" : ship.status === "exception" ? "danger" : ship.status === "out" ? "info" : "neutral"} led pulse={ship.status === "out"}>
                  {ship.status === "exception" ? "Action needed" : ship.status === "delivered" ? "Delivered" : "On the way"}
                </Badge>
              </div>
              <div className="fl-trk-num">
                <span>{ship.carrier}</span>
                <code>{ship.number}</code>
                <Button variant="tertiary" size={32} icon={copied ? "check" : "copy"} onClick={() => void copy()}>
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="tertiary" size={32} icon="refresh" onClick={() => void run(ship.number)}>
                  Refresh
                </Button>
              </div>

              <ol className={`fl-trk-stages${ship.status === "exception" ? " is-problem" : ""}`} aria-label="Progress" style={{ ["--fl-trk-fill" as string]: stageAt / (STAGES.length - 1) }}>
                <span className="fl-trk-line" aria-hidden="true">
                  <span />
                </span>
                {STAGES.map((s, i) => {
                  const state = i < stageAt ? "done" : i === stageAt ? (ship.status === "exception" ? "problem" : "now") : "next";
                  return (
                    <li key={s.id} className={`is-${state}`} aria-current={i === stageAt ? "step" : undefined} style={{ ["--fl-trk-i" as string]: i }}>
                      <span className="fl-trk-dot" aria-hidden="true">
                        {state === "done" || (state === "now" && s.id === "delivered") ? <Icon name="check" /> : state === "problem" ? <Icon name="alert" /> : null}
                      </span>
                      <span className="fl-trk-stage">{s.label}</span>
                      <span className="fl-sr">{state === "done" ? ", done" : state === "now" ? ", current" : state === "problem" ? ", stopped: problem" : ""}</span>
                    </li>
                  );
                })}
              </ol>

              {ship.problem ? (
                <div className="fl-trk-problem" role="region" aria-labelledby={`${uid}-pb`}>
                  <div className="fl-trk-problem-head">
                    <Icon name="alert" />
                    <div>
                      <strong id={`${uid}-pb`}>{ship.problem.title}</strong>
                      <p>{ship.problem.text}</p>
                    </div>
                    {!fixOpen ? (
                      <Button
                        variant="primary"
                        size={40}
                        aria-expanded={false}
                        aria-controls={`${uid}-fix`}
                        onClick={() => {
                          setFixOpen(true);
                          focusLater(() => document.getElementById(`${uid}-unit`));
                        }}
                      >
                        Fix address
                      </Button>
                    ) : null}
                  </div>
                  <div className={`fl-trk-fold${fixOpen ? " is-open" : ""}`} id={`${uid}-fix`} inert={!fixOpen || undefined}>
                    <form
                      className="fl-trk-fixform"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveFix();
                      }}
                    >
                      <p className="fl-trk-addr">
                        {ship.to.name}, {ship.to.city}
                      </p>
                      <div className="fl-trk-field">
                        <label htmlFor={`${uid}-unit`}>Apartment, suite or unit</label>
                        <TextField
                          id={`${uid}-unit`}
                          size={40}
                          value={fix.unit}
                          invalid={Boolean(fixErr)}
                          aria-describedby={fixErr ? `${uid}-unit-err` : undefined}
                          onChange={(e) => {
                            setFix((f) => ({ ...f, unit: e.target.value }));
                            setFixErr("");
                          }}
                        />
                        {fixErr ? <Err id={`${uid}-unit-err`} text={fixErr} /> : null}
                      </div>
                      <div className="fl-trk-field">
                        <label htmlFor={`${uid}-note`}>
                          Note for the driver <span>(optional)</span>
                        </label>
                        <TextField id={`${uid}-note`} size={40} value={fix.note} placeholder="e.g. Buzz 4B, leave with the front desk" onChange={(e) => setFix((f) => ({ ...f, note: e.target.value }))} />
                      </div>
                      <div className="fl-trk-btns">
                        <Button
                          variant="tertiary"
                          size={40}
                          onClick={() => {
                            setFixOpen(false);
                            setFixErr("");
                            focusLater(() => document.getElementById(`${uid}-pb`)?.closest<HTMLElement>(".fl-trk-problem")?.querySelector<HTMLElement>("button"));
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" variant="primary" size={40} busy={fixBusy}>
                          {fixBusy ? "Saving…" : "Save address"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}

              <section className="fl-trk-scans" aria-labelledby={`${uid}-scans`}>
                <h4 id={`${uid}-scans`}>Scans</h4>
                <ol className="fl-trk-tl">
                  {shownScans.map((s, i) => (
                    <ScanRow key={`${s.at}-${i}`} scan={s} i={i} fmt={fmtWhen} latest={i === 0} />
                  ))}
                </ol>
                {moreScans.length ? (
                  <>
                    <div className={`fl-trk-fold${allScans ? " is-open" : ""}`} id={`${uid}-more`} inert={!allScans || undefined}>
                      <ol className="fl-trk-tl" aria-label="Earlier scans">
                        {moreScans.map((s, i) => (
                          <ScanRow key={`${s.at}-m${i}`} scan={s} i={i} fmt={fmtWhen} />
                        ))}
                      </ol>
                    </div>
                    <button type="button" className="fl-trk-more" aria-expanded={allScans} aria-controls={`${uid}-more`} onClick={() => setAllScans((v) => !v)}>
                      <Icon name="chevron-down" />
                      {allScans ? "Show fewer" : `Show all ${ship.scans.length} scans`}
                    </button>
                  </>
                ) : null}
              </section>
            </section>

            <aside className="fl-trk-side">
              <section aria-labelledby={`${uid}-det`}>
                <h4 id={`${uid}-det`}>Details</h4>
                <dl className="fl-trk-dl">
                  <dt>To</dt>
                  <dd>
                    {ship.to.name}, {ship.to.city}
                  </dd>
                  <dt>From</dt>
                  <dd>{ship.from}</dd>
                  <dt>Service</dt>
                  <dd>{ship.service}</dd>
                  {ship.weight ? (
                    <>
                      <dt>Weight</dt>
                      <dd>{ship.weight}</dd>
                    </>
                  ) : null}
                  {ship.items ? (
                    <>
                      <dt>Contents</dt>
                      <dd>{ship.items}</dd>
                    </>
                  ) : null}
                </dl>
              </section>

              {ship.status !== "delivered" ? (
                <section aria-labelledby={`${uid}-nt`} className="fl-trk-notify">
                  <h4 id={`${uid}-nt`}>Notify me</h4>
                  {notifySaved ? (
                    <div className="fl-trk-saved">
                      <p>
                        <Icon name="bell" />
                        {notifySaved}
                      </p>
                      <Button
                        id={`${uid}-n-off`}
                        variant="secondary"
                        size={40}
                        onClick={() => {
                          setNotifySaved(null);
                          setSaid("Updates off.");
                          focusLater(() => document.getElementById(`${uid}-n-email`));
                        }}
                      >
                        Turn off
                      </Button>
                    </div>
                  ) : (
                    <form
                      className="fl-trk-nform"
                      noValidate
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveNotify();
                      }}
                    >
                      <div className="fl-trk-field">
                        <label htmlFor={`${uid}-n-email`}>Email</label>
                        <TextField
                          id={`${uid}-n-email`}
                          type="email"
                          size={40}
                          autoComplete="email"
                          value={notify.email}
                          invalid={Boolean(notifyErr.email)}
                          aria-describedby={notifyErr.email ? `${uid}-n-email-err` : undefined}
                          onChange={(e) => {
                            setNotify((n) => ({ ...n, email: e.target.value }));
                            setNotifyErr((x) => ({ ...x, email: undefined }));
                          }}
                        />
                        {notifyErr.email ? <Err id={`${uid}-n-email-err`} text={notifyErr.email} /> : null}
                      </div>
                      <label className="fl-trk-switch">
                        <Switch size={24} label="Text me too" on={notify.text} onToggle={(v) => setNotify((n) => ({ ...n, text: v }))} />
                        <span aria-hidden="true">Text me too</span>
                      </label>
                      <div className={`fl-trk-fold${notify.text ? " is-open" : ""}`} inert={!notify.text || undefined}>
                        <div className="fl-trk-field">
                          <label htmlFor={`${uid}-n-phone`}>Mobile number</label>
                          <TextField
                            id={`${uid}-n-phone`}
                            type="tel"
                            size={40}
                            autoComplete="tel"
                            value={notify.phone ?? ""}
                            invalid={Boolean(notifyErr.phone)}
                            aria-describedby={notifyErr.phone ? `${uid}-n-phone-err` : undefined}
                            onChange={(e) => {
                              setNotify((n) => ({ ...n, phone: e.target.value }));
                              setNotifyErr((x) => ({ ...x, phone: undefined }));
                            }}
                          />
                          {notifyErr.phone ? <Err id={`${uid}-n-phone-err`} text={notifyErr.phone} /> : null}
                        </div>
                      </div>
                      <fieldset className="fl-trk-events" aria-describedby={notifyErr.events ? `${uid}-n-events-err` : undefined}>
                        <legend>Tell me when it's</legend>
                        {(
                          [
                            ["out", "Out for delivery"],
                            ["delivered", "Delivered"],
                            ["problem", "Delayed or stuck"],
                          ] as const
                        ).map(([v, l], i) => (
                          <Checkbox
                            key={v}
                            id={i === 0 ? `${uid}-n-events` : undefined}
                            label={l}
                            checked={notify.events.includes(v)}
                            onChange={(e) => {
                              const on = e.currentTarget.checked;
                              setNotify((n) => ({ ...n, events: on ? [...n.events, v] : n.events.filter((x) => x !== v) }));
                              setNotifyErr((x) => ({ ...x, events: undefined }));
                            }}
                          />
                        ))}
                        {notifyErr.events ? <Err id={`${uid}-n-events-err`} text={notifyErr.events} /> : null}
                      </fieldset>
                      <Button type="submit" variant="primary" size={40} icon="bell" busy={notifyBusy} block>
                        {notifyBusy ? "Saving…" : "Get updates"}
                      </Button>
                    </form>
                  )}
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}
      </div>

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

function ScanRow({ scan, i, fmt, latest }: { scan: Scan; i: number; fmt: Intl.DateTimeFormat; latest?: boolean }) {
  return (
    <li className={`fl-trk-scan is-${scan.kind ?? "info"}${latest ? " is-latest" : ""}`} style={{ ["--fl-trk-i" as string]: Math.min(i, 6) }}>
      <span className="fl-trk-sdot" aria-hidden="true" />
      <div>
        <strong>{scan.text}</strong>
        <span>
          <time dateTime={scan.at}>{fmt.format(parse(scan.at))}</time>
          {scan.place ? ` · ${scan.place}` : ""}
        </span>
      </div>
    </li>
  );
}

function Err({ id, text }: { id?: string; text: string }) {
  return (
    <p className="fl-trk-err" id={id}>
      <Icon name="alert" />
      {text}
    </p>
  );
}

/** A time some hours before now, so the sample's scans stay current. */
const ago = (h: number) => stamp(new Date(Date.now() - h * 3600000));
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoOf(d);
};

// flowcode:sample
const SAMPLE: ShipmentTrackingProps = {
  title: "Track a package",
  start: "1Z 84A 7F3 03 4471 2209",
  shipments: [
    {
      number: "1Z 84A 7F3 03 4471 2209",
      carrier: "UPS Ground",
      service: "Ground, 3–5 business days",
      from: "Northside Fulfillment, Reno, NV",
      to: { name: "Maya Singh", city: "Portland, OR 97209" },
      status: "exception",
      eta: null,
      weight: "4.2 lb",
      items: "2 items · Order #48213",
      problem: { title: "Address needs a unit number", text: "The driver couldn't find an apartment number. Add it by tomorrow at 6 PM or the package goes back." },
      scans: [
        { at: ago(2), place: "Portland, OR", text: "Delivery attempted: apartment number missing", kind: "exception" },
        { at: ago(5), place: "Portland, OR", text: "Out for delivery" },
        { at: ago(9), place: "Portland, OR", text: "Arrived at local facility" },
        { at: ago(20), place: "Medford, OR", text: "Departed facility" },
        { at: ago(27), place: "Medford, OR", text: "Arrived at facility" },
        { at: ago(41), place: "Sacramento, CA", text: "Departed facility" },
        { at: ago(48), place: "Reno, NV", text: "Picked up" },
        { at: ago(60), place: "Reno, NV", text: "Label created" },
      ],
    },
    {
      number: "9400 1118 9922 3045 7781 06",
      carrier: "USPS",
      service: "Priority Mail",
      from: "Alder & Rye Supply, Boise, ID",
      to: { name: "Jordan Lee", city: "Denver, CO 80205" },
      status: "out",
      eta: inDays(0),
      window: "by 8 PM",
      weight: "1.1 lb",
      items: "1 item · Order #48190",
      scans: [
        { at: ago(1), place: "Denver, CO", text: "Out for delivery" },
        { at: ago(6), place: "Denver, CO", text: "Arrived at post office" },
        { at: ago(22), place: "Salt Lake City, UT", text: "In transit" },
        { at: ago(30), place: "Boise, ID", text: "Picked up" },
        { at: ago(34), place: "Boise, ID", text: "Label created" },
      ],
    },
    {
      number: "7741 9902 3310",
      carrier: "FedEx",
      service: "2Day",
      from: "Northside Fulfillment, Reno, NV",
      to: { name: "Priya Shah", city: "Austin, TX 78704" },
      status: "delivered",
      eta: inDays(-1),
      items: "3 items · Order #48102",
      scans: [
        { at: ago(26), place: "Austin, TX", text: "Delivered: left at front door", kind: "delivered" },
        { at: ago(31), place: "Austin, TX", text: "Out for delivery" },
        { at: ago(44), place: "Dallas, TX", text: "In transit" },
        { at: ago(56), place: "Reno, NV", text: "Picked up" },
      ],
    },
  ],
};

export default function ShipmentTrackingPreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ShipmentTracking {...SAMPLE} />
      </div>
    </section>
  );
}
