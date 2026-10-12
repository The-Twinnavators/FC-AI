/** @flowcode-library sliders-states · Sliders: single, stepped and range (Forms)
 * Catalog ID: c.slider (component)
 * Function: The slider (c.slider): a single, stepped or two-thumb range slider that always spells out its value, with optional end labels and a minimum gap between thumbs; the reference sheet shows its states.
 * Use it as: import { Slider } from "./sliders-states"; <Slider version?="standard"|"filled" fields? prefix? variant?="single"|"range" label="Budget" min? max? step? steps?={[1,2,3]} minGap? scale? defaultValue?={60} format?={(n) => `${n}`} onChange? disabled? />
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
/** standard = the compact slider; filled = the filter-panel slider: visible label, accent-filled track, value in the header. */
export type SliderVersion = "standard" | "filled";

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
  /** Look: "standard" (default) or "filled" (label and value above a filled track; a range adds number fields with `fields`). */
  version?: SliderVersion;
  /** filled range only: min and max number fields under the track, kept in step with the thumbs. */
  fields?: boolean;
  /** filled range only: a symbol in front of the number fields, such as "$". */
  prefix?: string;
  disabled?: boolean;
  /** Draw the keyboard focus ring without focus, for showing the state. */
  focused?: boolean;
  className?: string;
};
type SingleProps = SliderOwn & { variant?: "single"; value?: number; defaultValue?: number; onChange?: (n: number) => void };
type RangeProps = SliderOwn & { variant: "range"; value?: [number, number]; defaultValue?: [number, number]; onChange?: (r: [number, number]) => void };
export type SliderProps = (SingleProps | RangeProps) & Omit<HTMLAttributes<HTMLSpanElement>, keyof SliderOwn | "onChange" | "defaultValue">;

export function Slider(props: SliderProps) {
  const { label, min = 0, max = 100, step = 1, steps, minGap = 0, scale, format = String, version = "standard", fields, prefix, disabled, focused, className, variant = "single", value, defaultValue, onChange, ...rest } = props;
  const uid = useId();
  const [texts, setTexts] = useState<[string, string] | null>(null);
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
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  if (version === "filled" && variant === "range") {
    const [lo, hi] = (Array.isArray(cur) ? cur : [min, max]) as [number, number];
    const set = (r: [number, number]) => (setInner(r), setTexts(null), (onChange as ((r: [number, number]) => void) | undefined)?.(r));
    const setLow = (v: number) => set([Math.max(min, Math.min(v, hi - minGap)), hi]);
    const setHigh = (v: number) => set([lo, Math.min(max, Math.max(v, lo + minGap))]);
    const loText = texts?.[0] ?? String(lo);
    const hiText = texts?.[1] ?? String(hi);
    const commit = (which: 0 | 1) => {
      const t = which === 0 ? loText : hiText;
      const raw = Number(t);
      const ok = Number.isFinite(raw) && t.trim() !== "";
      if (which === 0) setLow(ok ? raw : lo);
      else setHigh(ok ? raw : hi);
    };
    const field = (which: 0 | 1, text: string, name: string) => {
      const invalid = text.trim() === "" || Number.isNaN(Number(text));
      return (
        <div className="fl-field">
          <label htmlFor={`${uid}-${which}`}>{name}</label>
          <div className="fl-in-affix">
            {prefix ? <span aria-hidden="true">{prefix}</span> : null}
            <input
              id={`${uid}-${which}`}
              className="fl-input"
              inputMode="numeric"
              value={text}
              disabled={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${uid}-${which}-err` : undefined}
              onChange={(e) => setTexts(which === 0 ? [e.target.value, hiText] : [loText, e.target.value])}
              onBlur={() => commit(which)}
              onKeyDown={(e) => e.key === "Enter" && commit(which)}
            />
          </div>
          {invalid ? (
            <span id={`${uid}-${which}-err`} className="fl-in-error">
              Enter a number.
            </span>
          ) : null}
        </div>
      );
    };
    return (
      <fieldset {...(rest as HTMLAttributes<HTMLFieldSetElement>)} className={["fl-in-fieldset", className ?? ""].filter(Boolean).join(" ")} data-fl="c.slider@filled" disabled={disabled}>
        <legend>{label}</legend>
        <div className="fl-in-dual" style={{ ["--fl-in-lo" as string]: `${pct(lo)}%`, ["--fl-in-hi" as string]: `${pct(hi)}%` }}>
          <span className="fl-in-dual__track" aria-hidden="true" />
          <input type="range" className="fl-in-dual__thumb" aria-label={`Lowest ${label}`} min={min} max={max} step={step} value={lo} aria-valuetext={format(lo)} onChange={(e) => setLow(Number(e.target.value))} />
          <input type="range" className="fl-in-dual__thumb" aria-label={`Highest ${label}`} min={min} max={max} step={step} value={hi} aria-valuetext={format(hi)} onChange={(e) => setHigh(Number(e.target.value))} />
        </div>
        {fields ? (
          <div className="fl-in-minmax">
            {field(0, loText, "Min")}
            <span className="fl-in-minmax__dash" aria-hidden="true">
              to
            </span>
            {field(1, hiText, "Max")}
          </div>
        ) : (
          <output className="fl-in-range__value" aria-live="polite">
            {format(lo)} to {format(hi)}
          </output>
        )}
      </fieldset>
    );
  }
  if (version === "filled") {
    const n = typeof cur === "number" ? cur : min;
    const set = (v: number) => (setInner(v), (onChange as ((n: number) => void) | undefined)?.(v));
    return (
      <div {...(rest as HTMLAttributes<HTMLDivElement>)} className={["fl-in-range", className ?? ""].filter(Boolean).join(" ")} data-fl="c.slider@filled">
        <div className="fl-in-range__head">
          <label htmlFor={uid}>{label}</label>
          <output htmlFor={uid} className="fl-in-range__value">
            {format(n)}
          </output>
        </div>
        <input
          id={uid}
          className="fl-in-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          list={listId}
          disabled={disabled}
          value={n}
          aria-valuetext={format(n)}
          style={{ ["--fl-in-fill" as string]: `${pct(n)}%` }}
          onChange={(e) => set(Number(e.target.value))}
        />
        {scale ? (
          <div className="fl-in-range__scale fl-meta" aria-hidden="true">
            <span>{format(min)}</span>
            <span>{format(max)}</span>
          </div>
        ) : null}
        {list}
      </div>
    );
  }
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
        <h3>Version: filled (c.slider@filled)</h3>
        <p className="fl-ctl-btn-what">
          The filter-panel look: the label and the live value above an accent-filled track, the ends written beneath, and a
          range with min and max number fields that stay in step with the thumbs (typed values are kept inside the range).
        </p>
        <Slider version="filled" label="Distance from home" min={1} max={50} defaultValue={12} format={(n) => `${n} km`} scale />
        <Slider version="filled" variant="range" label="Price per workshop" min={0} max={300} step={5} minGap={10} defaultValue={[40, 180]} format={(n) => `$${n}`} prefix="$" fields />
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
