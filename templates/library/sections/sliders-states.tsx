/** @flowcode-library sliders-states · Sliders: single, stepped and range (Forms)
 * Catalog ID: c.slider (component)
 * Function: The slider (c.slider): a single, stepped or two-thumb range slider that always spells out its value, with optional end labels and a minimum gap between thumbs; the reference sheet shows its states.
 * Use it as: import { Slider } from "./sliders-states"; <Slider variant?="single"|"range" label="Budget" min? max? step? steps?={[1,2,3]} minGap? scale? defaultValue?={60} format?={(n) => `${n}`} onChange? disabled? />
 * Variants: c.slider.single - pick one number without typing (volume, budget, guests): one thumb on a track, value written beside it; pass steps for a stepped one; c.slider.range - narrow a list between two values (price filter): two thumbs on stacked tracks, the pair written out beside them
 * Look: An accent-colored track and thumb with the current value written as text beneath it.
 * Tokens: --color-accent --color-text-muted --text-sm --space-2 --focus-ring
 * Use cases: price filter; volume; image quality; date range; rating filter; budget filter; distance filter; search filters; price range; duration filter; rental search
 * Jobs to be done: pick a number without typing; narrow a list to a range; see the value as I drag; narrow results to my budget; find options within my distance; set a minimum and maximum
 * Keywords: slider, range, track, thumb, steps, filter, price range, dual thumb, min max
 */
/**
 * A slider for a number people do not need to be exact about. The value is always shown as text beside it, because a
 * thumb on a track is not readable on its own, and a range needs two thumbs with the pair's value spelled out.
 *
 * Make it the app's own: set the min, max and step, and keep the value text. A stepped slider should say its steps.
 */
/**
 * How to try it
 * - Drag any slider, or focus one and use the arrow keys: each cell keeps its own value and writes it out beside itself.
 * - Drag the two range thumbs past each other: they keep their order.
 *
 * Dependencies: React (useId, useState). Nothing else — no package to install and nothing fetched at run time. The styles are the
 * library's own fl- classes in templates/library/css, and the sample data is in the file, so the piece runs in a built app
 * exactly as it runs here.
 */
import { useId, useState, type HTMLAttributes } from "react";

// ── c.slider: the one slider. Single or range; the value is always written out beside the track. ──

export type SliderVariant = "single" | "range";

type SliderOwn = {
  /** Names the slider for screen readers. A range reads "Lowest <label>" and "Highest <label>". */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** Marked steps the thumb snaps to (a stepped slider); say what they are in the value text. */
  steps?: number[];
  /** Range only: the thumbs stay at least this far apart (0 lets them meet). */
  minGap?: number;
  /** Writes the lowest and highest value under the track's ends, using format. */
  scale?: boolean;
  /** Turns a number into the text beside the track. The number itself when left out. */
  format?: (n: number) => string;
  disabled?: boolean;
  /** Draw the keyboard focus ring without focus, for showing the state. */
  focused?: boolean;
  className?: string;
};
type SingleProps = SliderOwn & { variant?: "single"; value?: number; defaultValue?: number; onChange?: (n: number) => void };
type RangeProps = SliderOwn & { variant: "range"; value?: [number, number]; defaultValue?: [number, number]; onChange?: (r: [number, number]) => void };
export type SliderProps = (SingleProps | RangeProps) & Omit<HTMLAttributes<HTMLSpanElement>, keyof SliderOwn | "onChange" | "defaultValue">;

