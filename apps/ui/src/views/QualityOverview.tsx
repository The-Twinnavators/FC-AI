/**
 * My Projects: one card per project with its prototype build's progress (steps built, review) and its
 * latest build analysis (health score, open issues). Pick one to open that project's page; the ⋯ menu
 * renames or deletes it, as on the home page.
 */
import { useEffect, useState } from "react";
import { runStatusLabel, type Project } from "@flowcode/contracts";
import { get, useResource } from "../api";
import { navigate } from "../router";
import { Empty, StatusChip, ago } from "../components/ui";
import { RadialGauge, SkeletonBlock } from "../components/motion";
import { ProjectActions } from "../components/ProjectActions";
import { ViewInBuilder } from "../components/ViewInBuilder";
import { DemoButton } from "../components/DemoButton";
import { ProjectShot } from "../components/ProjectShot";

type Severity = "critical" | "high" | "medium" | "low" | "informational";
interface Analysis {
  overall: number;
  verdict: string;
  generatedAt: string;
  counts: Record<Severity, number>;
}
interface Launch {
  projectId: string;
  percent: number;
  completed: number;
  counted: number;
  gateOpen: number;
  blocked: number;
  needsReview: number;
  latestRunStatus?: string;
  latestRunStop?: { label: string; needsYou: boolean };
  updatedAt: string;
  /** The prototype build: its steps done out of all its steps, and where its review stands. */
  build?: { runId: string; done: number; total: number; status: string; review?: string };
}

/**
 * Project cards with launch readiness and build health: the full set on My Projects, or `compact` (smaller, for the
 * Dashboard's most recent projects).
 */
export function ProjectCards({ projects, reload, compact }: { projects: Project[]; reload: () => void; compact?: boolean }) {
  const launch = useResource<Launch[]>("/launch/summary", [], 15000);
  const [reports, setReports] = useState<Record<string, Analysis | null>>();
  // Keyed on the projects' ids, not the array: callers pass a new array on every render, and restarting here threw
  // the answers away before they landed, so My Projects stayed on its skeleton while requests piled up by the hundred.
  const ids = projects.map((p) => p.id).join(",");
  useEffect(() => {
    let alive = true;
    void Promise.all(
      projects.map((p) =>
        get<{ report?: Analysis | null }>(`/projects/${p.id}/build-analysis`)
          .then((r) => [p.id, r?.report && typeof r.report.overall === "number" ? r.report : null] as const)
          .catch(() => [p.id, null] as const),
      ),
    ).then((rows) => alive && setReports(Object.fromEntries(rows)));
    return () => {
      alive = false;
    };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = new Map((launch.data ?? []).map((s) => [s.projectId, s]));
  const gauge = compact ? 36 : 40;
  return (
    <>
      {projects.length && !launch.data ? <SkeletonBlock rows={compact ? 2 : 3} label="Loading projects" /> : null}
      <div className={`lrc-cards${compact ? " lrc-cards--compact" : ""}`} role="list">
        {launch.data
          ? projects.map((p, i) => {
              const r = reports?.[p.id];
              const l = byId.get(p.id);
              const ready = !!l && l.gateOpen === 0 && l.percent === 100;
              return (
                <div key={p.id} role="listitem" className="qa-card-wrap">
                <button type="button" className={`lrc-card qa-card${ready ? " is-ready" : ""}`} data-reveal style={{ ["--i" as string]: Math.min(i, 8) }} onClick={() => navigate(`/quality/${p.id}`)} title={`Open ${p.name}: its Prototype plan and Launch readiness`} data-ctx-project={p.id} data-ctx-label={p.name} data-guide="nav.quality">
                  <ProjectShot projectId={p.id} name={p.name} version={p.updatedAt} variant="banner" />
                  {/* Where the build stands, first (as on the Dashboard). */}
                  <div className="qa-card__status">
                      {l?.latestRunStatus ? (
                        <span className="lrc-card__status">
                          {["running", "recovering", "verifying"].includes(l.latestRunStatus) && !l.latestRunStop ? (
                            <span className="stack-anim strip__blocks" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : null}
                          {l.latestRunStop ? <span className={`chip ${l.latestRunStop.needsYou ? "chip--warn" : "chip--muted"}`} title="Why this build isn't working right now">{l.latestRunStop.label}</span> : <StatusChip status={l.latestRunStatus} dot />}
                        </span>
                      ) : (
                        <span className="muted">No builds yet</span>
                      )}
                  </div>
                  <div className="lrc-card__top">
                    <div className="lrc-card__name">
                      <strong>{p.name}</strong>
                      <span className="lrc-card__sub">
                        <span className="mono">{p.projectType && p.projectType !== "unknown" ? p.projectType : "not analyzed"}</span>
                        {r || l ? <span className="lrc-card__age">{ago(r ? r.generatedAt : l!.updatedAt)}</span> : null}
                      </span>
                    </div>
                  </div>
                  <div className="qa-card__metrics">
                    <div className="qa-metric">
                      {l?.build?.total ? <RadialGauge value={l.build.done / l.build.total} size={gauge} stroke={4} label={`${p.name} prototype build progress`} /> : <span className="qa-metric__none" aria-hidden="true">—</span>}
                      <span>
                        <span className="qa-metric__val" title={l?.build?.review ? runStatusLabel(l.build) : undefined}>{l?.build?.total ? `${l.build.done} of ${l.build.total} steps built` : "No steps yet"}</span>
                      </span>
                    </div>
                  </div>
                  <div className="lrc-card__foot">

                  </div>
                </button>
                <DemoButton projectId={p.id} projectName={p.name} className="card-demo" />
                <ViewInBuilder projectId={p.id} projectName={p.name} runId={(p as Project & { latestRun?: { id: string } }).latestRun?.id} className="card-view" />
                <ProjectActions project={p} onChanged={reload} />
                </div>
              );
            })
          : null}
      </div>
    </>
  );
}

export function QualityOverview({ projects, reload, loaded = true }: { projects: Project[]; reload: () => void; loaded?: boolean }) {
  return (
    <div className="page">
      <header className="page__head">
        <div>
          <span className="label">Work</span>
          <h1 className="page__title">My Projects</h1>
          <p className="lrc__meta">Every prototype you've built, each with its Prototype plan and its Launch readiness checklist for the real app. Open one in the builder to keep iterating on the design.</p>
        </div>
      </header>
      {!loaded ? <SkeletonBlock rows={3} label="Loading projects" /> : null}
      {loaded && !projects.length ? (
        <Empty title="No projects yet" action={<button className="btn btn--primary" onClick={() => navigate("/")}>Start a prototype</button>}>
          Each prototype gets its own Prototype plan and a Launch readiness checklist for the real app.
        </Empty>
      ) : null}
      <ProjectCards projects={projects} reload={reload} />
    </div>
  );
}
