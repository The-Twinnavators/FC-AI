/** @flowcode-library time-zone-field · Time zone field (Forms)
 * Catalog ID: c.time-zone-field (component)
 * Function: A time zone picker: a searchable field over every IANA time zone, grouped by region with the person's own zone pinned on top, each showing its UTC offset, short name and the time there now; finds zones by city, region, short name or offset.
 * Use it as: import { TimeZoneField } from "./time-zone-field"; <TimeZoneField label="Your time zone" value?/defaultValue?="America/Los_Angeles" onChange?={(tz) => ...} zones?={["Europe/London", ...]} locale? hint? disabled? id? labels?={{ yours, search, empty, result, results, picked, toggle }} />  // also exports zoneOffset(tz, date) in minutes
 * Built from: c.time-picker.input
 * Look: A bordered field showing the chosen city and its offset with a globe at the left, the time there now and a chevron 8px from the right edge; it drops a raised list of zones grouped under small region headings, each row with the city, a muted short name, the offset and the time there now, the active row tinted.
 * Tokens: --color-surface --color-surface-sunken --color-border-strong --color-border --color-text --color-text-muted --color-accent --field-radius --surface-shadow-overlay --radius-sm --space-1 --space-2 --space-3 --text-sm --text-xs --duration-fast --duration-base --ease-out --focus-ring
 * Use cases: account settings; meeting scheduler; event creation; team directory; calendar settings; shipping cutoff times; on-call schedule
 * Jobs to be done: set my own time zone; find a city's time zone without knowing its name; see what time it is there now; schedule across time zones
 * Keywords: time zone, timezone, utc offset, combobox, searchable select, city, world clock, scheduling, IANA
 */
/**
 * Time zone field: a combobox (APG list autocomplete) over the browser's own list of time zones. Focus stays in the
 * field while Up and Down move a highlight through the list; Enter picks, Escape closes (and clears the search when
 * already closed), Alt+Down opens. Type a city ("tokyo"), a region ("europe"), a short name ("pst") or an offset
 * ("+5:30", "utc-3"); the count of matches is announced. The person's own zone is pinned first, and every row shows
 * the time there now, updated each minute.
 * Make it the app's own: save the chosen IANA id (not the offset, which changes with daylight saving) through onChange.
 * Adapted from TailGrids (MIT, Copyright (c) 2025 Tailgrids): its time field's time zone example (a time shown in and
 * converted between zones), rewritten as a zone picker without its dependencies.
 */
