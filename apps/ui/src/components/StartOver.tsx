/**
 * Start over from this PRD: opens New build with the PRD (and its background file) the project's latest build started
 * from, so a build planned before FlowCode's newer steps can be built again from scratch. You review it and click Start.
 */
import { useResource } from "../api";
import { navigate } from "../router";
import { NEW_BUILD_PRD_KEY } from "./PrdTemplates";

interface Refs {
  objective: string;
  references: Array<{ name: string; role: string; content: string }>;
}

export function StartOver({ runId }: { runId?: string }) {
  const refs = useResource<Refs>(runId ? `/runs/${runId}/references` : null, [runId]);
  const prd = refs.data?.references.find((r) => r.role === "prd");
  if (!prd) return null;
  const extra = refs.data!.references.find((r) => r.role === "text");
  const start = () => {
    try {
      sessionStorage.setItem(NEW_BUILD_PRD_KEY, JSON.stringify({ name: prd.name, content: prd.content, ...(extra ? { extra: { name: extra.name, content: extra.content } } : {}), description: refs.data!.objective }));
    } catch {
      return;
    }
    navigate("/");
    setTimeout(() => window.dispatchEvent(new CustomEvent("fc:new-build")), 300);
  };
  return (
    <button type="button" className="btn" onClick={start} title={`Open New build with ${prd.name} attached. Nothing starts until you click Start.`}>
      Start over from this PRD
    </button>
  );
}
