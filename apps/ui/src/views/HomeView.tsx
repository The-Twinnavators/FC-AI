/**
 * Home: where a build starts. "What would you like to build?" over a slow animated backdrop, the composer in the middle
 * (ProductComposer: name, description, attachments, product type), and the drafts you haven't started yet. The project
 * overview that used to open here is the Dashboard (/dashboard).
 */
import { useEffect, useRef } from "react";
import { useResource } from "../api";
import { ProductComposer } from "../components/ProductComposer";
import { HomeBackdrop } from "../components/HomeBackdrop";
import { SetupSteps } from "./SetupView";
import type { ProjectSetup } from "@flowcode/contracts";
import { SetupCard } from "../components/SetupCard";
import { DraftsButton, type Draft } from "../components/DraftsButton";
import { startBuild } from "../components/IntroHero";
import { HowItWorks } from "../components/HowItWorks";
import { Aurora } from "../components/Aurora";

export function HomeView({ draft }: { draft?: { projectId: string; name: string; setup: ProjectSetup } } = {}) {
  const drafts = useResource<Draft[]>("/setups");
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
      {!draft ? (
        <button type="button" className="home__scroll" onClick={() => document.getElementById("newbuild")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>
          How FlowCode AI works
          <span className="home__mouse" aria-hidden="true" />
        </button>
      ) : null}
      <div className="home__inner">
        <SetupCard compact />
        <h1 className="home__title" id="composer-title">
          What would you like to build?
        </h1>
        <ProductComposer projectId={draft?.projectId} initial={draft ? { name: draft.name, setup: draft.setup } : undefined} />
        {!draft && drafts.data?.length ? <DraftsButton drafts={drafts.data} reload={drafts.reload} /> : null}
      </div>
    </div>
    {/* How FlowCode works, at the bottom of Home (below the first screen and its backdrop). */}
    {!draft ? (
      <div id="newbuild" className="home__how">
        {/* The waves' purple, carried to the bottom of the page as a drifting aurora. */}
        <div className="home__aurora" aria-hidden="true">
          <Aurora colorStops={["#5227FF", "#9b6bff", "#5227FF"]} direction="bottom" amplitude={1} blend={0.5} height={0.5} speed={0.6} glow={0.6} />
        </div>
        <HowItWorks onStart={startBuild} />
      </div>
    ) : null}
    </>
  );
}
