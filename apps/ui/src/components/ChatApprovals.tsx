/**
 * Approvals inside a conversation: structured action cards, not chat messages. Each shows the build it belongs to, the
 * exact action, its risk, why it's needed and its current state, with Approve and Deny. Typing "yes" in chat never
 * approves anything, and the assistant can't approve on your behalf. The same approval records back the Approvals page,
 * the build's Overview and the phone page, so a decision anywhere shows everywhere.
 */
import type { Approval, Project } from "@flowcode/contracts";
import { useResource } from "../api";
import { ApprovalCard } from "./ApprovalCard";

const STATE: Record<string, string> = { approved: "Approved", denied: "Denied", expired: "Expired" };

/** `since`: hide decisions made before this time (the Copilot's Clear). Approvals still waiting always show. */
export function ChatApprovals({ projectId, runId, compact, since }: { projectId?: string; runId?: string; compact?: boolean; since?: string }) {
  const pending = useResource<Approval[]>(projectId ? `/approvals?projectId=${projectId}` : "/approvals", [projectId], 10_000);
  const history = useResource<Approval[]>("/approvals/history?limit=30", [projectId, pending.data?.length], 0);
  const projects = useResource<Project[]>("/projects", []);
  const name = (id: string) => projects.data?.find((p) => p.id === id)?.name.replace(/\s+/g, " ") ?? "A project";
  const reload = () => {
    pending.reload();
    history.reload();
  };
  // Requests that hold up a build; optional ideas are on the Approvals page.
  const waiting = (pending.data ?? []).filter((a) => a.kind !== "enhancement_idea" && (!runId || !a.runId || a.runId === runId || a.projectId === projectId));
  const decided = (history.data ?? []).filter((a) => a.kind !== "enhancement_idea" && (!projectId || a.projectId === projectId) && (!since || (a.resolvedAt ?? a.createdAt) > since)).slice(0, compact ? 2 : 3);
  if (!waiting.length && !decided.length) return null;
  return (
    <div className="chat-approvals" aria-label="Approvals">
      {waiting.map((a) => (
        <article key={a.id} className="chat-approval" aria-label={`Approval needed for ${name(a.projectId)}`}>
          <header className="chat-approval__head">
            <span className="chip chip--approval">Needs your OK</span>
            <strong>{name(a.projectId)}</strong>
            <span className="muted">FlowCode is waiting for this decision</span>
          </header>
          <ApprovalCard approval={a} onDecided={reload} />
        </article>
      ))}
      {decided.map((a) => (
        <div key={a.id} className="chat-approval chat-approval--done">
          <span className={`chip ${a.status === "approved" ? "chip--ok" : "chip--stopped"}`}>{STATE[a.status] ?? a.status}</span>
          <span className="chat-approval__action">{a.action.slice(0, 140)}</span>
          <span className="muted">{name(a.projectId)}</span>
        </div>
      ))}
    </div>
  );
}
