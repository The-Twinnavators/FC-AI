/**
 * The walkthrough: the path every FlowCode user takes, from describing an app to a checked prototype, one step at a
 * time. It's general: nothing here depends on a project on this computer. Each step says what you do and where (with a
 * button to go there), and shows a small built-in example, labeled Example, of what you'll see.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { navigate, useRoute } from "../router";
import { Icon, StatusChip } from "../components/ui";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "../components/RobotHead";
import { LearnTabs } from "../components/LearnTabs";
import { DotField } from "../components/DotField";
import { GuideShot } from "../components/GuideShot";

/** One card, in the Feature guide's card style. `example` marks a made-up sample of what you'll see. */
function Card({ title, example, children }: { title: string; example?: boolean; children: ReactNode }) {
  return (
    <section className="section guide-card wt-panel" aria-label={title}>
      <div className="section__body guide-card__body">
        <div className="guide-card__head">
          {example ? (
            <span className="wt-badge wt-badge--simulated" title="A made-up sample of what you'll see; not from your projects">
              Example
            </span>
          ) : null}
          <h3 className="guide-card__title">{title}</h3>
        </div>
        <div className="wt-panel__body">{children}</div>
      </div>
    </section>
  );
}

/** What you do on this step, and a button to go there. */
function YouDo({ steps, go }: { steps: ReactNode[]; go?: { label: string; path: string } }) {
  return (
    <Card title="What you do">
      <ol className="wt-steps">
        {steps.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ol>
      {go ? (
        <button type="button" className="btn btn--sm" onClick={() => navigate(go.path)}>
          {go.label} <Icon name="chevron" size={13} />
        </button>
      ) : null}
    </Card>
  );
}

const STAGES = [
  { id: "describe", title: "Describe your app", does: "Say what you want to build. A PRD helps, but isn't required." },
  { id: "look", title: "Choose the look", does: "Pick a starting template and the colors, type and feel." },
  { id: "hands-on", title: "Choose how hands-on", does: "Decide how often FlowCode asks you, and which AI writes the code." },
  { id: "plan", title: "Approve the plan", does: "FlowCode plans the screens, steps and tests. Nothing is built until you approve." },
  { id: "build", title: "Watch it build", does: "Each step is built, then checked, before the next one starts." },
  { id: "change", title: "Try it and ask for changes", does: "Click through the app, then say what should change." },
  { id: "review", title: "Review and undo", does: "See what was checked and what changed, and go back to any version." },
] as const;

export function WalkthroughView() {
  // The step is in the address (#/walkthrough/<step>), so a link opens it and the browser's Back goes back a step.
  const route = useRoute();
  const stage = Math.max(0, STAGES.findIndex((x) => x.id === route.parts[1]));
  const go = (i: number) => navigate(`/walkthrough/${STAGES[Math.max(0, Math.min(STAGES.length - 1, i))].id}`);
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    head.current?.focus({ preventScroll: true });
  }, [stage]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], iframe")) return;
      if (e.key === "ArrowRight") go(stage + 1);
      if (e.key === "ArrowLeft") go(stage - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const s = STAGES[stage];

  // The Feature guide's layout: page header, the steps as the left list, one step's cards on the right.
  return (
    <div className="dots-bg">
    <DotField />
    <div className="page wt">
      <LearnTabs at="walkthrough" />
      <header className="page__head">
        <div>
          <h1 className="page__title">Walkthrough</h1>
          <p className="lib__lede">How a build goes in FlowCode, from describing your app to a checked prototype, in seven steps.</p>
        </div>
      </header>

      <div className="settings-layout guide-layout">
        <nav className="settings-nav" aria-label="Walkthrough steps">
          {STAGES.map((x, i) => (
            <button key={x.id} type="button" className="settings-nav__item wt-nav__item" aria-current={i === stage ? "step" : undefined} aria-selected={i === stage} onClick={() => go(i)}>
              <span className="wt-nav__n" aria-hidden="true">
                {i + 1}
              </span>
              <span className="settings-nav__label">{x.title}</span>
            </button>
          ))}
        </nav>

        <article className="settings-panel wt-stage" aria-labelledby="wt-stage-title" key={s.id}>
          <header className="wt-stage__head">
            <p className="wt-stage__step">
              Step {stage + 1} of {STAGES.length}
            </p>
            <h2 id="wt-stage-title" ref={head} tabIndex={-1}>
              {s.title}
            </h2>
            <p className="wt-stage__does">{s.does}</p>
          </header>
          {s.id === "describe" && <Describe />}
          {s.id === "look" && <Look />}
          {s.id === "hands-on" && <HandsOn />}
          {s.id === "plan" && <Plan />}
          {s.id === "build" && <Build />}
          {s.id === "change" && <Change />}
          {s.id === "review" && <Review />}
          <footer className="wt-foot">
            <button type="button" className="btn" disabled={stage === 0} onClick={() => go(stage - 1)}>
              <Icon name="chevron" size={14} /> Back
            </button>
            {stage < STAGES.length - 1 ? (
              <button type="button" className="btn btn--primary" onClick={() => go(stage + 1)}>
                Next: {STAGES[stage + 1].title} <Icon name="chevron" size={14} />
              </button>
            ) : (
              <button type="button" className="btn btn--primary" onClick={() => navigate("/")}>
                Start a build <Icon name="chevron" size={14} />
              </button>
            )}
          </footer>
        </article>
      </div>
    </div>
    </div>
  );
}

