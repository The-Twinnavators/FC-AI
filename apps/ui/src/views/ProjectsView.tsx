import { DotField } from "../components/DotField";
import { useState } from "react";
import { SetupCard } from "../components/SetupCard";
import type { Project, Run } from "@flowcode/contracts";
import { post } from "../api";
import { IntroHero } from "../components/IntroHero";
import { Empty, Icon, ErrorNotice } from "../components/ui";
import { Dashboard } from "../components/Dashboard";
import { SkeletonBlock } from "../components/motion";
import { navigate } from "../router";
import { ProjectCards } from "./QualityOverview";

type ProjectRow = Project & { latestRun?: Run };

export function ProjectsView({ projects, reload }: { projects?: ProjectRow[]; reload: () => void }) {
  const [error, setError] = useState<string>();

  const openExisting = async () => {
    setError(undefined);
    const folder = await window.flowcode?.selectFolder?.();
    if (!folder) return;
    try {
      const p = await post<Project>("/projects", { name: folder.split(/[\\/]/).pop() || "Repository", workspacePath: folder });
      reload();
      navigate(`/projects/${p.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="dots-bg">
    {/* The same dot field as Create PRD's list, under a lens that follows the cursor. */}
    <DotField />
    <div className="page page-enter">
      <header className="page__head">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="lib__lede">Your builds, checks and projects at a glance.</p>
        </div>
      </header>
      {/* Until this computer can build (Ollama, a model, a passed coder test): the next step. */}
      <SetupCard />
      <Dashboard />

      <div className="home-split">
      {/* The three most recent projects, as small My Projects cards, on the page itself (no container). */}
      <section className="home-projects" data-guide="projects.list" data-reveal aria-labelledby="projects-heading">
        <header className="home-projects__head">
          <h2 className="home-projects__title" id="projects-heading">
            My Projects
          </h2>
          <span className="label">{projects?.length ?? 0} total</span>
          <button className="btn btn--sm home-projects__all" onClick={() => navigate("/quality")}>
            View all projects
            <Icon name="chevron" size={14} />
          </button>
        </header>
        {!projects ? (
          <SkeletonBlock rows={2} label="Loading projects" />
        ) : projects.length === 0 ? (
          <Empty title="No projects yet" illustration="server-down" action={<button className="btn btn--primary" onClick={() => navigate("/")}>Start a prototype</button>}>Bring a PRD, or describe what you want in your own words. FlowCode plans a clickable prototype, builds it and checks its design.</Empty>
        ) : (
          <ProjectCards compact reload={reload} projects={[...projects].sort((a, b) => (b.latestRun?.createdAt ?? b.updatedAt).localeCompare(a.latestRun?.createdAt ?? a.updatedAt)).slice(0, 3)} />
        )}
      </section>

      </div>
      {/* The intro (what FlowCode does, the two ways in, a short live demo of a build), at the bottom: the Dashboard opens on its numbers. */}
      <div className="ab2 ab2--home">
        <IntroHero
          extra={
            <>
              {window.flowcode?.selectFolder ? (
                <button className="btn btn--ghost btn--sm ab2__repo" data-cp="open-folder" onClick={openExisting}>
                  <Icon name="folder" size={14} /> Or open an existing repository
                </button>
              ) : null}
              {error ? <ErrorNotice error={error} doing="do that" /> : null}
            </>
          }
        />
      </div>

    </div>
    </div>
  );
}
