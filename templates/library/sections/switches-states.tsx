/** @flowcode-library switches-states - Switches: every state and size (Forms)
 * Use cases: settings screen; feature on or off; notification preferences; privacy choice; row-level toggle
 * Jobs to be done: turn something on or off; see at a glance what is on; know a setting is locked
 * Keywords: switch, toggle, on off, setting, disabled
 */
/**
 * A switch changes something straight away, so it has no Save button: that is what separates it from a checkbox.
 * Here it is in every state, at three heights, and in the settings row it usually lives in.
 *
 * The settings rows are live, and each one says it has been saved as it moves, because that is the whole difference
 * between a switch and a checkbox.
 *
 * Make it the app's own: replace the settings and their descriptions. If a change needs saving, use a checkbox.
 */
import { useState } from "react";

// flowcode:sample
const SAMPLE = {
  states: [
    { id: "off", label: "Off", on: false, disabled: false },
    { id: "on", label: "On", on: true, disabled: false },
    { id: "off-disabled", label: "Off, disabled", on: false, disabled: true },
    { id: "on-disabled", label: "On, disabled", on: true, disabled: true },
  ],
  sizes: [
    { id: "s14", label: "14 px", cls: "fl-ctl-switch--14" },
    { id: "s16", label: "16 px", cls: "fl-ctl-switch--16" },
    { id: "s18", label: "18 px", cls: "fl-ctl-switch--18" },
    { id: "s20", label: "20 px", cls: "fl-ctl-switch--20" },
    { id: "s24", label: "24 px", cls: "fl-ctl-switch--24" },
    { id: "s32", label: "32 px", cls: "fl-ctl-switch--32" },
  ],
  settings: [
    { id: "s1", name: "Text me when a booking is cancelled", what: "Only cancellations. Everything else is email.", on: true, disabled: false },
    { id: "s2", name: "Let clients reschedule themselves", what: "Up to 24 hours before the shoot.", on: false, disabled: false },
    { id: "s3", name: "Two-factor sign-in", what: "Required by your studio's plan, so this cannot be turned off.", on: true, disabled: true },
  ],
};

function Switch({ on, disabled, cls = "", label, onToggle }: { on: boolean; disabled?: boolean; cls?: string; label: string; onToggle?: (next: boolean) => void }) {
  return (
    <span className={`fl-ctl-switch ${cls}`}>
      {onToggle ? (
        <input type="checkbox" checked={on} disabled={disabled} aria-label={label} onChange={(e) => onToggle(e.target.checked)} />
      ) : (
        <input type="checkbox" defaultChecked={on} disabled={disabled} aria-label={label} />
      )}
      <span className="fl-ctl-switch-track" aria-hidden="true">
        <span className="fl-ctl-switch-thumb" />
      </span>
    </span>
  );
}

export default function SwitchesStates() {
  const d = SAMPLE;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(SAMPLE.settings.map((s) => [s.id, s.on])));
  const [said, setSaid] = useState("");
  return (
    <section className="fl-section fl-section--specimen">
      <div className="fl-ctl-matrix-wrap">
        <table className="fl-ctl-matrix">
          <caption className="fl-sr">A switch in each state, at each size</caption>
          <thead>
            <tr>
              <th scope="col">Size</th>
              {d.states.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.sizes.map((z) => (
              <tr key={z.id}>
                <th scope="row">
                  <span className="fl-ctl-matrix-kind">{z.label}</span>
                </th>
                {d.states.map((s) => (
                  <td key={s.id} data-state={s.label}>
                    <Switch on={s.on} disabled={s.disabled} cls={z.cls} label={`${z.label}, ${s.label}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fl-ctl-sizes">
        <h3>In a settings row</h3>
        <p className="fl-ctl-btn-what">Where a switch usually lives: the setting on the left, the switch on the right.</p>
        <ul className="fl-ctl-setting-list">
          {d.settings.map((s) => (
            <li key={s.id}>
              <span>
                <strong>{s.name}</strong>
                <span className="fl-ctl-matrix-what">{s.what}</span>
              </span>
              <Switch
                on={Boolean(on[s.id])}
                disabled={s.disabled}
                label={s.name}
                onToggle={(next) => {
                  setOn((v) => ({ ...v, [s.id]: next }));
                  setSaid(`${next ? "Turned on" : "Turned off"}: ${s.name}. Saved.`);
                }}
              />
            </li>
          ))}
        </ul>
        <p className="fl-ctl-status" role="status" aria-live="polite">
          {said || "A switch saves as it moves, so there is no Save button here."}
        </p>
      </div>
    </section>
  );
}
