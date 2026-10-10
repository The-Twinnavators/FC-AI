/** @flowcode-library avatar-group · Avatar group (Cards)
 * Use cases: team members; collaborators; attendee list; online presence; shared with; project members; participants; assignees
 * Jobs to be done: see who is on the team; check who is online now; see everyone attending; find a specific person
 * Keywords: avatars, team, presence, status, people
 */
/**
 * Avatars: initials on theme colors in four sizes, with status dots, a stacked group that ends in "+5", and the
 * full list of people behind it. Use it to show who is on a team, a booking or a shared list.
 * Make it the app's own: replace SAMPLE with your people (photos can replace the initials) and real presence data.
 */
import { useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Studio team",
  title: "Who's in today",
  stackLabel: "Team on the Saturday rota",
  stackShown: 4,
  statuses: [
    { id: "online", label: "In the studio" },
    { id: "away", label: "On a break" },
    { id: "busy", label: "Teaching" },
    { id: "offline", label: "Off today" },
  ],
  people: [
    { name: "Ana Ruiz", role: "Studio lead", status: "busy", tone: 1 },
    { name: "Tom Okafor", role: "Wheel tutor", status: "online", tone: 2 },
    { name: "Mei Lin", role: "Glaze technician", status: "away", tone: 3 },
    { name: "Sam Patel", role: "Front desk", status: "online", tone: 4 },
    { name: "Jo Byrne", role: "Kiln and firing", status: "offline", tone: 5 },
    { name: "Lena Fischer", role: "Kids' club tutor", status: "busy", tone: 1 },
    { name: "Kofi Mensah", role: "Hand-building tutor", status: "offline", tone: 2 },
    { name: "Priya Shah", role: "Shop and orders", status: "online", tone: 3 },
    { name: "Rory Walsh", role: "Weekend assistant", status: "away", tone: 4 },
  ],
  sizes: ["sm", "md", "lg", "xl"],
  emptyText: "No one is in the studio right now.",
};

type Person = (typeof SAMPLE.people)[number];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Avatar({ p, size = "md", showStatus = true, statusLabel }: { p: Person; size?: string; showStatus?: boolean; statusLabel?: string }) {
  return (
    <span className={`fl-way-av fl-way-av--${size} fl-way-tone-${p.tone}`} role="img" aria-label={statusLabel ? `${p.name}, ${statusLabel}` : p.name}>
      <span aria-hidden="true">{initials(p.name)}</span>
      {showStatus && <span className={`fl-way-av__dot fl-way-dot-${p.status}`} aria-hidden="true" />}
    </span>
  );
}

export default function AvatarGroup() {
  const d = SAMPLE;
  const [expanded, setExpanded] = useState(false);
  const [onlyIn, setOnlyIn] = useState(false);
  const listRef = useRef<HTMLHeadingElement | null>(null);
  const label = (id: string) => d.statuses.find((s) => s.id === id)?.label ?? id;

  const shown = d.people.slice(0, d.stackShown);
  const more = d.people.length - shown.length;
  const filtered = onlyIn ? d.people.filter((p) => p.status !== "offline") : d.people;
  const list = expanded ? filtered : filtered.slice(0, d.stackShown);

  return (
    <section className="fl-section" aria-labelledby="avatar-group-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="avatar-group-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-grid fl-grid--2" style={{ alignItems: "start" }}>
          <div className="fl-card" style={{ gap: "var(--space-4)" }}>
            <h3>Sizes</h3>
            <ul className="fl-way-sizes" aria-label="Avatar sizes">
              {d.sizes.map((s, i) => (
                <li key={s}>
                  <Avatar p={d.people[i]} size={s} statusLabel={label(d.people[i].status)} />
                </li>
              ))}
            </ul>
            <ul className="fl-way-legend" aria-label="Status key">
              {d.statuses.map((s) => (
                <li key={s.id}>
                  <span className={`fl-way-av__dot fl-way-dot-${s.id}`} aria-hidden="true" />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="fl-card" style={{ gap: "var(--space-4)" }}>
            <h3>{d.stackLabel}</h3>
            <ul className="fl-way-stack" aria-label={`${d.people.length} people`}>
              {shown.map((p) => (
                <li key={p.name}>
                  <Avatar p={p} size="lg" showStatus={false} />
                </li>
              ))}
              {more > 0 && (
                <li>
                  <button
                    type="button"
                    className="fl-way-av fl-way-av--lg fl-way-av--more"
                    aria-expanded={expanded}
                    aria-controls="avatar-group-people"
                    aria-label={expanded ? "Show fewer people" : `Show ${more} more people`}
                    onClick={() => {
                      setExpanded((x) => !x);
                      if (!expanded) requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "nearest" }));
                    }}
                  >
                    {expanded ? "–" : `+${more}`}
                  </button>
                </li>
              )}
            </ul>
            <p className="fl-meta" style={{ margin: 0 }}>
              {shown.map((p) => p.name.split(" ")[0]).join(", ")} and {more} others
            </p>
          </div>
        </div>

        <div style={{ marginTop: "var(--space-6)" }}>
          <div className="fl-way-toolbar-row">
            <h3 ref={listRef} className="fl-title fl-title--md" id="avatar-group-list-title">
              People
            </h3>
            <label className="fl-way-pagesize" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={onlyIn} onChange={(e) => setOnlyIn(e.target.checked)} />
              Hide people who are off today
            </label>
          </div>
          {list.length === 0 ? (
            <div className="fl-way-empty">
              <p>{d.emptyText}</p>
            </div>
          ) : (
            <ul className="fl-way-list" id="avatar-group-people" aria-labelledby="avatar-group-list-title">
              {list.map((p) => (
                <li key={p.name}>
                  <Avatar p={p} />
                  <div className="fl-way-list__main">
                    <p className="fl-way-list__title">{p.name}</p>
                    <p className="fl-way-list__meta">{p.role}</p>
                  </div>
                  <span className="fl-way-state">
                    <span className={`fl-way-av__dot fl-way-dot-${p.status}`} aria-hidden="true" />
                    {label(p.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="fl-actions" style={{ marginTop: "var(--space-3)", justifyContent: "space-between" }}>
            <p className="fl-way-status" role="status" aria-live="polite">
              Showing {list.length} of {filtered.length}
            </p>
            {filtered.length > d.stackShown && (
              <button type="button" className="fl-way-btn-sm" aria-expanded={expanded} aria-controls="avatar-group-people" onClick={() => setExpanded((x) => !x)}>
                {expanded ? "Show fewer" : "Show everyone"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
