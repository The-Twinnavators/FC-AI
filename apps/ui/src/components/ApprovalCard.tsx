/** Approval card (§14.4): exact action, reason, affected items, risk, diff, scope choices, consequences. */
import { useState } from "react";
import { approvalForYou, type Approval } from "@flowcode/contracts";
import { post } from "../api";
import { Icon, UnifiedDiff, ErrorNotice } from "./ui";
import { navigate } from "../router";
import { RobotHead, ROLE_COLOR } from "./RobotHead";

/**
 * `savedTo`: where a saved idea goes, so the card can say so before it leaves: "project" (its project's Suggestions
 * tab, from the Approvals page) or "below" (the Saved for later list on the same tab).
 */
export function ApprovalCard({ approval, onDecided, savedTo = "project" }: { approval: Approval; onDecided?: () => void; savedTo?: "project" | "below" }) {
  const [busy, setBusy] = useState(false);
  // After Save for later or Dismiss: the idea card turns into a short note saying what happened, then fades away.
  const [note, setNote] = useState<{ kind: "saved" | "dismissed"; leaving: boolean }>();
  const playNote = (kind: "saved" | "dismissed") => {
    setNote({ kind, leaving: false });
    setTimeout(() => setNote({ kind, leaving: true }), 2600);
    setTimeout(() => onDecided?.(), 3100);
    // Fallback: if the list still shows this idea after reloading, bring the card back.
    setTimeout(() => setNote(undefined), 4800);
  };
  const [error, setError] = useState<string>();
  const decide = async (decision: "once" | "project" | "deny") => {
    setBusy(true);
    setError(undefined);
    try {
      // The exact action shown is sent back: if the record changed since, the decision is refused.
      const res = await post<{ followUpRunId?: string }>(`/approvals/${approval.id}/decision`, { decision, action: approval.action });
      if (approval.kind === "enhancement_idea" && decision === "deny") return playNote("dismissed");
      onDecided?.();
      // An accepted idea becomes a follow-up request: go and watch it.
      if (res?.followUpRunId) navigate(`/projects/${approval.projectId}/runs/${res.followUpRunId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  /** Keep an idea for later, or move it back to the new ideas. */
  const save = async (saved: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      await post(`/approvals/${approval.id}/save`, { saved });
      if (saved) return playNote("saved");
      onDecided?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // Improvement ideas FlowCode found: a suggestion to build, keep or dismiss, not a permission request.
  if (approval.kind === "enhancement_idea" && note) {
    return (
      <div className={`approval-saved${note.kind === "dismissed" ? " approval-saved--dismissed" : ""}${note.leaving ? " is-leaving" : ""}`} role="status">
        <span className="approval-saved__icon" aria-hidden="true">
          <Icon name={note.kind === "dismissed" ? "x" : "check"} size={14} />
        </span>
        <span className="approval-saved__text">
          <strong>
            {note.kind === "dismissed" ? "Dismissed" : "Saved for later"}: {approval.action}
          </strong>
          {note.kind === "dismissed" ? (
            <span>
              FlowCode won&apos;t suggest it again. It&apos;s listed in <a href="#/approvals">Approvals → Decision log</a>.
            </span>
          ) : savedTo === "below" ? (
            <span>It&apos;s now in Saved for later, below.</span>
          ) : (
            <span>
              Find it in this project&apos;s{" "}
              <a href={`#/quality/${approval.projectId}/ideas`}>Suggestions tab</a>, under Saved for later.
            </span>
          )}
        </span>
      </div>
    );
  }
  if (approval.kind === "enhancement_idea") {
    return (
      <article className="approval approval--idea reveal" aria-labelledby={`apr-${approval.id}`}>
        <header className="approval__head">
          <span className="chip chip--idea">
            <Icon name="spark" size={12} /> Idea
          </span>
          <span className="label">{approval.author === "you" ? "your idea" : "found by the Researcher agent"}{approval.savedForLater ? " · saved for later" : ""}</span>
        </header>
        <div className="approval__body">
          <div id={`apr-${approval.id}`} className="approval__action">
            {approval.action}
          </div>
          <p className="approval__why">{approval.reason}</p>
          {approval.detail ? (
            <details>
              <summary className="label" style={{ cursor: "pointer" }}>
                What the coder will be asked to do
              </summary>
              {approval.briefBy === "planner" ? (
                <div className="approval__brief-by" title="The Planner agent wrote this instruction for the coder">
                  <RobotHead color={ROLE_COLOR.planner!} id={`brief-${approval.id}`} size={22} />
                  <span>Written by the Planner agent</span>
                </div>
              ) : approval.author === "you" ? (
                <div className="approval__brief-by approval__brief-by--working" role="status">
                  <RobotHead color={ROLE_COLOR.planner!} id={`brief-${approval.id}`} size={22} className="robot-head--working" />
                  <span>The Planner agent is writing this up for the coder. For now, it shows your words.</span>
                </div>
              ) : null}
              <p className="approval__prompt">{approval.detail}</p>
            </details>
          ) : null}
          {error ? (
            <ErrorNotice error={error} doing="record your decision" />
          ) : null}
        </div>
        <footer className="approval__actions approval__actions--idea">
          <button className="btn btn--primary" data-cp="idea-build" disabled={busy} onClick={() => decide("once")} title="Starts a follow-up change now. With Supervised autonomy you approve its plan first.">
            Build this now
          </button>
          {approval.savedForLater ? (
            <button className="btn" disabled={busy} onClick={() => void save(false)} title="Put it back with the new ideas">
              Move back to new ideas
            </button>
          ) : (
            <button className="btn" disabled={busy} onClick={() => void save(true)} title="Keep it on this project's list; build it whenever you're ready">
              Save for later
            </button>
          )}
          <button className="btn btn--ghost" disabled={busy} onClick={() => decide("deny")} title="FlowCode won't suggest this idea again">
            Dismiss
          </button>
          <span className="approval__hint">{approval.savedForLater ? "Saved for later. Build it whenever you're ready." : "Dismissed ideas aren't suggested again."}</span>
        </footer>
      </article>
    );
  }
  const isDiff = approval.detail?.startsWith("===") || approval.detail?.includes("\n@@");
  const forYou = approvalForYou(approval);
  const canPersist = !!approval.persistKey && approval.kind !== "plan";
  return (
    <article className="approval reveal" aria-labelledby={`apr-${approval.id}`}>
      <header className="approval__head">
        <span className={`chip ${approval.risk === "high" ? "chip--bad" : "chip--warn"}`}>{approval.risk} risk</span>
        <span className="label">{approval.kind.replace(/_/g, " ")}</span>
        <span className="label" style={{ marginLeft: "auto" }}>
          awaiting decision
        </span>
      </header>
      <div className="approval__body">
        {forYou ? <p className="approval__foryou">{forYou}</p> : null}
        <div id={`apr-${approval.id}`} className="approval__action">
          {approval.action}
        </div>
        <dl>
          <dt>Reason</dt>
          <dd>{approval.reason}</dd>
          {approval.affected.length ? (
            <>
              <dt>Affects</dt>
              <dd className="mono">{approval.affected.join(", ")}</dd>
            </>
          ) : null}
          <dt>If denied</dt>
          <dd className="dim">{approval.consequencesOfDenial}</dd>
        </dl>
        {approval.detail ? (
          <details open={approval.kind === "plan"}>
            <summary className="label" style={{ cursor: "pointer" }}>
              {isDiff ? "Diff" : "Details"}
            </summary>
            {isDiff ? (
              <div className="codeblock" style={{ padding: 0 }}>
                <UnifiedDiff text={approval.detail} />
              </div>
            ) : (
              <pre className="codeblock" style={{ whiteSpace: "pre-wrap" }}>
                {approval.detail}
              </pre>
            )}
          </details>
        ) : null}
        {error ? (
          <ErrorNotice error={error} doing="record your decision" />
        ) : null}
      </div>
      <footer className="approval__actions">
        <button className="btn btn--primary" data-cp="approval-allow" disabled={busy} onClick={() => decide("once")}>
          {approval.kind === "plan" ? "Approve plan" : "Allow once"}
        </button>
        {canPersist ? (
          <button className="btn" disabled={busy} onClick={() => decide("project")}>
            Allow for project
          </button>
        ) : null}
        {/* The review step's approval: the plan to review is on the Prototype plan tab. */}
        {approval.kind === "plan" && approval.taskId ? (
          <button className="btn" onClick={() => navigate(`/quality/${approval.projectId}/plan`)}>
            <Icon name="checklist" size={14} /> Open the Prototype plan
          </button>
        ) : null}
        <button className="btn btn--danger" disabled={busy} onClick={() => decide("deny")}>
          Deny
        </button>
      </footer>
    </article>
  );
}
