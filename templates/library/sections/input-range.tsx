/** @flowcode-library input-range · Range sliders (Forms)
 * Use cases: price filter; budget filter; distance filter; search filters; price range; duration filter; rental search
 * Jobs to be done: narrow results to my budget; find options within my distance; set a minimum and maximum
 * Keywords: range, slider, price range, dual thumb, filter, min max
 */
/**
 * Input: range sliders. A single slider that shows its value as you drag, and a two-thumb price range whose min and
 * max number fields stay in step with the thumbs (the thumbs can't cross). A results line updates from the chosen
 * range. Use it for filters such as budget, distance or class length. Make it the app's own: replace SAMPLE with the
 * real bounds, step and unit, and feed the chosen range into the real filter.
 */
import { useId, useState } from "react";

// flowcode:sample
const SAMPLE = {
  title: "Narrow it down",
  lede: "Set how far you'll travel and what you'd like to spend on a workshop.",
  distance: { label: "Distance from home", min: 1, max: 50, step: 1, initial: 12, unit: "km" },
  price: { label: "Price per workshop", min: 0, max: 300, step: 5, initial: [40, 180] as [number, number], currency: "$", gap: 10 },
  workshops: [
    { name: "Wheel throwing taster", price: 35, km: 4 },
    { name: "Natural dye weekend", price: 160, km: 18 },
    { name: "Sourdough basics", price: 55, km: 7 },
    { name: "Furniture restoration", price: 240, km: 26 },
    { name: "Watercolour evenings", price: 90, km: 9 },
    { name: "Knife skills", price: 75, km: 3 },
    { name: "Stained glass day", price: 195, km: 32 },
  ],
  reset: "Reset",
};

