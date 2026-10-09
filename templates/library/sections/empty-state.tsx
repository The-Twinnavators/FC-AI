/** @flowcode-library empty-state · Empty list state (Alerts and states)
 * Use cases: empty list; first run; no projects yet; empty inbox; no tasks; empty cart; onboarding start; no saved items
 * Jobs to be done: add my first item; understand what goes here; get started with the product; know what to do next
 * Keywords: empty state, list, onboarding, zero data
 */
/**
 * Empty state: what a list shows before it has anything in it. A simple drawing, a title, a line that says what the
 * list is for, and one primary action that adds the first item; the list then appears, and removing every item brings
 * the empty state back. Make it the app's own: replace SAMPLE with the real list's words and swap the add action for
 * the app's own create flow.
 */
import { useEffect, useRef, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Your shopping list",
  empty: {
    title: "Nothing on the list yet",
    text: "Add what the house needs this week. Everyone at home sees the same list, so nobody buys milk twice.",
    action: "Add your first item",
  },
  suggestions: [
    { name: "Oat milk", note: "2 cartons" },
    { name: "Washing-up liquid", note: "The unscented one" },
    { name: "Sourdough loaf", note: "From the bakery on the corner" },
    { name: "Bin bags", note: "Large, 30 pack" },
  ],
  addMore: "Add another",
};

export default function EmptyState() {
  const d = SAMPLE;
  const [items, setItems] = useState<{ id: number; name: string; note: string }[]>([]);
  const [status, setStatus] = useState("");
  const nextId = useRef(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emptyActionRef = useRef<HTMLButtonElement>(null);
  const prevCount = useRef(0);

  // Move focus sensibly when the view swaps between empty and filled.
  useEffect(() => {
    if (prevCount.current === 0 && items.length === 1) headingRef.current?.focus();
    if (prevCount.current > 0 && items.length === 0) emptyActionRef.current?.focus();
    prevCount.current = items.length;
  }, [items.length]);

  const add = () => {
    const s = d.suggestions[(nextId.current - 1) % d.suggestions.length];
    setItems((all) => [...all, { id: nextId.current++, ...s }]);
    setStatus(`Added ${s.name}.`);
  };
  const remove = (id: number, name: string) => {
    setItems((all) => all.filter((i) => i.id !== id));
    setStatus(`Removed ${name}.`);
  };

  return (
    <section className="fl-section" aria-labelledby="empty-state-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-alr-empty__head">
          <h2 id="empty-state-title" className="fl-title fl-title--md" ref={headingRef} tabIndex={-1} style={{ outline: "none" }}>
            {d.title}
          </h2>
          {items.length > 0 && (
            <button type="button" className="fl-btn fl-btn--primary" onClick={add}>
              {d.addMore}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="fl-alr-empty">
            <svg className="fl-alr-empty__art" viewBox="0 0 160 120" aria-hidden="true">
              <ellipse cx="80" cy="108" rx="58" ry="7" style={{ fill: "var(--color-surface-sunken)" }} />
              <rect x="38" y="18" width="84" height="88" rx="10" style={{ fill: "var(--color-surface)", stroke: "var(--color-border-strong)", strokeWidth: 2 }} />
              <rect x="62" y="10" width="36" height="16" rx="6" style={{ fill: "color-mix(in srgb, var(--color-accent) 22%, var(--color-surface))", stroke: "var(--color-accent)", strokeWidth: 2 }} />
              {[44, 62, 80].map((y, i) => (
                <g key={y}>
                  <rect x="52" y={y - 5} width="10" height="10" rx="3" style={{ fill: "none", stroke: "var(--color-border-strong)", strokeWidth: 2 }} />
                  <rect x="70" y={y - 3} width={i === 1 ? 26 : 38} height="6" rx="3" style={{ fill: "var(--color-surface-sunken)" }} />
                </g>
              ))}
              <circle cx="124" cy="92" r="16" style={{ fill: "var(--color-accent)" }} />
              <path d="M124 85v14M117 92h14" style={{ stroke: "var(--color-on-accent)", strokeWidth: 3, strokeLinecap: "round" }} />
            </svg>
            <h3 className="fl-title fl-title--md" style={{ fontSize: "var(--text-lg)" }}>
              {d.empty.title}
            </h3>
            <p className="fl-text">{d.empty.text}</p>
            <button ref={emptyActionRef} type="button" className="fl-btn fl-btn--primary" onClick={add}>
              {d.empty.action}
            </button>
          </div>
        ) : (
          <ul className="fl-alr-empty__list" aria-label={`${items.length} ${items.length === 1 ? "item" : "items"} on the list`}>
            {items.map((i) => (
              <li key={i.id}>
                <span className="fl-tick" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
                <div>
                  <strong>{i.name}</strong>
                  <span className="fl-meta">{i.note}</span>
                </div>
                <button type="button" className="fl-alr__close" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id, i.name)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="fl-meta" role="status" aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
          {status}
        </p>
      </div>
    </section>
  );
}
