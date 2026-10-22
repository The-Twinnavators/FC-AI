/** @flowcode-library shift-schedule · Shift schedule (Tables and lists)
 * Catalog ID: b.shift-schedule (block)
 * Function: A week's shift plan (b.shift-schedule): people down the side, days across, a shift in each cell; assign by dragging a shift from the palette (or a cell to move it), by the arrow keys and a letter, or from a menu; conflicts flagged in the cell and counted (time off, too little rest between shifts, more shifts than a person's limit) and gaps in each day's cover shown under the grid; Undo, Clear week after a confirm, week paging, and Publish with a confirm that names the conflicts, a working state and a Published or Changed status.
 * Use it as: import { ShiftSchedule } from "./shift-schedule"; <ShiftSchedule title shifts={[{ id: "m", label: "Morning", key: "M", start: "06:00", end: "14:00", need: 2 }]} team={[{ id, name, role, maxShifts: 5, off?: ["2026-10-22"] }]} assignments={{ "personId|2026-10-20": "m" }} publishedWeeks?={{ "2026-10-19": { ... } }} minRestHours?={10} onPublish?={async (weekStart, assignments) => void} />
 * Built from: c.button.primary, c.button.secondary, c.button.tertiary, c.badge.status, c.avatar.person, c.modal.confirm, c.modal.danger
 * Look: A white card: the title and week (with back, this week and next), a status pill and Undo, Clear and Publish; a row of shift chips to drag (each a soft tone with its letter and hours); then the grid: a sticky first column of people (initials, name, role, "4/5" shifts) and seven day columns, today's header marked by a straight accent bar; filled cells hold a tinted chip, empty ones a faint plus; a conflict draws a straight danger bar down the cell's left side and a small alert. The last row counts cover per day, short days in danger tone. A summary line counts conflicts and gaps.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-text --color-text-muted --color-accent --color-on-accent --color-success --color-warning --color-danger --color-info --color-secondary --surface-bg --surface-radius --surface-shadow-overlay --pill-radius --space-1 --space-2 --space-3 --space-4 --space-5 --radius-sm --radius-md --text-xs --text-sm --text-md --text-lg --font-display --weight-medium --weight-semibold --focus-ring --duration-instant --duration-fast --duration-base --duration-slow --ease-out --ease-spring --easing --enter-distance --stagger
 * Use cases: shift planner; rota; staff scheduling; roster; warehouse shifts; restaurant schedule; retail staffing; on-call schedule; nurse schedule
 * Jobs to be done: plan who works which shift this week; see at a glance where the week is short-handed; avoid scheduling someone who is off or has too little rest; move a shift from one person to another; publish the week so the team sees it
 * Keywords: shift, schedule, rota, roster, staffing, week, grid, drag and drop, coverage, conflict, publish, workforce
 */
/**
 * Shift schedule: a manager's week. Shifts are kept by person and day, so paging weeks keeps everything. A cell takes
 * one shift. Drag a chip from the palette onto a cell to assign it, or drag a cell's chip to another cell to move it.
 * The grid is one tab stop: arrows move between cells (Home and End along a row, Ctrl with them to the corners); a
 * shift's letter assigns it, Delete clears, Enter opens a menu of shifts, Ctrl+Z undoes. Conflicts: a shift on a day
 * off, less rest than minRestHours since the shift before (overnight shifts count to the next morning), and more
 * shifts than a person's limit. The cover row counts each shift per day against its need. Publish asks first, naming
 * any conflicts. Every change is read out.
 * Make it the app's own: replace SAMPLE with the team and the saved plan, load time off from the leave system, and
 * make onPublish save the week and tell the team.
 * Adapted from TailAdmin free edition (MIT License, Copyright (c) 2023 TailAdmin): its calendar page's week grid.
 */
