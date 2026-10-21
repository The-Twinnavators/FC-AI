/** @flowcode-library app-calendar · Calendar (App screens)
 * Catalog ID: t.app-calendar (template)
 * Function: A calendar screen (t.app-calendar) with Month, Week and Day views, a Today / previous / next toolbar, events colored by kind in their days and hours, and an Add / Edit event dialog (title, color, start and end date and time) that adds, changes and deletes events; arrow keys move through the month. Adapted from TailAdmin (MIT).
 * Use it as: Copy app-calendar.tsx (FlowCode brings the components it uses); replace SAMPLE with the app's own event kinds and load the events from the app's data. Or import { EventCalendar } from "./app-calendar"; <EventCalendar events={[{ id, title, tone: "accent"|"success"|"warning"|"danger", start: "2026-10-21", end: "2026-10-21", startTime?: "10:00", endTime?: "12:00" }]} onChange={(events) => ...} toneLabels={{ accent: "Class", success: "Open studio", warning: "Firing", danger: "Deadline" }} defaultView?="month"|"week"|"day" weekStart?={0|1} hours?={[7, 21]} locale? labels?={{ dialogText?, noun?: "event" }} />  // no startTime is all day
 * Built from: p.top-nav.app, c.button.primary, c.button.secondary, c.segmented.toggle, c.modal.form, c.modal.danger, c.text-field.outlined, c.choice-group.pill, c.date-picker.docked, c.select.outlined
 * Look: A toolbar with previous, next and Today, the month's name and a Month / Week / Day switch beside Add event, a key of event colors, and a month grid of days with tinted event chips (today's number filled with the accent); Week and Day show the hours with events as blocks in their slots and an all-day row on top; on a phone the month folds to colored dots with the chosen day's events listed under it.
 * Use cases: team calendar; event calendar; class schedule; studio schedule; content calendar; booking overview; shift planner; project deadlines
 * Jobs to be done: see what's happening this month; plan an event on a day; move or change an event; delete an event that was canceled; see my week hour by hour
 * Keywords: app, calendar, schedule, events, month view, week view, day view, agenda, dialog
 */
/**
 * App screen: calendar. A whole screen with its own top bar, a toolbar (previous, Today, next, the period's name, a
 * Month / Week / Day switch and Add event) over the calendar itself. Month shows each day's events as colored chips;
 * Week and Day lay timed events out in their hours, side by side when they overlap, with all-day and multi-day events
 * in a row on top. Choosing an event opens it to edit or delete; Add event, or a click on an empty day or hour, opens
 * the same dialog with the date filled in. On a phone the month folds to colored dots, with the chosen day's events
 * listed under it.
 * Keyboard: in Month, the arrow keys move a day or a week, Page Up/Down a month, Home/End to the week's ends; Enter
 * opens the day; Tab reaches the focused day's events. Escape closes the dialog and focus goes back where it was.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin): its calendar page and Add / Edit event dialog,
 * rewritten for FlowCode in plain React on the library's own pieces and tokens (TailAdmin draws it with FullCalendar).
 * Assembled from: p.top-nav.app > toolbar (c.button x4, c.segmented.toggle) > month grid or time grid (inline) >
 * c.modal.form (c.text-field, c.choice-group.pill, c.date-picker.docked x2, c.select x2) and c.modal.danger to delete.
 * Make it the app's own: replace SAMPLE with the app's event kinds and load the events from the app's data.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { ChoiceGroup } from "./checkboxes-radios";
import { DatePicker, fromIso, toIso, type IsoDate } from "./date-picker";
import { Select } from "./dropdowns-states";
import { Modal } from "./modals-dialogs";
import { Segmented } from "./segmented-control";
import { TextField } from "./text-fields-states";
import { TopNav } from "./top-nav-variants";
import { showTime } from "./booking-calendar";

// ── Events and dates ──

/** An event's color: one of the generic status tones (the same ones as the status badge, c.badge.status). */
export type CalendarTone = BadgeTone;
export type CalendarView = "month" | "week" | "day";
/** Dates are YYYY-MM-DD in local time; times are 24-hour "HH:MM". No start time means all day. */
export type CalendarEvent = { id: string; title: string; tone: CalendarTone; start: IsoDate; end: IsoDate; startTime?: string; endTime?: string };

