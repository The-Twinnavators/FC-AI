/** @flowcode-library chips-tags · Chips and tags: filters, choices and labels (Forms)
 * Catalog ID: c.chip (component)
 * Function: The chip component (c.chip): the reference sheet shows filter, input and static chips in every state, a live filter bar, and the five heights.
 * Use it as: import { Chip } from "./chips-tags"; <Chip variant?="filter"|"input"|"static" selected? size?={20|24|32|40|44} disabled? onClick? onToggle? onRemove? removeLabel?>Label</Chip>
 * Variants: c.chip.filter - switches a filter on and off in a filter bar: a pill button that fills with the accent when selected; c.chip.input - a chosen value that can be taken off again: a pill with a small remove x; give onToggle and the label also switches on and off; c.chip.static - only a label such as a category tag on a card: a pill that is not interactive
 * Look: A rounded pill with a short label in five heights from 20 to 44 px, filled with the accent when selected, with an optional small x to remove it.
 * Tokens: --color-accent --color-on-accent --color-surface --color-surface-sunken --color-text --color-text-muted --color-border --color-border-strong --control-md --control-sm --control-pad-sm --control-radius --text-sm --text-xs --weight-medium --focus-ring --duration-fast
 * Use cases: filter bar; chosen filters; labels on a card; category tags; removable selections
 * Jobs to be done: narrow a list; see what I have already narrowed it by; take a filter off again
 * Keywords: chip, tag, filter, label, dismiss, remove
 */
/**
 * Three things that look alike and behave differently: a filter chip you switch on and off, an input chip you can
 * take off again, and a static chip that is only a label. The filter bar below is live: switch filters, remove them,
 * clear them, and the count follows.
 *
 * Make it the app's own: replace the words. Keep the remove button inside the chip labelled with what it removes.
 */
/**
 * How to try it
 * - Press a filter chip's label to switch it on or off; press its x to take it off altogether.
 * - The count under the bar says how many of them are on.
 * - "Clear all" and "Put them back" reset it.
 *
 * Dependencies: React (useState), and the library's own inline icon set ("./icons"), which is a table of SVG paths rather
 * than an icon package. Nothing else — no package to install and nothing fetched at run time. The styles are the library's
 * own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app exactly as
 * it runs here.
 */
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Button } from "./buttons-variants";

// ── c.chip: the one chip. Every piece's filters and tags are this component; the specimen shows every variant. ──

export type ChipVariant = "filter" | "input" | "static";
export type ChipSize = 20 | 24 | 32 | 40 | 44;

// Written out in full (not built from the size) so a build finds every class the chip needs.
const SIZE: Record<ChipSize, string> = {
  20: "fl-ctl-chip-item--20",
  24: "fl-ctl-chip-item--24",
  32: "",
  40: "fl-ctl-chip-item--40",
  44: "fl-ctl-chip-item--44",
};

type ChipProps = {
  variant?: ChipVariant;
  /** Height in px; 32 when left out. */
  size?: ChipSize;
  /** On: filled with the accent. A filter chip also reports it as aria-pressed. */
  selected?: boolean;
  disabled?: boolean;
  /** filter: pressing the chip. */
  onClick?: () => void;
  /** input: when given, the label itself is a button that switches the chip on and off. */
  onToggle?: () => void;
  /** input: pressing the x. */
  onRemove?: () => void;
  /** input: the x button's name; defaults to "Remove the <label> filter". */
  removeLabel?: string;
  className?: string;
  children?: ReactNode;
};

