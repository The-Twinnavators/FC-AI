/** @flowcode-library avatars-variants · Avatars: sizes, shapes, initials, status and a stack (Small components)
 * Catalog ID: c.avatar (component)
 * Function: The avatar (c.avatar) that identifies a person or organization, and its reference sheet: sizes, round or square, the initials fallback when a picture fails, presence dots and a stack.
 * Use it as: import { Avatar } from "./avatars-variants"; <Avatar variant?="person"|"organization" name size?={20|24|32|40|48|64} tone?="a"|"b"|"c"|"d"|"e"|"rest" src? status?="online"|"away"|"offline" label? decorative? />
 * Variants: c.avatar.person - a person: a round avatar; c.avatar.organization - a company or team: a square avatar with rounded corners
 * Look: A small colored disc (or rounded square) holding a picture or the name's initials, with an optional status dot on the corner; six sizes from 20 to 64 px.
 * Tokens: --color-surface-sunken --color-text --color-text-muted --color-accent --color-success --color-danger --color-warning --color-surface --color-border --color-border-strong --radius-md
 * Use cases: a comment's author; a team list; an assignee picker; a chat header; a presence row
 * Jobs to be done: tell people apart at a glance; see who is on something; see who is here now
 * Keywords: avatar, initials, profile picture, presence, status dot, avatar group, fallback
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
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  sizes: [20, 24, 32, 40, 48, 64] as const,
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
export type AvatarSize = 20 | 24 | 32 | 40 | 48 | 64;
export type AvatarTone = "a" | "b" | "c" | "d" | "e" | "rest";
export type AvatarStatus = "online" | "away" | "offline";

// Written out in full (not built from the name) so a build finds every class the avatar needs.
const VARIANT: Record<AvatarVariant, string> = { person: "", organization: "is-square" };
const SIZE: Record<AvatarSize, string> = { 20: "fl-ctl-avatar--20", 24: "fl-ctl-avatar--24", 32: "fl-ctl-avatar--32", 40: "fl-ctl-avatar--40", 48: "fl-ctl-avatar--48", 64: "fl-ctl-avatar--64" };
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

export default function AvatarsVariants() {
  const d = SAMPLE;
  const shown = d.people.slice(0, 4);
  const rest = d.people.length - shown.length;

  return (
    <section className="fl-section fl-section--specimen">
      <h3>Sizes</h3>
      <p className="fl-ctl-btn-what">Six steps. Under 24 px the initials stop being readable, so those are for a stack or a dot, not for standing alone.</p>
      <ul className="fl-ctl-size-list fl-ctl-avatar-sizes">
        {d.sizes.map((s) => (
          <li key={s}>
            <Avatar name="Ana Moreau" tone="a" size={s} />
            <span className="fl-ctl-btn-what">{s} px</span>
          </li>
        ))}
      </ul>

      <div className="fl-ctl-sizes">
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

      <div className="fl-ctl-sizes">
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

      <div className="fl-ctl-sizes">
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

      <div className="fl-ctl-sizes">
        <h3>A stack</h3>
        <p className="fl-ctl-btn-what">Four at most, then a count. The whole stack is one thing to a screen reader, so it reads as a sentence rather than six names in a row.</p>
        <span className="fl-ctl-avatar-stack" role="img" aria-label={`On this shoot: ${d.people.map((p) => p.name).join(", ")}`}>
          {shown.map((p) => (
            <Avatar key={p.id} name={p.name} tone={p.tone} size={32} decorative />
          ))}
          {rest > 0 ? (
            <Avatar name={`${rest} more`} tone="rest" size={32} label={`+${rest}`} decorative />
          ) : null}
        </span>
      </div>
    </section>
  );
}
