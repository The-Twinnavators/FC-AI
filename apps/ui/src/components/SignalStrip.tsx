/** The verification matrix as a strip of signal lights (§14.1 bottom bar, FR-V1). */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw, Wrench, X } from "lucide-react";
import { navigate } from "../router";
import type { Run, VerificationCheck, VerificationKind } from "@flowcode/contracts";
import { post } from "../api";
import { Led, StatusChip, StatusText } from "./ui";
import { BuildTimer } from "./BuildTimer";
import { CHECKS, checkCouldNotRun, statusLabel } from "@flowcode/contracts";
import { ROLE_COLOR, ROLE_LABEL, RobotHead } from "./RobotHead";

const ORDER: VerificationKind[] = [
  "project_preflight",
  "manifest_validation",
  "install",
  "typecheck",
  "lint",
  "tests",
  "build",
  "app_wiring",
  "server_start",
  "preview_health",
  "accessibility",
  "screenshots",
  "design_qa",
  "visual_critique",
  "spec_fidelity",
  "security_scan",
  "final_report",
];

// Check names in everyday words (shared with the rest of the app); the technical name stays in the tooltip.
const SHORT: Partial<Record<VerificationKind, string>> = Object.fromEntries(Object.entries(CHECKS).map(([k, v]) => [k, v.short]));
const NAME: Partial<Record<VerificationKind, string>> = Object.fromEntries(Object.entries(CHECKS).map(([k, v]) => [k, v.name]));
/** A check's status in one or two words (a blocked check is waiting on an earlier step, not stuck). */
// A check that was skipped because it couldn't run (no credit, model unreachable) verified nothing: say so.
const checkStatusShort = (st?: string, summary?: string) => (checkCouldNotRun(st, summary) ? "Couldn't run" : st === "passed_with_warnings" ? "Notes" : st === "blocked" ? "Waiting" : st === "failed" ? "Needs fixing" : !st || st === "not_run" ? "Not yet" : statusLabel(st));
const BROWSER: VerificationKind[] = ["server_start", "preview_health", "screenshots", "accessibility", "design_qa", "visual_critique", "spec_fidelity"];
const STATIC: VerificationKind[] = ["security_scan", "compliance_triage", "seo"];
const groupNote = (k: VerificationKind) =>
  BROWSER.includes(k) ? "Re-runs the browser checks together (dev server, preview, screenshots, accessibility, design, critique). About a minute." : STATIC.includes(k) ? "Re-runs the static scans together." : k === "project_preflight" || k === "manifest_validation" ? "Re-reads the project setup." : "";
const CAN_RERUN = (k: VerificationKind) => k !== "install";