// Written out in full (not built from the tone) so a build finds every class.
const TONE: Record<CalendarTone, string> = { neutral: "fl-acal-ev--neutral", info: "fl-acal-ev--info", success: "fl-acal-ev--success", warning: "fl-acal-ev--warning", danger: "fl-acal-ev--danger" };
const ALL_TONES: CalendarTone[] = ["info", "success", "warning", "danger", "neutral"];

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
};
const weekOf = (d: Date, weekStart: number) => addDays(d, -((d.getDay() - weekStart + 7) % 7));
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (n: number) => String(n).padStart(2, "0");
/** Timed and on one day: laid out in the hours. Anything else sits in the all-day row. */
const timed = (e: CalendarEvent) => !!e.startTime && e.start === e.end;
const onDay = (e: CalendarEvent, iso: IsoDate) => e.start <= iso && iso <= e.end;
/** All-day and multi-day first, then by start time, then by title. */
const order = (a: CalendarEvent, b: CalendarEvent) => Number(timed(a)) - Number(timed(b)) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.title.localeCompare(b.title);

/** Overlapping timed events share the column: each gets a lane and the number of lanes in its cluster. */
function lanes(events: CalendarEvent[]) {
  const out: Array<{ ev: CalendarEvent; from: number; to: number; lane: number; of: number }> = [];
  let cluster: typeof out = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) c.of = ends.length;
    cluster = [];
    ends = [];
  };
  for (const ev of [...events].sort(order)) {
    const from = minutes(ev.startTime!);
    const to = Math.max(from + 30, ev.endTime ? minutes(ev.endTime) : from + 60);
    if (from >= clusterEnd) flush();
    let lane = ends.findIndex((end) => end <= from);
    if (lane < 0) lane = ends.push(to) - 1;
    else ends[lane] = to;
    const item = { ev, from, to, lane, of: 1 };
    cluster.push(item);
    out.push(item);
    clusterEnd = Math.max(clusterEnd, to);
  }
  flush();
  return out;
}

type Draft = { id?: string; title: string; tone: CalendarTone; start: IsoDate; end: IsoDate; startTime: string; endTime: string };
type DraftErrors = Partial<Record<"title" | "end", string>>;

// ── The calendar ──

/**
 * The calendar with its toolbar and the Add / Edit event dialog. Events are the parent's: every add, edit and delete
 * comes back through onChange with the whole new list.
 */
