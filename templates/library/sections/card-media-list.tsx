/** @flowcode-library card-media-list · Media list cards (Cards)
 * Use cases: listings; property listings; course catalog; event list; recipe list; job listings; saved items; travel destinations; podcast episodes
 * Jobs to be done: browse listings with details; save items to come back to; see only my saved items; find the one that fits me
 * Keywords: list, media, listing, favourites, saved
 */
/**
 * Cards: media list. Wide cards in a column, each with a picture on the left, a title, a short summary, details and
 * tags, plus a heart to save it. A switch shows only saved ones. Use for classes, recipes, guides or listings. Make it
 * the app's own: replace SAMPLE with the real items (and real photos with alt text); saved items stay in this browser.
 */
import { useEffect, useState } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Classes",
  title: "Short courses this season",
  storageKey: "fl-crd-media-saved",
  items: [
    {
      id: "wheel",
      title: "Wheel throwing for beginners",
      summary: "Center clay, pull your first walls and leave with three pots ready for glazing.",
      meta: ["6 weeks", "Tuesdays 6:30 pm", "$180"],
      tags: ["Beginner", "Clay"],
      alt: "Hands shaping a pot on a spinning wheel",
    },
    {
      id: "glaze",
      title: "Glazing and finishing",
      summary: "Mix, dip and layer glazes, then see how each one changes in the kiln.",
      meta: ["4 weeks", "Saturdays 10 am", "$140"],
      tags: ["Intermediate", "Colour"],
      alt: "A row of glazed bowls in blues and greens",
    },
    {
      id: "hand",
      title: "Hand building at home",
      summary: "Pinch, coil and slab techniques you can keep practising at the kitchen table.",
      meta: ["3 weeks", "Thursdays 7 pm", "$95"],
      tags: ["Beginner", "No wheel"],
      alt: "A coiled clay planter drying on a table",
    },
  ],
};

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
    </svg>
  );
}

function loadSaved(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function CardMediaList() {
  const d = SAMPLE;
  const [saved, setSaved] = useState<string[]>(() => loadSaved(d.storageKey));
  const [onlySaved, setOnlySaved] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(d.storageKey, JSON.stringify(saved));
    } catch {
      /* storage blocked: keep it in memory */
    }
  }, [saved, d.storageKey]);

  const toggle = (id: string, title: string) => {
    const isSaved = saved.includes(id);
    setSaved(isSaved ? saved.filter((s) => s !== id) : [...saved, id]);
    setStatus(isSaved ? `${title} removed from saved.` : `${title} saved.`);
  };

  const shown = onlySaved ? d.items.filter((i) => saved.includes(i.id)) : d.items;

  return (
    <section className="fl-section" aria-labelledby="card-media-list-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-crd-bar">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            <span className="fl-eyebrow">{d.eyebrow}</span>
            <h2 id="card-media-list-title" className="fl-title fl-title--md">
              {d.title}
            </h2>
          </div>
          <div className="fl-toggle" role="group" aria-label="Show">
            <button type="button" aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>
              All ({d.items.length})
            </button>
            <button type="button" aria-pressed={onlySaved} onClick={() => setOnlySaved(true)}>
              Saved ({saved.length})
            </button>
          </div>
        </div>

        <p className="fl-sr" aria-live="polite">
          {status}
        </p>

        {shown.length === 0 ? (
          <div className="fl-crd-empty" role="status">
            <strong>Nothing saved yet</strong>
            <p>Tap the heart on a class to keep it here for later.</p>
            <button type="button" className="fl-btn fl-btn--secondary" onClick={() => setOnlySaved(false)}>
              Show all classes
            </button>
          </div>
        ) : (
          <ul className="fl-crd-list" style={{ display: "grid", gap: "var(--space-4)" }}>
            {shown.map((item) => {
              const isSaved = saved.includes(item.id);
              return (
                <li key={item.id} className="fl-card fl-crd-media">
                  <div className="fl-media" role="img" aria-label={item.alt}>
                    <span aria-hidden="true">{item.alt}</span>
                  </div>
                  <div className="fl-crd-media__body">
                    <h3>{item.title}</h3>
                    <p className="fl-text">{item.summary}</p>
                    <p className="fl-crd-media__meta">
                      {item.meta.map((m) => (
                        <span key={m}>{m}</span>
                      ))}
                    </p>
                    <ul className="fl-crd-tags" aria-label="Tags">
                      {item.tags.map((t) => (
                        <li key={t} className="fl-crd-tag">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="fl-crd-iconbtn"
                    aria-pressed={isSaved}
                    aria-label={`Save ${item.title}`}
                    onClick={() => toggle(item.id, item.title)}
                  >
                    <HeartIcon />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
