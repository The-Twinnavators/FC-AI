/** @flowcode-library tabs-underline · Underline tabs (Navigation)
 * Use cases: section tabs; profile tabs; inbox folders; order status tabs; settings sections; project views; dashboard views
 * Jobs to be done: switch between views quickly; see how many items are in each group; find the right section of a page
 * Keywords: tabs, underline, navigation, counts
 */
/**
 * Underline tabs: accessible tabs with an underline that slides to the active tab, optional count badges, and arrow
 * keys, Home and End to move between them. Use it to split one page into a few views of the same thing.
 * Adapted from FlowCode's own UI (Branding page).
 * Make it the app's own: replace SAMPLE with your tabs and their content; counts are optional per tab.
 */
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Household",
  title: "Chores this week",
  tabsLabel: "Chores",
  emptyText: "Nothing here. Enjoy the free time.",
  tabs: [
    { id: "today", label: "Today", items: ["Water the plants", "Take the recycling out", "Book the boiler check"] },
    { id: "week", label: "This week", items: ["Clean the oven", "Change the bed sheets", "Pay the window cleaner", "Sort the post", "Defrost the freezer"] },
    { id: "later", label: "Later", items: ["Paint the hallway", "Clear out the shed"] },
    { id: "done", label: "Done", items: [] as string[], noCount: true },
  ],
};

export default function TabsUnderline() {
  const d = SAMPLE;
  const [active, setActive] = useState(d.tabs[0].id);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [bar, setBar] = useState({ x: 0, w: 0 });

  // Move the underline under the active tab, and keep it there when the layout changes.
  useLayoutEffect(() => {
    const place = () => {
      const i = d.tabs.findIndex((t) => t.id === active);
      const el = refs.current[i];
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    refs.current.forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [active, d.tabs]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = d.tabs.length;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setActive(d.tabs[next].id);
    refs.current[next]?.focus();
    refs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <section className="fl-section" aria-labelledby="tabs-underline-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="tabs-underline-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-ctl-tabs">
          <div className="fl-ctl-tablist" role="tablist" aria-label={d.tabsLabel}>
            {d.tabs.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                className="fl-ctl-tab"
                id={`tabs-underline-tab-${t.id}`}
                aria-selected={active === t.id}
                aria-controls={`tabs-underline-panel-${t.id}`}
                tabIndex={active === t.id ? 0 : -1}
                onClick={() => setActive(t.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {t.label}
                {"noCount" in t ? null : (
                  <span className="fl-ctl-tab__count">
                    {t.items.length}
                    <span className="fl-sr"> items</span>
                  </span>
                )}
              </button>
            ))}
            <span className="fl-ctl-tabs__bar" aria-hidden="true" style={{ transform: `translateX(${bar.x}px)`, width: bar.w }} />
          </div>
        </div>

        {d.tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`tabs-underline-panel-${t.id}`}
            aria-labelledby={`tabs-underline-tab-${t.id}`}
            hidden={active !== t.id}
            tabIndex={0}
            className="fl-ctl-panel"
          >
            {t.items.length === 0 ? (
              <p className="fl-ctl-empty">{d.emptyText}</p>
            ) : (
              <ul className="fl-ctl-list">
                {t.items.map((x) => (
                  <li key={x} className="fl-ctl-row" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
                    <span className="fl-ctl-led fl-ctl-tone-progress" aria-hidden="true" />
                    <p className="fl-ctl-row__title">{x}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
