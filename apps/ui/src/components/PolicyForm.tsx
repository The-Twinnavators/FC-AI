/** Project policy fields, shared by the default policy (System Settings) and each project's own settings. */
import type { ProjectSettings } from "@flowcode/contracts";
import { AutonomyPicker } from "./AutonomyPicker";

export function PolicyFields({ s, onChange, showApprovals, idPrefix }: { s: ProjectSettings; onChange: (s: ProjectSettings) => void; showApprovals?: boolean; idPrefix: string }) {
  return (
    <>
      <div className="field" data-guide="settings.autonomy">
        <span className="label">Autonomy level</span>
        <AutonomyPicker value={s.autonomy} onChange={(autonomy) => onChange({ ...s, autonomy })} />
      </div>
      <label className="check">
        <input type="checkbox" data-cp="policy-research" checked={s.allowExternalResearch} onChange={(e) => onChange({ ...s, allowExternalResearch: e.target.checked })} />
        <span>
          Allow external research without asking each time
          <span className="muted" style={{ display: "block", fontSize: 12 }}>Sends only search words to the configured search sources, never your files. When a build finishes, FlowCode also looks for ideas that could improve the app and sends each one to Approvals. If you accept an idea, it becomes a request for the coder. Off by default.</span>
        </span>
      </label>
      <label className="check">
        <input type="checkbox" checked={s.allowHostedModels} onChange={(e) => onChange({ ...s, allowHostedModels: e.target.checked })} />
        <span>
          Allow hosted models
          <span className="muted" style={{ display: "block", fontSize: 12 }}>Repository content would be sent to the hosted provider. Local models never leave this machine. Off by default.</span>
        </span>
      </label>
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-maxfp`}>
          Stop after N identical failures (no-progress control)
        </label>
        <input id={`${idPrefix}-maxfp`} className="input" type="number" min={1} max={10} value={s.maxSameFingerprintAttempts} onChange={(e) => onChange({ ...s, maxSameFingerprintAttempts: Number(e.target.value) })} />
      </div>
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-timeout`}>
          Command timeout (seconds)
        </label>
        <input id={`${idPrefix}-timeout`} className="input" type="number" min={1} value={Math.round(s.commandTimeoutMs / 1000)} onChange={(e) => onChange({ ...s, commandTimeoutMs: Number(e.target.value) * 1000 })} />
      </div>
      <div className="field">
        <label className="label" htmlFor={`${idPrefix}-secrets`}>
          Extra secret file patterns (regex, one per line)
        </label>
        <textarea id={`${idPrefix}-secrets`} className="textarea mono" value={s.extraSecretPatterns.join("\n")} onChange={(e) => onChange({ ...s, extraSecretPatterns: e.target.value.split("\n").filter(Boolean) })} />
      </div>
      {showApprovals ? (
        <div className="field">
          <span className="label">Standing project approvals</span>
          {s.persistentApprovals.length ? (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {s.persistentApprovals.map((k) => (
                <li key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="mono" style={{ flex: 1 }}>{k}</span>
                  <button type="button" className="btn btn--sm btn--danger" onClick={() => onChange({ ...s, persistentApprovals: s.persistentApprovals.filter((x) => x !== k) })}>
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 12 }}>None. "Allow for project" on an approval card adds an entry here.</p>
          )}
        </div>
      ) : null}
    </>
  );
}
