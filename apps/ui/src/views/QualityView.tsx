/**
 * One project's page in My Projects: the prototype plan the build follows, the launch readiness checklist for the real
 * app, run reports, performance and repository intelligence, as tabs. The tab is part of the route (/quality/:id/:view)
 * so links and Back work. Build analysis and static triage have their own pages (they scan a repo on disk).
 */
import { useEffect, useState } from "react";
import type { Project } from "@flowcode/contracts";
import { Empty, Icon, Tabs } from "../components/ui";
import { navigate } from "../router";
import { Blocks } from "lucide-react";
import { BackLink } from "../components/BackLink";
import { SkeletonBlock } from "../components/motion";
import { Markdown } from "../components/Markdown";
import { get } from "../api";
import { LaunchView } from "./LaunchView";
import { PlanView } from "./PlanView";
import { ProjectWorkingAgent } from "../components/BuildTimer";
import { StartOver } from "../components/StartOver";
import { RunReports } from "./ReportsView";
import { RunPerformancePage } from "../components/RunPerformance";
import { ProjectDecisions, useProjectDecisions } from "../components/ProjectDecisions";

export type QualityTab = "plan" | "waiting" | "ideas" | "launch" | "reports" | "performance" | "intel";
const TABS: Array<{ id: QualityTab; label: string }> = [
  { id: "plan", label: "Prototype plan" },
  // This project's decision cards (the same records as the Approvals page).
  { id: "waiting", label: "Waiting on you" },
  { id: "ideas", label: "Suggestions" },
  { id: "launch", label: "Launch readiness" },
  { id: "reports", label: "Run reports" },
  { id: "performance", label: "Performance" },
  { id: "intel", label: "Repository intelligence" },
];

export function QualityView({ projects, projectId, view: routeView, runId }: { projects: Project[]; projectId: string; view?: string; runId?: string }) {
  const view: QualityTab = TABS.some((t) => t.id === routeView) ? (routeView as QualityTab) : "plan";
  const setView = (v: QualityTab) => navigate(`/quality/${projectId}/${v}`);
  // Switching project keeps the current tab.
  const setProjectId = (id: string) => navigate(`/quality/${id}/${view}`);
  const decisions = useProjectDecisions(projectId);
  const [intel, setIntel] = useState<string>();
  const [intelBusy, setIntelBusy] = useState(false);
  const [error, setError] = useState<string>();
  const runIntel = async () => {
    setError(undefined);
    setIntelBusy(true);
    try {
      setIntel((await get<{ markdown: string }>(`/projects/${projectId}/intelligence`)).markdown);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIntelBusy(false);
    }
  };
  // Opening the intelligence tab reads the repository the first time.
  useEffect(() => {
    if (view === "intel" && !intel && !intelBusy) void runIntel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  return (
    <div className="page">
      <BackLink fallback="/quality" fallbackLabel="My Projects" />
      <header className="page__head">
        <div>
          <span className="label">My Projects</span>
          <h1 className="page__title">{projects.find((p) => p.id === projectId)?.name ?? "Project"}</h1>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <ProjectWorkingAgent projectId={projectId} />
          <StartOver runId={(projects.find((p) => p.id === projectId) as (Project & { latestRun?: { id: string } }) | undefined)?.latestRun?.id} />
          <button className="btn btn--primary" onClick={() => navigate(`/projects/${projectId}`)} title="Open this project in the Agent Builder">
            <Blocks size={14} strokeWidth={1.75} aria-hidden="true" /> View in Agent Builder
          </button>
          {projects.length > 1 ? (
            <select className="select" style={{ width: 220 }} aria-label="Project" value={projectId} onChange={(e) => (setProjectId(e.target.value), setIntel(undefined))}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </header>
      <Tabs label="quality-view" value={view} onChange={setView} tabs={TABS.map((t) => (t.id === "waiting" && decisions.waiting.length ? { ...t, label: `Waiting on you (${decisions.waiting.length})` } : t.id === "ideas" && decisions.ideas.length + decisions.saved.length ? { ...t, label: `Suggestions (${decisions.ideas.length + decisions.saved.length})` } : t))} />
      {!projects.length ? <Empty title="No projects">Start a prototype first.</Empty> : null}
      <div role="tabpanel" id={`panel-quality-view-${view}`} aria-labelledby={`tab-quality-view-${view}`} className="qa-panel">
      {view === "intel" ? (
        <div className="qa-panel__actions">
          <button className="btn btn--sm" disabled={intelBusy} onClick={runIntel}>
            <Icon name="refresh" size={14} /> {intelBusy ? "Reading repository…" : "Re-read repository"}
          </button>
        </div>
      ) : null}
      {error ? <p className="notice notice--bad" role="alert">{error}</p> : null}
      {projectId && view === "plan" ? <PlanView key={projectId} projectId={projectId} /> : null}
      {projectId && view === "waiting" ? <ProjectDecisions key={`w-${projectId}`} projectId={projectId} mode="waiting" /> : null}
      {projectId && view === "ideas" ? <ProjectDecisions key={`i-${projectId}`} projectId={projectId} mode="ideas" /> : null}
      {projectId && view === "launch" ? <LaunchView key={projectId} projectId={projectId} projects={projects} embedded /> : null}
      {projectId && view === "reports" ? <RunReports key={projectId} projectId={projectId} runId={runId} /> : null}
      {projectId && view === "performance" ? <RunPerformancePage key={projectId} projectId={projectId} runId={runId} /> : null}
      {view === "intel" && intelBusy && !intel ? <SkeletonBlock rows={5} label="Reading repository" /> : null}
      {view === "intel" && intel ? (
        <section className="section">
          <div className="section__body">
            <Markdown source={intel} />
          </div>
        </section>
      ) : null}
      </div>
    </div>
  );
}
