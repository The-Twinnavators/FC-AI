import { useEffect, useState } from "react";
import { SetupCard } from "../components/SetupCard";
import type { Project, Run } from "@flowcode/contracts";
import { post } from "../api";
import { IntroHero, IntroActions } from "../components/IntroHero";
import { Empty, Icon, ErrorNotice } from "../components/ui";
import { NewBuild } from "../components/NewBuild";
import { Dashboard } from "../components/Dashboard";
import { SkeletonBlock } from "../components/motion";
import { navigate } from "../router";
import { HowItWorks } from "../components/HowItWorks";
import { ProjectCards } from "./QualityOverview";
import { Modal } from "../components/Modal";
import { NEW_BUILD_PRD_KEY } from "../components/PrdTemplates";

type ProjectRow = Project & { latestRun?: Run };

export function ProjectsView({ projects, reload }: { projects?: ProjectRow[]; reload: () => void }) {
  // New build opens as a 4-step modal: from Start a prototype (hero or How FlowCode works), or a PRD handed over from
  // Settings → PRD templates (left in session storage for New build).
  const [building, setBuilding] = useState(() => {
    try {
      return !!sessionStorage.getItem(NEW_BUILD_PRD_KEY);
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const open = () => setBuilding(true);
    window.addEventListener("fc:new-build", open);
    return () => window.removeEventListener("fc:new-build", open);
  }, []);
  const [error, setError] = useState<string>();

  // The most recent project, opened on its Design tab (where Capture a style lives).
  const openDesignTab = () => {
    const latest = [...(projects ?? [])].sort((a, b) => (b.latestRun?.createdAt ?? b.updatedAt).localeCompare(a.latestRun?.createdAt ?? a.updatedAt))[0];
    if (!latest) return setBuilding(true);
    navigate(`/projects/${latest.id}`);
    setTimeout(() => window.dispatchEvent(new CustomEvent("fc:show-tab", { detail: "styles" })), 300);
  };
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
    <div className="page page-enter">
      {/* Until this computer can build (Ollama, a model, a passed coder test): the next step. */}
      <SetupCard />
      {/* The intro: what FlowCode does, the two ways in, and a short live demo of a build. */}
      <div className="ab2 ab2--home">
        <IntroHero
          eyebrow={
            // Hover or focus the line to see what it is and where to find it.
            <span className="ab2__news-trigger">
              <button type="button" className="ab2__eyebrow-link" aria-describedby="capture-style">
                Capture a style from a website or screenshot
              </button>
              <aside className="ab2__news ab2__news--pop" id="capture-style" role="tooltip" aria-labelledby="capture-style-title">
                <span className="ab2__news-tag">Feature</span>
                <div>
                  <strong id="capture-style-title">Capture a style</strong>
                  <p>Give FlowCode a website address, or screenshots and mockups, and it copies the colours, fonts, corners and surfaces into your prototype. You can change any of it afterwards.</p>
                  <p className="ab2__news-where">
                    Find it when you{" "}
                    <button type="button" className="ab2__link" onClick={() => setBuilding(true)}>
                      start a new build
                    </button>{" "}
                    (step 2, Choose the look), or in any project&apos;s{" "}
                    <button type="button" className="ab2__link" onClick={openDesignTab}>
                      Design tab
                    </button>{" "}
                    → Capture a style.
                  </p>
                </div>
              </aside>
            </span>
          }
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

      <Dashboard />

      <div className="home-split">
      <div id="newbuild" data-reveal>
        <HowItWorks onStart={() => setBuilding(true)} />
      </div>
      {building ? (
        <Modal onClose={() => setBuilding(false)} labelledBy="newbuild-title" className="nb-modal">
          <NewBuild wizard onCancel={() => setBuilding(false)} />
        </Modal>
      ) : null}

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
          <Empty title="No projects yet" illustration="welcome" action={<button className="btn btn--primary" onClick={() => window.dispatchEvent(new Event("fc:new-build"))}>Start a prototype</button>}>Bring a PRD, or describe what you want in your own words. FlowCode plans a clickable prototype, builds it and checks its design.</Empty>
        ) : (
          <ProjectCards compact reload={reload} projects={[...projects].sort((a, b) => (b.latestRun?.createdAt ?? b.updatedAt).localeCompare(a.latestRun?.createdAt ?? a.updatedAt)).slice(0, 3)} />
        )}
      </section>
      </div>
      {/* Closing call to action: the same band as About FlowCode's. */}
      <div className="ab2 ab2--home-cta">
        <section className="ab2__cta" aria-labelledby="home-start">
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
  );
}

