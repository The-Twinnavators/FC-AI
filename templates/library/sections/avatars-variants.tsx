/** @flowcode-library avatars-variants - Avatars: sizes, shapes, initials, status and a stack (Small components)
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
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  sizes: [20, 24, 32, 40, 48, 64],
  people: [
    { id: "p1", name: "Ana Moreau", tone: "a", here: "online" },
    { id: "p2", name: "Tom Reed", tone: "b", here: "away" },
    { id: "p3", name: "Priya", tone: "c", here: "offline" },
    { id: "p4", name: "Oláv Fenwick", tone: "d", here: "online" },
    { id: "p5", name: "Lane & Co", tone: "e", here: "offline" },
    { id: "p6", name: "Jun Okonkwo", tone: "a", here: "online" },
  ],
};

/** Initials from a name: two words give two letters, one word gives one, and nothing gives a shape. */
function initials(name: string) {
  const bits = name.trim().split(/\s+/).filter((b) => /[\p{L}\p{N}]/u.test(b[0] ?? ""));
  if (!bits.length) return "?";
  if (bits.length === 1) return bits[0].slice(0, 1).toUpperCase();
  return (bits[0][0] + bits[bits.length - 1][0]).toUpperCase();
}

function Avatar({ name, tone, size = 40, square = false, src, here }: { name: string; tone: string; size?: number; square?: boolean; src?: string; here?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`fl-ctl-avatar fl-ctl-avatar--${size} fl-ctl-avatar--${tone}${square ? " is-square" : ""}`}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : <span aria-hidden="true">{initials(name)}</span>}
      <span className="fl-sr">{name}</span>
      {here ? (
        <>
          <span className={`fl-ctl-avatar-dot fl-ctl-dot--${here}`} aria-hidden="true" />
          <span className="fl-sr">, {here}</span>
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
            <Avatar name="Lane & Co" tone="e" size={48} square />
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
              <Avatar name={p.name} tone={p.tone} size={40} here={p.here} />
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
            <span key={p.id} className={`fl-ctl-avatar fl-ctl-avatar--32 fl-ctl-avatar--${p.tone}`} aria-hidden="true">
              <span>{initials(p.name)}</span>
            </span>
          ))}
          {rest > 0 ? (
            <span className="fl-ctl-avatar fl-ctl-avatar--32 fl-ctl-avatar--rest" aria-hidden="true">
              <span>+{rest}</span>
            </span>
          ) : null}
        </span>
      </div>
    </section>
  );
}