export function SignalStrip({ run, checks, active, resumable, paused, controls, onRerun, agent, grip, style }: { /** Paused from the builder: the step in progress finishes, then it waits. */ paused?: boolean; /** Move grip (the builder layout). */ grip?: React.ReactNode; style?: React.CSSProperties; run?: Run; checks: VerificationCheck[]; active: boolean; resumable: boolean; controls: React.ReactNode; onRerun?: () => void; /** Role of the agent working right now. */ agent?: string }) {
  const [openKind, setOpenKind] = useState<VerificationKind>();
  const [anchor, setAnchor] = useState<DOMRect>();
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const rerun = async (k: VerificationKind) => {
    if (!run) return;
    setBusy((b) => new Set(b).add(k));
    setMsg((m) => ({ ...m, [k]: { ok: true, text: "Re-running…" } }));
    try {
      const r = await post<{ rerun: VerificationKind[] }>(`/runs/${run.id}/checks/${k}/rerun`);
      setMsg((m) => ({ ...m, [k]: { ok: true, text: r.rerun.length > 1 ? `Re-ran ${r.rerun.length} checks.` : "Re-ran." } }));
      onRerun?.();
    } catch (e) {
      setMsg((m) => ({ ...m, [k]: { ok: false, text: (e as Error).message } }));
    } finally {
      setBusy((b) => {
        const n = new Set(b);
        n.delete(k);
        return n;
      });
    }
  };
  const latest = new Map<string, VerificationCheck>();
  for (const c of checks) if (!c.taskId) latest.set(c.kind, c);
  const required = new Set(run?.strategy?.requiredChecks ?? []);
  const kinds = ORDER.filter((k) => required.has(k) || latest.has(k));
  const label = !run ? "Not started" : resumable ? "Paused" : paused ? (agent ? "Pausing" : "Paused") : statusLabel(run.status);
  return (
    <footer className="strip" data-guide="ws.strip" aria-label="Build status and checks" style={style}>
      {grip}
      <div className="strip__status">
        {/* The build timer sits above the bot (or the light), as h:mm:ss. */}
        <span className="strip__botcol">
        {run ? <BuildTimer run={run} clock /> : null}
        {/* While agents are working, the building blocks stack up instead of a static light. */}
        {active && agent ? (
          <span className="strip__bot" title={`${ROLE_LABEL[agent] ?? agent} is working`}>
            <RobotHead color={ROLE_COLOR[agent] ?? "#9a9fd6"} id={`strip-${agent}`} size={34} className="robot-head--working" />
          </span>
        ) : active ? (
          <span className="stack-anim strip__blocks" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          <Led status={resumable ? "awaiting_approval" : run?.status} />
        )}
        </span>
        <div style={{ display: "grid", gap: 2 }}>
          <span className="strip__eyebrow">Build status</span>
          <span style={{ fontWeight: 600, textTransform: "capitalize" }} aria-live="polite">
            <StatusText status={resumable || paused ? "awaiting_approval" : run?.status}>{label}</StatusText>
            {active ? <span className="sr-only"> (active)</span> : null}
          </span>
          {active && agent ? (
            <span className="strip__agent">
              <span className="strip__agent-dot" style={{ background: ROLE_COLOR[agent] }} aria-hidden="true" />
              {ROLE_LABEL[agent] ?? agent.replace(/_/g, " ")} {paused ? "is finishing this step" : "is working"}
            </span>
          ) : paused ? (
            <span className="strip__agent">Continue to start the next step</span>
          ) : null}
        </div>
      </div>
      <div className="strip__matrix" role="list" aria-label="Verification checks" tabIndex={0}>
        {kinds.length === 0 ? (
          <div className="signal" role="listitem">
            <span className="signal__name">matrix</span>
            <span className="signal__row">no checks yet</span>
          </div>
        ) : (
          kinds.map((k) => {
            const c = latest.get(k);
            return (
              <div key={k} role="listitem" className={`signal ${required.has(k) ? "signal--required" : ""}${busy.has(k) ? " is-rerunning" : ""}`}>
                <button
                  className="signal__btn"
                  aria-haspopup="dialog"
                  aria-expanded={openKind === k}
                  aria-label={`${NAME[k] ?? k}: ${checkStatusShort(c?.status, c?.summary)}. Details and re-run`}
                  title={`${NAME[k] ?? k} (${k}): ${CHECKS[k]?.explain ?? ""} ${checkStatusShort(c?.status, c?.summary)}${required.has(k) ? " · required" : ""}`}
                  onClick={(e) => {
                    setAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
                    setOpenKind(openKind === k ? undefined : k);
                  }}
                />
                <span className="signal__name">
                  {SHORT[k] ?? k}
                  {required.has(k) ? " *" : ""}
                </span>
                <span className="signal__row">
                  <Led status={c?.status} />
                  <span className="sr-only">{k}</span>
                  <StatusText status={c?.status}>{checkStatusShort(c?.status, c?.summary)}</StatusText>
                  {c?.evidenceRefs.length ? <span className="muted">·{c.evidenceRefs.length}</span> : null}
                </span>
              </div>
            );
          })
        )}
      </div>
      {openKind && anchor ? (
        <CheckPopover
          kind={openKind}
          check={latest.get(openKind)}
          required={required.has(openKind)}
          anchor={anchor}
          busy={busy.has(openKind)}
          disabled={!run || active}
          message={msg[openKind]}
          onRerun={() => void rerun(openKind)}
          onClose={() => setOpenKind(undefined)}
          runId={run?.id}
          projectId={run?.projectId}
        />
      ) : null}
      <div className="strip__controls" data-guide="ws.controls">{controls}</div>
    </footer>
  );
}

