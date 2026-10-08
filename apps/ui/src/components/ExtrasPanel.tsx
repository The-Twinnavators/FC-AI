/**
 * Design → Extras: the same extras as New build's Look and feel (micro-animations, page transitions, a light and dark
 * switch, …), for an app that already exists. Extras its builds were already asked for are marked; ticking more and
 * pressing Add writes the change into the builder chat for the person to read and send (nothing starts on its own).
 */
import { useState } from "react";
import { BUILD_EXTRAS } from "@flowcode/contracts";
import { useResource } from "../api";
import { composeChange } from "./PointAndSay";

export function ExtrasPanel({ projectId }: { projectId: string }) {
  const asked = useResource<{ asked: string[] }>(`/projects/${projectId}/extras`, [projectId]);
  const has = new Set(asked.data?.asked ?? []);
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  const add = () => {
    const chosen = BUILD_EXTRAS.filter((x) => picked.includes(x.id));
    composeChange(
      [
        `Add ${chosen.length === 1 ? "this extra" : "these extras"} to the app:`,
        ...chosen.map((x) => `- ${x.label}: ${x.guidance}`),
        "",
        "Keep everything else as it is, and respect the reduce-motion setting for anything animated.",
      ].join("\n"),
    );
    setPicked([]);
  };
  return (
    <div className="extras-panel">
      <p className="muted extras-panel__lede">
        The extras from New build, for this app. Tick the ones to add; the change is written into the chat for you to send.
      </p>
      <ul className="look__checks" data-cp="extras-list">
        {BUILD_EXTRAS.map((x) => {
          const already = has.has(x.id);
          return (
            <li key={x.id}>
              <label className="look-check">
                <input type="checkbox" checked={already || picked.includes(x.id)} disabled={already} onChange={(e) => toggle(x.id, e.target.checked)} />
                <span>
                  <span className="look-check__label">
                    {x.label}
                    {already ? <span className="extras-panel__has">In this build</span> : null}
                  </span>
                  <span className="look-check__hint">{x.hint}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="extras-panel__foot">
        <span className="muted">Animations always respect the "reduce motion" setting on the viewer's device.</span>
        <button type="button" className="btn btn--primary btn--sm" data-cp="extras-add" disabled={!picked.length} onClick={add}>
          {picked.length ? `Add ${picked.length} to this app` : "Add to this app"}
        </button>
      </div>
    </div>
  );
}
