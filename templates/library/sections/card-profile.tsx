/** @flowcode-library card-profile · Profile card (Cards)
 * Use cases: user profile; creator profile; team member card; contact card; author bio; mentor profile; freelancer profile; social profile
 * Jobs to be done: learn about a person; follow someone i'm interested in; send someone a message; see someone's activity numbers
 * Keywords: profile, person, contact, follow, avatar
 */
/**
 * Cards: profile. One person's card with initials, role, a short bio, a few numbers, and Follow and Message actions.
 * Follow toggles; Message opens a short note form with checks and a sent message. Use for a teacher, a host or a
 * contact. Make it the app's own: replace SAMPLE with the real person and their numbers; send notes through the
 * app's own messaging when it has one.
 */
import { useRef, useState, type FormEvent } from "react";

// flowcode:sample
const SAMPLE = {
  name: "Maya Okafor",
  role: "Pottery teacher · Riverside Studio",
  bio: "Teaches wheel throwing for beginners on weekday evenings. Twelve years at the wheel, still learns something every class.",
  stats: [
    { label: "Classes", value: 312 },
    { label: "Students", value: 1480 },
    { label: "Followers", value: 864 },
  ],
  messageLabel: "Your note to Maya",
  messageHint: "Ask about a class, a date or a private lesson.",
  sent: "Sent. Maya usually replies within a day.",
};

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");

export default function CardProfile() {
  const d = SAMPLE;
  const [following, setFollowing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState("");
  const messageBtn = useRef<HTMLButtonElement>(null);

  const followers = d.stats[2].value + (following ? 1 : 0);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text) return setError("Write a note before sending.");
    if (text.length < 10) return setError("Add a little more, at least 10 characters.");
    setError("");
    setNote("");
    setComposing(false);
    setSent(true);
    messageBtn.current?.focus();
  };

  const closeCompose = () => {
    setComposing(false);
    setError("");
    messageBtn.current?.focus();
  };

  return (
    <section className="fl-section" aria-labelledby="card-profile-name">
      <div className="fl-wrap">
        <article className="fl-card fl-crd-profile">
          <div className="fl-crd-profile__cover" aria-hidden="true" />
          <div className="fl-crd-profile__body">
            <span className="fl-crd-avatar" aria-hidden="true">
              {initials(d.name)}
            </span>
            <div className="fl-crd-profile__name">
              <h2 id="card-profile-name" className="fl-title fl-title--md">
                {d.name}
              </h2>
              <p>{d.role}</p>
            </div>
            <p className="fl-text">{d.bio}</p>
            <dl className="fl-crd-stats">
              {d.stats.map((s, i) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{(i === 2 ? followers : s.value).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <div className="fl-crd-profile__actions">
              <button
                type="button"
                className="fl-btn fl-btn--primary"
                aria-pressed={following}
                onClick={() => {
                  setFollowing(!following);
                  setStatus(following ? `You no longer follow ${d.name}.` : `You now follow ${d.name}.`);
                }}
              >
                {following ? "Following" : "Follow"}
              </button>
              <button
                ref={messageBtn}
                type="button"
                className="fl-btn fl-btn--secondary"
                aria-expanded={composing}
                aria-controls="card-profile-compose"
                onClick={() => {
                  setSent(false);
                  setComposing(!composing);
                }}
              >
                Message
              </button>
            </div>
            <p className="fl-sr" aria-live="polite">
              {status}
            </p>

            {composing && (
              <form
                id="card-profile-compose"
                className="fl-crd-compose"
                noValidate
                onSubmit={send}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeCompose();
                }}
              >
                <div className="fl-field">
                  <label htmlFor="card-profile-note">{d.messageLabel}</label>
                  <textarea
                    id="card-profile-note"
                    className="fl-input"
                    rows={3}
                    style={{ minHeight: "6rem" }}
                    value={note}
                    autoFocus
                    onChange={(e) => setNote(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "card-profile-note-error" : "card-profile-note-hint"}
                  />
                  {error ? (
                    <p id="card-profile-note-error" className="fl-crd-error" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p id="card-profile-note-hint" className="fl-note" style={{ margin: 0 }}>
                      {d.messageHint}
                    </p>
                  )}
                </div>
                <div className="fl-actions">
                  <button type="submit" className="fl-btn fl-btn--primary">
                    Send note
                  </button>
                  <button type="button" className="fl-btn fl-btn--secondary" onClick={closeCompose}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
            <div aria-live="polite">{sent && <p className="fl-done" style={{ margin: 0 }}>{d.sent}</p>}</div>
          </div>
        </article>
      </div>
    </section>
  );
}