/**
 * How to try it
 * - Drag the Night chip onto an empty cell. Drag a filled cell onto another empty one: it moves.
 * - Tab into the grid, move with the arrows, press M, E or N to assign and Delete to clear. Press Enter for the menu.
 * - Give Priya a Morning the day after her Night: the cell is flagged "less than 10 h rest". Give Sam a shift on his day off.
 * - Press Undo. Press Publish: it lists the conflicts and asks first. Change a cell after: the status turns to Changed.
 * - Page to next week and back; press Clear week (it asks first).
 *
 * Dependencies: React (useEffect, useId, useLayoutEffect, useMemo, useRef, useState), the library's Button
 * ("./buttons-variants"), Badge ("./badges-status"), Avatar ("./avatars-variants"), Modal ("./modals-dialogs") and its
 * inline icon set ("./icons"). Native drag and drop; no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css/r5c-shift-schedule.css.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Avatar } from "./avatars-variants";
import { Badge } from "./badges-status";
import { Button } from "./buttons-variants";
import { Icon } from "./icons";
import { Modal } from "./modals-dialogs";

// ── b.shift-schedule: a people-by-days grid with drag, keyboard, conflicts, cover and publish. ──

export type ShiftKind = { id: string; label: string; /** one letter that assigns it from the keyboard */ key: string; /** "HH:MM", 24-hour */ start: string; end: string; /** people needed each day */ need: number };
export type ShiftPerson = { id: string; name: string; role: string; maxShifts: number; /** days off, "YYYY-MM-DD" */ off?: string[] };
/** "personId|YYYY-MM-DD" → shift id */
export type ShiftPlan = Record<string, string>;
export type ShiftScheduleProps = {
  title?: string;
  shifts: ShiftKind[];
  team: ShiftPerson[];
  assignments: ShiftPlan;
  /** The plan as last published, by the week's Monday. */
  publishedWeeks?: Record<string, ShiftPlan>;
  minRestHours?: number;
  locale?: string;
  onPublish?: (weekStart: string, week: ShiftPlan) => Promise<void>;
  onChange?: (plan: ShiftPlan) => void;
};

