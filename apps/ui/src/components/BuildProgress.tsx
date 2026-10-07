/**
 * Top bar build progress: shown only while a build is active (planning, waiting for your approval, building, checking
 * or recovering). It shows how far that build has got and opens it in the builder; with several active builds, a picker
 * chooses between them (the last one opened first). No active build, no bar.
 */
import { isFinishedRun } from "@flowcode/contracts";
import { useState } from "react";
import type { Project, Run, Task } from "@flowcode/contracts";
import { useResource } from "../api";
import { Led } from "./ui";
import { ViewInBuilder } from "./ViewInBuilder";
import { BuildTimer } from "./BuildTimer";

type ProjectRow = Project & { latestRun?: Run };
const KEY = "flowcode.topbarProject";
const WORKING = ["draft", "running", "verifying", "recovering"];
/** A build in progress, including one paused for your approval. */
const ACTIVE = [...WORKING, "awaiting_approval"];

function load(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Makes this project the one shown here (called when a project is opened in the builder). */
export function rememberBuildProject(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* per-viewer convenience only */
  }
}

export function BuildProgress() {
  const projects = useResource<ProjectRow[]>("/projects", [], 10_000);
  const [picked, setPicked] = useState<string | undefined>(load);

  const list = [...(projects.data ?? [])].filter((p) => p.latestRun && ACTIVE.includes(p.latestRun.status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const project = list.find((p) => p.id === picked) ?? list.find((p) => p.latestRun && WORKING.includes(p.latestRun.status)) ?? list[0];
  const run = project?.latestRun;
  const working = !!run && WORKING.includes(run.status);
  const view = useResource<{ run: Run; tasks: Task[]; active: boolean }>(run ? `/runs/${run.id}` : null, [run?.id], working ? 4000 : 15_000);

  // Nothing building right now: the top bar stays clear.
  if (!project) return null;
  const status = view.data?.run.status ?? run?.status;
  // A skipped step was replaced by smaller steps: it is neither done nor still to do, so it isn't counted at all.
  const tasks = (view.data?.tasks ?? []).filter((t) => t.status !== "skipped");
  const done = tasks.filter((t) => t.status === "verified").length;
  const planning = status === "draft" && !tasks.length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : isFinishedRun(status) ? 100 : 0;
  const label = !run ? "No builds yet" : planning ? "Planning" : tasks.length ? `${done} of ${tasks.length} tasks` : (status ?? "").replace(/_/g, " ");

  return (
    <div className="tb-build" data-guide="topbar.build">
      <label className="sr-only" htmlFor="tb-build-project">
        Project to show build progress for
      </label>
      {list.length > 1 ? (
        <select
          id="tb-build-project"
          className="select tb-build__select"
          value={project.id}
          onChange={(e) => {
            setPicked(e.target.value);
            rememberBuildProject(e.target.value);
          }}
        >
          {list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <span id="tb-build-project" className="tb-build__name" title={project.name}>
          {project.name}
        </span>
      )}
      <span className="tb-build__progress" title={status ? `${project.name}: ${status.replace(/_/g, " ")}` : project.name}>
        <Led status={status} />
        <span
          className={`tb-build__bar${planning || (working && !tasks.length) ? " is-busy" : ""}`}
          role="progressbar"
          aria-label={`${project.name} build progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={planning ? undefined : pct}
          aria-valuetext={label}
        >
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="tb-build__label">{label}</span>
        <BuildTimer run={view.data?.run ?? run} compact />
      </span>
      <ViewInBuilder projectId={project.id} projectName={project.name} runId={run?.id} className="tb-build__open" />
    </div>
  );
}
