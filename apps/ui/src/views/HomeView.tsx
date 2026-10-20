/**
 * Home: where a build starts. "What would you like to build?" over a slow animated backdrop, the composer in the middle
 * (ProductComposer: name, description, attachments, product type), and the drafts you haven't started yet. The project
 * overview that used to open here is the Dashboard (/dashboard).
 */
import { useEffect, useRef } from "react";
import { useResource } from "../api";
import { navigate } from "../router";
import { ProductComposer } from "../components/ProductComposer";
import { SetupCard } from "../components/SetupCard";
import { PrototypeScope } from "../components/IntroHero";

export function HomeView() {
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
    <div className="home page-enter" ref={wrap}>
      <div className="home__backdrop" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="home__inner">
        <SetupCard compact />
        <h1 className="home__title" id="composer-title">
          What would you like to build?
        </h1>
        <p className="home__lede">Describe it in your own words or attach a PRD. You choose the look and how hands-on to be next.</p>
        <ProductComposer />
        {drafts.data?.length ? (
          <nav className="home__drafts" aria-label="Drafts not started yet">
            <span className="home__drafts-h">Continue a draft</span>
            {drafts.data.map((d) => (
              <button key={d.project.id} type="button" className="home__draft" onClick={() => navigate(`/new/${d.project.id}/look`)}>
                {d.project.name}
              </button>
            ))}
          </nav>
        ) : null}
        <PrototypeScope />
      </div>
    </div>
  );
}