function CheckPopover({ kind, check, required, anchor, busy, disabled, message, onRerun, onClose, runId, projectId }: { kind: VerificationKind; check?: VerificationCheck; required: boolean; anchor: DOMRect; busy: boolean; disabled: boolean; message?: { ok: boolean; text: string }; onRerun: () => void; onClose: () => void; runId?: string; projectId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState<string>();
  const failing = !!check && ["failed", "blocked", "timed_out"].includes(check.status);
  // A failing check can be handed straight to FlowCode: a follow-up request with the exact problem, opened in the builder.
  const fix = async () => {
    if (!runId || !projectId || !check) return;
    setFixing(true);
    setFixError(undefined);
    try {
      const r = await post<{ id: string }>("/runs", {
        projectId,
        parentRunId: runId,
        objective: `Fix the failing ${(NAME[kind] ?? kind).toLowerCase()} so it passes, without changing what the app does.

What it reports:
${check.summary}`,
        constraints: [],
        attachedKnowledgeIds: [],
        references: [],
      });
      onClose();
      navigate(`/projects/${projectId}/runs/${r.id}`);
    } catch (e) {
      setFixError((e as Error).message);
    } finally {
      setFixing(false);
    }
  };
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const click = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.(".signal__btn") && onClose();
    addEventListener("keydown", key);
    addEventListener("mousedown", click);
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("mousedown", click);
    };
  }, [onClose]);
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - 352));
  const note = groupNote(kind);
  return createPortal(
    <div ref={ref} className="check-pop" role="dialog" aria-label={`${NAME[kind] ?? kind} check`} tabIndex={-1} style={{ left, bottom: window.innerHeight - anchor.top + 8 }}>
      <div className="check-pop__head">
        <strong>{NAME[kind] ?? kind}</strong>
        {required ? <span className="chip">required</span> : null}
        <span className={`chip chip--${check?.status === "passed" ? "ok" : check?.status === "passed_with_warnings" ? "notes" : failing ? "bad" : "off"}`} title={check?.status}>
          {checkStatusShort(check?.status, check?.summary)}
        </span>
        <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ marginLeft: "auto" }}>
          <X size={15} />
        </button>
      </div>
      <p className="check-pop__summary">{check?.summary || "This check hasn't run yet."}</p>
      {note ? <p className="check-pop__note muted">{note}</p> : null}
      {message ? (() => {
        // After a re-run, say what the result means: a re-run checks again, it doesn't change the code.
        const done = /^Re-ran/.test(message.text);
        const failing = done && check && !["passed", "passed_with_warnings"].includes(check.status);
        const text = failing
          ? "Checked again: it still needs fixing. Re-running only checks again; it doesn't change the code. Choose Fix this and FlowCode will fix it."
          : done && check
            ? "Checked again: it passes now."
            : message.text;
        return (
          <p className={`check-pop__msg${message.ok && !failing ? "" : " is-bad"}`} role="status">
            {text}
          </p>
        );
      })() : null}
      {fixError ? <p className="check-pop__msg is-bad" role="alert">{fixError}</p> : null}
      <div className="check-pop__actions">
      {failing && runId && !disabled ? (
        <button className="btn btn--primary btn--sm" disabled={fixing} onClick={() => void fix()} title="Send FlowCode a request to fix this, with the exact error">
          <Wrench size={14} aria-hidden="true" /> {fixing ? "Sending…" : "Fix this"}
        </button>
      ) : null}
      {CAN_RERUN(kind) ? (
        <button className={`btn btn--sm${failing && runId && !disabled ? "" : " btn--primary"}`} disabled={busy || disabled} onClick={onRerun} title={disabled ? "Available when the run is paused or finished" : undefined}>
          <RefreshCw size={14} className={busy ? "spin" : undefined} aria-hidden="true" /> {busy ? "Re-running…" : "Re-run"}
        </button>
      ) : (
        <p className="muted check-pop__note">Install runs through an approved command; use Resume to run it again.</p>
      )}
      </div>
      {disabled && !busy ? <p className="muted check-pop__note">Available when the run is paused or finished.</p> : null}
    </div>,
    document.body,
  );
}

export { StatusChip };