export function EventCalendar({
  events,
  onChange,
  toneLabels,
  defaultView = "month",
  weekStart = 0,
  hours = [7, 21],
  locale,
  labels = {},
}: {
  events: CalendarEvent[];
  onChange: (events: CalendarEvent[]) => void;
  /** What each status color means here, e.g. { info: "Class", danger: "Deadline" }. Only the tones named here are offered. */
  toneLabels: Partial<Record<CalendarTone, string>>;
  defaultView?: CalendarView;
  /** 0 Sunday, 1 Monday. */
  weekStart?: 0 | 1;
  /** The first and last hour the Week and Day views show. */
  hours?: [number, number];
  locale?: string;
  /** The dialog's words: its line of context, and what is added ("event"). */
  labels?: { dialogText?: string; noun?: string };
}) {
  const noun = labels.noun ?? "event";
  const TONES = ALL_TONES.filter((t) => toneLabels[t]);
  const Noun = noun[0]!.toUpperCase() + noun.slice(1);
  const [view, setView] = useState<CalendarView>(defaultView);
  const [anchor, setAnchor] = useState(() => new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  // The event opened from its chip: read first, edited only on "Edit event".
  const [shown, setShown] = useState<CalendarEvent | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [doomed, setDoomed] = useState<CalendarEvent | null>(null);
  const [said, setSaid] = useState("");
  const [compact, setCompact] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  // Where focus goes after a change that removed what had it (a saved event moved to another day, a deleted one).
  const refocus = useRef<string | null>(null);
  const nextId = useRef(1);

  const today = toIso(new Date());
  const anchorIso = toIso(anchor);
  const fmt = useMemo(
    () => ({
      month: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
      day: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      range: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }),
      head: new Intl.DateTimeFormat(locale, { weekday: "short" }),
      headLong: new Intl.DateTimeFormat(locale, { weekday: "long" }),
      short: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }),
      hour: new Intl.DateTimeFormat(locale, { hour: "numeric" }),
    }),
    [locale],
  );

  // A phone-width frame folds the month to dots and lists the chosen day under it.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setCompact((entry?.contentRect.width ?? 1000) < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Arrow keys in the month move focus with the day; after a save or delete, focus lands on what replaced the old target.
  useEffect(() => {
    if (moved.current) {
      moved.current = false;
      root.current?.querySelector<HTMLElement>(`[data-day="${anchorIso}"]`)?.focus();
    }
  }, [anchorIso]);
  useEffect(() => {
    const sel = refocus.current;
    if (!sel || draft || doomed || shown) return;
    refocus.current = null;
    const el = [...(root.current?.querySelectorAll<HTMLElement>(sel) ?? [])].find((e) => e.offsetParent !== null);
    (el ?? heading.current)?.focus();
  });

  // ── The period on show ──
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = weekOf(monthStart, weekStart);
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const weekCount = Math.ceil(((monthStart.getDay() - weekStart + 7) % 7 + daysInMonth) / 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekOf(anchor, weekStart), i));
  const title =
    view === "month" ? fmt.month.format(anchor) : view === "week" ? fmt.range.formatRange(weekDays[0]!, weekDays[6]!) : fmt.day.format(anchor);
  const unit = view === "month" ? "month" : view === "week" ? "week" : "day";
  const step = (n: number) => setAnchor((a) => (view === "month" ? addMonths(a, n) : addDays(a, view === "week" ? 7 * n : n)));
  const eventsOn = (iso: IsoDate) => events.filter((e) => onDay(e, iso)).sort(order);

  const when = (e: CalendarEvent) => {
    const a = fromIso(e.start)!;
    const b = fromIso(e.end)!;
    const dates = e.start === e.end ? fmt.short.format(a) : fmt.short.formatRange(a, b);
    if (!e.startTime) return e.start === e.end ? `${dates}, all day` : dates;
    return `${dates}, ${showTime(e.startTime, locale)}${e.endTime ? ` to ${showTime(e.endTime, locale)}` : ""}`;
  };
  const evLabel = (e: CalendarEvent) => `${e.title}, ${toneLabels[e.tone] ?? e.tone}, ${when(e)}`;

  const openDay = (d: Date) => {
    setAnchor(d);
    setView("day");
    // The day button that was pressed is gone in the Day view; the heading, which names the day, takes focus.
    requestAnimationFrame(() => heading.current?.focus());
  };
  const add = (day: IsoDate = anchorIso, startTime = "") => {
    setErrors({});
    setDraft({ title: "", tone: TONES[0] ?? "info", start: day, end: day, startTime, endTime: startTime ? `${pad(Math.min(23, Number(startTime.slice(0, 2)) + 1))}:${startTime.slice(3)}` : "" });
  };
  const edit = (e: CalendarEvent) => {
    setErrors({});
    setDraft({ id: e.id, title: e.title, tone: e.tone, start: e.start, end: e.end, startTime: e.startTime ?? "", endTime: e.endTime ?? "" });
  };

  const save = () => {
    if (!draft) return false;
    const next: DraftErrors = {};
    const t = draft.title.trim();
    if (!t) next.title = `Give the ${noun} a title.`;
    if (draft.end < draft.start) next.end = "End on or after the start date.";
    else if (draft.startTime && draft.endTime && draft.start === draft.end && draft.endTime <= draft.startTime) next.end = "End after the start time.";
    setErrors(next);
    if (next.title || next.end) return false;
    const ev: CalendarEvent = {
      id: draft.id ?? `new-${nextId.current++}`,
      title: t,
      tone: draft.tone,
      start: draft.start,
      end: draft.end,
      ...(draft.startTime ? { startTime: draft.startTime, ...(draft.endTime ? { endTime: draft.endTime } : {}) } : {}),
    };
    onChange(draft.id ? events.map((e) => (e.id === draft.id ? ev : e)) : [...events, ev]);
    setSaid(`${ev.title} ${draft.id ? "saved" : "added"}, ${when(ev)}.`);
    // A changed event may have moved to another day: focus its new chip (the dialog's own return lands on the old one).
    if (draft.id) refocus.current = `[data-event="${ev.id}"]`;
  };

  const times = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let h = hours[0]; h <= hours[1]; h++) for (const m of [0, 30]) if (h < hours[1] || m === 0) out.push({ value: `${pad(h)}:${pad(m)}`, label: showTime(`${pad(h)}:${pad(m)}`, locale) });
    return out;
  }, [hours, locale]);

  // ── Month: the grid of days ──
  const monthKey = (e: KeyboardEvent<HTMLTableElement>) => {
    if (!(e.target as HTMLElement).dataset.day) return;
    const map: Record<string, () => Date> = {
      ArrowLeft: () => addDays(anchor, -1),
      ArrowRight: () => addDays(anchor, 1),
      ArrowUp: () => addDays(anchor, -7),
      ArrowDown: () => addDays(anchor, 7),
      PageUp: () => addMonths(anchor, -1),
      PageDown: () => addMonths(anchor, 1),
      Home: () => weekOf(anchor, weekStart),
      End: () => addDays(weekOf(anchor, weekStart), 6),
    };
    const go = map[e.key];
    if (!go) return;
    e.preventDefault();
    moved.current = true;
    setAnchor(go());
  };

  const chip = (e: CalendarEvent, focusable: boolean, iso?: IsoDate) => (
    <button
      type="button"
      className={["fl-acal-ev", TONE[e.tone], iso && e.start !== e.end ? (iso === e.start ? "fl-acal-ev--from" : iso === e.end ? "fl-acal-ev--to" : "fl-acal-ev--mid") : ""].filter(Boolean).join(" ")}
      data-event={e.id}
      tabIndex={focusable ? 0 : -1}
      aria-label={evLabel(e)}
      onClick={(m) => {
        m.stopPropagation();
        setShown(e);
      }}
    >
      {e.startTime && timed(e) ? <span className="fl-acal-ev__time">{showTime(e.startTime, locale)}</span> : null}
      <span className="fl-acal-ev__title">{e.title}</span>
    </button>
  );

  const month = (
    <>
      <table className="fl-acal-month" role="grid" aria-labelledby="fl-acal-period" onKeyDown={monthKey}>
        <thead>
          <tr>
            {weekDays.map((d) => (
              <th key={d.getDay()} scope="col" abbr={fmt.headLong.format(d)}>
                {fmt.head.format(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: weekCount }, (_, w) => (
            <tr key={w}>
              {Array.from({ length: 7 }, (_, i) => {
                const d = addDays(gridStart, w * 7 + i);
                const iso = toIso(d);
                const list = eventsOn(iso);
                const focused = iso === anchorIso;
                const shown = list.slice(0, list.length > 3 ? 2 : 3);
                return (
                  <td
                    key={iso}
                    role="gridcell"
                    aria-selected={compact ? focused : undefined}
                    className={["fl-acal-cell", d.getMonth() !== anchor.getMonth() ? "fl-acal-cell--outside" : "", focused ? "fl-acal-cell--focus" : ""].filter(Boolean).join(" ")}
                    // Pointer shortcut only: the keyboard adds with Add event, which starts on the focused day.
                    onClick={(m: MouseEvent) => m.target === m.currentTarget && add(iso)}
                  >
                    <button
                      type="button"
                      className="fl-acal-daynum"
                      data-day={iso}
                      tabIndex={focused ? 0 : -1}
                      aria-current={iso === today ? "date" : undefined}
                      aria-label={`${fmt.day.format(d)}${iso === today ? ", today" : ""}, ${list.length === 0 ? `no ${noun}s` : list.length === 1 ? `1 ${noun}` : `${list.length} ${noun}s`}`}
                      onClick={() => (compact ? setAnchor(d) : openDay(d))}
                    >
                      {d.getDate()}
                    </button>
                    {compact ? (
                      <span className="fl-acal-dots" aria-hidden="true">
                        {list.slice(0, 4).map((e) => (
                          <span key={e.id} className={`fl-acal-dot ${TONE[e.tone]}`} />
                        ))}
                      </span>
                    ) : list.length ? (
                      <ul className="fl-acal-chips">
                        {shown.map((e) => (
                          <li key={e.id}>{chip(e, focused, iso)}</li>
                        ))}
                        {list.length > shown.length ? (
                          <li>
                            <button type="button" className="fl-acal-more" tabIndex={focused ? 0 : -1} onClick={() => openDay(d)}>
                              {list.length - shown.length} more
                            </button>
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {compact ? (
        <section className="fl-acal-agenda" aria-labelledby="fl-acal-agenda-title">
          <div className="fl-acal-agenda__head">
            <h3 id="fl-acal-agenda-title" className="fl-as-h2">
              {fmt.day.format(anchor)}
            </h3>
            <Button variant="tertiary" size={32} onClick={() => openDay(anchor)}>
              Open day
            </Button>
          </div>
          {eventsOn(anchorIso).length ? (
            <ul className="fl-acal-agenda__list">
              {eventsOn(anchorIso).map((e) => (
                <li key={e.id}>
                  {chip(e, true)}
                  <span className="fl-acal-agenda__when">{when(e)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-acal-empty">Nothing planned.</p>
          )}
        </section>
      ) : null}
    </>
  );

  // ── Week and Day: the hours ──
  const span = hours[1] - hours[0];
  const timeGrid = (days: Date[]) => (
    <div className="fl-acal-scroll">
      <div className={`fl-acal-time${days.length === 1 ? " fl-acal-time--day" : ""}`} style={{ "--_cols": days.length, "--_hours": span } as CSSProperties}>
        <div className="fl-acal-time__corner" aria-hidden="true" />
        {days.map((d) => {
          const iso = toIso(d);
          return days.length === 1 ? (
            <div key={iso} className="fl-acal-time__head" aria-hidden="true" />
          ) : (
            <div key={iso} className="fl-acal-time__head">
              <button type="button" className="fl-acal-colhead" aria-current={iso === today ? "date" : undefined} aria-label={`${fmt.day.format(d)}${iso === today ? ", today" : ""}. Open the day`} onClick={() => openDay(d)}>
                <span>{fmt.head.format(d)}</span>
                <strong>{d.getDate()}</strong>
              </button>
            </div>
          );
        })}
        <div className="fl-acal-time__label fl-acal-time__label--allday">All day</div>
        {days.map((d) => {
          const iso = toIso(d);
          const list = eventsOn(iso).filter((e) => !timed(e));
          return (
            <div key={iso} className="fl-acal-allday" onClick={(m) => m.target === m.currentTarget && add(iso)}>
              {list.length ? (
                <ul className="fl-acal-chips" aria-label={`All day, ${fmt.day.format(d)}`}>
                  {list.map((e) => (
                    <li key={e.id}>{chip(e, true, iso)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
        <div className="fl-acal-gutter" aria-hidden="true">
          {Array.from({ length: span }, (_, i) => (
            <span key={i}>{fmt.hour.format(new Date(2000, 0, 1, hours[0] + i))}</span>
          ))}
        </div>
        {days.map((d) => {
          const iso = toIso(d);
          const laid = lanes(eventsOn(iso).filter(timed));
          return (
            <div
              key={iso}
              className={`fl-acal-track${iso === today ? " fl-acal-track--today" : ""}`}
              // Pointer shortcut only: a click on an empty hour adds an event there; the keyboard uses Add event.
              onClick={(m) => {
                if (m.target !== m.currentTarget) return;
                const box = m.currentTarget.getBoundingClientRect();
                const h = hours[0] + Math.floor(((m.clientY - box.top) / box.height) * span);
                add(iso, `${pad(Math.min(hours[1] - 1, Math.max(hours[0], h)))}:00`);
              }}
            >
              {laid.length ? (
                <ul className="fl-acal-timed" aria-label={`${fmt.day.format(d)}, by time`}>
                  {laid.map(({ ev, from, to, lane, of }) => {
                    const top = Math.max(0, from / 60 - hours[0]);
                    const len = Math.max(0.5, Math.min(span, to / 60 - hours[0]) - top);
                    return (
                      <li key={ev.id} style={{ "--_at": top, "--_len": len, "--_lane": lane, "--_of": of } as CSSProperties}>
                        {chip(ev, true)}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={root} className="fl-acal" data-fl="t.app-calendar">
      <div className="fl-acal-bar">
        <div className="fl-acal-nav">
          <Button variant="secondary" size={40} icon="chevron-left" iconOnly onClick={() => step(-1)}>
            {`Previous ${unit}`}
          </Button>
          <Button variant="secondary" size={40} icon="chevron-right" iconOnly onClick={() => step(1)}>
            {`Next ${unit}`}
          </Button>
          <Button variant="secondary" size={40} aria-label={`Today, ${fmt.day.format(new Date())}`} onClick={() => setAnchor(new Date())}>
            Today
          </Button>
        </div>
        <h2 id="fl-acal-period" ref={heading} tabIndex={-1} className="fl-acal-period" aria-live="polite">
          {title}
        </h2>
        <div className="fl-acal-tools">
          <Segmented
            variant="toggle"
            label="View"
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
            ]}
            value={view}
            onChange={(v) => setView(v as CalendarView)}
          />
          <Button size={40} icon="plus" aria-haspopup="dialog" onClick={() => add()}>
            {`Add ${noun}`}
          </Button>
        </div>
      </div>

      <ul className="fl-acal-key" aria-label="What the colors mean">
        {TONES.map((t) => (
          <li key={t}>
            <span className={`fl-acal-dot ${TONE[t]}`} aria-hidden="true" />
            {toneLabels[t]}
          </li>
        ))}
      </ul>

      {view === "month" ? month : timeGrid(view === "week" ? weekDays : [anchor])}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>

      {shown ? (
        <Modal
          title={shown.title}
          confirmLabel={`Edit this ${noun}`}
          cancelLabel="Close"
          onConfirm={() => {
            const e = shown;
            setShown(null);
            edit(e);
          }}
          onClose={() => setShown(null)}
        >
          <dl className="fl-acal-read">
            <div>
              <dt>Type</dt>
              <dd>
                <Badge variant="status" tone={shown.tone}>
                  {toneLabels[shown.tone] ?? shown.tone}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>{when(shown)}</dd>
            </div>
          </dl>
        </Modal>
      ) : null}

      {draft ? (
        <Modal
          variant="form"
          title={draft.id ? `Edit ${noun}` : `Add ${noun}`}
          description={labels.dialogText}
          confirmLabel={draft.id ? "Save changes" : `Add ${noun}`}
          onConfirm={save}
          onClose={() => (setDraft(null), setErrors({}))}
        >
          <div className="fl-acal-form">
            <div className="fl-acal-field">
              <label htmlFor="fl-acal-title">{`${Noun} title`}</label>
              <TextField
                id="fl-acal-title"
                name="title"
                size={40}
                value={draft.title}
                data-autofocus
                invalid={!!errors.title}
                aria-describedby={errors.title ? "fl-acal-title-error" : undefined}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              {errors.title ? (
                <p id="fl-acal-title-error" className="fl-dlg-error">
                  {errors.title}
                </p>
              ) : null}
            </div>
            <ChoiceGroup
              variant="pill"
              label="Type"
              className="fl-acal-tones"
              options={TONES.map((t) => ({ value: t, label: toneLabels[t] ?? t }))}
              value={draft.tone}
              onChange={(v) => setDraft({ ...draft, tone: v as CalendarTone })}
            />
            <div className="fl-acal-pair">
              <DatePicker label="Start date" value={draft.start} locale={locale} weekStart={weekStart} onChange={(v) => v && setDraft({ ...draft, start: v, end: draft.end < v ? v : draft.end })} />
              <DatePicker label="End date" value={draft.end} locale={locale} weekStart={weekStart} min={draft.start} error={errors.end} onChange={(v) => v && setDraft({ ...draft, end: v })} />
            </div>
            <div className="fl-acal-pair">
              <div className="fl-acal-field">
                <label htmlFor="fl-acal-from">Start time</label>
                <Select id="fl-acal-from" options={[{ value: "", label: "All day" }, ...times]} value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value, endTime: e.target.value ? draft.endTime : "" })} />
              </div>
              <div className="fl-acal-field">
                <label htmlFor="fl-acal-to">End time</label>
                <Select id="fl-acal-to" options={[{ value: "", label: draft.startTime ? "No end time" : "All day" }, ...times]} value={draft.endTime} disabled={!draft.startTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} />
              </div>
            </div>
            {draft.id ? (
              <div>
                <Button
                  variant="tertiary"
                  size={40}
                  icon="trash"
                  className="fl-acal-delete"
                  onClick={() => {
                    const ev = events.find((e) => e.id === draft.id);
                    setDraft(null);
                    if (ev) setDoomed(ev);
                  }}
                >
                  {`Delete ${noun}`}
                </Button>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {doomed ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Delete ${doomed.title}?`}
          description={`${when(doomed)}. This cannot be undone.`}
          confirmLabel={`Delete ${noun}`}
          onConfirm={() => {
            onChange(events.filter((e) => e.id !== doomed.id));
            setSaid(`${doomed.title} deleted.`);
            // Its chip is gone: focus goes to the day it was on (Month) or the period's name.
            refocus.current = view === "month" ? `[data-day="${doomed.start}"]` : "#fl-acal-period";
            if (view === "month") setAnchor(fromIso(doomed.start)!);
          }}
          onClose={() => setDoomed(null)}
        />
      ) : null}
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  product: "Kiln Room",
  nav: ["Calendar", "Classes", "Members", "Kilns"],
  screen: "Studio calendar",
  eyebrow: "Schedule",
  tones: { info: "Class", success: "Open studio", warning: "Firing", danger: "Deadline" } as Partial<Record<CalendarTone, string>>,
  dialogText: "Plan a class, an open studio session, a firing or a deadline.",
  // Days from today, so the calendar always has something on show.
  events: [
    { title: "Wheel throwing for beginners", tone: "info", day: 0, startTime: "10:00", endTime: "12:00" },
    { title: "Open studio", tone: "success", day: 0, startTime: "11:00", endTime: "14:00" },
    { title: "Glaze firing", tone: "warning", day: 1, days: 2 },
    { title: "Hand-building evening", tone: "info", day: 2, startTime: "18:00", endTime: "20:00" },
    { title: "Holiday market application due", tone: "danger", day: 4 },
    { title: "Open studio", tone: "success", day: 5, startTime: "09:00", endTime: "13:00" },
    { title: "Kids' clay club", tone: "info", day: 5, startTime: "14:00", endTime: "15:30" },
    { title: "Bisque firing", tone: "warning", day: 7, startTime: "08:00", endTime: "16:00" },
    { title: "Wheel throwing for beginners", tone: "info", day: 7, startTime: "10:00", endTime: "12:00" },
    { title: "Clay order cutoff", tone: "danger", day: 9 },
    { title: "Members' critique night", tone: "success", day: 11, startTime: "19:00", endTime: "21:00" },
    { title: "Raku workshop", tone: "info", day: 13, days: 1, startTime: "10:00", endTime: "16:00" },
    { title: "Studio deep clean", tone: "danger", day: -3 },
    { title: "Glaze test tiles", tone: "warning", day: -2, startTime: "13:00", endTime: "15:00" },
  ] as Array<{ title: string; tone: CalendarTone; day: number; days?: number; startTime?: string; endTime?: string }>,
};

function sampleEvents(): CalendarEvent[] {
  const now = new Date();
  return SAMPLE.events.map((e, i) => {
    const start = toIso(addDays(now, e.day));
    const end = toIso(addDays(now, e.day + (e.days ?? 0)));
    return { id: `s${i + 1}`, title: e.title, tone: e.tone, start, end, ...(e.startTime ? { startTime: e.startTime, endTime: e.endTime } : {}) };
  });
}

export default function AppCalendar() {
  const d = SAMPLE;
  const [page, setPage] = useState(d.nav[0]);
  const [events, setEvents] = useState(sampleEvents);
  return (
    <div className="fl-as-app fl-as-app--canvas">
      <TopNav variant="app" brand={d.product} links={d.nav.map((n) => ({ label: n }))} current={page} onSelect={setPage} />
      <main className="fl-as-main">
        <div className="fl-as-pagehead">
          <div>
            <p className="fl-eyebrow">{d.eyebrow}</p>
            <h1 className="fl-as-h1">{d.screen}</h1>
          </div>
        </div>
        <section className="fl-as-panel" aria-label={d.screen}>
          <EventCalendar events={events} onChange={setEvents} toneLabels={d.tones} labels={{ dialogText: d.dialogText }} />
        </section>
      </main>
    </div>
  );
}
