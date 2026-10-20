import { DotField } from "../components/DotField";
import { useState } from "react";
import { SetupCard } from "../components/SetupCard";
import type { Project, Run } from "@flowcode/contracts";
import { post } from "../api";
import { IntroHero, IntroActions } from "../components/IntroHero";
import { Empty, Icon, ErrorNotice } from "../components/ui";
import { Dashboard } from "../components/Dashboard";
import { SkeletonBlock } from "../components/motion";
import { navigate } from "../router";
import { ProjectCards } from "./QualityOverview";
import { CodeBackdrop } from "../components/CodeBackdrop";

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
          <Empty title="No projects yet" illustration="server-down" action={<button className="btn btn--primary" onClick={() => window.dispatchEvent(new Event("fc:new-build"))}>Start a prototype</button>}>Bring a PRD, or describe what you want in your own words. FlowCode plans a clickable prototype, builds it and checks its design.</Empty>
        ) : (
          <ProjectCards compact reload={reload} projects={[...projects].sort((a, b) => (b.latestRun?.createdAt ?? b.updatedAt).localeCompare(a.latestRun?.createdAt ?? a.updatedAt)).slice(0, 3)} />
        )}
      </section>

      </div>
      {/* The intro (what FlowCode does, the two ways in, a short live demo of a build), near the bottom: the Dashboard opens on its numbers. */}
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

      {/* Closing call to action: the same band as About FlowCode's. */}
      <div className="ab2 ab2--home-cta">
        <section className="ab2__cta" aria-labelledby="home-start">
          <CodeBackdrop />
          <h2 className="ab2__h" id="home-start">
            Start with what you have.
          </h2>
          <p className="ab2__lede">A PRD, a problem to solve, or an existing project folder.</p>
          <IntroActions />
          <p className="ab2__fine">
            FlowCode builds prototypes, not production apps; each project&apos;s Launch readiness lists what the real app still needs. Looking for something specific? <a href="#/guide">Browse the feature guide</a>.
          </p>
        </section>
      </div>
    </div>
    </div>
  );
}
