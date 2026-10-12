/** @flowcode-library tooltips · Tooltips (arrow) (Alerts and states)
 * Catalog ID: c.tooltip@arrow (component version)
 * Version of: c.tooltip
 * Function: A week toolbar whose icon buttons show tooltips on hover and focus on all four sides, linked with aria-describedby and closed with Escape.
 * Use it as: import { Tooltip } from "./tooltips-variants"; <Tooltip version="arrow" tip="Go back a week" place?="top"|"bottom"|"left"|"right"><Button iconOnly ...>Previous week</Button></Tooltip>  // opens at once on hover and focus (delay defaults to 0); Escape shuts it
 * Look: A dark label with a small pointer toward the control, on any of the four sides, that appears the moment you point at an icon button or tab to it and fades out when you leave.
 * Tokens: --color-text --color-bg --radius-md --text-xs --space-2 --space-3 --duration-fast --easing
 * Use cases: toolbar hints; icon buttons; calendar toolbar; editor toolbar; field help; control explanations; accessibility hints
 * Jobs to be done: understand what an icon does; learn the controls without guessing; get a quick hint without leaving
 * Keywords: tooltip, hint, toolbar, icon buttons, accessibility
 */
/**
 * Tooltips: short hints on icon buttons that appear on hover and on keyboard focus, on any side (top, right, bottom,
 * left), stay open while the pointer is over them and close with Escape. This is c.tooltip@arrow with this piece's
 * sample content; the implementation lives in the component, in ./tooltips-variants. Each is linked with
 * aria-describedby. Use them to explain icon-only controls; never hide anything essential in a tooltip.
 * Make it the app's own: replace SAMPLE with your toolbar's actions and hints, and pick the side that has room.
 */
import { useState } from "react";
import { Button } from "./buttons-variants";
import { Tooltip } from "./tooltips-variants";

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
          <Tooltip version="arrow" place="right" tip={d.tips.prev.tip}>
            <Button variant="secondary" size={40} icon="chevron-left" iconOnly onClick={() => (setWeek(week - 1), setStatus(""))}>
              {d.tips.prev.label}
            </Button>
          </Tooltip>
          <Tooltip version="arrow" place="bottom" tip={d.tips.today.tip}>
            <Button variant="secondary" size={40} aria-disabled={week === 0} onClick={() => week !== 0 && (setWeek(0), setStatus(""))}>
              {d.tips.today.label}
            </Button>
          </Tooltip>
          <p className="fl-way-toolbar__label" aria-live="polite" style={{ margin: 0 }}>
            {fmt(start)} – {fmt(end)}
            <span className="fl-meta" style={{ display: "block", fontWeight: "var(--weight-regular)" }}>
              {base + (extra[week] ?? 0)} classes
            </span>
          </p>
          <Tooltip version="arrow" place="top" tip={d.tips.next.tip}>
            <Button variant="secondary" size={40} icon="chevron-right" iconOnly onClick={() => (setWeek(week + 1), setStatus(""))}>
              {d.tips.next.label}
            </Button>
          </Tooltip>
          <Tooltip version="arrow" place="left" tip={d.tips.add.tip}>
            <Button
              variant="secondary"
              size={40}
              icon="plus"
              iconOnly
              onClick={() => (setExtra((x) => ({ ...x, [week]: (x[week] ?? 0) + 1 })), setStatus("Draft class added to this week."))}
            >
              {d.tips.add.label}
            </Button>
          </Tooltip>
        </div>
        <div className="fl-actions" style={{ marginTop: "var(--space-4)", gap: "var(--space-2)" }}>
          <p className="fl-way-status" role="status" aria-live="polite">
            {status || `${extra[week] ?? 0} drafts this week`}
          </p>
          <Tooltip version="arrow" place="right" tip={d.helpTip}>
            <Button variant="tertiary" size={32} icon="help" iconOnly>
              {d.helpLabel}
            </Button>
          </Tooltip>
        </div>
      </div>
    </section>
  );
}
