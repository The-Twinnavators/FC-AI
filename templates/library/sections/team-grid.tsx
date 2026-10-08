/**
 * Team: grid. The people behind the product, with a role and one line each. Make it the app's own: use only people
 * the PRD names; swap the initials for real photos (with alt text) when there are some.
 */
// flowcode:sample
const SAMPLE = {
  eyebrow: "The team",
  title: "Small team, big on care",
  people: [
    { name: "Jordan Lee", role: "Founder", text: "Ran a studio for eight years before building this." },
    { name: "Sam Patel", role: "Design", text: "Makes sure every screen feels calm." },
    { name: "Alex Kim", role: "Engineering", text: "Keeps your bookings fast and safe." },
    { name: "Rosa Diaz", role: "Support", text: "Answers every message, usually within the hour." },
  ],
};

const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("");

export default function TeamGrid() {
  const d = SAMPLE;
  return (
    <section className="fl-section" aria-labelledby="team-grid-title">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          <span className="fl-eyebrow">{d.eyebrow}</span>
          <h2 id="team-grid-title" className="fl-title">
            {d.title}
          </h2>
        </div>
        <ul className="fl-grid fl-grid--4" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {d.people.map((p) => (
            <li key={p.name} className="fl-card" style={{ textAlign: "center", justifyItems: "center" }}>
              <span className="fl-person__avatar" aria-hidden="true" style={{ width: "4.5rem", height: "4.5rem", fontSize: "var(--text-lg)" }}>
                {initials(p.name)}
              </span>
              <h3>{p.name}</h3>
              <span className="fl-eyebrow">{p.role}</span>
              <p className="fl-text">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
