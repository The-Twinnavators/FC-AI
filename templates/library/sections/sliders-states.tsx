/** @flowcode-library sliders-states - Sliders: single, stepped and range (Forms)
 * Use cases: price filter; volume; image quality; date range; rating filter
 * Jobs to be done: pick a number without typing; narrow a list to a range; see the value as I drag
 * Keywords: slider, range, track, thumb, steps, filter
 */
/**
 * A slider for a number people do not need to be exact about. The value is always shown as text beside it, because a
 * thumb on a track is not readable on its own, and a range needs two thumbs with the pair's value spelled out.
 *
 * Make it the app's own: set the min, max and step, and keep the value text. A stepped slider should say its steps.
 */

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
                  const id = `sl-${k.id}-${s.id}`;
                  const stepped = k.id === "stepped";
                  return (
                    <td key={k.id} data-state={k.label}>
                      <span className="fl-ctl-slider">
                        <label className="fl-sr" htmlFor={id}>
                          {stepped ? "Guests" : "Budget"}, {s.label}
                        </label>
                        <input
                          id={id}
                          className={`fl-ctl-range${s.id === "focus" ? " is-focus" : ""}`}
                          type="range"
                          min={stepped ? 1 : 0}
                          max={stepped ? 5 : 100}
                          step={stepped ? 1 : 1}
                          defaultValue={stepped ? 3 : 60}
                          list={stepped ? "guest-steps" : undefined}
                          disabled={s.id === "disabled"}
                        />
                        <output className="fl-ctl-slider-value">{stepped ? "3 guests" : "$600"}</output>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <datalist id="guest-steps">
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>

      <div className="fl-ctl-sizes">
        <h3>A range, with two thumbs</h3>
        <p className="fl-ctl-btn-what">Two inputs, one above the other, with the pair written out. Each thumb keeps its own label for the keyboard.</p>
        <span className="fl-ctl-slider fl-ctl-slider--range">
          <label className="fl-sr" htmlFor="sl-min">
            Lowest price
          </label>
          <input id="sl-min" className="fl-ctl-range" type="range" min={0} max={100} defaultValue={25} />
          <label className="fl-sr" htmlFor="sl-max">
            Highest price
          </label>
          <input id="sl-max" className="fl-ctl-range" type="range" min={0} max={100} defaultValue={75} />
          <output className="fl-ctl-slider-value">$250 to $750</output>
        </span>
      </div>
    </section>
  );
}
