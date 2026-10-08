/**
 * Gradient hero: a dark panel with a "New" announcement pill, a light display heading with one phrase in a gradient,
 * a short lede and two actions. Good for a product's front page or the top of a launch page. Make it the app's own:
 * replace SAMPLE with the real announcement, headline and actions; the panel stays dark in light and dark styles.
 * Adapted from FlowCode's own UI (Branding page).
 */
import { useState } from "react";
import { Icon } from "./icons";

// flowcode:sample
const SAMPLE = {
  badge: "New",
  announcement: "Book a whole term of classes in one go",
  before: "Turn a free evening into a",
  emphasis: "class you'll love",
  after: "",
  lede: "Find small-group workshops near you, see which seats are left and book in under a minute. No account needed to look around.",
  primary: "Find a class",
  secondary: "See how it works",
  notes: {
    announcement: "Term booking: pick a class once and every week is held for you.",
    primary: "Showing classes near you…",
    secondary: "Three steps: choose, book, turn up.",
  },
};

export default function HeroGradient() {
  const d = SAMPLE;
  const [note, setNote] = useState("");
  return (
    <section className="fl-section" aria-labelledby="hero-gradient-title">
      <div className="fl-wrap">
        <div className="fl-brd-hero">
          <a className="fl-brd-eyebrow" href="#news" onClick={(e) => { e.preventDefault(); setNote(d.notes.announcement); }}>
            <b>{d.badge}</b>
            <span>{d.announcement}</span>
          </a>
          <h1 id="hero-gradient-title" className="fl-brd-hero__title">
            {d.before} <span className="fl-brd-grad">{d.emphasis}</span>
            {d.after ? ` ${d.after}` : ""}
          </h1>
          <p className="fl-brd-hero__lede">{d.lede}</p>
          <div className="fl-actions" style={{ marginTop: 0 }}>
            <button type="button" className="fl-btn fl-btn--primary" onClick={() => setNote(d.notes.primary)}>
              {d.primary}
              <Icon name="arrow" />
            </button>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setNote(d.notes.secondary)}>
              {d.secondary}
            </button>
          </div>
          <p className="fl-brd-hero__note" role="status" aria-live="polite">
            {note}
          </p>
        </div>
      </div>
    </section>
  );
}
