/** @flowcode-library card-profile · Profile card (Cards)
 * Catalog ID: p.profile-card (pattern)
 * Function: The profile card pattern (p.profile-card): one person with a Follow toggle that bumps the follower count and a Message form with checks, a sent note and keyboard escape.
 * Use it as: import { ProfileCard } from "./card-profile"; <ProfileCard name role bio stats={[{ label, value }, { label, value }, { label: "Followers", value }]} messageLabel messageHint? sent="Sent." avatarSrc? onFollow?={(following) => ...} onSend?={(note) => ...} />
 * Built from: c.card.surface, c.avatar.person, c.button.primary, c.button.secondary, c.text-field.outlined
 * Look: A narrow card with a tinted cover band, an avatar overlapping it, name and role, a short bio, three centered numbers between rules, and Follow and Message buttons; Message opens a note form beneath.
 * Tokens: --color-surface --color-surface-sunken --color-border --color-accent --color-text-muted --color-danger --space-4 --space-6 --radius-md --font-display --text-xl --text-lg
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
import { Avatar } from "./avatars-variants";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { TextField } from "./text-fields-states";

// ── p.profile-card: one person with role, bio, three numbers, a Follow toggle and a Message form. ──

export type ProfileStat = { label: string; value: number };

export type ProfileCardProps = {
  name: string;
  /** Job and place: "Pottery teacher · Riverside Studio". */
  role: string;
  bio: string;
  /** Three numbers; the third is the follower count and goes up by one while Follow is on. */
  stats: ProfileStat[];
  /** Photo address; initials show without one. */
  avatarSrc?: string;
  /** The note field's label: "Your note to Maya". */
  messageLabel: string;
  messageHint?: string;
  /** Shown after a note is sent. */
  sent: string;
  /** Called when Follow turns on or off. */
  onFollow?: (following: boolean) => void;
  /** Called with the note text when it is sent. */
  onSend?: (note: string) => void;
};

export function ProfileCard({ name, role, bio, stats, avatarSrc, messageLabel, messageHint, sent: sentText, onFollow, onSend }: ProfileCardProps) {
  const [following, setFollowing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [status, setStatus] = useState("");
  const body = useRef<HTMLDivElement>(null);
  const focusMessage = () => body.current?.querySelector<HTMLElement>("[aria-controls]")?.focus();

  const followers = (stats[2]?.value ?? 0) + (following ? 1 : 0);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (!text) return setError("Write a note before sending.");
    if (text.length < 10) return setError("Add a little more, at least 10 characters.");
    setError("");
    setNote("");
    setComposing(false);
    setSent(true);
    onSend?.(text);
    focusMessage();
  };

  const closeCompose = () => {
    setComposing(false);
    setError("");
    focusMessage();
  };

  return (
    <section className="fl-section" aria-labelledby="card-profile-name" data-fl="p.profile-card">
      <div className="fl-wrap">
        <Card variant="surface" className="fl-crd-profile" role="group" aria-labelledby="card-profile-name">
          <div className="fl-crd-profile__cover" aria-hidden="true" />
          <div className="fl-crd-profile__body" ref={body}>
            <div className="fl-crd-profile__avatar">
              <Avatar name={name} src={avatarSrc} size={64} decorative />
            </div>
            <div className="fl-crd-profile__name">
              <h2 id="card-profile-name" className="fl-title fl-title--md">
                {name}
              </h2>
              <p>{role}</p>
            </div>
            <p className="fl-text">{bio}</p>
            <dl className="fl-crd-stats">
              {stats.map((s, i) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{(i === 2 ? followers : s.value).toLocaleString()}</dd>
                </div>
              ))}
            </dl>
            <div className="fl-crd-profile__actions">
              <Button
                variant="primary"
                size={40}
                aria-pressed={following}
                onClick={() => {
                  setFollowing(!following);
                  setStatus(following ? `You no longer follow ${name}.` : `You now follow ${name}.`);
                  onFollow?.(!following);
                }}
              >
                {following ? "Following" : "Follow"}
              </Button>
              <Button
                variant="secondary"
                size={40}
                aria-expanded={composing}
                aria-controls="card-profile-compose"
                onClick={() => {
                  setSent(false);
                  setComposing(!composing);
                }}
              >
                Message
              </Button>
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
                  <label htmlFor="card-profile-note">{messageLabel}</label>
                  <TextField
                    multiline
                    id="card-profile-note"
                    rows={3}
                    style={{ minHeight: "6rem" }}
                    value={note}
                    autoFocus
                    onChange={(e) => setNote(e.target.value)}
                    invalid={!!error}
                    aria-describedby={error ? "card-profile-note-error" : "card-profile-note-hint"}
                  />
                  {error ? (
                    <p id="card-profile-note-error" className="fl-crd-error" role="alert">
                      {error}
                    </p>
                  ) : (
                    <p id="card-profile-note-hint" className="fl-note" style={{ margin: 0 }}>
                      {messageHint}
                    </p>
                  )}
                </div>
                <div className="fl-actions">
                  <Button type="submit" variant="primary" size={40}>
                    Send note
                  </Button>
                  <Button variant="secondary" size={40} onClick={closeCompose}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
            <div aria-live="polite">{sent && <p className="fl-done" style={{ margin: 0 }}>{sentText}</p>}</div>
          </div>
        </Card>
      </div>
    </section>
  );
}

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

export default function CardProfile() {
  return <ProfileCard {...SAMPLE} />;
}
