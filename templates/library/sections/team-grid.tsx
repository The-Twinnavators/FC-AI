/** @flowcode-library team-grid · Team grid (Team)
 * Catalog ID: b.team-grid (block)
 * Function: The team grid block (b.team-grid): the people behind the product, with a role and a line each.
 * Use it as: import { TeamGrid } from "./team-grid"; <TeamGrid title eyebrow? people={[{name,role,text,photo?}]} />
 * Built from: c.avatar.person
 * Look: A centered heading above four columns of centered cards, each with a round avatar, a bold name, an eyebrow role and a muted sentence.
 * Tokens: --space-6 --space-9 --type-h3-size --color-surface --color-border --color-accent --color-text-muted
 * Use cases: team page; about us; meet the team; staff directory; leadership; our people; board members; speakers
 * Jobs to be done: see who is behind the product; find the right person to contact; trust the company by knowing the people; learn what each person does
 * Keywords: team, about, people, staff
 */
/**
 * Team: grid. The people behind the product, with a role and one line each. Make it the app's own: use only people
 * the PRD names; swap the initials for real photos (with alt text) when there are some.
 */
import { Avatar } from "./avatars-variants";

export type TeamGridProps = {
  eyebrow?: string;
  title: string;
  /** Each person: name, role, one line about them, and an optional photo address (initials show without one). */
  people: { name: string; role: string; text: string; photo?: string }[];
};

export function TeamGrid({ eyebrow, title, people }: TeamGridProps) {
  return (
    <section className="fl-section" aria-labelledby="team-grid-title" data-fl="b.team-grid">
      <div className="fl-wrap">
        <div className="fl-head fl-head--center">
          {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
          <h2 id="team-grid-title" className="fl-title">
            {title}
          </h2>
        </div>
        <ul className="fl-grid fl-grid--4" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {people.map((p) => (
            <li key={p.name} className="fl-card" style={{ textAlign: "center", justifyItems: "center" }}>
              <Avatar name={p.name} size={72} src={p.photo} decorative />
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

// flowcode:sample
const SAMPLE: TeamGridProps = {
  eyebrow: "The team",
  title: "Small team, big on care",
  people: [
    { name: "Jordan Lee", role: "Founder", text: "Ran a studio for eight years before building this." },
    { name: "Sam Patel", role: "Design", text: "Makes sure every screen feels calm." },
    { name: "Alex Kim", role: "Engineering", text: "Keeps your bookings fast and safe." },
    { name: "Rosa Diaz", role: "Support", text: "Answers every message, usually within the hour." },
  ],
};

export default function TeamGridPreview() {
  return <TeamGrid {...SAMPLE} />;
}
