/** @flowcode-library upcoming-schedule · Upcoming schedule (Charts and data)
 * Catalog ID: p.upcoming-schedule (pattern)
 * Function: The upcoming schedule pattern (p.upcoming-schedule): a dashboard card of upcoming appointments or events, soonest first, each with day and time, title, detail and a status badge, a box to mark it done and a Hide done toggle.
 * Use it as: import { UpcomingSchedule } from "./upcoming-schedule"; <UpcomingSchedule title items={[{ id, at: "2026-10-22T09:20", title, detail?, status, done? }]} statuses={{ confirmed: { label: "Confirmed", tone: "success" } }} doneLabel? hideDoneLabel? leftLabel?="{n} left" emptyText? locale? onToggle?={(id, done) => ...} />
 * Built from: c.card.surface, c.checkbox, c.badge.status, c.button.tertiary
 * Look: A card titled with a count left and a Hide done toggle, then rows soonest first: a done box, the day over the time, the title with a muted line of detail, and a status pill at the right; done rows are struck through.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text-muted --space-1 --space-3 --space-4 --space-5 --radius-md --text-xs --text-sm --duration-fast
 * Use cases: upcoming appointments; today's agenda; dashboard schedule; class schedule; staff schedule; event list; bookings today; upcoming meetings
 * Jobs to be done: see what is coming up next; check the status of my appointments; tick off what is done; plan my day
 * Keywords: schedule, upcoming, agenda, appointments, events, dashboard, status, checklist
 */
/**
 * Upcoming schedule: a dashboard card listing what is coming up next, soonest first. Each row shows the day and time,
 * the title with a line of detail, and its status as a badge; the box at the start of a row marks it done (it is struck
 * through and its status reads Done), and Hide done takes finished ones off the list. A count says how many are left
 * and a status line announces each change. Use it on a dashboard, a staff home screen or a client's portal. Make it
 * the app's own: replace SAMPLE with the app's real appointments or events and their statuses, and save the done state
 * through onToggle.
 * Built from c.card.surface, c.checkbox, c.badge.status and c.button.tertiary.
 * Adapted from TailAdmin (MIT License, Copyright (c) 2023 TailAdmin), its Upcoming Schedule card.
 */
import { useId, useMemo, useState } from "react";
import { Badge, type BadgeTone } from "./badges-status";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Checkbox } from "./checkboxes-radios";

// ── p.upcoming-schedule: what is next, soonest first, with a status and a done box. ──

export type ScheduleItem = {
  id: string;
  /** When it starts, as an ISO date and time: "2026-10-22T09:20". */
  at: string;
  title: string;
  /** A line under the title: who, where, or "+3 more". */
  detail?: string;
  /** A key into `statuses`. */
  status: string;
  /** Already done when the card opens. */
  done?: boolean;
};

export type UpcomingScheduleProps = {
  title: string;
  items: ScheduleItem[];
  /** Each status key's words and badge tone: { confirmed: { label: "Confirmed", tone: "success" } }. */
  statuses: Record<string, { label: string; tone: BadgeTone }>;
  /** The badge on a row that is marked done. */
  doneLabel?: string;
  /** The toggle that hides finished rows. */
  hideDoneLabel?: string;
  /** "{n} left" or similar; {n} is replaced with how many are not done. */
  leftLabel?: string;
  /** Shown when nothing is left to show. */
  emptyText?: string;
  /** Date and time formatting, such as "en-US". */
  locale?: string;
  /** Called when a row is marked done or not done. */
  onToggle?: (id: string, done: boolean) => void;
};

