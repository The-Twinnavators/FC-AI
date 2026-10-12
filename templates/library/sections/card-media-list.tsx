/** @flowcode-library card-media-list · Media list cards (Cards)
 * Catalog ID: p.media-list (pattern)
 * Function: The media list pattern (p.media-list): listing cards with a save heart that persists in the browser and an All / Saved switch with an empty state; the reference sheet shows three courses.
 * Use it as: import { MediaList } from "./card-media-list"; <MediaList title eyebrow? storageKey="my-saved" items={[{ id, title, summary, meta: ["6 weeks"], tags: ["Beginner"], alt, image? }]} onSave?={(id, saved) => ...} />
 * Built from: c.card.surface, c.media-frame, c.chip.static, c.button.tertiary, c.button.secondary, c.empty-state.first-use
 * Look: A column of wide cards, each with a square picture at the left, a title, summary, a line of facts and small tags, and a heart button at the right that fills red when saved; an All / Saved switch sits above.
 * Tokens: --color-surface --color-border --color-danger --color-danger-surface --color-text-muted --color-surface-sunken --space-2 --space-4 --space-5 --radius-md --text-lg --text-sm
 * Use cases: listings; property listings; course catalog; event list; recipe list; job listings; saved items; travel destinations; podcast episodes
 * Jobs to be done: browse listings with details; save items to come back to; see only my saved items; find the one that fits me
 * Keywords: list, media, listing, favorites, saved
 */
/**
 * Cards: media list. Wide cards in a column, each with a picture on the left, a title, a short summary, details and
 * tags, plus a heart to save it. A switch shows only saved ones. Use for classes, recipes, guides or listings. Make it
 * the app's own: replace SAMPLE with the real items (and real photos with alt text); saved items stay in this browser.
 */
import { useEffect, useState } from "react";
import { Button } from "./buttons-variants";
import { Card } from "./cards-variants";
import { Chip } from "./chips-tags";
import { EmptyState } from "./empty-states";
import { MediaFrame, type MediaArt } from "./media-frames";

// ── p.media-list: wide cards, each a picture, title, summary, details and tags, with a heart to save it and an All/Saved switch. ──

export type MediaListItem = {
  id: string;
  title: string;
  summary: string;
  /** Short facts: "6 weeks", "$180". */
  meta: string[];
  tags: string[];
  /** Describes the picture (and names it when there is no image). */
  alt: string;
  /** Picture address; a gradient picture shows without one. */
  image?: string;
};

export type MediaListProps = {
  eyebrow?: string;
  title: string;
  items: MediaListItem[];
  /** Where saved ids are kept in this browser. */
  storageKey: string;
  /** Called when an item is saved or unsaved. */
  onSave?: (id: string, saved: boolean) => void;
};

const ART: MediaArt[] = ["a", "b", "c", "d", "e"];

function loadSaved(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function MediaList({ eyebrow, title, items, storageKey, onSave }: MediaListProps) {
  const [saved, setSaved] = useState<string[]>(() => loadSaved(storageKey));
  const [onlySaved, setOnlySaved] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      /* storage blocked: keep it in memory */
    }
  }, [saved, storageKey]);

  const toggle = (id: string, name: string) => {
    const isSaved = saved.includes(id);
    setSaved(isSaved ? saved.filter((s) => s !== id) : [...saved, id]);
    setStatus(isSaved ? `${name} removed from saved.` : `${name} saved.`);
    onSave?.(id, !isSaved);
  };

  const shown = onlySaved ? items.filter((i) => saved.includes(i.id)) : items;

  return (
    <section className="fl-section" aria-labelledby="card-media-list-title" data-fl="p.media-list">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-crd-bar">
          <div className="fl-head" style={{ marginBottom: 0 }}>
            {eyebrow ? <span className="fl-eyebrow">{eyebrow}</span> : null}
            <h2 id="card-media-list-title" className="fl-title fl-title--md">
              {title}
            </h2>
          </div>
          <div className="fl-toggle" role="group" aria-label="Show">
            <button type="button" aria-pressed={!onlySaved} onClick={() => setOnlySaved(false)}>
              All ({items.length})
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
          <div role="status">
            <EmptyState
              variant="first-use"
              icon="heart"
              title="Nothing saved yet"
              action={
                <Button variant="secondary" onClick={() => setOnlySaved(false)}>
                  Show all
                </Button>
              }
            >
              Tap the heart on an item to keep it here for later.
            </EmptyState>
          </div>
        ) : (
          <ul className="fl-crd-list" style={{ display: "grid", gap: "var(--space-4)" }}>
            {shown.map((item, n) => {
              const isSaved = saved.includes(item.id);
              return (
                <li key={item.id} style={{ display: "grid" }}>
                  <Card variant="surface" className="fl-crd-media">
                    <div {...(item.image ? {} : { role: "img", "aria-label": item.alt })}>
                      <MediaFrame ratio="1-1" src={item.image} alt={item.alt} art={ART[n % ART.length]} />
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
                          <li key={t}>
                            <Chip variant="static" size={24}>
                              {t}
                            </Chip>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button
                      variant="tertiary"
                      size={40}
                      icon="heart"
                      iconOnly
                      className="fl-crd-save"
                      aria-pressed={isSaved}
                      aria-label={`Save ${item.title}`}
                      onClick={() => toggle(item.id, item.title)}
                    >
                      Save
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

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
      tags: ["Intermediate", "Color"],
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

export default function CardMediaList() {
  return <MediaList {...SAMPLE} />;
}
