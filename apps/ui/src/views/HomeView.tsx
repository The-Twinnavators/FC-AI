/**
 * Home: where a build starts. "What would you like to build?" over a slow animated backdrop, the composer in the middle
 * (ProductComposer: name, description, attachments, product type), and the drafts you haven't started yet. The project
 * overview that used to open here is the Dashboard (/dashboard).
 */
import { useEffect, useRef } from "react";
import { useResource } from "../api";
import { navigate } from "../router";
import { ProductComposer } from "../components/ProductComposer";
import { HomeBackdrop } from "../components/HomeBackdrop";
import { SetupSteps } from "./SetupView";
import type { ProjectSetup } from "@flowcode/contracts";
import { SetupCard } from "../components/SetupCard";
import { startBuild } from "../components/IntroHero";
import { HowItWorks } from "../components/HowItWorks";

export function HomeView({ draft }: { draft?: { projectId: string; name: string; setup: ProjectSetup } } = {}) {
  const drafts = useResource<Array<{ project: { id: string; name: string }; updatedAt: string }>>("/setups");
  const wrap = useRef<HTMLDivElement>(null);
  // "Let's build something" from anywhere (and New build's old event) lands here with the cursor in the description.
  useEffect(() => {
    const focus = () => wrap.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    focus();
    window.addEventListener("fc:new-build", focus);
    return () => window.removeEventListener("fc:new-build", focus);
  }, []);
  return (
    <>
    <div className="home page-enter" ref={wrap}>
      <HomeBackdrop />
      <SetupSteps projectId={draft?.projectId} at="describe" />
      <div className="home__inner">
        <SetupCard compact />
        <h1 className="home__title" id="composer-title">
          What would you like to build?
        </h1>
        <ProductComposer projectId={draft?.projectId} initial={draft ? { name: draft.name, setup: draft.setup } : undefined} />
        {!draft && drafts.data?.length ? (
          <nav className="home__drafts" aria-label="Drafts not started yet">
            <span className="home__drafts-h">Continue a draft</span>
            {drafts.data.map((d) => (
              <button key={d.project.id} type="button" className="home__draft" onClick={() => navigate(`/new/${d.project.id}/look`)}>
                {d.project.name}
              </button>
            ))}
          </nav>
        ) : null}
        {!draft ? (
          <button type="button" className="home__how-link" onClick={() => document.getElementById("newbuild")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
            How FlowCode AI works
          </button>
        ) : null}
      </div>
    </div>
    {/* How FlowCode works, at the bottom of Home (below the first screen and its backdrop). */}
    {!draft ? (
      <div id="newbuild" className="home__how">
        <HowItWorks onStart={startBuild} />
      </div>
    ) : null}
    </>
  );
}