/**
 * How to try it
 * - Click the field: your own zone is on top, then every region.
 * - Type "kolk", "pst" or "+9": the list narrows and says how many match.
 * - Use Up and Down, then Enter; Escape closes.
 * - Change the meeting time: the team's local times follow, with the day when it differs.
 *
 * Dependencies: React (useEffect, useId, useMemo, useRef, useState), the library's TimePicker ("./time-picker") and its
 * inline icon set ("./icons"), which is a table of SVG paths rather than an icon package. Time zones and their times
 * come from the browser's own Intl. Nothing else — no package to install and nothing fetched at run time. The styles
 * are the library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in
 * a built app exactly as it runs here.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Icon } from "./icons";
import { TimePicker } from "./time-picker";

// ── c.time-zone-field: a list autocomplete over the time zones, grouped by region. ──

type Zone = { tz: string; city: string; region: string; offset: number; offsetLabel: string; abbr: string; find: string; clock: Intl.DateTimeFormat };
type TzLabels = { yours: string; search: string; empty: string; result: string; results: string; picked: string; toggle: string };

const LABELS: TzLabels = {
  yours: "Your time zone",
  search: "Search city or offset",
  empty: "No time zone matches “{q}”.",
  result: "1 time zone",
  results: "{n} time zones",
  picked: "Time zone set to {city}, {offset}.",
  toggle: "Show time zones",
};

const FALLBACK = ["Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Sao_Paulo", "Atlantic/Azores", "Europe/London", "Europe/Paris", "Europe/Berlin", "Africa/Cairo", "Europe/Moscow", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Bangkok", "Asia/Singapore", "Asia/Shanghai", "Asia/Tokyo", "Australia/Adelaide", "Australia/Sydney", "Pacific/Auckland", "UTC"];

// Browsers still list some zones by their old names; show and save the current ones.
const RENAMED: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Godthab": "America/Nuuk",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Enderbury": "Pacific/Kanton",
};
const current = (tz: string) => RENAMED[tz] ?? tz;

/** Minutes ahead of UTC for a zone at a moment. */
export function zoneOffset(tz: string, at: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour! % 24, +p.minute!);
  return Math.round((asUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}
const offsetText = (m: number) => (m === 0 ? "UTC" : `UTC${m < 0 ? "−" : "+"}${String(Math.floor(Math.abs(m) / 60)).padStart(2, "0")}:${String(Math.abs(m) % 60).padStart(2, "0")}`);

function buildZones(list: string[], locale: string | undefined, now: Date): Zone[] {
  return list
    .map((tz) => {
      let offset = 0;
      let abbr = "";
      let other = "";
      try {
        offset = zoneOffset(tz, now);
        const nameAt = (style: "short" | "longGeneric", at: Date) => new Intl.DateTimeFormat(locale ?? "en-US", { timeZone: tz, timeZoneName: style }).formatToParts(at).find((x) => x.type === "timeZoneName")?.value ?? "";
        abbr = nameAt("short", now);
        // Winter and summer short names ("PST", "PDT") and the generic name ("Pacific Time") also find the zone.
        const y = now.getUTCFullYear();
        other = [nameAt("short", new Date(Date.UTC(y, 0, 15))), nameAt("short", new Date(Date.UTC(y, 6, 15))), nameAt("longGeneric", now)].join(" ");
      } catch {
        return null;
      }
      const segs = tz.split("/");
      const city = segs[segs.length - 1]!.replace(/_/g, " ");
      const region = segs.length > 1 ? segs[0]! : "Other";
      const h = Math.floor(Math.abs(offset) / 60);
      const mm = String(Math.abs(offset) % 60).padStart(2, "0");
      const sign = offset < 0 ? "-" : "+";
      const find = [tz.replace(/_/g, " "), city, region, abbr, other,`utc${sign}${h}`, `utc${sign}${h}:${mm}`, `${sign}${h}`, `${sign}${h}:${mm}`, `gmt${sign}${h}`].join(" ").toLowerCase();
      return { tz, city, region, offset, offsetLabel: offsetText(offset), abbr: /^(GMT|UTC)[+-]/.test(abbr) ? "" : abbr, find, clock: new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" }) };
    })
    .filter((z): z is Zone => !!z)
    .sort((a, b) => a.region.localeCompare(b.region) || a.offset - b.offset || a.city.localeCompare(b.city));
}

export function TimeZoneField({
  label,
  value,
  defaultValue,
  onChange,
  zones,
  locale,
  hint,
  disabled,
  id,
  labels,
  className,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (tz: string) => void;
  /** IANA ids to offer; every zone the browser knows when left out. */
  zones?: string[];
  locale?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
  labels?: Partial<TzLabels>;
  className?: string;
}) {
  const L = { ...LABELS, ...labels };
  const auto = useId().replace(/:/g, "");
  const base = id ?? `tz${auto}`;
  const mine = useMemo(() => current(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const [now, setNow] = useState(() => new Date());
  const list = useMemo(() => {
    const all = [...new Set((zones ?? (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? FALLBACK).map(current))];
    return all.includes(mine) || zones ? all : [mine, ...all];
  }, [zones, mine]);
  const all = useMemo(() => buildZones(list, locale, now), [list, locale, now.getHours()]);
  const [own, setOwn] = useState(defaultValue ?? mine);
  const chosen = value ?? own;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [said, setSaid] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lb = useRef<HTMLUListElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // The times in the list move on each minute.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000 - (Date.now() % 60_000));
    return () => clearInterval(t);
  }, [now]);

  const pick = all.find((z) => z.tz === chosen);
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? all.filter((z) => terms.every((t) => z.find.includes(t))) : all;
  const yours = !terms.length ? all.filter((z) => z.tz === mine) : [];
  const groups: Array<{ name: string; items: Zone[] }> = [];
  if (yours.length) groups.push({ name: L.yours, items: yours });
  for (const z of hits) {
    const g = groups[groups.length - 1];
    if (g && g.name === z.region) g.items.push(z);
    else groups.push({ name: z.region, items: [z] });
  }
  const flat = groups.flatMap((g) => g.items.map((z) => ({ z, key: `${g.name}:${z.tz}` })));
  const act = Math.min(active, Math.max(0, flat.length - 1));

  const show = () => {
    if (disabled) return;
    setOpen(true);
    const i = flat.findIndex((f) => f.z.tz === chosen);
    setActive(i < 0 ? 0 : i);
  };
  const close = () => {
    setOpen(false);
    setQ("");
  };
  const choose = (z: Zone) => {
    if (value === undefined) setOwn(z.tz);
    onChange?.(z.tz);
    setSaid(L.picked.replace("{city}", z.city).replace("{offset}", z.offsetLabel));
    close();
    input.current?.focus();
  };

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open) return;
    lb.current?.querySelector<HTMLElement>(`[data-i="${act}"]`)?.scrollIntoView({ block: "nearest" });
  }, [act, open]);

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      if (e.altKey && k === "ArrowUp") return close();
      setActive((i) => Math.max(0, Math.min(flat.length - 1, i + (k === "ArrowDown" ? 1 : -1))));
    } else if ((k === "PageDown" || k === "PageUp") && open) {
      e.preventDefault();
      setActive((i) => Math.max(0, Math.min(flat.length - 1, i + (k === "PageDown" ? 8 : -8))));
    } else if (k === "Enter" && open) {
      e.preventDefault();
      const f = flat[act];
      if (f) choose(f.z);
    } else if (k === "Escape") {
      if (open) (e.preventDefault(), close());
      else if (q) setQ("");
    } else if (k === "Tab" && open) close();
  };

  const shown = open ? q : pick ? `${pick.city} (${pick.offsetLabel})` : chosen;
  const listId = `${base}-list`;

  return (
    <div
      ref={wrap}
      className={["fl-tzf", open ? "is-open" : "", className ?? ""].filter(Boolean).join(" ")}
      data-fl="c.time-zone-field"
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <label className="fl-tzf-label" htmlFor={base}>
        {label}
      </label>
      <div className="fl-tzf-anchor">
      <div className={`fl-tzf-box${disabled ? " is-disabled" : ""}`}>
        <Icon name="globe" />
        <input
          ref={input}
          id={base}
          className="fl-tzf-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[act] ? `${base}-o${act}` : undefined}
          aria-describedby={[hint ? `${base}-hint` : "", `${base}-said`].filter(Boolean).join(" ")}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={open ? L.search : undefined}
          value={shown}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            if (!open) setOpen(true);
            const t = e.target.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            const n = t.length ? all.filter((z) => t.every((x) => z.find.includes(x))).length : all.length;
            setSaid(n === 1 ? L.result : n ? L.results.replace("{n}", String(n)) : L.empty.replace("{q}", e.target.value));
          }}
          onClick={() => (open ? null : show())}
          onKeyDown={onKey}
        />
        {pick && !open ? (
          <span className="fl-tzf-now" aria-hidden="true">
            {pick.clock.format(now)}
          </span>
        ) : null}
        <button type="button" className="fl-tzf-chev" tabIndex={-1} aria-label={L.toggle} disabled={disabled} onClick={() => (open ? close() : (show(), input.current?.focus()))}>
          <Icon name="chevron-down" />
        </button>
      </div>
      {open ? (
        <ul ref={lb} id={listId} className="fl-tzf-list" role="listbox" aria-label={label}>
          {flat.length === 0 ? (
            <li className="fl-tzf-empty" role="presentation">
              {L.empty.replace("{q}", q)}
            </li>
          ) : (
            groups.map((g, gi) => {
              const start = groups.slice(0, gi).reduce((t, x) => t + x.items.length, 0);
              return (
                <li key={`${g.name}${gi}`} role="presentation" className="fl-tzf-group">
                  <span id={`${base}-g${gi}`} className="fl-tzf-gname" aria-hidden="true">
                    {g.name}
                  </span>
                  <ul role="group" aria-labelledby={`${base}-g${gi}`} className="fl-tzf-items">
                    {g.items.map((z, k) => {
                      const i = start + k;
                      return (
                        <li
                          key={z.tz}
                          id={`${base}-o${i}`}
                          data-i={i}
                          role="option"
                          aria-selected={i === act}
                          aria-checked={z.tz === chosen}
                          className={`fl-tzf-opt${i === act ? " is-active" : ""}${z.tz === chosen ? " is-chosen" : ""}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseMove={() => i !== act && setActive(i)}
                          onClick={() => choose(z)}
                        >
                          <span className="fl-tzf-city">
                            {z.city}
                            {z.abbr ? <span className="fl-tzf-abbr"> {z.abbr}</span> : null}
                          </span>
                          <span className="fl-tzf-off">{z.offsetLabel}</span>
                          <span className="fl-tzf-time">{z.clock.format(now)}</span>
                          <span className="fl-tzf-tick" aria-hidden="true">
                            {z.tz === chosen ? <Icon name="check" /> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
      </div>
      {hint ? (
        <p id={`${base}-hint`} className="fl-tzf-hint">
          {hint}
        </p>
      ) : null}
      <p id={`${base}-said`} className="fl-tzf-said" role="status">
        {said}
      </p>
    </div>
  );
}

// ── The reference sheet: set your zone, then see a meeting time across the team. ──

// flowcode:sample
const SAMPLE = {
  eyebrow: "Forms",
  title: "Pick a time zone",
  lede: "Search by city, short name or offset.",
  field: { label: "Your time zone", hint: "Used for reminders and your calendar." },
  meeting: { label: "Meeting starts", title: "For the team" },
  team: [
    { name: "Ada Reyes", where: "New York", tz: "America/New_York" },
    { name: "Tom Okafor", where: "London", tz: "Europe/London" },
    { name: "Priya Nair", where: "Bengaluru", tz: "Asia/Kolkata" },
    { name: "Ken Sato", where: "Tokyo", tz: "Asia/Tokyo" },
  ],
};

export default function TimeZoneFieldPreview() {
  const d = SAMPLE;
  const [tz, setTz] = useState(() => current(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [time, setTime] = useState("09:00");
  // The meeting's moment: today's date in the chosen zone at the chosen time.
  const today = new Date();
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const [y, m, dd] = ymd.split("-").map(Number) as [number, number, number];
  const [hh, mi] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, dd, hh, mi);
  const at = new Date(guess - zoneOffset(tz, new Date(guess)) * 60000);
  const dayOf = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  const home = dayOf(tz);

  return (
    <section className="fl-section fl-section--canvas" aria-labelledby="time-zone-title">
      <div className="fl-wrap">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="time-zone-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <div className="fl-tzf-sheet">
          <div className="fl-tzf-card">
            <TimeZoneField label={d.field.label} hint={d.field.hint} value={tz} onChange={setTz} />
            <TimePicker label={d.meeting.label} value={time} onChange={setTime} step={15} />
          </div>
          <div className="fl-tzf-card">
            <h3 className="fl-tzf-team-title">{d.meeting.title}</h3>
            <ul className="fl-tzf-team">
              {d.team.map((p) => {
                const day = dayOf(p.tz);
                return (
                  <li key={p.name}>
                    <span className="fl-tzf-who">
                      <strong>{p.name}</strong>
                      <span>{p.where}</span>
                    </span>
                    <span className="fl-tzf-when">
                      {new Intl.DateTimeFormat(undefined, { timeZone: p.tz, hour: "numeric", minute: "2-digit" }).format(at)}
                      {day !== home ? <span className="fl-tzf-day">{day > home ? "+1 day" : "−1 day"}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
