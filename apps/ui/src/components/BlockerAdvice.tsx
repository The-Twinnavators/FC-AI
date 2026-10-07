/**
 * Under a stopped step: a suggested choice only when this computer's history of similar stops supports it, with the
 * numbers; otherwise it says there's no basis. Nothing is pre-selected; the buttons stay the person's.
 */
import { useResource } from "../api";

type Advice = { suggest?: "retry" | "retry_guided"; why: string; cloudHint?: string };
type External = { since?: string; changed: string[]; added: string[]; removed: string[] };

/** "You changed … since the build stopped": the retry will use your version. Only a notice. */
function ExternalEdits({ runId }: { runId: string }) {
  const res = useResource<External>(`/runs/${runId}/external-changes`, [runId], 15_000);
  const x = res.data;
  if (!x) return null;
  const all = [...x.changed, ...x.added.map((f) => `${f} (new)`), ...x.removed.map((f) => `${f} (deleted)`)];
  if (!all.length) return null;
  const name = (f: string) => f;
  return (
    <p className="blocker__external" data-cp="external-edits" role="note">
      <strong>You changed {all.length === 1 ? "a file" : `${all.length} files`} since the build stopped:</strong> <span className="mono">{all.slice(0, 4).map(name).join(", ")}{all.length > 4 ? ` +${all.length - 4} more` : ""}</span>. A retry starts from your version.
    </p>
  );
}

export function BlockerAdvice({ runId, taskId }: { runId: string; taskId: string }) {
  const res = useResource<Advice>(`/runs/${runId}/tasks/${taskId}/advice`, [runId, taskId], 0);
  const a = res.data;
  if (!a) return <ExternalEdits runId={runId} />;
  return (
    <>
    <ExternalEdits runId={runId} />
    <p className={`blocker__advice${a.suggest ? " blocker__advice--suggest" : ""}`} data-cp="blocker-advice">
      {a.suggest ? <strong>Suggested: {a.suggest === "retry_guided" ? "Troubleshoot, then retry with your guidance." : "Retry the step."} </strong> : null}
      {a.why}
    </p>
    {a.cloudHint ? <p className="blocker__advice">{a.cloudHint}</p> : null}
    </>
  );
}
