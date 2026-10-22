/** @flowcode-library avatars-variants · Avatars: sizes, shapes, initials, status and a stack (Small components)
 * Catalog ID: c.avatar (component)
 * Function: The avatar (c.avatar) that identifies a person or organization, and its reference sheet: sizes, round or square, the initials fallback when a picture fails, presence dots and a stack. Also exports c.avatar-stack (AvatarStack).
 * Use it as: import { Avatar } from "./AvatarsVariants"; <Avatar variant?="person"|"organization" name size?={20|24|32|40|44|48|64|72|96|120} tone?="a"|"b"|"c"|"d"|"e"|"rest" src? status?="online"|"away"|"offline" label? decorative? />; <AvatarStack version?="default"|"classic" people={[{ name, tone?, src?, status? }]} max?={4} size?={32} label? onMore?={() => ...} />
 * Variants: c.avatar.person - a person: a round avatar; c.avatar.organization - a company or team: a square avatar with rounded corners
 * Look: A small colored disc (or rounded square) holding a picture or the name's initials, with an optional status dot on the corner; ten sizes from 20 to 120 px.
 * Tokens: --color-surface-sunken --color-text --color-text-muted --color-accent --color-success --color-danger --color-warning --color-surface --color-border --color-border-strong --radius-md
 * Also: c.avatar-stack (component)
 *   Use it as: import { AvatarStack } from "./AvatarsVariants"; <AvatarStack version?="default"|"classic" showStatus? statusKey? people={[{ name, tone?, src?, status?: "online"|"away"|"busy"|"offline" }]} max?={4} size?={20|24|32|40|44|48|64|72|96|120} label?="On this shoot" onMore?={() => ...} expanded? />
 *   Look: Overlapping round avatars with a white ring, ending in a +N circle that becomes a button when onMore is passed; the whole stack reads as one labeled image.
 * Use cases: a comment's author; a team list; an assignee picker; a chat header; a presence row; team members; collaborators; attendee list; online presence; shared with; project members; participants; assignees
 * Jobs to be done: tell people apart at a glance; see who is on something; see who is here now; see who is on the team; check who is online now; see everyone attending; find a specific person
 * Keywords: avatar, initials, profile picture, presence, status dot, avatar group, fallback, avatars, team, status, people
 */
/**
 * An avatar is a fallback waiting to happen: a picture that fails, a person with one name, a name with an accent, a
 * list too long to draw. All four are here, because the fallback is the part that ships broken.
 *
 * Initials come from the name rather than being typed in, a failed image drops back to those initials instead of
 * showing a torn-page icon, and the stack says "+4" with the full count in words for anyone who cannot see the
 * pictures. Presence is a dot with a word behind it, never a color on its own.
 *
 * Make it the app's own: replace the people. Keep the initials fallback; roughly one picture in twenty will not load.
 */
/**
 * How to try it
 * - Nothing to press: this one is about what happens without you.
 * - The second avatar under "When the picture is not there" loads a broken address on purpose, so you see the fallback
 *   happen rather than being told about it.
 * - Initials are worked out from the name, so one name gives one letter and no name gives a shape.
 *
 * Dependencies: React (useState). Nothing else — no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app
 * exactly as it runs here.
 */
import { useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "./ButtonsVariants";

// flowcode:sample
const SAMPLE = {
  group: {
    eyebrow: "Studio team",
    title: "Who's in today",
    stackLabel: "Team on the Saturday rota",
    stackShown: 4,
    statuses: [
      { id: "online" as const, label: "In the studio" },
      { id: "away" as const, label: "On a break" },
      { id: "busy" as const, label: "Teaching" },
      { id: "offline" as const, label: "Off today" },
    ],
    people: [
      { name: "Ana Ruiz", role: "Studio lead", status: "busy" as const, tone: "a" as const },
      { name: "Tom Okafor", role: "Wheel tutor", status: "online" as const, tone: "b" as const },
      { name: "Mei Lin", role: "Glaze technician", status: "away" as const, tone: "c" as const },
      { name: "Sam Patel", role: "Front desk", status: "online" as const, tone: "d" as const },
      { name: "Jo Byrne", role: "Kiln and firing", status: "offline" as const, tone: "e" as const },
      { name: "Lena Fischer", role: "Kids' club tutor", status: "busy" as const, tone: "a" as const },
      { name: "Kofi Mensah", role: "Hand-building tutor", status: "offline" as const, tone: "b" as const },
      { name: "Priya Shah", role: "Shop and orders", status: "online" as const, tone: "c" as const },
      { name: "Rory Walsh", role: "Weekend assistant", status: "away" as const, tone: "d" as const },
    ],
    sizes: ["sm", "md", "lg", "xl"] as WaySize[],
    emptyText: "No one is in the studio right now.",
  },
  sizes: [20, 24, 32, 40, 44, 48, 64, 72, 96, 120] as const,
  people: [
    { id: "p1", name: "Ana Moreau", tone: "a" as const, here: "online" as const },
    { id: "p2", name: "Tom Reed", tone: "b" as const, here: "away" as const },
    { id: "p3", name: "Priya", tone: "c" as const, here: "offline" as const },
    { id: "p4", name: "Oláv Fenwick", tone: "d" as const, here: "online" as const },
    { id: "p5", name: "Lane & Co", tone: "e" as const, here: "offline" as const },
    { id: "p6", name: "Jun Okonkwo", tone: "a" as const, here: "online" as const },
  ],
};

/** Initials from a name: two words give two letters, one word gives one, and nothing gives a shape. */
function initials(name: string) {
  const bits = name.trim().split(/\s+/).filter((b) => /[\p{L}\p{N}]/u.test(b[0] ?? ""));
  if (!bits.length) return "?";
  if (bits.length === 1) return bits[0].slice(0, 1).toUpperCase();
  return (bits[0][0] + bits[bits.length - 1][0]).toUpperCase();
}

// ── c.avatar: the one avatar. Every piece's people and organizations are this component. ──

export type AvatarVariant = "person" | "organization";
export type AvatarSize = 20 | 24 | 32 | 40 | 44 | 48 | 64 | 72 | 96 | 120;
export type AvatarTone = "a" | "b" | "c" | "d" | "e" | "rest";
export type AvatarStatus = "online" | "away" | "offline";

// Written out in full (not built from the name) so a build finds every class the avatar needs.
const VARIANT: Record<AvatarVariant, string> = { person: "", organization: "is-square" };
const SIZE: Record<AvatarSize, string> = { 20: "fl-ctl-avatar--20", 24: "fl-ctl-avatar--24", 32: "fl-ctl-avatar--32", 40: "fl-ctl-avatar--40", 44: "fl-ctl-avatar--44", 48: "fl-ctl-avatar--48", 64: "fl-ctl-avatar--64", 72: "fl-ctl-avatar--72", 96: "fl-ctl-avatar--96", 120: "fl-ctl-avatar--120" };
const TONE: Record<AvatarTone, string> = { a: "fl-ctl-avatar--a", b: "fl-ctl-avatar--b", c: "fl-ctl-avatar--c", d: "fl-ctl-avatar--d", e: "fl-ctl-avatar--e", rest: "fl-ctl-avatar--rest" };
const DOT: Record<AvatarStatus, string> = { online: "fl-ctl-dot--online", away: "fl-ctl-dot--away", offline: "fl-ctl-dot--offline" };

export function Avatar({ variant = "person", name, size = 40, tone = "e", src, status, label, decorative, className }: {
  variant?: AvatarVariant;
  /** Who it is. Initials are worked out from it, and screen readers read it. */
  name: string;
  /** Diameter in px; 40 when left out. */
  size?: AvatarSize;
  /** Background color family: a to e, or rest for a "+4" counter. */
  tone?: AvatarTone;
  /** A picture. If it fails to load, the initials show instead. */
  src?: string;
  /** Presence: a dot on the corner, with the word behind it for screen readers. */
  status?: AvatarStatus;
  /** Text shown in place of the initials, such as "+4". */
  label?: string;
  /** Inside a group that names itself: hidden from screen readers. */
  decorative?: boolean;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const cls = ["fl-ctl-avatar", SIZE[size], TONE[tone], VARIANT[variant], className ?? ""].filter(Boolean).join(" ");
  return (
    <span className={cls} data-fl={`c.avatar.${variant}`} aria-hidden={decorative || undefined}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : <span aria-hidden="true">{label ?? initials(name)}</span>}
      {decorative ? null : <span className="fl-sr">{name}</span>}
      {status && !decorative ? (
        <>
          <span className={`fl-ctl-avatar-dot ${DOT[status]}`} aria-hidden="true" />
          <span className="fl-sr">, {status}</span>
        </>
      ) : null}
    </span>
  );
}

/** Presence in the classic stack's key: the three above plus busy (teaching, in a meeting). */
export type PresenceStatus = AvatarStatus | "busy";
export type StackPerson = { name: string; tone?: AvatarTone; src?: string; status?: PresenceStatus };
/** default = overlapping round avatars with a ring; classic = the team-presence stack: themed discs, a status key and a count button. */
export type AvatarStackVersion = "default" | "classic";

// c.avatar-stack@classic: the wayfinding kit's avatar classes (templates/library/css/wayfinding.css), written out in full.
type WaySize = "sm" | "md" | "lg" | "xl";
const WAY_SIZE: Record<WaySize, string> = { sm: "fl-way-av--sm", md: "fl-way-av--md", lg: "fl-way-av--lg", xl: "fl-way-av--xl" };
const WAY_TONE: Record<AvatarTone, string> = { a: "fl-way-tone-1", b: "fl-way-tone-2", c: "fl-way-tone-3", d: "fl-way-tone-4", e: "fl-way-tone-5", rest: "fl-way-tone-5" };
const WAY_DOT: Record<PresenceStatus, string> = { online: "fl-way-dot-online", away: "fl-way-dot-away", busy: "fl-way-dot-busy", offline: "fl-way-dot-offline" };
const wayOf = (size: AvatarSize): WaySize => (size <= 32 ? "sm" : size <= 44 ? "md" : size <= 64 ? "lg" : "xl");

/** An initials disc in the classic look, with an optional presence dot; one image to a screen reader ("Ana Ruiz, Teaching"). */
function WayAvatar({ name, tone = "a", size = "md", status, statusLabel }: { name: string; tone?: AvatarTone; size?: WaySize; status?: PresenceStatus; statusLabel?: string }) {
  return (
    <span className={`fl-way-av ${WAY_SIZE[size]} ${WAY_TONE[tone]}`} role="img" aria-label={statusLabel ? `${name}, ${statusLabel}` : name}>
      <span aria-hidden="true">{initials(name)}</span>
      {status ? <span className={`fl-way-av__dot ${WAY_DOT[status]}`} aria-hidden="true" /> : null}
    </span>
  );
}

/**
 * c.avatar-stack: overlapping avatars that end in a "+N" count. The whole stack is one labeled image for a screen
 * reader; pass onMore to make the count a button that reveals everyone (for example to open the full list).
 */
export function AvatarStack({ version = "default", showStatus, statusKey, people, max = 4, size, label, onMore, expanded, className }: {
  /** "classic" draws the team-presence stack (larger themed discs, optional presence dots and key); "default" when left out. */
  version?: AvatarStackVersion;
  /** classic: draw each person's presence dot (status: online, away, busy or offline). */
  showStatus?: boolean;
  /** classic: a key under the stack explaining the dots, e.g. [{ id: "busy", label: "Teaching" }]. */
  statusKey?: { id: PresenceStatus; label: string }[];
  people: StackPerson[];
  /** How many faces to draw before the count. */
  max?: number;
  size?: AvatarSize;
  /** What the stack reads as, such as "On this shoot". The names are added after it. */
  label?: string;
  /** Makes the "+N" a button; called when it is pressed. */
  onMore?: () => void;
  /** With onMore: whether the list it controls is open. */
  expanded?: boolean;
  className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  if (version === "classic") {
    const way = wayOf(size ?? 48);
    const word = (id?: PresenceStatus) => statusKey?.find((k) => k.id === id)?.label ?? id;
    return (
      <div className={className} data-fl="c.avatar-stack@classic">
        <ul className="fl-way-stack" aria-label={label ? `${label}: ${people.length} people` : `${people.length} people`}>
          {shown.map((p, i) => (
            <li key={p.name} style={{ "--i": i } as CSSProperties}>
              <WayAvatar name={p.name} tone={p.tone} size={way} status={showStatus ? p.status : undefined} statusLabel={showStatus ? word(p.status) : undefined} />
            </li>
          ))}
          {rest > 0 ? (
            <li style={{ "--i": shown.length } as CSSProperties}>
              {onMore ? (
                <button type="button" className={`fl-way-av ${WAY_SIZE[way]} fl-way-av--more`} aria-expanded={expanded} aria-label={expanded ? "Show fewer people" : `Show ${rest} more people`} onClick={onMore}>
                  {expanded ? "–" : `+${rest}`}
                </button>
              ) : (
                <span className={`fl-way-av ${WAY_SIZE[way]} fl-way-av--more`} role="img" aria-label={`${rest} more people`}>
                  +{rest}
                </span>
              )}
            </li>
          ) : null}
        </ul>
        {statusKey ? (
          <ul className="fl-way-legend" aria-label="Status key">
            {statusKey.map((k) => (
              <li key={k.id}>
                <span className={`fl-way-av__dot ${WAY_DOT[k.id]}`} aria-hidden="true" />
                {k.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  const faces = shown.map((p) => <Avatar key={p.name} name={p.name} tone={p.tone} src={p.src} status={undefined} size={size ?? 32} decorative />);
  const more = rest > 0 ? <Avatar name={`${rest} more`} tone="rest" size={size ?? 32} label={expanded ? "–" : `+${rest}`} decorative /> : null;
  const names = `${label ? `${label}: ` : ""}${people.map((p) => p.name).join(", ")}`;
  return (
    <span className={["fl-ctl-avatar-stack", className ?? ""].filter(Boolean).join(" ")} data-fl="c.avatar-stack" role={onMore ? "group" : "img"} aria-label={names}>
      {faces}
      {more && onMore ? (
        <button type="button" className="fl-ctl-avatar-more" aria-expanded={expanded} aria-label={expanded ? "Show fewer people" : `Show ${rest} more people`} onClick={onMore}>
          {more}
        </button>
      ) : (
        more
      )}
    </span>
  );
}

// ── c.avatar-stack@classic in use: the team-presence sheet (avatar-group wraps this). ──

export type ClassicAvatarGroupProps = {
  eyebrow: string;
  title: string;
  stackLabel: string;
  stackShown: number;
  statuses: { id: PresenceStatus; label: string }[];
  people: { name: string; role: string; status: PresenceStatus; tone: AvatarTone }[];
  sizes: WaySize[];
  emptyText: string;
};

export function ClassicAvatarGroup(d: ClassicAvatarGroupProps) {
  const uid = useId();
  const [expanded, setExpanded] = useState(false);
  const [onlyIn, setOnlyIn] = useState(false);
  const listRef = useRef<HTMLHeadingElement | null>(null);
  const label = (id: string) => d.statuses.find((x) => x.id === id)?.label ?? id;

  const shown = d.people.slice(0, d.stackShown);
  const more = d.people.length - shown.length;
  const filtered = onlyIn ? d.people.filter((p) => p.status !== "offline") : d.people;
  const list = expanded ? filtered : filtered.slice(0, d.stackShown);

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id={`${uid}-title`} className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-grid fl-grid--2" style={{ alignItems: "start" }}>
          <div className="fl-card" style={{ gap: "var(--space-4)" }}>
            <h3>Sizes</h3>
            <ul className="fl-way-sizes" aria-label="Avatar sizes">
              {d.sizes.map((sz, i) => (
                <li key={sz}>
                  <WayAvatar name={d.people[i].name} tone={d.people[i].tone} size={sz} status={d.people[i].status} statusLabel={label(d.people[i].status)} />
                </li>
              ))}
            </ul>
            <ul className="fl-way-legend" aria-label="Status key">
              {d.statuses.map((x) => (
                <li key={x.id}>
                  <span className={`fl-way-av__dot ${WAY_DOT[x.id]}`} aria-hidden="true" />
                  {x.label}
                </li>
              ))}
            </ul>
          </div>

          <div className="fl-card" style={{ gap: "var(--space-4)" }}>
            <h3>{d.stackLabel}</h3>
            <AvatarStack
              version="classic"
              people={d.people}
              max={d.stackShown}
              label={d.stackLabel}
              onMore={() => {
                setExpanded((x) => !x);
                if (!expanded) requestAnimationFrame(() => listRef.current?.scrollIntoView({ block: "nearest" }));
              }}
              expanded={expanded}
            />
            <p className="fl-meta" style={{ margin: 0 }}>
              {shown.map((p) => p.name.split(" ")[0]).join(", ")} and {more} others
            </p>
          </div>
        </div>

        <div style={{ marginTop: "var(--space-6)" }}>
          <div className="fl-way-toolbar-row">
            <h3 ref={listRef} className="fl-title fl-title--md" id={`${uid}-list-title`}>
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
            <ul className="fl-way-list" id={`${uid}-people`} aria-labelledby={`${uid}-list-title`}>
              {list.map((p, i) => (
                <li key={p.name} className={expanded && i >= d.stackShown ? "fl-way-list__new" : undefined} style={{ "--i": Math.min(5, Math.max(0, i - d.stackShown)) } as CSSProperties}>
                  <WayAvatar name={p.name} tone={p.tone} status={p.status} />
                  <div className="fl-way-list__main">
                    <p className="fl-way-list__title">{p.name}</p>
                    <p className="fl-way-list__meta">{p.role}</p>
                  </div>
                  <span className="fl-way-state">
                    <span className={`fl-way-av__dot ${WAY_DOT[p.status]}`} aria-hidden="true" />
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
            {filtered.length > d.stackShown ? (
              <Button variant="tertiary" size={32} aria-expanded={expanded} aria-controls={`${uid}-people`} onClick={() => setExpanded((x) => !x)}>
                {expanded ? "Show fewer" : "Show everyone"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AvatarsVariants() {
  const d = SAMPLE;
  const [all, setAll] = useState(false);

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-spec fl-ctl-spec--wide">
        <h3>Sizes</h3>
        <p className="fl-ctl-btn-what">Ten steps, up to 120 px for a profile page. Under 24 px the initials stop being readable, so those are for a stack or a dot, not for standing alone.</p>
        <ul className="fl-ctl-size-list fl-ctl-avatar-sizes">
          {d.sizes.map((s) => (
            <li key={s}>
              <Avatar name="Ana Moreau" tone="a" size={s} status={s >= 44 ? "online" : undefined} />
              <span className="fl-ctl-btn-what">{s} px</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Round or square</h3>
        <p className="fl-ctl-btn-what">Round for a person, square for an organisation. Mixing the two in one list is how people tell them apart.</p>
        <div className="fl-ctl-avatar-row">
          <span className="fl-ctl-avatar-pair">
            <Avatar name="Ana Moreau" tone="a" size={48} />
            <span className="fl-ctl-matrix-what">A person</span>
          </span>
          <span className="fl-ctl-avatar-pair">
            <Avatar variant="organization" name="Lane & Co" tone="e" size={48} />
            <span className="fl-ctl-matrix-what">A company</span>
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>When the picture is not there</h3>
        <p className="fl-ctl-btn-what">
          Three fallbacks in order: the photograph, the initials, and a question mark. The middle one is loaded from a
          broken address on purpose, so you can see what happens when an image fails rather than being told.
        </p>
        <div className="fl-ctl-avatar-row">
          <span className="fl-ctl-avatar-pair">
            <Avatar name="Ana Moreau" tone="a" size={48} />
            <span className="fl-ctl-matrix-what">Initials from two words</span>
          </span>
          <span className="fl-ctl-avatar-pair">
            <Avatar name="Tom Reed" tone="b" size={48} src="/this-image-does-not-exist.png" />
            <span className="fl-ctl-matrix-what">A picture that failed</span>
          </span>
          <span className="fl-ctl-avatar-pair">
            <Avatar name="Priya" tone="c" size={48} />
            <span className="fl-ctl-matrix-what">One name, one letter</span>
          </span>
          <span className="fl-ctl-avatar-pair">
            <Avatar name=" " tone="e" size={48} />
            <span className="fl-ctl-matrix-what">No name at all</span>
          </span>
        </div>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>Presence</h3>
        <p className="fl-ctl-btn-what">A dot on the corner, with the word behind it for anyone who cannot see the color.</p>
        <ul className="fl-ctl-avatar-people">
          {d.people.slice(0, 3).map((p) => (
            <li key={p.id}>
              <Avatar name={p.name} tone={p.tone} size={40} status={p.here} />
              <span>
                <strong>{p.name}</strong>
                <span className="fl-ctl-matrix-what">{p.here === "online" ? "Here now" : p.here === "away" ? "Signed in, away from the desk" : "Not here"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec">
        <h3>A stack</h3>
        <p className="fl-ctl-btn-what">Four at most, then a count. The whole stack is one thing to a screen reader, so it reads as a sentence rather than six names in a row.</p>
        <AvatarStack people={d.people} label="On this shoot" />
        <p className="fl-ctl-btn-what">With onMore the count is a button, and the list it opens is yours to draw.</p>
        <AvatarStack people={d.people} max={3} label="Team on the Saturday rota" onMore={() => setAll((v) => !v)} expanded={all} />
        {all ? (
          <ul className="fl-ctl-avatar-people">
            {d.people.map((p) => (
              <li key={p.id}>
                <Avatar name={p.name} tone={p.tone} size={32} status={p.here} />
                <span>
                  <strong>{p.name}</strong>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="fl-ctl-sizes fl-ctl-spec fl-ctl-spec--wide fl-ctl-spec--bare">
        <h3>Version: classic (c.avatar-stack@classic)</h3>
        <p className="fl-ctl-btn-what">
          The team-presence stack: larger themed discs that overlap, a count button that opens the full list, and a key for the
          four presence dots, including busy (teaching, in a meeting). The sheet below also shows the sizes and the people list behind the count.
        </p>
        <ClassicAvatarGroup {...d.group} />
      </div>
    </section>
  );
}
