/**
 * How long a build has taken, from the moment the request was sent (planning included) to the finish. Ticks every
 * second while the build is working; once it stops, shows the total. A resumed build keeps counting from the start.
 */
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import type { Run } from "@flowcode/contracts";
import { useResource } from "../api";
import { RobotHead, ROLE_COLOR, ROLE_LABEL, workingRole } from "./RobotHead";

const WORKING = ["draft", "running", "verifying", "recovering", "awaiting_approval"];

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/** h:mm:ss, e.g. 0:02:22 or 3:12:05. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function BuildTimer({ run, compact = false, clock = false }: { run?: Pick<Run, "status" | "createdAt" | "completedAt"> | null; compact?: boolean; clock?: boolean }) {
  const working = !!run && WORKING.includes(run.status);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [working]);
  if (!run) return null;
  const start = Date.parse(run.createdAt);
  const end = working ? now : Date.parse(run.completedAt ?? "") || NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const took = formatDuration(end - start);
  const text = clock ? formatClock(end - start) : working ? (compact ? took : `Building for ${took}`) : compact ? took : `Took ${took}`;
  return (
    <span className={`build-timer${working ? " build-timer--live" : ""}${compact ? " build-timer--compact" : ""}${clock ? " build-timer--clock" : ""}`} title={working ? `This build has been working for ${took} (since the request was sent)` : `This build took ${took} from request to finish`}>
      {clock ? null : <Timer size={compact ? 12 : 14} aria-hidden="true" />}
      {/* Screen readers hear the time when it changes state, not every second. */}
      <span aria-hidden={working ? true : undefined}>{text}</span>
      {working ? <span className="sr-only">Build in progress</span> : null}
    </span>
  );
}

/**
 * The agent working on a project's latest build, with its robot head (refreshes every few seconds). The elapsed time
 * isn't repeated here: the top bar and the Performance tab show it.
 */
export function ProjectWorkingAgent({ projectId }: { projectId: string }) {
  const projects = useResource<Array<{ id: string; latestRun?: Run }>>("/projects", [], 8000);
  const run = projects.data?.find((p) => p.id === projectId)?.latestRun;
  const working = !!run && WORKING.includes(run.status);
  const view = useResource<{ run: Run; tasks: Array<{ id: string; role: string; attempts: number }> }>(working ? `/runs/${run!.id}` : null, [run?.id], 5000);
  const role = working ? workingRole(view.data?.run ?? run, view.data?.tasks) : undefined;
  if (!role) return null;
  return (
    <span className="build-agent" title={`${ROLE_LABEL[role] ?? role} is working on this build`}>
      <RobotHead color={ROLE_COLOR[role] ?? "#9a9fd6"} id={`agent-${role}`} size={20} className="robot-head--working" />
      <span>{ROLE_LABEL[role] ?? role} is working</span>
    </span>
  );
}
