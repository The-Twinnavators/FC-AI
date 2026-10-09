/** The blue View button: opens a project (at its latest build when there is one) in the FlowCode Builder. */
import { Blocks } from "lucide-react";
import { navigate } from "../router";

export function ViewInBuilder({ projectId, projectName, runId, className = "" }: { projectId: string; projectName: string; runId?: string; className?: string }) {
  return (
    <button type="button" className={`btn btn--sm btn--primary view-btn ${className}`.trim()} onClick={() => navigate(runId ? `/projects/${projectId}/runs/${runId}` : `/projects/${projectId}`)} aria-label={`View ${projectName} in the Agent Builder`}>
      <Blocks size={13} strokeWidth={1.75} aria-hidden="true" /> View
    </button>
  );
}
