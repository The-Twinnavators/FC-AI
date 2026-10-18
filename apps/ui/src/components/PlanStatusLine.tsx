/**
 * The build's plan, in one line under its request: which version is waiting, being revised, or approved (with the look
 * it was approved with). It stays after the approval card closes, so what was approved is never in doubt.
 */
import { useEffect } from "react";
import { useResource } from "../api";

interface Versions {
  versions: Array<{ version: number; status: "current" | "superseded" | "approved"; revision?: { request: string } }>;
  approval: { planVersion: number; look: { version: number | null }; approvedAt: string } | null;
  pendingApprovalId: string | null;
}

export function PlanStatusLine({ runId, status }: { runId: string; status: string }) {
  const res = useResource<Versions>(`/runs/${runId}/plan/versions`, [runId, status]);
  useEffect(() => {
    if (status !== "draft" && status !== "awaiting_approval") return;
    const t = window.setInterval(() => res.reload(), 3000);
    return () => window.clearInterval(t);
  }, [status, res]);
  const d = res.data;
  if (!d || !d.versions.length) return null;
  const last = d.versions[d.versions.length - 1]!;
  const text = d.approval
    ? `Plan version ${d.approval.planVersion} approved ${new Date(d.approval.approvedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${d.approval.look.version ? `look version ${d.approval.look.version}` : "base styling"}`
    : last.status === "superseded" && last.revision
      ? `Revising plan version ${last.version} as you asked: version ${last.version + 1} comes back for your approval`
      : d.pendingApprovalId
        ? `Plan version ${last.version} is waiting for your approval`
        : `Plan version ${last.version}`;
  return (
    <span className="plan-status" role="status" data-plan-status>
      {text}
    </span>
  );
}