/* 1. Describe: Home's composer. */
function Describe() {
  return (
    <>
      <YouDo
        steps={[
          <>On Home, write what the app is for, who uses it and what they need to do.</>,
          <>Pick the product type (SaaS, website, online store…). It decides which page templates you're offered.</>,
          <>Have a PRD (a product requirements document)? Press Attach PRD &amp; Files and add it. No PRD? Create PRD helps you write one from a problem.</>,
          <>Press Next: Look and Feel. Your build is saved as a draft from here.</>,
        ]}
        go={{ label: "Open Home", path: "/" }}
      />
      <Card title="On screen">
        <GuideShot name="home-composer" alt="Home's What would you like to build? box" lookFor='The "What would you like to build?" box on Home. Fill in the name, product type and description, then press Next: Look and Feel.' />
        <GuideShot name="home-attach" alt="Attach PRD and Files on Home" lookFor="Attach PRD & Files, for your PRD and any HTML, CSS, JSON or images." />
      </Card>
    </>
  );
}

/* 2. Look and Feel. */
function Look() {
  return (
    <>
      <YouDo
        steps={[
          <>Start from a page template made for your product type; the preview shows it live.</>,
          <>Adjust the buttons, type, colors, layout and motion. Hover a color to pick a lighter or darker shade.</>,
          <>Add extras if you want them, like a dark mode switch or animations.</>,
          <>Press Next: Build. You can change the look later on the project's Design tab.</>,
        ]}
      />
      <Card title="On screen">
        <GuideShot name="look-studio" alt="The Look and Feel step" lookFor="The panel on the right: the template under Start from, then Buttons, Type, Colors, Layout and Motion. The preview on the left changes as you choose." />
      </Card>
    </>
  );
}

/* 3. Build: how hands-on, and who writes the code. */
function HandsOn() {
  return (
    <>
      <YouDo
        steps={[
          <>Choose how hands-on you want to be (below).</>,
          <>Choose who writes the code: Local AI on this computer, or Cloud AI once a provider is set up on the Models page.</>,
          <>Press Start Build. The build opens in the builder.</>,
        ]}
      />
      <Card title="The three levels">
        <dl className="wt-levels">
          <div>
            <dt>Guided</dt>
            <dd>You approve each important step.</dd>
          </div>
          <div>
            <dt>Collaborative</dt>
            <dd>Routine work runs on its own; FlowCode asks about real risks and new packages.</dd>
          </div>
          <div>
            <dt>Autonomous</dt>
            <dd>Works start to finish; still asks before anything leaves this computer.</dd>
          </div>
        </dl>
        <p className="wt-dim">Local AI keeps everything on this computer and is free. Cloud AI sends the code and screenshots to the provider, which charges per use.</p>
      </Card>
      <Card title="On screen">
        <GuideShot name="build-levels" alt="The Build step's hands-on levels" lookFor="The three level cards. The selected one is highlighted." />
        <GuideShot name="build-coder" alt="Code written by: Local AI or Cloud AI" lookFor="Code written by, under the levels. Cloud AI is grayed out until a provider is set up." />
      </Card>
    </>
  );
}