const quick = async () => undefined;
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const addDays = (s: string, n: number) => {
  const d = fromIso(s);
  d.setDate(d.getDate() + n);
  return isoOf(d);
};
const mondayOf = (s: string) => addDays(s, -((fromIso(s).getDay() + 6) % 7));
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const dayNo = (s: string) => Math.round(fromIso(s).getTime() / 86400000);
const weekOf = (plan: ShiftPlan, monday: string) => {
  const days = new Set(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  return Object.fromEntries(Object.entries(plan).filter(([k]) => days.has(k.split("|")[1]!)));
};
const same = (a: ShiftPlan, b: ShiftPlan) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

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

type Conflict = { kind: "off" | "rest" | "max"; text: string };

export function ShiftSchedule({ title = "Shift schedule", shifts, team, assignments, publishedWeeks = {}, minRestHours = 10, locale = "en-US", onPublish = quick, onChange }: ShiftScheduleProps) {
  const uid = useId();
  const focusLater = useFocusLater();
  const today = isoOf(new Date());
  const [plan, setPlan] = useState<ShiftPlan>(assignments);
  const [history, setHistory] = useState<ShiftPlan[]>([]);
  const [monday, setMonday] = useState(mondayOf(today));
  const [published, setPublished] = useState(publishedWeeks);
  const [at, setAt] = useState({ r: 0, c: 0 });
  const [menu, setMenu] = useState<{ r: number; c: number; x: number; y: number } | null>(null);
  const [said, setSaid] = useState("");
  const [confirm, setConfirm] = useState<"publish" | "clear" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pubError, setPubError] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const grid = useRef<HTMLTableElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const byId = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);
  const fmtHead = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const fmtLong = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }), [locale]);
  const fmtShort = useMemo(() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }), [locale]);
  const fmtTime = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }), [locale]);
  const hours = (s: ShiftKind) => `${fmtTime.format(new Date(2026, 0, 1, Number(s.start.slice(0, 2)), Number(s.start.slice(3))))}–${fmtTime.format(new Date(2026, 0, 1, Number(s.end.slice(0, 2)), Number(s.end.slice(3))))}`;
  const short = (s: ShiftKind) => `${Number(s.start.slice(0, 2)) % 12 || 12}–${Number(s.end.slice(0, 2)) % 12 || 12}`;
  const firstName = (p: ShiftPerson) => p.name.split(" ")[0];

  /** Conflicts per cell, plus each person's count against their limit. */
  const { conflicts, counts } = useMemo(() => {
    const out = new Map<string, Conflict[]>();
    const counts = new Map<string, number>();
    const add = (k: string, c: Conflict) => out.set(k, [...(out.get(k) ?? []), c]);
    for (const p of team) {
      let n = 0;
      for (const d of days) {
        const k = `${p.id}|${d}`;
        const s = byId.get(plan[k] ?? "");
        if (!s) continue;
        n++;
        if (p.off?.includes(d)) add(k, { kind: "off", text: `${firstName(p)} is off that day` });
        const prev = byId.get(plan[`${p.id}|${addDays(d, -1)}`] ?? "");
        if (prev) {
          const prevEnd = (dayNo(d) - 1) * 1440 + mins(prev.end) + (mins(prev.end) <= mins(prev.start) ? 1440 : 0);
          const rest = (dayNo(d) * 1440 + mins(s.start) - prevEnd) / 60;
          if (rest < minRestHours) add(k, { kind: "rest", text: `Only ${Math.max(0, rest)} h rest after ${prev.label}` });
        }
        if (n > p.maxShifts) add(k, { kind: "max", text: `Shift ${n} of ${p.maxShifts} allowed` });
      }
      counts.set(p.id, n);
    }
    return { conflicts: out, counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, days, team, byId, minRestHours]);

  const cover = days.map((d) => shifts.map((s) => ({ s, n: team.filter((p) => plan[`${p.id}|${d}`] === s.id).length })));
  const gaps = cover.reduce((n, day) => n + day.filter((x) => x.n < x.s.need).length, 0);
  const conflictCount = [...conflicts.values()].reduce((n, l) => n + l.length, 0);
  const week = weekOf(plan, monday);
  const pub = published[monday];
  const status: "published" | "changed" | "draft" = pub ? (same(pub, week) ? "published" : "changed") : "draft";

  const commit = (next: ShiftPlan, words: string, key?: string) => {
    setHistory((h) => [...h.slice(-29), plan]);
    setPlan(next);
    onChange?.(next);
    setSaid(words);
    setPubError("");
    if (key) setFlash(key);
  };
  const describe = (p: ShiftPerson, d: string, s?: ShiftKind) => `${firstName(p)}, ${fmtLong.format(fromIso(d))}: ${s ? `${s.label} ${hours(s)}` : "no shift"}`;
  const assign = (r: number, c: number, shiftId: string | null) => {
    const p = team[r];
    const d = days[c];
    if (!p || !d) return;
    const k = `${p.id}|${d}`;
    if ((plan[k] ?? null) === shiftId) return;
    const next = { ...plan };
    if (shiftId) next[k] = shiftId;
    else delete next[k];
    commit(next, `${describe(p, d, shiftId ? byId.get(shiftId) : undefined)}.`, k);
  };
  const move = (from: string, r: number, c: number) => {
    const p = team[r];
    const d = days[c];
    const s = plan[from];
    if (!p || !d || !s) return;
    const to = `${p.id}|${d}`;
    if (to === from) return;
    const next = { ...plan };
    delete next[from];
    next[to] = s;
    const [fp, fd] = from.split("|");
    const fromP = team.find((x) => x.id === fp);
    commit(next, `Moved ${byId.get(s)?.label ?? "shift"} from ${fromP ? firstName(fromP) : ""} ${fmtShort.format(fromIso(fd!))} to ${firstName(p)} ${fmtShort.format(fromIso(d))}.`, to);
  };
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setPlan(last);
    onChange?.(last);
    setSaid("Undone.");
  };

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 700);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Keep the roving cell inside the grid when the team changes.
  const r0 = Math.min(at.r, team.length - 1);
  const focusCell = (r: number, c: number) => {
    setAt({ r, c });
    focusLater(() => grid.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`));
  };

  const openMenu = (r: number, c: number) => {
    const cell = grid.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`);
    if (!cell) return;
    const box = cell.getBoundingClientRect();
    const width = 224;
    setMenu({ r, c, x: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)), y: Math.min(box.bottom + 4, window.innerHeight - 260) });
  };
  useLayoutEffect(() => {
    if (!menu) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]");
    const current = plan[`${team[menu.r]?.id}|${days[menu.c]}`];
    const idx = current ? shifts.findIndex((s) => s.id === current) : shifts.length;
    items?.[Math.max(0, idx)]?.focus();
    const close = () => setMenu(null);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu]);
  const closeMenu = () => {
    if (!menu) return;
    const { r, c } = menu;
    setMenu(null);
    focusCell(r, c);
  };

  const onGridKey = (e: KeyboardEvent<HTMLTableElement>) => {
    const t = e.target as HTMLElement;
    if (!t.dataset.cell) return;
    const [r, c] = t.dataset.cell.split("-").map(Number) as [number, number];
    const rows = team.length;
    const go = (nr: number, nc: number) => {
      e.preventDefault();
      focusCell(Math.max(0, Math.min(rows - 1, nr)), Math.max(0, Math.min(6, nc)));
    };
    if (e.key === "ArrowRight") return go(r, c + 1);
    if (e.key === "ArrowLeft") return go(r, c - 1);
    if (e.key === "ArrowDown") return go(r + 1, c);
    if (e.key === "ArrowUp") return go(r - 1, c);
    if (e.key === "Home") return go(e.ctrlKey ? 0 : r, 0);
    if (e.key === "End") return go(e.ctrlKey ? rows - 1 : r, 6);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (e.key === "Enter" || e.key === " " || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      openMenu(r, c);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      assign(r, c, null);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = shifts.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
    if (s) {
      e.preventDefault();
      assign(r, c, s.id);
    }
  };

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitemradio]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      closeMenu();
    } else {
      const s = shifts.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
      if (s && menu) {
        e.preventDefault();
        assign(menu.r, menu.c, s.id);
        closeMenu();
      }
    }
  };

  const onDrop = (e: DragEvent<HTMLElement>, r: number, c: number) => {
    e.preventDefault();
    setDragOver(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (raw.startsWith("new:")) assign(r, c, raw.slice(4));
    else if (raw.startsWith("move:")) move(raw.slice(5), r, c);
    focusCell(r, c);
  };

  const doPublish = async () => {
    setBusy(true);
    setPubError("");
    try {
      await onPublish(monday, week);
      setPublished((p) => ({ ...p, [monday]: week }));
      focusCell(r0, at.c);
      setSaid(`Week of ${fmtShort.format(fromIso(monday))} published. The team can see it.`);
      setConfirm(null);
    } catch {
      setPubError("Couldn't publish. Try again.");
      setSaid("Couldn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const doClear = () => {
    const next = Object.fromEntries(Object.entries(plan).filter(([k]) => !days.includes(k.split("|")[1]!)));
    commit(next, `Cleared the week of ${fmtShort.format(fromIso(monday))}. Undo puts it back.`);
    setConfirm(null);
    focusLater(() => document.getElementById(`${uid}-undo`));
  };

  const conflictList = team.flatMap((p) => days.flatMap((d) => (conflicts.get(`${p.id}|${d}`) ?? []).map((c) => `${firstName(p)}, ${fmtShort.format(fromIso(d))}: ${c.text}`)));
  const weekLabel = `${fmtShort.format(fromIso(days[0]!))} – ${fmtShort.format(fromIso(days[6]!))}`;

  return (
    <div className="fl-rota" data-fl="b.shift-schedule">
      <header className="fl-rota-head">
        <div className="fl-rota-titles">
          <h3 className="fl-rota-title" id={`${uid}-title`}>
            {title}
          </h3>
          <div className="fl-rota-week" role="group" aria-label="Week">
            <Button variant="tertiary" size={32} icon="chevron-left" iconOnly onClick={() => setMonday(addDays(monday, -7))}>
              Previous week
            </Button>
            <strong aria-live="polite">{weekLabel}</strong>
            <Button variant="tertiary" size={32} icon="chevron-right" iconOnly onClick={() => setMonday(addDays(monday, 7))}>
              Next week
            </Button>
            {monday !== mondayOf(today) ? (
              <button type="button" className="fl-rota-link" onClick={() => setMonday(mondayOf(today))}>
                This week
              </button>
            ) : null}
          </div>
        </div>
        <div className="fl-rota-actions">
          <Badge tone={status === "published" ? "success" : status === "changed" ? "warning" : "neutral"} led>
            {status === "published" ? "Published" : status === "changed" ? "Changed since publish" : "Draft"}
          </Badge>
          <Button id={`${uid}-undo`} variant="tertiary" size={40} icon="refresh" aria-disabled={!history.length || undefined} onClick={undo}>
            Undo
          </Button>
          <Button variant="secondary" size={40} icon="trash" disabled={!Object.keys(week).length} onClick={() => setConfirm("clear")}>
            Clear week
          </Button>
          <Button variant="primary" size={40} icon="send" disabled={status === "published"} onClick={() => setConfirm("publish")}>
            Publish
          </Button>
        </div>
      </header>

      <div className="fl-rota-bar">
        <ul className="fl-rota-palette" aria-label="Shifts: drag onto a cell, or press the letter in the grid">
          {shifts.map((s, i) => (
            <li
              key={s.id}
              className={`fl-rota-chip fl-rota-t${i % 4}`}
              draggable
              title={`Drag onto a cell, or press ${s.key} in the grid`}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `new:${s.id}`);
                e.dataTransfer.effectAllowed = "copy";
              }}
            >
              <kbd>{s.key}</kbd>
              <span>{s.label}</span>
              <small>{hours(s)}</small>
            </li>
          ))}
        </ul>
        <p className={`fl-rota-sum${conflictCount || gaps ? " is-warn" : ""}`}>
          <Icon name={conflictCount || gaps ? "alert" : "check"} />
          {conflictCount || gaps ? `${conflictCount} ${conflictCount === 1 ? "conflict" : "conflicts"} · ${gaps} ${gaps === 1 ? "gap" : "gaps"} in cover` : "No conflicts, full cover"}
        </p>
      </div>

      {team.length === 0 ? (
        <div className="fl-rota-empty" data-fl="c.empty-state">
          <Icon name="users" />
          <strong>No one on the team yet</strong>
          <p>Add people to start planning shifts.</p>
        </div>
      ) : (
        <div className="fl-rota-scroll">
          <table className="fl-rota-grid" role="grid" ref={grid} aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-help`} onKeyDown={onGridKey}>
            <thead>
              <tr>
                <th scope="col" className="fl-rota-corner">
                  Team
                </th>
                {days.map((d) => (
                  <th key={d} scope="col" className={d === today ? "is-today" : undefined} aria-label={fmtLong.format(fromIso(d))}>
                    <span>{fmtHead.format(fromIso(d))}</span>
                    <strong>{fromIso(d).getDate()}</strong>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((p, r) => {
                const n = counts.get(p.id) ?? 0;
                return (
                  <tr key={p.id} style={{ ["--fl-rota-i" as string]: Math.min(r, 8) }}>
                    <th scope="row" className="fl-rota-who">
                      <div className="fl-rota-whobox">
                      <Avatar name={p.name} size={32} tone={(["a", "b", "c", "d", "e"] as const)[r % 5]} decorative />
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.role} · <b className={n > p.maxShifts ? "is-over" : undefined}>{n}/{p.maxShifts}</b>
                        </small>
                      </span>
                      </div>
                    </th>
                    {days.map((d, c) => {
                      const k = `${p.id}|${d}`;
                      const s = byId.get(plan[k] ?? "");
                      const cf = conflicts.get(k) ?? [];
                      const off = p.off?.includes(d);
                      const si = s ? shifts.indexOf(s) : -1;
                      const label = `${describe(p, d, s)}${off ? ", day off" : ""}${cf.length ? `. ${cf.map((x) => x.text).join(". ")}` : ""}`;
                      return (
                        <td
                          key={d}
                          role="gridcell"
                          data-cell={`${r}-${c}`}
                          tabIndex={r0 === r && at.c === c ? 0 : -1}
                          aria-label={label}
                          aria-haspopup="menu"
                          className={["fl-rota-cell", off ? "is-off" : "", cf.length ? "is-conflict" : "", dragOver === k ? "is-over" : "", flash === k ? "is-flash" : "", d === today ? "is-today" : ""].filter(Boolean).join(" ")}
                          onFocus={() => setAt({ r, c })}
                          onClick={() => {
                            focusCell(r, c);
                            openMenu(r, c);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (dragOver !== k) setDragOver(k);
                          }}
                          onDragLeave={() => setDragOver((x) => (x === k ? null : x))}
                          onDrop={(e) => onDrop(e, r, c)}
                        >
                          {s ? (
                            <span
                              className={`fl-rota-pill fl-rota-t${si % 4}`}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation();
                                e.dataTransfer.setData("text/plain", `move:${k}`);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                            >
                              <strong className="fl-rota-long">{s.label}</strong>
                              <strong className="fl-rota-short">{s.key}</strong>
                              <small>{short(s)}</small>
                            </span>
                          ) : (
                            <span className="fl-rota-free" aria-hidden="true">
                              {off ? "Off" : "+"}
                            </span>
                          )}
                          {cf.length ? (
                            <span className="fl-rota-flag" aria-hidden="true" title={cf.map((x) => x.text).join("\n")}>
                              <Icon name="alert" />
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="fl-rota-who fl-rota-coverhead">
                  Cover
                </th>
                {cover.map((day, c) => (
                  <td key={days[c]} className="fl-rota-cover">
                    {day.map(({ s, n }) => (
                      <span key={s.id} className={n < s.need ? "is-short" : undefined} title={`${s.label}: ${n} of ${s.need}`}>
                        {s.key} {n}/{s.need}
                        <span className="fl-sr"> {s.label}{n < s.need ? ", short" : ""}</span>
                      </span>
                    ))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="fl-rota-help" id={`${uid}-help`}>
        Arrows move · {shifts.map((s) => s.key).join(" ")} assign · Delete clears · Enter for the menu
      </p>

      {menu ? (
        <>
          <div className="fl-rota-scrim" onMouseDown={closeMenu} />
          <div className="fl-rota-menu" role="menu" aria-label={`Shift for ${describe(team[menu.r]!, days[menu.c]!)}`} ref={menuRef} style={{ left: menu.x, top: menu.y }} onKeyDown={onMenuKey}>
            {[...shifts, null].map((s, i) => {
              const current = (plan[`${team[menu.r]!.id}|${days[menu.c]}`] ?? null) === (s?.id ?? null);
              return (
                <button
                  key={s?.id ?? "none"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  tabIndex={-1}
                  className={s ? `fl-rota-t${i % 4}` : "is-none"}
                  onClick={() => {
                    assign(menu.r, menu.c, s?.id ?? null);
                    closeMenu();
                  }}
                >
                  <kbd aria-hidden="true">{s ? s.key : "Del"}</kbd>
                  <span>{s ? s.label : "No shift"}</span>
                  {s ? <small>{hours(s)}</small> : null}
                  {current ? <Icon name="check" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {confirm === "publish" ? (
        <Modal
          variant="confirm"
          title={conflictCount ? `Publish with ${conflictCount} ${conflictCount === 1 ? "conflict" : "conflicts"}?` : `Publish ${weekLabel}?`}
          description={`The team sees their shifts for ${weekLabel}${gaps ? `, with ${gaps} ${gaps === 1 ? "gap" : "gaps"} in cover` : ""}.`}
          confirmLabel={pubError ? "Try again" : "Publish"}
          busy={busy}
          busyLabel="Publishing…"
          onConfirm={() => {
            void doPublish();
            return false;
          }}
          onClose={() => {
            setConfirm(null);
            setPubError("");
          }}
        >
          {conflictList.length ? (
            <ul className="fl-rota-clist">
              {conflictList.slice(0, 6).map((t) => (
                <li key={t}>
                  <Icon name="alert" />
                  {t}
                </li>
              ))}
              {conflictList.length > 6 ? <li>and {conflictList.length - 6} more</li> : null}
            </ul>
          ) : null}
          {pubError ? (
            <p className="fl-rota-err" role="alert">
              <Icon name="alert" />
              {pubError}
            </p>
          ) : null}
        </Modal>
      ) : null}

      {confirm === "clear" ? (
        <Modal
          variant="danger"
          icon="trash"
          title={`Clear ${weekLabel}?`}
          description={`All ${Object.keys(week).length} shifts this week come off the plan. Undo puts them back.`}
          confirmLabel="Clear week"
          cancelLabel="Keep"
          onConfirm={() => {
            doClear();
            return false;
          }}
          onClose={() => setConfirm(null)}
        />
      ) : null}

      <p className="fl-sr" role="status" aria-live="polite">
        {said}
      </p>
    </div>
  );
}

const thisMonday = mondayOf(isoOf(new Date()));
const day = (i: number) => addDays(thisMonday, i);

// flowcode:sample
const SAMPLE: ShiftScheduleProps = {
  title: "Warehouse shifts",
  minRestHours: 10,
  shifts: [
    { id: "m", label: "Morning", key: "M", start: "06:00", end: "14:00", need: 2 },
    { id: "e", label: "Evening", key: "E", start: "14:00", end: "22:00", need: 2 },
    { id: "n", label: "Night", key: "N", start: "22:00", end: "06:00", need: 1 },
  ],
  team: [
    { id: "priya", name: "Priya Shah", role: "Lead", maxShifts: 5 },
    { id: "sam", name: "Sam Ortiz", role: "Picker", maxShifts: 5, off: [day(2), day(3)] },
    { id: "mei", name: "Mei Chen", role: "Dispatcher", maxShifts: 4 },
    { id: "tomas", name: "Tomás Reyes", role: "Driver", maxShifts: 5 },
    { id: "ana", name: "Ana Ruiz", role: "Picker", maxShifts: 3 },
    { id: "kofi", name: "Kofi Mensah", role: "Forklift", maxShifts: 5 },
  ],
  assignments: {
    [`priya|${day(0)}`]: "m", [`priya|${day(1)}`]: "m", [`priya|${day(2)}`]: "n", [`priya|${day(3)}`]: "m", [`priya|${day(4)}`]: "e",
    [`sam|${day(0)}`]: "e", [`sam|${day(1)}`]: "e", [`sam|${day(4)}`]: "m", [`sam|${day(5)}`]: "m",
    [`mei|${day(0)}`]: "m", [`mei|${day(1)}`]: "m", [`mei|${day(2)}`]: "m", [`mei|${day(4)}`]: "m",
    [`tomas|${day(0)}`]: "e", [`tomas|${day(1)}`]: "e", [`tomas|${day(2)}`]: "e", [`tomas|${day(3)}`]: "e", [`tomas|${day(5)}`]: "e",
    [`ana|${day(0)}`]: "n", [`ana|${day(1)}`]: "n", [`ana|${day(3)}`]: "n", [`ana|${day(4)}`]: "n",
    [`kofi|${day(2)}`]: "e", [`kofi|${day(3)}`]: "m", [`kofi|${day(4)}`]: "e", [`kofi|${day(6)}`]: "m",
  },
};

export default function ShiftSchedulePreview() {
  return (
    <section className="fl-section fl-section--canvas" aria-label={SAMPLE.title}>
      <div className="fl-wrap">
        <ShiftSchedule {...SAMPLE} />
      </div>
    </section>
  );
}
