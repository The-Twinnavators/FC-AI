/**
 * Pill tabs: rounded tabs with live counts and one tab panel, operated with arrow keys, Home and End (roving
 * tabindex). Use it to sort one list into a few stages, such as orders that are new, ready or collected.
 * Make it the app's own: replace SAMPLE with your stages and items; the action on each row moves it to the next stage.
 */
import { useRef, useState, type KeyboardEvent } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Click and collect",
  title: "Orders to pack",
  tabsLabel: "Order stages",
  stages: [
    { id: "new", label: "New", action: "Mark packed", empty: "No new orders. New ones show up here." },
    { id: "ready", label: "Ready to collect", action: "Mark collected", empty: "Nothing is waiting on the shelf." },
    { id: "collected", label: "Collected", action: "", empty: "No orders collected yet today." },
  ],
  orders: [
    { id: "A-2041", name: "Ana Ruiz", items: "2 speckled mugs, 1 bowl", stage: "new" },
    { id: "A-2042", name: "Tom Okafor", items: "Glaze sampler set", stage: "new" },
    { id: "A-2043", name: "Mei Lin", items: "Serving platter", stage: "new" },
    { id: "A-2039", name: "Sam Patel", items: "4 espresso cups", stage: "ready" },
    { id: "A-2040", name: "Jo Byrne", items: "Plant pot, saucer", stage: "ready" },
  ],
};

export default function TabsPills() {
  const d = SAMPLE;
  const [active, setActive] = useState(d.stages[0].id);
  const [orders, setOrders] = useState(d.orders);
  const [status, setStatus] = useState("");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = d.stages.length;
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % n;
    else if (e.key === "ArrowLeft") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    setActive(d.stages[next].id);
    tabs.current[next]?.focus();
    tabs.current[next]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const advance = (id: string) => {
    const i = d.stages.findIndex((s) => s.id === active);
    const to = d.stages[i + 1];
    if (!to) return;
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, stage: to.id } : o)));
    setStatus(`Order ${id} moved to ${to.label}.`);
  };

  const stage = d.stages.find((s) => s.id === active)!;
  const shown = orders.filter((o) => o.stage === active);

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="tabs-pills-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="tabs-pills-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-way-pills" role="tablist" aria-label={d.tabsLabel}>
          {d.stages.map((s, i) => {
            const n = orders.filter((o) => o.stage === s.id).length;
            return (
              <button
                key={s.id}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                className="fl-way-pill"
                id={`tabs-pills-tab-${s.id}`}
                aria-selected={active === s.id}
                aria-controls={`tabs-pills-panel-${s.id}`}
                tabIndex={active === s.id ? 0 : -1}
                onClick={() => setActive(s.id)}
                onKeyDown={(e) => onKey(e, i)}
              >
                {s.label}
                <span className="fl-way-pill__count">
                  {n}
                  <span className="fl-sr"> orders</span>
                </span>
              </button>
            );
          })}
        </div>

        {d.stages.map((s) => (
          <div
            key={s.id}
            role="tabpanel"
            id={`tabs-pills-panel-${s.id}`}
            aria-labelledby={`tabs-pills-tab-${s.id}`}
            hidden={active !== s.id}
            tabIndex={0}
            className="fl-way-panel"
          >
            {active !== s.id ? null : shown.length === 0 ? (
              <div className="fl-way-empty">
                <p>{stage.empty}</p>
              </div>
            ) : (
              <ul className="fl-way-list">
                {shown.map((o) => (
                  <li key={o.id}>
                    <div className="fl-way-list__main">
                      <p className="fl-way-list__title">
                        {o.name} <span className="fl-way-num">{o.id}</span>
                      </p>
                      <p className="fl-way-list__meta">{o.items}</p>
                    </div>
                    {stage.action ? (
                      <button type="button" className="fl-way-btn-sm" onClick={() => advance(o.id)} aria-label={`${stage.action}: order ${o.id}`}>
                        {stage.action}
                      </button>
                    ) : (
                      <span className="fl-meta">Done</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        <p className="fl-way-status" role="status" aria-live="polite" style={{ marginTop: "var(--space-3)" }}>
          {status}
        </p>
      </div>
    </section>
  );
}
