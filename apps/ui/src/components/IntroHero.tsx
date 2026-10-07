/**
 * The two page openers, shared so they can live on either page:
 * - IntroHero: the headline with the two ways in (build / solve) and the animated product demo (now on the Dashboard).
 * - BannerHero: the image banner with the "Capture a style" news line (now on About FlowCode).
 */
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { navigate } from "../router";
import { AboutDemo } from "./AboutDemo";
import { Icon } from "./ui";

/** Start a build: open New build on the Dashboard (it listens for this event). */
export const startBuild = () => {
  navigate("/");
  setTimeout(() => window.dispatchEvent(new Event("fc:new-build")), 50);
};

export function IntroActions() {
  return (
    <div className="ab__actions">
      <button type="button" className="btn btn--primary" data-cp="start-prototype" onClick={startBuild}>
        Let&apos;s build something
      </button>
      <button type="button" className="btn" onClick={() => navigate("/discover/new")}>
        Let&apos;s solve something
      </button>
    </div>
  );
}

export function IntroHero({ eyebrow, extra }: { eyebrow: ReactNode; extra?: ReactNode }) {
  return (
    <section className="ab2__hero" aria-labelledby="intro-title">
      <div className="ab2__hero-text">
        <span className="ab2__eyebrow">
          <Sparkles size={13} aria-hidden="true" /> {eyebrow}
        </span>
        <h1 className="ab2__title" id="intro-title">
          Turn a PRD into a prototype <span className="ab2__accent">you can check.</span>
        </h1>
        <p className="ab2__lede">FlowCode plans, builds and checks a working prototype on your own computer. You decide what it builds, and you see exactly what it verified, and what it couldn&apos;t.</p>
        <IntroActions />
        {/* The two ways in, in a sentence each. */}
        <dl className="ab2__paths">
          <div>
            <dt>Let&apos;s build something</dt>
            <dd>You have a PRD or a clear idea. FlowCode plans the prototype, you approve the plan, and it builds and checks it.</dd>
          </div>
          <div>
            <dt>Let&apos;s solve something</dt>
            <dd>You only have a problem. FlowCode researches it with you and writes the PRD first, then you build from it.</dd>
          </div>
        </dl>
        {extra}
      </div>
      <AboutDemo />
    </section>
  );
}

export function BannerHero({ onBuild, dark }: { onBuild?: () => void; dark?: boolean }) {
  return (
    <section className={`hero hero--panel${dark ? " hero--dark" : ""}`} aria-labelledby="banner-title">
      <div style={{ position: "relative", display: "grid", gap: 4, maxWidth: 860 }}>
        <span className="eyebrow">
          <b>FEATURE</b> Capture a style from any website or screenshot
        </span>
        <h2 id="banner-title" className="hero__title">
          Turn a PRD into a
          <br />
          <span className="grad">clickable prototype.</span>
        </h2>
        <p className="hero__sub">Design first: real screens, links and search, with simulated data saved in the browser. When the design is right, Launch readiness hands off the real app.</p>
        <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" className="btn btn--primary" style={{ height: 48, padding: "0 18px" }} onClick={onBuild ?? startBuild}>
            Let&apos;s build something <Icon name="chevron" size={14} />
          </button>
          <span className="btn-or" aria-hidden="true">
            or
          </span>
          <button type="button" className="btn hero__solve" style={{ height: 48, padding: "0 16px" }} title="No PRD yet? Describe the problem; FlowCode researches it with you and writes the PRD." onClick={() => navigate("/discover/new")}>
            Let&apos;s solve something <Icon name="chevron" size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
