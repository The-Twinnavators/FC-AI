/**
 * Home: where a build starts. "What would you like to build?" over a slow animated backdrop, the composer in the middle
 * (ProductComposer: name, description, attachments, product type) and your recent builds. Start opens the builder's
 * chat, where FlowCode asks only what matters and then plans and builds: no setup steps in between.
 */
import { useEffect, useRef } from "react";
import type { Project } from "@flowcode/contracts";
import { useResource } from "../api";
import { ProductComposer } from "../components/ProductComposer";
import { HomeBackdrop } from "../components/HomeBackdrop";

export function HomeView() {
  const projects = useResource<Project[]>("/projects");
  const wrap = useRef<HTMLDivElement>(null);
  // "Let's build something" from anywhere (and New build's old event) lands here with the cursor in the description.
  useEffect(() => {
    const focus = () => wrap.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    focus();
    window.addEventListener("fc:new-build", focus);
    return () => window.removeEventListener("fc:new-build", focus);
  }, []);
  const recent = [...(projects.data ?? [])].sort((a, b) => String(b.updatedAt ?? b.createdAt).localeCompare(String(a.updatedAt ?? a.createdAt))).slice(0, 4);
  return (
    <div className="home page-enter" ref={wrap}>
      <HomeBackdrop />
      <div className="home__inner">
        <h1 className="home__title" id="composer-title">
          What would you like to build?
        </h1>
        <ProductComposer />
        <p className="home__noprd">
          Not sure yet? <a href="#/discover/new">Let&apos;s solve something together</a>
        </p>
        {recent.length ? (
          <nav className="home__recent" aria-label="Recent builds">
            {recent.map((p) => (
              <a key={p.id} className="home__recent-item" href={`#/build/${p.id}`}>
                {p.name}
              </a>
            ))}
          </nav>
        ) : null}
      </div>
    </div>
  );
}
