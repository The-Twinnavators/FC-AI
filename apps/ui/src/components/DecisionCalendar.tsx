/**
 * The decision log as a month calendar and a day list: days with decisions are marked on the calendar (today selected
 * by default), and the list beside it shows that day's decisions, newest first.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "./ui";
import { navigate } from "../router";

export interface LogEntry {
  id: string;
  at: string;
  chip: string;
  summary: string;
  reason?: string;
  who: string;
  projectId?: string;
  runId?: string;
}

/** What happened, in a word or two: the summary's lead ("Saved for later: …") when it has one, else the chip. */
function statusOf(e: LogEntry): string {
  const lead = /^([^:]{3,32}):\s/.exec(e.summary)?.[1]?.replace(/^Added your own idea.*/, "Added your idea");
  return lead ?? e.chip;
}

/** The selected day at a glance: how many decisions, of what kind, by whom, on which projects, and when. */
function DaySummary({ date, isToday, list, noun, kindLabel }: { date: Date; isToday: boolean; list: LogEntry[]; noun: [string, string]; kindLabel: string }) {
  const count = (keyOf: (e: LogEntry) => string) =>
    [...list.reduce((m, e) => m.set(keyOf(e), (m.get(keyOf(e)) ?? 0) + 1), new Map<string, number>())]
      .filter(([k]) => k)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k} ${n}`)
      .join(" · ");
  const byYou = list.filter((e) => e.who.startsWith("You")).length;
  const byFlowCode = list.filter((e) => e.who.startsWith("FlowCode")).length;
  const projects = count((e) => e.who.replace(/^(You|FlowCode)( · )?/, ""));
  const times = list.map((e) => new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  return (
    <div className="dcal-sum" aria-live="polite">
      <div className="dcal-sum__date">
        <strong>{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</strong>
        <span>{isToday ? "Today" : date.toLocaleDateString(undefined, { year: "numeric" })} · {list.length ? `${list.length} ${list.length === 1 ? noun[0] : noun[1]}` : `No ${noun[1]}`}</span>
      </div>
      {list.length ? (
        <dl>
          <dt>{kindLabel}</dt>
          <dd>{count(statusOf)}</dd>
          {byYou || byFlowCode ? (
            <>
              <dt>Decided by</dt>
              <dd>{[byYou ? `You ${byYou}` : "", byFlowCode ? `FlowCode ${byFlowCode}` : ""].filter(Boolean).join(" · ")}</dd>
            </>
          ) : null}
          {projects ? (
            <>
              <dt>Projects</dt>
              <dd>{projects}</dd>
            </>
          ) : null}
          <dt>Time</dt>
          <dd>{list.length > 1 ? `${times.at(-1)} – ${times[0]}` : times[0]}</dd>
        </dl>
      ) : null}
    </div>
  );
}

const dayKey =(d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** `filter`: shown above the calendar, at its width. */
/**
 * `noun`: what's listed, singular and plural ("decision", "decisions"). `kindLabel`: the summary's first row.
 * `renderItem`: a row of the day list, when the default (time, chip, what, who, Open) isn't right.
 */
export function DecisionCalendar({ entries, emptyHint, filter, noun = ["decision", "decisions"], kindLabel = "Status", renderItem }: { entries: LogEntry[]; emptyHint?: string; filter?: ReactNode; noun?: [string, string]; kindLabel?: string; renderItem?: (e: LogEntry) => ReactNode }) {
  const today = dayKey(new Date());
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const byDay = useMemo(() => {
    const m = new Map<string, LogEntry[]>();
    for (const e of entries) {
      const k = dayKey(new Date(e.at));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    for (const list of m.values()) list.sort((a, b) => b.at.localeCompare(a.at));
    return m;
  }, [entries]);
  const latestDay = useMemo(() => [...byDay.keys()].sort().at(-1), [byDay]);

  // Six weeks starting on the Sunday on or before the 1st.
  const cells = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const pick = (k: string) => {
    setSelected(k);
    const [y, m] = k.split("-").map(Number);
    setMonth(new Date(y!, m! - 1, 1));
  };

  const list = byDay.get(selected) ?? [];
  const selDate = new Date(`${selected}T12:00:00`);
  return (
    <div className="dcal-layout">
      <div className="dcal-side">
      {filter}
      <div className="dcal" aria-label="Pick a day">
        <div className="dcal__head">
          <button type="button" className="dcal__nav dcal__nav--prev" aria-label="Previous month" onClick={() => shift(-1)}>
            <Icon name="chevron" size={16} />
          </button>
          <strong className="dcal__month">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
          <button type="button" className="dcal__nav" aria-label="Next month" onClick={() => shift(1)}>
            <Icon name="chevron" size={16} />
          </button>
        </div>
        <div className="dcal__grid" role="grid">
          {WEEKDAYS.map((w) => (
            <span key={w} className="dcal__wd" role="columnheader">
              {w}
            </span>
          ))}
          {cells.map((d) => {
            const k = dayKey(d);
            const n = byDay.get(k)?.length ?? 0;
            const cls = ["dcal__day", d.getMonth() !== month.getMonth() && "is-other", k === today && "is-today", k === selected && "is-selected", n && "has-items"].filter(Boolean).join(" ");
            return (
              <button
                key={k}
                type="button"
                className={cls}
                aria-pressed={k === selected}
                aria-current={k === today ? "date" : undefined}
                aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${n ? `${n} ${n === 1 ? noun[0] : noun[1]}` : `no ${noun[1]}`}`}
                onClick={() => pick(k)}
              >
                {d.getDate()}
                {n ? <span className="dcal__dot" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <DaySummary date={selDate} isToday={selected === today} list={list} noun={noun} kindLabel={kindLabel} />
        <div className="dcal__foot">
          <button type="button" className="btn btn--sm" disabled={selected === today} onClick={() => pick(today)}>
            Today
          </button>
          <span className="muted">
            <span className="dcal__dot dcal__dot--key" aria-hidden="true" /> Days with {noun[1]}
          </span>
        </div>
      </div>

      </div>
      <section className="dcal-day" aria-live="polite">
        <h2 className="dcal-day__title">
          {selected === today ? "Today" : selDate.toLocaleDateString(undefined, { weekday: "long" })}
          <span className="muted">
            {" "}
            · {selDate.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · {list.length} {list.length === 1 ? noun[0] : noun[1]}
          </span>
        </h2>
        {list.length ? (
          <ol className="apv-log__list">
            {list.map((d) => renderItem ? <li key={d.id} className="apv-log__item">{renderItem(d)}</li> : (
              <li key={d.id} className="apv-log__item">
                <span className="apv-log__when">{new Date(d.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="chip">{d.chip}</span>
                <span className="apv-log__what">
                  {d.summary}
                  {d.reason ? <span className="muted"> — {d.reason}</span> : null}
                </span>
                <span className="muted apv-log__who">{d.who}</span>
                {d.runId && d.projectId ? (
                  <button type="button" className="btn btn--sm" onClick={() => navigate(`/projects/${d.projectId}/runs/${d.runId}`)}>
                    Open
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="apv-empty dcal-day__empty">
            <p>No {noun[1]} on this day{emptyHint ?? ""}.</p>
            {latestDay && latestDay !== selected ? (
              <button type="button" className="btn btn--sm" onClick={() => pick(latestDay)}>
                Go to the latest: {new Date(`${latestDay}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