/* 4. The plan. */
function Plan() {
  return (
    <>
      <YouDo
        steps={[
          <>FlowCode reads your description and PRD, then writes a plan: the screens, the build steps and a test for each.</>,
          <>Read it in the builder's Overview. Anything that needs you also shows on Approvals.</>,
          <>Approve it to start building, or say what to change first.</>,
        ]}
        go={{ label: "Open Approvals", path: "/approvals" }}
      />
      <Card title="On screen">
        <GuideShot name="approvals" alt="A plan waiting for approval" lookFor="The plan's build steps, then Approve plan at the bottom left. Request changes sends it back with your notes; nothing is built until you approve." />
      </Card>
    </>
  );
}

/* 5. Building. */
function Build() {
  const steps: Array<[string, string]> = [
    ["Class schedule screen", "verified"],
    ["Book a spot", "running"],
    ["Cancel a booking", "pending"],
    ["Staff class list", "pending"],
  ];
  return (
    <>
      <YouDo
        steps={[
          <>Follow the build in the builder: each step shows who's working on it and whether its checks passed.</>,
          <>If a step stops, select Details on it, then Troubleshoot. It explains why in plain words and offers fixes.</>,
          <>When all steps pass, FlowCode checks the whole app: it starts, its pages work, and the design holds up at phone, tablet and desktop sizes.</>,
        ]}
        go={{ label: "Open My Projects", path: "/quality" }}
      />
      <Card title="A build in progress" example>
        <ol className="wt-tasks">
          {steps.map(([t, st]) => (
            <li key={t}>
              <StatusChip status={st} />
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <div className="wt-agents" aria-label="Who works on it">
          {(["planner", "coder", "debugger"] as const).map((role) => (
            <span key={role} className="wt-agent">
              <RobotHead color={ROLE_COLOR[role]!} id={`wt-${role}`} size={22} />
              {ROLE_LABEL[role]}
            </span>
          ))}
        </div>
        <p className="wt-dim">The Planner plans, the Coder builds each step, and the Debugger fixes a step whose checks fail.</p>
      </Card>
    </>
  );
}

/* 6. Try it and ask for a change. */
function Change() {
  return (
    <>
      <YouDo
        steps={[
          <>Open the builder's Preview tab and click through the app like a user would.</>,
          <>Ask for a change in the builder's Chat, in your own words.</>,
          <>Or use Point &amp; Edit on the Preview tab: click the part that should change, then say how.</>,
          <>FlowCode plans only the difference, builds it and checks it.</>,
        ]}
      />
      <Card title="Asking for a change" example>
        <div className="wt-chat">
          <p className="wt-chat__you">Make the class cards larger, three to a row on desktop.</p>
          <p className="wt-chat__bot">
            <RobotHead color={ROLE_COLOR.planner!} id="wt-change-planner" size={20} />
            <span>Plan: change the schedule grid and its cards, then check the Schedule screen at desktop and phone sizes. One step; approve it to start.</span>
          </p>
        </div>
      </Card>
    </>
  );
}

/* 7. Review and undo. */
function Review() {
  const checks: Array<[string, string]> = [
    ["Code checks", "passed"],
    ["Tests", "passed"],
    ["App starts and pages work", "passed"],
    ["Design at three sizes", "passed_with_warnings"],
  ];
  return (
    <>
      <YouDo
        steps={[
          <>The Review tab lists every changed file, with what changed. Undo any one there.</>,
          <>The build's report says what was checked, and anything that couldn't be checked.</>,
          <>Every finished step saves a version. Roll back to any of them from the Overview.</>,
          <>When the design is right, Launch readiness lists what the real app still needs.</>,
        ]}
      />
      <Card title="What a finished build shows" example>
        <ul className="wt-checklist">
          {checks.map(([t, st]) => (
            <li key={t}>
              <StatusChip status={st} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <p className="wt-dim">A warning means it passed with notes for you to read, like a color with low contrast on one screen.</p>
      </Card>
    </>
  );
}
