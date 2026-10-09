/** Settings → Sounds: notification sounds on or off for this browser, and what each one means (with a preview). */
import { useEffect, useState } from "react";
import { onSoundsChange, playSound, setSoundsOn, soundsOn, type SoundKind } from "./sounds";

const KINDS: Array<{ kind: SoundKind; label: string; when: string }> = [
  { kind: "alert", label: "Waiting on you", when: "A soft rising chime when an approval is waiting." },
  { kind: "block", label: "Build stopped", when: "A low falling tone when a step or a build stops and needs a decision." },
  { kind: "reply", label: "Chat reply", when: "A short pop when Copilot or the builder chat answers." },
];

export function SoundSettings() {
  const [on, setOn] = useState(soundsOn);
  useEffect(() => onSoundsChange(setOn), []);
  return (
    <section className="section" aria-labelledby="sounds-title">
      <div className="section__head">
        <h2 className="section__title" id="sounds-title">
          Sounds
        </h2>
      </div>
      <div className="section__body rt">
        <label className="rt__row">
          <input type="checkbox" data-cp="sounds-on" checked={on} onChange={(e) => setSoundsOn(e.target.checked)} />
          <span>
            <strong>Play notification sounds</strong>
            <span className="muted">Saved for this browser. Browsers only play sound after you&apos;ve clicked somewhere on the page once.</span>
          </span>
        </label>
        <ul className="sounds__list">
          {KINDS.map((k) => (
            <li key={k.kind} className="sounds__item">
              <span>
                <strong>{k.label}</strong>
                <span className="muted">{k.when}</span>
              </span>
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => playSound(k.kind)} disabled={!on} title={on ? `Hear the ${k.label.toLowerCase()} sound` : "Turn sounds on to hear it"}>
                Play
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