export default function InputRange() {
  const d = SAMPLE;
  const uid = useId();
  const [km, setKm] = useState(d.distance.initial);
  const [lo, setLo] = useState(d.price.initial[0]);
  const [hi, setHi] = useState(d.price.initial[1]);
  const [loText, setLoText] = useState(String(d.price.initial[0]));
  const [hiText, setHiText] = useState(String(d.price.initial[1]));
  const { min, max, step, gap, currency } = d.price;

  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  const kmPct = ((km - d.distance.min) / (d.distance.max - d.distance.min)) * 100;

  function setLow(v: number) {
    const next = Math.max(min, Math.min(v, hi - gap));
    setLo(next);
    setLoText(String(next));
  }
  function setHigh(v: number) {
    const next = Math.min(max, Math.max(v, lo + gap));
    setHi(next);
    setHiText(String(next));
  }
  function commitText(which: "lo" | "hi") {
    const raw = Number(which === "lo" ? loText : hiText);
    if (which === "lo") setLow(Number.isFinite(raw) && loText.trim() !== "" ? raw : lo);
    else setHigh(Number.isFinite(raw) && hiText.trim() !== "" ? raw : hi);
  }
  function reset() {
    setKm(d.distance.initial);
    setLo(d.price.initial[0]);
    setHi(d.price.initial[1]);
    setLoText(String(d.price.initial[0]));
    setHiText(String(d.price.initial[1]));
  }

  const loBad = loText.trim() === "" || Number.isNaN(Number(loText));
  const hiBad = hiText.trim() === "" || Number.isNaN(Number(hiText));
  const matches = d.workshops.filter((w) => w.km <= km && w.price >= lo && w.price <= hi);

  return (
    <section className="fl-section" aria-labelledby={`${uid}-title`}>
      <div className="fl-wrap fl-wrap--narrow">
        <div className="fl-head">
          <h2 id={`${uid}-title`} className="fl-title fl-title--md">
            {d.title}
          </h2>
          <p className="fl-text">{d.lede}</p>
        </div>
        <div className="fl-card fl-in-panel">
          <div className="fl-in-range">
            <div className="fl-in-range__head">
              <label htmlFor={`${uid}-km`}>{d.distance.label}</label>
              <output htmlFor={`${uid}-km`} className="fl-in-range__value">
                {km} {d.distance.unit}
              </output>
            </div>
            <input
              id={`${uid}-km`}
              className="fl-in-slider"
              type="range"
              min={d.distance.min}
              max={d.distance.max}
              step={d.distance.step}
              value={km}
              aria-valuetext={`${km} ${d.distance.unit}`}
              style={{ ["--fl-in-fill" as string]: `${kmPct}%` }}
              onChange={(e) => setKm(Number(e.target.value))}
            />
            <div className="fl-in-range__scale fl-meta" aria-hidden="true">
              <span>
                {d.distance.min} {d.distance.unit}
              </span>
              <span>
                {d.distance.max} {d.distance.unit}
              </span>
            </div>
          </div>

          <fieldset className="fl-in-fieldset">
            <legend>{d.price.label}</legend>
            <div className="fl-in-dual" style={{ ["--fl-in-lo" as string]: `${pct(lo)}%`, ["--fl-in-hi" as string]: `${pct(hi)}%` }}>
              <span className="fl-in-dual__track" aria-hidden="true" />
              <input
                type="range"
                className="fl-in-dual__thumb"
                aria-label="Lowest price"
                min={min}
                max={max}
                step={step}
                value={lo}
                aria-valuetext={`${currency}${lo}`}
                onChange={(e) => setLow(Number(e.target.value))}
              />
              <input
                type="range"
                className="fl-in-dual__thumb"
                aria-label="Highest price"
                min={min}
                max={max}
                step={step}
                value={hi}
                aria-valuetext={`${currency}${hi}`}
                onChange={(e) => setHigh(Number(e.target.value))}
              />
            </div>
            <div className="fl-in-minmax">
              <div className="fl-field">
                <label htmlFor={`${uid}-lo`}>Min</label>
                <div className="fl-in-affix">
                  <span aria-hidden="true">{currency}</span>
                  <input
                    id={`${uid}-lo`}
                    className="fl-input"
                    inputMode="numeric"
                    value={loText}
                    aria-invalid={loBad || undefined}
                    aria-describedby={loBad ? `${uid}-lo-err` : undefined}
                    onChange={(e) => setLoText(e.target.value)}
                    onBlur={() => commitText("lo")}
                    onKeyDown={(e) => e.key === "Enter" && commitText("lo")}
                  />
                </div>
                {loBad && (
                  <span id={`${uid}-lo-err`} className="fl-in-error">
                    Enter a number.
                  </span>
                )}
              </div>
              <span className="fl-in-minmax__dash" aria-hidden="true">
                to
              </span>
              <div className="fl-field">
                <label htmlFor={`${uid}-hi`}>Max</label>
                <div className="fl-in-affix">
                  <span aria-hidden="true">{currency}</span>
                  <input
                    id={`${uid}-hi`}
                    className="fl-input"
                    inputMode="numeric"
                    value={hiText}
                    aria-invalid={hiBad || undefined}
                    aria-describedby={hiBad ? `${uid}-hi-err` : undefined}
                    onChange={(e) => setHiText(e.target.value)}
                    onBlur={() => commitText("hi")}
                    onKeyDown={(e) => e.key === "Enter" && commitText("hi")}
                  />
                </div>
                {hiBad && (
                  <span id={`${uid}-hi-err`} className="fl-in-error">
                    Enter a number.
                  </span>
                )}
              </div>
            </div>
            <p className="fl-note">
              Between {currency}
              {min} and {currency}
              {max}; typed values are kept inside the range when you leave the field.
            </p>
          </fieldset>

          <div className="fl-in-result" aria-live="polite">
            {matches.length === 0 ? (
              <p className="fl-in-empty">No workshops match. Try a wider price range or a longer distance.</p>
            ) : (
              <>
                <p className="fl-in-result__count">
                  <strong>{matches.length}</strong> workshop{matches.length > 1 ? "s" : ""} within {km} {d.distance.unit}, {currency}
                  {lo}–{currency}
                  {hi}
                </p>
                <ul className="fl-in-chips">
                  {matches.map((w) => (
                    <li key={w.name}>
                      {w.name} · {currency}
                      {w.price}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="fl-actions">
            <button type="button" className="fl-btn fl-btn--secondary" onClick={reset}>
              {d.reset}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
