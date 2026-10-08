/**
 * My Projects: one card per project with its launch readiness (checklist progress, open gates) and its
 * latest build analysis (health score, open issues). Pick one to open that project's page; the ⋯ menu
 * renames or deletes it, as on the home page.
 */
import { useEffect, useState } from "react";
import type { Project } from "@flowcode/contracts";
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
  updatedAt: string;
}

/**
 * Project cards with launch readiness and build health: the full set on My Projects, or `compact` (smaller, for the
 * Dashboard's most recent projects).
 */
export function ProjectCards({ projects, reload, compact }: { projects: Project[]; reload: () => void; compact?: boolean }) {
  const launch = useResource<Launch[]>("/launch/summary", [], 15000);
  const [reports, setReports] = useState<Record<string, Analysis | null>>();
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
  }, [projects]);
  const byId = new Map((launch.data ?? []).map((s) => [s.projectId, s]));
  const gauge = compact ? 44 : 56;
  return (
    <>
      {projects.length && (!reports || !launch.data) ? <SkeletonBlock rows={compact ? 2 : 3} label="Loading projects" /> : null}
      <div className={`lrc-cards${compact ? " lrc-cards--compact" : ""}`} role="list">
        {reports && launch.data
          ? projects.map((p, i) => {
              const r = reports[p.id];
              const l = byId.get(p.id);
              const ready = !!l && l.gateOpen === 0 && l.percent === 100;
              return (
                <div key={p.id} role="listitem" className="qa-card-wrap">
                <button type="button" className={`lrc-card qa-card${ready ? " is-ready" : ""}`} data-reveal style={{ ["--i" as string]: Math.min(i, 8) }} onClick={() => navigate(`/quality/${p.id}`)} data-ctx-project={p.id} data-ctx-label={p.name} data-guide="nav.quality">
                  <ProjectShot projectId={p.id} name={p.name} version={p.updatedAt} variant="banner" />
                  {/* Where the build stands, first (as on the Dashboard). */}
                  <div className="qa-card__status">
                      {l?.latestRunStatus ? (
                        <span className="lrc-card__status">
                          {["running", "recovering", "verifying"].includes(l.latestRunStatus) ? (
                            <span className="stack-anim strip__blocks" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                              <i />
                              <i />
                              <i />
                            </span>
                          ) : null}
                          <StatusChip status={l.latestRunStatus} dot />
                        </span>
                      ) : (
                        <span className="muted">No builds yet</span>
                      )}
                  </div>
                  <div className="lrc-card__top">
                    <div className="lrc-card__name">
                      <strong>{p.name}</strong>
                      <span className="mono">{p.projectType && p.projectType !== "unknown" ? p.projectType : "not analysed"}</span>
                    </div>
                  </div>
                  <div className="qa-card__metrics">
                    <div className="qa-metric">
                      <RadialGauge value={(l?.percent ?? 0) / 100} size={gauge} stroke={compact ? 4 : 5} label={`${p.name} launch readiness`} />
                      <span>
                        <span className="label">Launch</span>
                        <span className="qa-metric__val">{l ? `${l.completed} of ${l.counted} done` : "No checklist yet"}</span>
                      </span>
                    </div>
                    <div className="qa-metric">
                      {r ? <RadialGauge value={r.overall / 100} size={gauge} stroke={compact ? 4 : 5} label={`${p.name} build health`} /> : <span className="qa-metric__none" aria-hidden="true">—</span>}
                      <span>
                        <span className="label">Build health</span>
                        <span className="qa-metric__val">{r ? `${r.overall}/100 · ${r.verdict}` : "Not analysed"}</span>
                      </span>
                    </div>
                  </div>
                  <div className="lrc-card__foot">
                    <span className="muted">{r ? `Analysed ${ago(r.generatedAt)}` : l ? `Updated ${ago(l.updatedAt)}` : ""}</span>
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
      {loaded && !projects.length ? (
        <Empty title="No projects yet" action={<button className="btn btn--primary" onClick={() => navigate("/")}>Start a prototype</button>}>
          Each prototype gets its own Prototype plan and a Launch readiness checklist for the real app.
        </Empty>
      ) : null}
      <ProjectCards projects={projects} reload={reload} />
    </div>
  );
}