export function UpcomingSchedule({ title, items, statuses, doneLabel = "Done", hideDoneLabel = "Hide done", leftLabel = "{n} left", emptyText = "Nothing coming up.", locale = "en-US", onToggle }: UpcomingScheduleProps) {
  const id = useId();
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.id, !!i.done])));
  const [hideDone, setHideDone] = useState(false);
  const [said, setSaid] = useState("");

  const sorted = useMemo(() => [...items].sort((a, b) => a.at.localeCompare(b.at)), [items]);
  const shown = sorted.filter((i) => !(hideDone && done[i.id]));
  const left = sorted.filter((i) => !done[i.id]).length;
  const day = (at: string) => new Date(at).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
  const time = (at: string) => new Date(at).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  const toggle = (item: ScheduleItem) => {
    const next = !done[item.id];
    setDone((d) => ({ ...d, [item.id]: next }));
    setSaid(`${item.title} ${next ? "marked done" : "marked not done"}.`);
    onToggle?.(item.id, next);
  };

  return (
    <div data-fl="p.upcoming-schedule" style={{ display: "grid" }}>
      <Card variant="surface" className="fl-sch" role="group" aria-labelledby={`${id}-title`}>
        <div className="fl-sch-head">
          <div className="fl-sch-heading">
            <h3 id={`${id}-title`}>{title}</h3>
            <span className="fl-sch-count">{leftLabel.replace("{n}", String(left))}</span>
          </div>
          <Button variant="tertiary" size={32} pressed={hideDone} onClick={() => setHideDone(!hideDone)}>
            {hideDoneLabel}
          </Button>
        </div>

        {shown.length === 0 ? (
          <p className="fl-sch-empty">{emptyText}</p>
        ) : (
          <ul className="fl-sch-list">
            {shown.map((item) => {
              const isDone = !!done[item.id];
              const status = isDone ? { label: doneLabel, tone: "success" as BadgeTone } : statuses[item.status] ?? { label: item.status, tone: "neutral" as BadgeTone };
              return (
                <li key={item.id} className={isDone ? "fl-sch-row is-done" : "fl-sch-row"}>
                  <Checkbox checked={isDone} onChange={() => toggle(item)} aria-label={`${item.title}, ${day(item.at)} ${time(item.at)}: done`} />
                  <time className="fl-sch-when" dateTime={item.at}>
                    <span>{day(item.at)}</span>
                    <strong>{time(item.at)}</strong>
                  </time>
                  <span className="fl-sch-what">
                    <strong>{item.title}</strong>
                    {item.detail ? <span>{item.detail}</span> : null}
                  </span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
        <p className="fl-sr" role="status" aria-live="polite">
          {said}
        </p>
      </Card>
    </div>
  );
}

// flowcode:sample
const SAMPLE = {
  title: "Upcoming schedule",
  statuses: {
    confirmed: { label: "Confirmed", tone: "success" as BadgeTone },
    pending: { label: "Waiting", tone: "warning" as BadgeTone },
    moved: { label: "Moved", tone: "info" as BadgeTone },
  },
  items: [
    { id: "s1", at: "2026-10-22T09:20", title: "Wheel throwing for beginners", detail: "Studio A · 8 students", status: "confirmed" },
    { id: "s2", at: "2026-10-22T13:30", title: "Glaze test review", detail: "With Tom Reyes", status: "pending" },
    { id: "s3", at: "2026-10-23T10:35", title: "Kiln firing", detail: "Bisque load · 42 pieces", status: "confirmed" },
    { id: "s4", at: "2026-10-24T18:00", title: "Hand-building evening", detail: "Studio B · 12 students +2 waiting", status: "moved" },
    { id: "s5", at: "2026-10-21T08:00", title: "Clay delivery", detail: "Twenty bags of stoneware", status: "confirmed", done: true },
  ],
  doneLabel: "Done",
  hideDoneLabel: "Hide done",
  leftLabel: "{n} to go",
  emptyText: "All done for now. New bookings show up here.",
};

export default function UpcomingScheduleSheet() {
  return (
    <section className="fl-section" aria-label={SAMPLE.title}>
      <div className="fl-wrap fl-wrap--narrow">
        <UpcomingSchedule {...SAMPLE} />
      </div>
    </section>
  );
}
