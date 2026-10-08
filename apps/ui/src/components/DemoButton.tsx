/**
 * Project card → Demo: starts the prototype's live preview (or reuses the running one) and opens it in your browser,
 * so you can try the build straight from its card. Nothing new is built; it's the same preview the builder shows.
 */
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { post } from "../api";

type Start = { url?: string; awaitingApproval?: string };

export function DemoButton({ projectId, projectName, className = "" }: { projectId: string; projectName: string; className?: string }) {
  const [state, setState] = useState<"idle" | "starting" | "approval" | "failed">("idle");
  const [why, setWhy] = useState<string>();
  // A failure or "needs approval" note shows for a moment, then the button is ready again.
  useEffect(() => {
    if (state !== "failed" && state !== "approval") return;
    const t = setTimeout(() => setState("idle"), 5000);
    return () => clearTimeout(t);
  }, [state]);
  const demo = async () => {
    setState("starting");
    setWhy(undefined);
    try {
      const r = await post<Start>(`/projects/${projectId}/preview/start`);
      if (r.awaitingApproval) {
        setWhy("Starting the preview needs your approval first: see Approvals.");
        return setState("approval");
      }
      if (!r.url) throw new Error("The preview didn't report an address.");
      await post("/open-external", { url: r.url });
      setState("idle");
    } catch (e) {
      setWhy((e as Error).message);
      setState("failed");
    }
  };
  const label = state === "starting" ? "Starting…" : state === "approval" ? "Needs approval" : state === "failed" ? "Couldn't start" : "Demo";
  return (
    <button
      type="button"
      className={`btn btn--sm demo-btn${state === "failed" ? " is-failed" : ""} ${className}`.trim()}
      onClick={() => void demo()}
      disabled={state === "starting"}
      aria-label={`Demo ${projectName}: open the running prototype in your browser`}
      title={why ?? "Open the running prototype in your browser"}
    >
      <Play size={13} strokeWidth={1.9} aria-hidden="true" /> {label}
    </button>
  );
}
