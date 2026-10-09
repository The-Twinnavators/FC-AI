/** @flowcode-library tooltips · Tooltips (Tabs, breadcrumbs and paging)
 * Use cases: toolbar hints; icon buttons; calendar toolbar; editor toolbar; field help; control explanations; accessibility hints
 * Jobs to be done: understand what an icon does; learn the controls without guessing; get a quick hint without leaving
 * Keywords: tooltip, hint, toolbar, icon buttons, accessibility
 */
/**
 * Tooltips: short hints on icon buttons that appear on hover and on keyboard focus, on any side (top, right, bottom,
 * left), stay open while the pointer is over them and close with Escape. Each is linked with aria-describedby. Use them
 * to explain icon-only controls; never hide anything essential in a tooltip.
 * Make it the app's own: replace SAMPLE with your toolbar's actions and hints, and pick the side that has room.
 */
import { useEffect, useId, useState, type ReactNode } from "react";

// flowcode:sample
const SAMPLE = {
  eyebrow: "Timetable",
  title: "Week at the studio",
  toolbarLabel: "Week controls",
  weekStart: "2026-11-09",
  classesPerWeek: [5, 7, 4, 6],
  tips: {
    prev: { label: "Previous week", tip: "Go back a week" },
    today: { label: "This week", tip: "Jump back to the current week" },
    next: { label: "Next week", tip: "Go forward a week" },
    add: { label: "Add a class", tip: "Add a draft class to this week. Nobody can book it until you publish it." },
  },
  helpLabel: "About drafts",
  helpTip: "Drafts are only visible to the studio team.",
};

type Side = "top" | "right" | "bottom" | "left";

function Tooltip({ side, text, children }: { side: Side; text: ReactNode; children: (describedBy: string) => ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  // Escape hides the tooltip wherever focus is, without moving focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span
      className="fl-way-tip-wrap"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children(id)}
      <span id={id} role="tooltip" className={`fl-way-tip fl-way-tip--${side}`} data-open={open}>
        {text}
      </span>
    </span>
  );
}

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function Tooltips() {
  const d = SAMPLE;
  const [week, setWeek] = useState(0);
  const [extra, setExtra] = useState<Record<number, number>>({});
  const [status, setStatus] = useState("");

  const start = new Date(`${d.weekStart}T00:00:00`);
  start.setDate(start.getDate() + week * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const base = d.classesPerWeek[((week % d.classesPerWeek.length) + d.classesPerWeek.length) % d.classesPerWeek.length];
  const count = base + (extra[week] ?? 0);

  const hint = (t: { tip: string }) => t.tip;
  const move = (w: number) => {
    setWeek(w);
    setStatus("");
  };

  return (
    <section className="fl-section fl-section--tint" aria-labelledby="tooltips-title">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <p className="fl-eyebrow">{d.eyebrow}</p>
          <h2 id="tooltips-title" className="fl-title">
            {d.title}
          </h2>
        </div>

        <div className="fl-way-toolbar" role="group" aria-label={d.toolbarLabel}>
          <Tooltip side="right" text={hint(d.tips.prev)}>
            {(id) => (
              <button type="button" className="fl-way-icon-btn" aria-label={d.tips.prev.label} aria-describedby={id} onClick={() => move(week - 1)}>
                <Svg d="M15 6l-6 6 6 6" />
              </button>
            )}
          </Tooltip>
          <Tooltip side="bottom" text={hint(d.tips.today)}>
            {(id) => (
              <button type="button" className="fl-way-btn-sm" aria-describedby={id} aria-disabled={week === 0} onClick={() => week !== 0 && move(0)} style={week === 0 ? { opacity: "var(--disabled-opacity)", cursor: "not-allowed" } : undefined}>
                {d.tips.today.label}
              </button>
            )}
          </Tooltip>
          <p className="fl-way-toolbar__label" aria-live="polite" style={{ margin: 0 }}>
            {fmt(start)} – {fmt(end)}
            <span className="fl-meta" style={{ display: "block", fontWeight: "var(--weight-regular)" }}>
              {count} classes
            </span>
          </p>
          <Tooltip side="top" text={hint(d.tips.next)}>
            {(id) => (
              <button type="button" className="fl-way-icon-btn" aria-label={d.tips.next.label} aria-describedby={id} onClick={() => move(week + 1)}>
                <Svg d="M9 6l6 6-6 6" />
              </button>
            )}
          </Tooltip>
          <Tooltip side="left" text={hint(d.tips.add)}>
            {(id) => (
              <button
                type="button"
                className="fl-way-icon-btn"
                aria-label={d.tips.add.label}
                aria-describedby={id}
                onClick={() => {
                  setExtra((x) => ({ ...x, [week]: (x[week] ?? 0) + 1 }));
                  setStatus("Draft class added to this week.");
                }}
              >
                <Svg d="M12 5v14M5 12h14" />
              </button>
            )}
          </Tooltip>
        </div>

        <div className="fl-actions" style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
          <p className="fl-way-status" role="status" aria-live="polite">
            {status || `${extra[week] ?? 0} drafts this week`}
          </p>
          <Tooltip side="right" text={d.helpTip}>
            {(id) => (
              <button type="button" className="fl-way-help" aria-label={d.helpLabel} aria-describedby={id}>
                <Svg d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" />
              </button>
            )}
          </Tooltip>
        </div>
      </div>
    </section>
  );
}
