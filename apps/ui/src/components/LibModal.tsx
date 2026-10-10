/**
 * Prompts & Skills: the shared pieces every tab's cards use. AgentHeads names the agents that use something, each
 * with its robot head; LibModal is the modal a card opens (a small label and a close button on top, a body that
 * scrolls, and an optional action bar pinned to the bottom).
 */
import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { useResource } from "../api";
import { effectiveRoles } from "@flowcode/contracts";
import { Modal } from "./Modal";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "./RobotHead";

/** An agent role as people read it: "designer" → "Designer", "compliance_triage" → "Compliance triage". */
const roleName = (r: string) => ROLE_LABEL[r] ?? r.charAt(0).toUpperCase() + r.slice(1).replace(/_/g, " ");

/** `max`: on a card, show that many and count the rest (the modal lists everyone). */
export function AgentHeads({ roles: named, id, max }: { roles?: string[]; id: string; max?: number }) {
  // Only agents that actually run: a role that never does (designer, reviewer, the scans) shows as the agent doing its work.
  const roles = effectiveRoles(named);
  if (!roles.length) return <span className="lib-agents">any agent</span>;
  const shown = max && roles.length > max ? roles.slice(0, max) : roles;
  const more = roles.length - shown.length;
  return (
    <span className="lib-agents" title={more ? roles.map((r) => roleName(r)).join(", ") : undefined}>
      {more ? <span className="sr-only">{roles.length} agents</span> : null}
      {shown.map((r) => (
        <span key={r} className="lib-agent" title={roleName(r)}>
          <RobotHead color={ROLE_COLOR[r] ?? "#9a9fd6"} id={`lib-${id}-${r}`} size={18} />
          <span>{roleName(r)}</span>
        </span>
      ))}
      {more ? <span className="lib-agents__more">+{more} more</span> : null}
    </span>
  );
}

/** Every saved version of a prompt or skill, newest first, with the date and what changed. */
export function VersionHistory({ path, current }: { path: string; current: string }) {
  const { data, error } = useResource<Array<{ version: string; changelog: Array<{ version: string; date?: string; note: string }> }>>(path, [current]);
  const rows = [...(data ?? [])].reverse();
  return (
    <section className="lib-history" aria-label="Version history">
      <span className="label">Version history</span>
      {error ? (
        <p className="muted">Couldn't load the history: {error}</p>
      ) : !data ? (
        // The same sliding progress bar FlowCode shows while a change is starting, instead of the word "Loading".
        <span className="lib-history__loading sug-progress__bar" role="progressbar" aria-label="Loading the version history">
          <span className="is-indeterminate" />
        </span>
      ) : (
        <ol className="lib-history__list">
          {rows.map((v) => {
            const entry = v.changelog.find((c) => c.version === v.version) ?? v.changelog.at(-1);
            return (
              <li key={v.version} className={v.version === current ? "is-current" : undefined}>
                <span className="mono lib-history__ver">v{v.version}</span>
                <span className="lib-history__note">{entry?.note ?? "—"}</span>
                <span className="mono muted lib-history__date">{v.version === current ? "current" : entry?.date ?? ""}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** The small on/off switch on a card. It sits beside the card's button (a button can't hold one), in its bottom-right corner. */
export function CardSwitch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (on: boolean) => void; disabled?: boolean }) {
  return (
    <label className="mcp-switch mcp-switch--sm lib-card__switch" title={on ? "On" : "Off"}>
      <input type="checkbox" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span aria-hidden="true" />
    </label>
  );
}

/** Copies text; once it worked, turns teal with a check ("Copied") for a moment, so you know it did. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);
  const copy = () => {
    if (!navigator.clipboard) return setState("failed");
    navigator.clipboard.writeText(text).then(
      () => setState("copied"),
      () => setState("failed"),
    );
  };
  return (
    <button type="button" className={`btn btn--sm copy-btn${state === "copied" ? " is-copied" : ""}`} onClick={copy} aria-live="polite">
      {state === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy" : label}
    </button>
  );
}

/** `toolbar`: controls for what the modal is showing (the component library puts the preview sizes there). */
export function LibModal({ label, onClose, actions, toolbar, children }: { label: string; onClose: () => void; actions?: React.ReactNode; toolbar?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Modal onClose={onClose} className="lib-modal" labelledBy="lib-modal-title">
      <header className="lib-modal__bar">
        <span id="lib-modal-title" className="label">
          {label}
        </span>
        {toolbar}
        <button type="button" className="btn btn--sm btn--ghost lib-modal__close" onClick={onClose} aria-label="Close">
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <div className="lib-modal__body">
        <div className="lib-modal__content">
          {children}
          {actions ? <div className="detail-actions">{actions}</div> : null}
        </div>
      </div>
    </Modal>
  );
}