export function Slider(props: SliderProps) {
  const { label, min = 0, max = 100, step = 1, steps, minGap = 0, scale, format = String, disabled, focused, className, variant = "single", value, defaultValue, onChange, ...rest } = props;
  const uid = useId();
  const listId = steps ? `${uid}-steps` : undefined;
  const [inner, setInner] = useState<number | [number, number]>(defaultValue ?? (variant === "range" ? [min, max] : min));
  const cur = value ?? inner;
  const input = `fl-ctl-range${focused ? " is-focus" : ""}`;
  const root = ["fl-ctl-slider", variant === "range" ? "fl-ctl-slider--range" : "", className ?? ""].filter(Boolean).join(" ");
  const own = { className: root, "data-fl": `c.slider.${variant}` };
  const list = listId ? (
    <datalist id={listId}>
      {steps!.map((n) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  ) : null;
  if (variant === "range") {
    const [lo, hi] = (Array.isArray(cur) ? cur : [min, max]) as [number, number];
    const set = (r: [number, number]) => (setInner(r), (onChange as ((r: [number, number]) => void) | undefined)?.(r));
    return (
      <span {...rest} {...own}>
        <label className="fl-sr" htmlFor={`${uid}-min`}>
          Lowest {label}
        </label>
        <input id={`${uid}-min`} className={input} type="range" min={min} max={max} step={step} list={listId} disabled={disabled} value={lo} onChange={(e) => set([Math.min(Number(e.target.value), hi - minGap), hi])} />
        <label className="fl-sr" htmlFor={`${uid}-max`}>
          Highest {label}
        </label>
        <input id={`${uid}-max`} className={input} type="range" min={min} max={max} step={step} list={listId} disabled={disabled} value={hi} onChange={(e) => set([lo, Math.max(Number(e.target.value), lo + minGap)])} />
        <output className="fl-ctl-slider-value" htmlFor={`${uid}-min ${uid}-max`}>
          {format(lo)} to {format(hi)}
        </output>
        {scale ? (
          <span className="fl-ctl-matrix-what fl-ctl-slider-ends" aria-hidden="true">
            <span>{format(min)}</span>
            <span>{format(max)}</span>
          </span>
        ) : null}
        {list}
      </span>
    );
  }
  const n = typeof cur === "number" ? cur : min;
  const set = (v: number) => (setInner(v), (onChange as ((n: number) => void) | undefined)?.(v));
  return (
    <span {...rest} {...own}>
      <label className="fl-sr" htmlFor={uid}>
        {label}
      </label>
      <input id={uid} className={input} type="range" min={min} max={max} step={step} list={listId} disabled={disabled} value={n} onChange={(e) => set(Number(e.target.value))} />
      <output className="fl-ctl-slider-value" htmlFor={uid}>
        {format(n)}
      </output>
      {scale ? (
        <span className="fl-ctl-matrix-what fl-ctl-slider-ends" aria-hidden="true">
          <span>{format(min)}</span>
          <span>{format(max)}</span>
        </span>
      ) : null}
      {list}
    </span>
  );
}

// flowcode:sample
const SAMPLE = {
  kinds: [
    { id: "single", label: "Single value", what: "One number on a track" },
    { id: "stepped", label: "Stepped", what: "Snaps to marked steps" },
  ],
  states: [
    { id: "rest", label: "Enabled", what: "Waiting" },
    { id: "focus", label: "Focused", what: "Ready for arrow keys" },
    { id: "disabled", label: "Disabled", what: "Not available" },
  ],
};

export default function SlidersStates() {
  const d = SAMPLE;
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">A slider in each state</caption>
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
                  <span className="fl-ctl-matrix-what">{s.what}</span>
                </th>
                {d.kinds.map((k) => {
                  const stepped = k.id === "stepped";
                  return (
                    <td key={k.id} data-state={k.label}>
                      {stepped ? (
                        <Slider
                          label={`Guests, ${s.label}`}
                          min={1}
                          max={5}
                          steps={[1, 2, 3, 4, 5]}
                          defaultValue={3}
                          format={(n) => `${n} guest${n === 1 ? "" : "s"}`}
                          focused={s.id === "focus"}
                          disabled={s.id === "disabled"}
                        />
                      ) : (
                        <Slider label={`Budget, ${s.label}`} defaultValue={60} format={(n) => `$${n * 10}`} focused={s.id === "focus"} disabled={s.id === "disabled"} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>A range, with two thumbs</h3>
        <p className="fl-ctl-btn-what">Two inputs, one above the other, with the pair written out. Each thumb keeps its own label for the keyboard.</p>
        <Slider variant="range" label="price" defaultValue={[25, 75]} format={(n) => `$${n * 10}`} />
      </div>

      <div className="fl-ctl-sizes">
        <h3>With a scale, and a gap the thumbs keep</h3>
        <p className="fl-ctl-btn-what">
          The lowest and highest value written under the ends of the track, and a range whose thumbs stay at least a set
          distance apart. Both are for filters with real bounds, like a price per workshop.
        </p>
        <Slider label="Distance from home" min={1} max={50} defaultValue={12} format={(n) => `${n} km`} scale />
        <Slider variant="range" label="price per workshop" min={0} max={300} step={5} minGap={10} defaultValue={[40, 180]} format={(n) => `$${n}`} scale />
      </div>
    </section>
  );
}
