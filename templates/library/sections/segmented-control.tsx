/**
 * Segmented control: a row of three or four joined options where exactly one is chosen, with a description below
 * that explains the choice. Native radio buttons inside a fieldset, so arrow keys move between options. Use it for a
 * setting with a few clear levels.
 * Adapted from FlowCode's own UI (Branding page).
 * Make it the app's own: replace SAMPLE with your options and what each one means; save the choice where you need it.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Booking settings",
  title: "How new bookings are handled",
  legend: "Confirm bookings",
  options: [
    {
      id: "auto",
      label: "Hands-off",
      who: "auto",
      summary: "Bookings are confirmed straight away.",
      points: ["Clients get a confirmation email at once", "You see new bookings on your calendar", "Clashes are still blocked"],
    },
    {
      id: "ask",
      label: "Ask first",
      who: "both",
      summary: "You approve each booking before it is confirmed.",
      points: ["Clients see 'requested' until you approve", "You get a note for each new request", "Unanswered requests expire after two days"],
    },
    {
      id: "step",
      label: "Step by step",
      who: "you",
      summary: "You confirm the time, the price and the deposit yourself.",
      points: ["Nothing is sent to the client without you", "Good for custom shoots and quotes", "Takes the most of your time"],
    },
  ],
  savedText: (label: string) => `Saved: ${label}.`,
};

const STORE = "fl-segmented-control";

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

export default function SegmentedControl() {
  const d = SAMPLE;
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(STORE);
      if (v && d.options.some((o) => o.id === v)) return v;
    } catch {
      /* storage unavailable: use the default */
    }
    return d.options[1].id;
  });
  const [saved, setSaved] = useState("");
  const current = d.options.find((o) => o.id === value) ?? d.options[0];

  const choose = (id: string) => {
    setValue(id);
    try {
      localStorage.setItem(STORE, id);
    } catch {
      /* not saved; the choice still applies on this page */
    }
    const o = d.options.find((x) => x.id === id);
    if (o) setSaved(d.savedText(o.label));
  };

  return (
    <section className="fl-section" aria-labelledby="segmented-control-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="segmented-control-title" className="fl-title fl-title--md">
            {d.title}
          </h2>
        </div>
        <fieldset className="fl-ctl-seg-field">
          <legend>{d.legend}</legend>
          <div className="fl-ctl-seg">
            {d.options.map((o) => (
              <label key={o.id} className="fl-ctl-seg__opt">
                <input
                  type="radio"
                  name="segmented-control"
                  value={o.id}
                  checked={value === o.id}
                  onChange={() => choose(o.id)}
                  aria-describedby="segmented-control-desc"
                />
                <span style={{ display: "inline-flex", gap: "1px" }}>
                  {o.who !== "auto" ? <PersonIcon /> : null}
                  {o.who !== "you" ? <BoltIcon /> : null}
                </span>
                {o.label}
              </label>
            ))}
          </div>
          <div id="segmented-control-desc" className="fl-ctl-seg-desc" aria-live="polite">
            <strong>{current.summary}</strong>
            <ul>
              {current.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </fieldset>
        <p className="fl-sr" aria-live="polite">
          {saved}
        </p>
      </div>
    </section>
  );
}
