/** @flowcode-library nb-cards · Neobrutal cards (Neobrutalism kit)
 * Use cases: pricing card; profile card; feature card; plan picker; team member card; creator profile; bold product page
 * Jobs to be done: choose a plan; follow a person i like; learn about a key feature
 * Keywords: cards, pricing, profile, feature, sticker, neobrutalism
 */
/**
 * Neobrutalist cards: a feature card, a pricing card with a tilted sticker badge, and a profile card with a follow
 * toggle. Use them for a bold product page, a plan picker or a team page. Make it the app's own: replace SAMPLE with the
 * real feature, plan and person; the plan choice and follow state stay on the page.
 */
import { useState } from "react";
import { Icon, Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Cards",
  title: "Blocks with a bit of attitude",
  feature: {
    icon: "bolt",
    title: "Book in ten seconds",
    text: "Pick a class, pick a time, done. No account needed for your first visit.",
    link: "How booking works",
  },
  pricing: {
    sticker: "Most picked",
    name: "Studio pass",
    price: "$39",
    per: "/month",
    text: "Four classes a month at any of our two studios.",
    features: ["4 classes each month", "Free mat and apron", "Bring a friend once"],
    choose: "Choose Studio pass",
    chosen: "Studio pass chosen",
  },
  profile: {
    initials: "MO",
    name: "Mira Okafor",
    role: "Ceramics teacher",
    bio: "Teaches wheel throwing on weekday evenings. Twelve years at the studio.",
    stats: [
      { label: "Classes", value: "214" },
      { label: "Students", value: "1.3k" },
      { label: "Rating", value: "4.9" },
    ],
    followers: 318,
  },
};

export default function NbCards() {
  const d = SAMPLE;
  const [chosen, setChosen] = useState(false);
  const [following, setFollowing] = useState(false);
  const followers = d.profile.followers + (following ? 1 : 0);

  return (
    <section className="fl-section fl-section--tint fl-nb" aria-labelledby="nb-cards-title">
      <div className="fl-wrap fl-nb-stack">
        <div className="fl-head">
          <p className="fl-nb-kicker">{d.eyebrow}</p>
          <h2 id="nb-cards-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <ul className="fl-nb-cards">
          <li className="fl-nb-box fl-nb-card fl-nb-card--accent">
            <span className="fl-nb-tile">
              <Icon name={d.feature.icon} />
            </span>
            <h3>{d.feature.title}</h3>
            <p>{d.feature.text}</p>
            <a className="fl-nb-btn fl-nb-btn--sm fl-nb-btn--plain" href="#how-booking-works" style={{ justifySelf: "start" }}>
              {d.feature.link}
              <Icon name="arrow" />
            </a>
          </li>

          <li className={`fl-nb-box fl-nb-card${chosen ? " fl-nb-card--success fl-nb-card--selected" : ""}`} style={{ marginTop: "var(--space-4)" }}>
            <span className="fl-nb-sticker">{d.pricing.sticker}</span>
            <h3>{d.pricing.name}</h3>
            <p className="fl-nb-price">
              <strong>{d.pricing.price}</strong>
              <span>{d.pricing.per}</span>
            </p>
            <p>{d.pricing.text}</p>
            <ul className="fl-nb-list">
              {d.pricing.features.map((f) => (
                <li key={f}>
                  <Tick />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={`fl-nb-btn fl-nb-btn--block ${chosen ? "fl-nb-btn--secondary" : "fl-nb-btn--primary"}`}
              aria-pressed={chosen}
              onClick={() => setChosen(!chosen)}
            >
              {chosen && <Icon name="check" />}
              {chosen ? d.pricing.chosen : d.pricing.choose}
            </button>
            <p className="fl-nb-status" role="status" aria-live="polite">
              {chosen ? "Nice pick. Tap again to undo." : ""}
            </p>
          </li>

          <li className="fl-nb-box fl-nb-card">
            <div className="fl-nb-person">
              <span className="fl-nb-avatar" aria-hidden="true">
                {d.profile.initials}
              </span>
              <div style={{ display: "grid", gap: "var(--space-1)" }}>
                <h3>{d.profile.name}</h3>
                <span className="fl-nb-badge fl-nb-badge--square fl-nb-tone-info" style={{ justifySelf: "start" }}>
                  {d.profile.role}
                </span>
              </div>
            </div>
            <p>{d.profile.bio}</p>
            <dl className="fl-nb-stats">
              {d.profile.stats.map((s) => (
                <div key={s.label}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
            <div className="fl-nb-row" style={{ justifyContent: "space-between" }}>
              <span className="fl-meta" aria-live="polite">
                {followers} followers
              </span>
              <button
                type="button"
                className={`fl-nb-btn fl-nb-btn--sm ${following ? "fl-nb-btn--plain" : "fl-nb-btn--primary"}`}
                aria-pressed={following}
                onClick={() => setFollowing(!following)}
              >
                <Icon name={following ? "check" : "users"} />
                {following ? "Following" : `Follow ${d.profile.name.split(" ")[0]}`}
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>
  );
}
