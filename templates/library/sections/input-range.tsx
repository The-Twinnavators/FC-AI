/** @flowcode-library input-range · Range sliders (filled) (Forms)
 * Catalog ID: c.slider@filled (component version)
 * Version of: c.slider
 * Function: A single slider with a live value and a two-thumb price range kept in order, with min and max number fields that stay in sync and filter a results list.
 * Use it as: import { Slider } from "./sliders-states"; <Slider version="filled" variant?="single"|"range" label="Distance" min max step minGap? scale? fields? prefix? defaultValue?={12}|{[40,180]} format?={(n) => `${n} km`} onChange? />
 * Look: The label and the live value sit above a track that is filled in the accent color up to the thumb; a range adds Min and Max number fields that stay in step with the thumbs.
 * Tokens: --color-accent --color-border --color-text-muted --color-danger --text-sm --space-2 --space-4 --focus-ring
 * Use cases: price filter; budget filter; distance filter; search filters; price range; duration filter; rental search
 * Jobs to be done: narrow results to my budget; find options within my distance; set a minimum and maximum
 * Keywords: range, slider, price range, dual thumb, filter, min max
 */
/**
 * Input: range sliders. This is c.slider@filled with this piece's sample content; the implementation lives in the
 * component, in ./sliders-states. A single slider that shows its value as you drag, and a two-thumb price range whose
 * min and max number fields stay in step with the thumbs (the thumbs can't cross). Use it for filters such as budget,
 * distance or class length. Make it the app's own: replace SAMPLE with the real bounds, step and unit, and feed the
 * chosen range into the real filter with onChange.
 */
import { Slider } from "./sliders-states";

// flowcode:sample
const SAMPLE = {
  distance: { label: "Distance from home", min: 1, max: 50, step: 1, initial: 12, unit: "km" },
  price: { label: "Price per workshop", min: 0, max: 300, step: 5, initial: [40, 180] as [number, number], currency: "$", gap: 10 },
};

export default function InputRange() {
  const d = SAMPLE;
  return (
    <section className="fl-section">
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-card fl-in-panel">
          <Slider version="filled" label={d.distance.label} min={d.distance.min} max={d.distance.max} step={d.distance.step} defaultValue={d.distance.initial} format={(n) => `${n} ${d.distance.unit}`} scale />
          <Slider
            version="filled"
            variant="range"
            label={d.price.label}
            min={d.price.min}
            max={d.price.max}
            step={d.price.step}
            minGap={d.price.gap}
            defaultValue={d.price.initial}
            format={(n) => `${d.price.currency}${n}`}
            prefix={d.price.currency}
            fields
          />
        </div>
      </div>
    </section>
  );
}
