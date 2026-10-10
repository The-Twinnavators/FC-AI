/**
 * Home → How FlowCode works: the path from a PRD to a clickable prototype and the hand-off for the real app. A stage
 * list on the left (number, name, one line), the chosen stage on the right: its picture, what you do, where to find it
 * in FlowCode (real links), which agents do the work, and a tip. "Let's build something" opens New build.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { Lightbulb } from "lucide-react";
import { navigate } from "../router";
import { Icon } from "./ui";
import { HiwIllustration } from "./HiwIllustrations";
import { HiwCode } from "./HiwCode";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "./RobotHead";

type StageId = "prd" | "start" | "plan" | "build" | "check" | "launch";

interface Stage {
  id: StageId;
  name: string;
  /** One line under the name in the stage list. */
  summary: string;
  title: string;
  lede: string;
  youDo: string[];
  /** Where it is in FlowCode: a page to open, or "new-build" for the New build window. */
  where: Array<{ label: string; to: string }>;
  /** The agents that do this stage's work (only ones that really do). */
  agents: string[];
  tip: string;
}

const STAGES: Stage[] = [
  {
    id: "prd",
    name: "Write the PRD",
    summary: "Who it's for and what they need",
    title: "Start with a PRD for the real product",
    lede: "A PRD (product requirements document) says who the product is for, what they need to do and what's out of scope. FlowCode builds a clickable prototype of it, so you can try the idea before anything real is built.",
    youDo: ["No PRD yet? Open Create PRD: describe the problem, and FlowCode researches it with you and writes the PRD.", "Have one? Bring it to New build, with any content as JSON (it becomes the prototype's data).", "Keep the numbered headings and any layout you draw: the plan follows them."],
    where: [
      { label: "Create PRD", to: "/discover" },
      { label: "Settings → PRD templates", to: "/settings" },
    ],
    agents: ["researcher", "planner"],
    tip: "Put real examples in the PRD (names, prices, messages). The prototype shows them instead of made-up sample data.",
  },
  {
    id: "start",
    name: "Start a prototype",
    summary: "Bring the PRD and the look",
    title: "Start a prototype with your PRD and your look",
    lede: "New build takes your PRD and support files, and the look you want: screenshots or mockups, a page's HTML or CSS, or a website to take the style from.",
    youDo: ["Attach the PRD, content as JSON, and images or pages that show the style you want.", "Choose the look and feel, or give a website and FlowCode captures its colors, fonts, corners and surfaces.", "Name it, choose who writes the code (local or cloud) and how hands-on FlowCode is."],
    where: [
      { label: "New build", to: "new-build" },
      { label: "Create PRD → Build from this PRD", to: "/discover" },
    ],
    agents: [],
    tip: "Assisted suits most builds: routine steps run on their own, and anything that needs you still asks.",
  },
  {
    id: "plan",
    name: "Approve plan & design",
    summary: "Nothing is built before you say so",
    title: "Get the design right before anything is built",
    lede: "FlowCode captures the style onto your project's Design tab and writes a prototype plan from your PRD: the screens and features, the requirements each covers, and the tests that prove it.",
    youDo: ["Set the look on the Design tab: colors, type, corners, surfaces and motion. Capture a style again any time.", "Read the Prototype plan: each step, its requirements and its tests.", "Approve when both are right. Nothing is built before you do."],
    where: [
      { label: "My Projects → your project → Design", to: "/quality" },
      { label: "My Projects → your project → Prototype plan", to: "/quality" },
    ],
    agents: ["planner"],
    tip: "If the plan misses something, change the PRD and start again. A sharper PRD beats a long fix-up later.",
  },
  {
    id: "build",
    name: "Watch it build",
    summary: "One checked step at a time",
    title: "A clickable prototype, one checked step at a time",
    lede: "Agents build real screens with simulated data: it saves in the browser and resets on demand, links and search work, and every action has feedback. There's no backend to wait for.",
    youDo: ["Watch progress in the run: the strip at the bottom shows which agent is working.", "Approve anything that needs you, like installing a package.", "Queue a change while it works; it starts when the current step finishes."],
    where: [
      { label: "Your project → Preview and Activity", to: "/quality" },
      { label: "Approvals", to: "/approvals" },
    ],
    agents: ["coder", "debugger"],
    tip: "Every change is saved first, so any step can be undone, even after the run finishes.",
  },
  {
    id: "check",
    name: "Check & iterate",
    summary: "Checks pass, then you refine it",
    title: "Checked for design, then shaped by you",
    lede: "A step only counts when its checks pass: type check, tests and build, the live preview, screenshots, and a design review (your palette, contrast and touch targets). Then you refine it with follow-ups.",
    youDo: ["Try the prototype in the live preview, on a narrow window too.", "Ask for changes as follow-ups; FlowCode plans only the difference and keeps the look.", "Fine-tune the design on the Design tab whenever you like."],
    where: [
      { label: "Your project → Preview, Design and Review", to: "/quality" },
      { label: "My Projects → Suggestions", to: "/quality" },
    ],
    agents: ["critic"],
    tip: "Show it to people early. A prototype is cheap to change; the real app isn't.",
  },
  {
    id: "launch",
    name: "Hand off the real app",
    summary: "Everything the real app still needs",
    title: "When the design is right, plan the real app",
    lede: "Launch readiness lists everything the real app needs that the prototype simulates or leaves out: backend, data, accounts, security, privacy, accessibility, SEO and deployment, each with a prompt for a coding agent.",
    youDo: ["Open Launch readiness for your project and download it as Markdown.", "Give each item's prompt to a coding agent to build the real version, keeping the prototype's screens and design.", "Point Repo Report at the real repo to check its health as it grows."],
    where: [
      { label: "My Projects → Launch readiness", to: "/quality" },
      { label: "Repo Report", to: "/flowreport" },
    ],
    agents: [],
    tip: "Keep the prototype: it's the reference the real app is built to match.",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function HowItWorks({ onStart }: { onStart: () => void }) {
  const [tab, setTab] = useState<StageId>("prd");
  const i = STAGES.findIndex((s) => s.id === tab);
  const stage = STAGES[i]!;
  const prev = STAGES[i - 1];
  const next = STAGES[i + 1];
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const go = (n: number, focus = false) => {
    const s = STAGES[(n + STAGES.length) % STAGES.length]!;
    setTab(s.id);
    if (focus) tabs.current[STAGES.indexOf(s)]?.focus();
  };
  // Up/down (and left/right) move between stages, Home/End jump to the ends.
  const onKey = (e: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (step) return e.preventDefault(), go(i + step, true);
    if (e.key === "Home") return e.preventDefault(), go(0, true);
    if (e.key === "End") return e.preventDefault(), go(STAGES.length - 1, true);
  };
  const open = (to: string) => (to === "new-build" ? onStart() : navigate(to));

  return (
    <section className="hw reveal" data-guide="newbuild.form" aria-labelledby="hiw-title">
      <header className="hw__head">
        <div className="hw__intro">
          <span className="hw__eyebrow">How FlowCode works</span>
          <h2 className="hw__title" id="hiw-title">
            From a PRD to a <span className="hw__accent">clickable prototype</span>
          </h2>
          <p className="hw__lede">Six stages. You decide what gets built and approve the plan and the design before any code is written. FlowCode&apos;s agents build it and check every step.</p>
        </div>
      </header>

      <div className="hw__body">
        <div className="hw__steps" role="tablist" aria-label="Stages" aria-orientation="vertical" onKeyDown={onKey}>
          {STAGES.map((s, n) => (
            <button
              key={s.id}
              ref={(el) => {
                tabs.current[n] = el;
              }}
              type="button"
              role="tab"
              id={`tab-hiw-${s.id}`}
              aria-selected={s.id === tab}
              aria-controls={`panel-hiw-${s.id}`}
              tabIndex={s.id === tab ? 0 : -1}
              className={`hw__step${s.id === tab ? " is-active" : ""}${n < i ? " is-done" : ""}`}
              onClick={() => setTab(s.id)}
            >
              <span className="hw__num">{pad(n + 1)}</span>
              <span className="hw__step-text">
                <strong>{s.name}</strong>
                <small>{s.summary}</small>
              </span>
            </button>
          ))}
        </div>

        <article className="hw__panel" role="tabpanel" id={`panel-hiw-${tab}`} aria-labelledby={`tab-hiw-${tab}`}>
          <div className="hw__visual">
            <span className="hw__visual-num" aria-hidden="true">
              {pad(i + 1)}
            </span>
            <HiwCode key={`code-${stage.id}`} id={stage.id} />
            <HiwIllustration key={stage.id} id={stage.id} />
          </div>
          <div className="hw__content">
            <span className="hw__stage-of">
              Stage {i + 1} of {STAGES.length}
            </span>
            <h3 className="hw__stage-title">{stage.title}</h3>
            <p className="hw__stage-lede">{stage.lede}</p>

            <div className="hw__cols">
              <div className="hw__col">
                <h4 className="hw__label">What you do</h4>
                <ol className="hw__do">
                  {stage.youDo.map((d, n) => (
                    <li key={d}>
                      <span className="hw__do-num">{n + 1}</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="hw__col">
                <h4 className="hw__label">Where to find it</h4>
                <ul className="hw__where">
                  {stage.where.map((w) => (
                    <li key={w.label}>
                      <button type="button" className="hw__link" onClick={() => open(w.to)}>
                        <span>{w.label}</span>
                        <Icon name="chevron" size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                {stage.agents.length ? (
                  <>
                    <h4 className="hw__label">Who does the work</h4>
                    <ul className="hw__agents">
                      {stage.agents.map((a) => (
                        <li key={a}>
                          <RobotHead color={ROLE_COLOR[a] ?? "#9a9fd6"} id={`hw-${stage.id}-${a}`} size={24} />
                          <span>{ROLE_LABEL[a] ?? a}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            </div>

            <p className="hw__tip">
              <Lightbulb size={15} aria-hidden="true" />
              <span>{stage.tip}</span>
            </p>
          </div>
          <footer className="hw__pager">
            {prev ? (
              <button type="button" className="hw__page hw__page--prev" onClick={() => go(i - 1)}>
                <span className="hw__page-dir">
                  <Icon name="chevron" size={12} /> Previous
                </span>
                <span className="hw__page-name">{prev.name}</span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button type="button" className="hw__page hw__page--next" onClick={() => go(i + 1)}>
                <span className="hw__page-dir">
                  Next <Icon name="chevron" size={12} />
                </span>
                <span className="hw__page-name">{next.name}</span>
              </button>
            ) : (
              <button type="button" className="hw__page hw__page--next" onClick={onStart}>
                <span className="hw__page-dir">
                  Ready? <Icon name="chevron" size={12} />
                </span>
                <span className="hw__page-name">Start a prototype</span>
              </button>
            )}
          </footer>
        </article>
      </div>
    </section>
  );
}
