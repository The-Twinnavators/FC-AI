/**
 * Features: checklist. A heading on one side, a two-column list of what's included on the other. Compact; good
 * below a hero or near pricing. Make it the app's own: replace SAMPLE with the real list (6 to 10 items).
 */
import { Tick } from "./icons";

// flowcode:sample
const SAMPLE = {
  title: "Included on every plan",
  lede: "No add-ons, no surprise fees.",
  items: ["Unlimited bookings", "Reminders by email and text", "Online deposits", "Team calendars", "Holiday and break blocking", "Weekly summary", "Export to your calendar", "Help from a real person"],
};

export default function FeaturesChecklist() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--tint" aria-labelledby="features-checklist-title">
      <div className="fl-wrap fl-split fl-split--start">
        <div className="fl-head" style={{ marginBottom: 0 }}>
          <h2 id="features-checklist-title" className="fl-title">
            {d.title}
          </h2>
          <p className="fl-lede">{d.lede}</p>
        </div>
        <ul className="fl-checks fl-grid--2" style={{ display: "grid", gap: "var(--space-4) var(--space-6)" }}>
          {d.items.map((item) => (
            <li key={item}>
              <Tick />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
