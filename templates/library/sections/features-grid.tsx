/**
 * Features: icon grid. Six benefits as cards, each with an icon, a short title and one sentence. The default way to
 * explain what a product does. Make it the app's own: replace SAMPLE with the PRD's real capabilities (3 or 6 read
 * best); pick an icon from icons.tsx that fits each one.
 */
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Why it works",
  title: "Everything a busy studio needs, nothing it doesn't",
  lede: "Six things that save you an hour a day.",
  items: [
    { icon: "clock", title: "Book in seconds", text: "Clients see real availability and pick a time without a back-and-forth." },
    { icon: "bolt", title: "Automatic reminders", text: "A reminder the day before cuts no-shows without you lifting a finger." },
    { icon: "shield", title: "Deposits up front", text: "Hold a slot with a small deposit, refunded if you cancel." },
    { icon: "users", title: "Your whole team", text: "Each person keeps their own calendar; you see everyone at a glance." },
    { icon: "chart", title: "See what's busy", text: "Know your fullest days and quietest hours, week by week." },
    { icon: "globe", title: "Works anywhere", text: "Phone, tablet or laptop: the same calendar, always up to date." },
  ],
};

export default function FeaturesGrid() {
  const d = SAMPLE;
  return (
    <section className="fl-section" id="features" aria-labelledby="features-grid-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h2 id="features-grid-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <ul className="fl-grid fl-grid--3" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {d.items.map((f) => (
            <li key={f.title} className="fl-card">
              <span className="fl-icon">
                <Icon name={f.icon} />
              </span>
              <h3>{f.title}</h3>
              <p className="fl-text">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