export function Chip({ variant = "filter", size = 32, selected, disabled, onClick, onToggle, onRemove, removeLabel, className, children }: ChipProps) {
  const cls = ["fl-ctl-chip-item", SIZE[size], variant === "static" ? "fl-ctl-chip-item--label" : "", selected ? "is-on" : "", className ?? ""].filter(Boolean).join(" ");
  const fl = `c.chip.${variant}`;
  if (variant === "static") {
    return (
      <span className={cls} data-fl={fl}>
        {children}
      </span>
    );
  }
  if (variant === "filter") {
    return (
      <button type="button" className={cls} data-fl={fl} aria-pressed={!!selected} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    );
  }
  const name = removeLabel ?? `Remove the ${typeof children === "string" ? children : "chip"} filter`;
  return (
    <span className={cls} data-fl={fl}>
      {onToggle ? (
        <button type="button" className="fl-ctl-chip-face" aria-pressed={!!selected} disabled={disabled} onClick={onToggle}>
          {children}
        </button>
      ) : (
        children
      )}
      <button type="button" className="fl-ctl-chip-x" aria-label={name} disabled={disabled} onClick={onRemove}>
        <Icon name="close" />
      </button>
    </span>
  );
}

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "filter", label: "Filter chip", what: "Turns a filter on and off" },
    { id: "input", label: "Input chip", what: "A selected filter, with a way to remove it" },
    { id: "static", label: "Static chip", what: "Says something; not interactive" },
  ],
  states: [
    { id: "enabled", label: "Enabled" },
    { id: "hovered", label: "Hovered" },
    { id: "selected", label: "Selected" },
    { id: "disabled", label: "Disabled" },
  ],
  filters: [
    { id: "f1", label: "Wedding", on: true },
    { id: "f2", label: "This year", on: true },
    { id: "f3", label: "Portrait", on: false },
    { id: "f4", label: "Commercial", on: false },
  ],
  sizes: [
    { px: 20 as const, note: "Inside a table cell, beside the text it labels" },
    { px: 24 as const, note: "In a table row or a dense toolbar" },
    { px: 32 as const, note: "Default: a filter bar above a list" },
    { px: 40 as const, note: "Beside 40 px buttons and fields" },
    { px: 44 as const, note: "Comfortable to tap" },
  ],
};

export default function ChipsTags() {
  const d = SAMPLE;
  const [filters, setFilters] = useState(d.filters);
  const [removed, setRemoved] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const shown = filters.filter((f) => !removed.includes(f.id));
  const onCount = shown.filter((f) => f.on).length;

  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">Each kind of chip in each state</caption>
          <thead>
            <tr>
              <th scope="col">State</th>
              {d.kinds.map((k) => (
                <th key={k.id} scope="col">
                  <span className="fl-ctl-matrix-kind">{k.label}</span>
                  <span className="fl-ctl-matrix-what">{k.what}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.states.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{s.label}</span>
                </th>
                {d.kinds.map((k) => {
                  const on = s.id === "selected";
                  const hover = s.id === "hovered" ? "is-hover" : undefined;
                  if (k.id === "static") {
                    return (
                      <td key={k.id} data-state={k.label}>
                        {s.id === "enabled" || on ? (
                          <Chip variant="static" selected={on}>
                            Wedding
                          </Chip>
                        ) : (
                          <span className="fl-ctl-matrix-what">Not applicable</span>
                        )}
                      </td>
                    );
                  }
                  return (
                    <td key={k.id} data-state={k.label}>
                      <Chip variant={k.id === "input" ? "input" : "filter"} selected={on} className={hover} disabled={s.id === "disabled"}>
                        Wedding
                      </Chip>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes fl-ctl-try">
        <h3>A filter bar you can use</h3>
        <p className="fl-ctl-btn-what">Switch a filter on or off, take one off the bar, or clear the lot. The count follows what is on.</p>
        <div className="fl-ctl-chip-bar">
          {shown.map((f) => (
            <Chip
              key={f.id}
              variant="input"
              selected={f.on}
              onToggle={() => {
                setFilters((list) => list.map((x) => (x.id === f.id ? { ...x, on: !x.on } : x)));
                setStatus(`${f.label} ${f.on ? "off" : "on"}.`);
              }}
              onRemove={() => {
                setRemoved((r) => [...r, f.id]);
                setStatus(`${f.label} removed from the bar.`);
              }}
            >
              {f.label}
            </Chip>
          ))}
          {shown.length ? (
            <Button
              variant="tertiary"
              size={32}
              onClick={() => {
                setFilters((list) => list.map((x) => ({ ...x, on: false })));
                setStatus("All filters off.");
              }}
            >
              Clear all
            </Button>
          ) : null}
          {removed.length ? (
            <Button variant="secondary" size={32} onClick={() => (setRemoved([]), setStatus("Filters put back."))}>
              Put them back
            </Button>
          ) : null}
        </div>
        <p className="fl-ctl-status" role="status" aria-live="polite">
          {status} {onCount} of {shown.length} on.
        </p>
      </div>

      <div className="fl-ctl-sizes">
        <h3>Heights</h3>
        <p className="fl-ctl-btn-what">The lower half of the button scale, so a chip and a button in the same bar line up. A chip is never a screen's main action, so it stops at 44.</p>
        <ul className="fl-ctl-size-list">
          {d.sizes.map((z) => (
            <li key={z.px}>
              <span className="fl-ctl-icon-row">
                <Chip size={z.px}>Wedding</Chip>
                <Chip variant="input" size={z.px} selected removeLabel="Remove the Booked filter">
                  Booked
                </Chip>
              </span>
              <span className="fl-ctl-btn-what">
                {z.px} px \u00b7 {z.note}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
