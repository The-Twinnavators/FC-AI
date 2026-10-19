/**
 * The walkthrough: FlowCode's intended experience from a PRD to a verified app, told with the Frameproof build.
 * Every panel says what it is: Working (FlowCode does this today; shown from the real build), New (made for this
 * walkthrough), Simulated (a scripted stand-in, nothing is sent), Future (not built yet) or Manual (made by hand, not
 * by FlowCode). Real data comes from the recorded Frameproof run through the daemon; nothing here claims a step,
 * check or output that didn't happen.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { get, useResource } from "../api";
import { navigate, useRoute } from "../router";
import { DiffView, Icon, StatusChip, time } from "../components/ui";
import { RobotHead, ROLE_COLOR, ROLE_LABEL } from "../components/RobotHead";

const PROJECT = "prj_7dc3fb8e913b4f61840f";
const RUN = "run_b789650d36dd4323aa4b";
const HAND_BUILT_URL = "http://localhost:5310/";

type Kind = "working" | "new" | "simulated" | "future" | "manual";
const KIND_LABEL: Record<Kind, string> = { working: "Working", new: "New", simulated: "Simulated", future: "Future", manual: "Manual" };
const KIND_MEANS: Record<Kind, string> = {
  working: "FlowCode does this today; shown from the real Frameproof build",
  new: "Built for this walkthrough",
  simulated: "A scripted stand-in: nothing is sent or changed",
  future: "Not built yet",
  manual: "Made by hand, not by FlowCode",
};

function Badge({ kind }: { kind: Kind }) {
  return (
    <span className={`wt-badge wt-badge--${kind}`} title={KIND_MEANS[kind]}>
      {KIND_LABEL[kind]}
    </span>
  );
}

function Panel({ kinds, title, source, children, wide }: { kinds: Kind[]; title: string; source?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`wt-panel${wide ? " wt-panel--wide" : ""}`} aria-label={title}>
      <header className="wt-panel__head">
        <h3>{title}</h3>
        <span className="wt-panel__badges">
          {kinds.map((k) => (
            <Badge key={k} kind={k} />
          ))}
        </span>
      </header>
      <div className="wt-panel__body">{children}</div>
      {source ? <p className="wt-panel__source">{source}</p> : null}
    </section>
  );
}

interface RunView {
  run: { status: string; statusReason?: string; plan?: { compliance?: Array<{ id: number; label: string; ok: boolean; hard: boolean; problems: string[] }> }; modelAssignments?: Record<string, { model: string }> };
  tasks: Array<{ id: string; title: string; status: string; attempts: number; ordinal: number }>;
  checks: Array<{ id: string; kind: string; status: string; summary: string; taskId?: string; updatedAt: string }>;
  checkpoints: Array<{ id: string; label: string; safe: boolean; createdAt: string; taskId?: string }>;
  snapshots: Array<{ id: string; relativePath: string; createdAt: string; operation: string; taskId?: string }>;
}
interface RunEvent {
  id: string;
  type: string;
  message?: string;
  createdAt: string;
  taskId?: string;
}
interface ProtoPlan {
  requirements: { total: number; inSteps: number; forPeople: number; later: number; filledIn: number };
  steps: Array<{ n: number; title: string; kind: string; items: Array<{ title: string; section?: string; covers?: Array<{ id: string; text: string }>; tests?: Array<{ behaviour: string; expect: string }> }> }>;
}

const STAGES = [
  { id: "prd", title: "Bring a PRD", does: "Start a build from the product requirements you already have." },
  { id: "requirements", title: "Confirm the requirements", does: "See what FlowCode understood, and what it got wrong, before anything is built." },
  { id: "look", title: "Choose the visual direction", does: "Pick how the app should look; colours and type come from this one choice." },
  { id: "build", title: "Watch it build", does: "Follow each step, who is working on it, and where it stops for you." },
  { id: "preview", title: "Click through the app", does: "Use the app FlowCode made, as it is right now." },
  { id: "change", title: "Ask for a change", does: "Point at what should change and say how." },
  { id: "verify", title: "Check it and go back in time", does: "See what was checked, what changed, and every saved version." },
] as const;

export function WalkthroughView() {
  // The stage is in the address (#/walkthrough/<stage>), so a link opens it and the browser's Back goes back a stage.
  const route = useRoute();
  const stage = Math.max(0, STAGES.findIndex((x) => x.id === route.parts[1]));
  const go = (i: number) => navigate(`/walkthrough/${STAGES[Math.max(0, Math.min(STAGES.length - 1, i))].id}`);
  const view = useResource<RunView>(`/runs/${RUN}`, []);
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

  return (
    <main className="page wt" id="main">
      <header className="wt-top">
        <div>
          <h1 className="wt-top__title">From a PRD to a checked app</h1>
          <p className="wt-top__sub">
            The Frameproof build, start to finish. Real parts come from build <code className="mono">{RUN.slice(0, 12)}…</code>; anything else says what it is.
          </p>
          <dl className="wt-legend" aria-label="What the labels mean">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <div key={k}>
                <dt>
                  <Badge kind={k} />
                </dt>
                <dd>{KIND_MEANS[k]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <div className="wt-body">
        <nav className="wt-rail" aria-label="Walkthrough stages">
          <ol>
            {STAGES.map((x, i) => (
              <li key={x.id}>
                <button type="button" className="wt-rail__item" aria-current={i === stage ? "step" : undefined} onClick={() => go(i)}>
                  <span className="wt-rail__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{x.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <article className="wt-stage" aria-labelledby="wt-stage-title" key={s.id}>
          <header className="wt-stage__head">
            <p className="wt-stage__step">
              Step {stage + 1} of {STAGES.length}
            </p>
            <h2 id="wt-stage-title" ref={head} tabIndex={-1}>
              {s.title}
            </h2>
            <p className="wt-stage__does">{s.does}</p>
          </header>
          <div className="wt-stage__grid">
            {s.id === "prd" && <PrdStage />}
            {s.id === "requirements" && <RequirementsStage view={view.data} />}
            {s.id === "look" && <LookStage />}
            {s.id === "build" && <BuildStage view={view.data} />}
            {s.id === "preview" && <PreviewStage />}
            {s.id === "change" && <ChangeStage />}
            {s.id === "verify" && <VerifyStage view={view.data} />}
          </div>
          {view.error ? <p className="wt-note wt-note--bad">The build's records couldn't be loaded ({view.error}). Start the FlowCode daemon and reload.</p> : null}
        </article>
      </div>

      <footer className="wt-foot">
        <button type="button" className="btn" disabled={stage === 0} onClick={() => go(stage - 1)}>
          <Icon name="chevron" size={14} /> Back
        </button>
        <span className="wt-foot__pos" aria-live="polite">
          {stage + 1} / {STAGES.length}: {s.title}
        </span>
        {stage < STAGES.length - 1 ? (
          <button type="button" className="btn btn--primary" onClick={() => go(stage + 1)}>
            Next: {STAGES[stage + 1].title}
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => go(0)}>
            Done: start again
          </button>
        )}
      </footer>
    </main>
  );
}

/* 1. The PRD, read from the build's workspace (the file FlowCode imported). */
function PrdStage() {
  const prd = useResource<{ content: string }>(`/projects/${PROJECT}/file?path=${encodeURIComponent("spec/Frameproof-PRD.md")}`, []);
  const text = prd.data?.content ?? "";
  const title = /^#\s+(.+)$/m.exec(text)?.[1] ?? "Frameproof";
  const sections = [...text.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);
  const reqs = [...text.matchAll(/^###\s+(R\d+\s+—\s+.+)$/gm)].map((m) => m[1]);
  return (
    <>
      <Panel wide kinds={["working"]} title="The PRD FlowCode imported" source={<>Read from the build's workspace: <code className="mono">spec/Frameproof-PRD.md</code>, {text.length.toLocaleString()} characters.</>}>
        {prd.error ? <p className="wt-note wt-note--bad">Couldn't read the PRD: {prd.error}</p> : null}
        <p className="wt-prd__title">{title}</p>
        <div className="wt-prd">
          <div>
            <p className="wt-label">Sections</p>
            <ul className="wt-list wt-list--plain">
              {sections.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="wt-label">Functional requirements</p>
            <ul className="wt-list">
              {reqs.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
      <Panel wide kinds={["working"]} title="How it got here" source="New build in My Projects: description, attached PRD, Look, Complete app, Local model, Supervised.">
        <ol className="wt-steps">
          <li>Open My Projects and choose New build.</li>
          <li>Describe the app in one line and attach the PRD.</li>
          <li>Pick a Look (or keep the default), the build mode and the model.</li>
          <li>FlowCode reads the PRD and plans before it writes any code.</li>
        </ol>
        <button type="button" className="btn btn--sm" onClick={() => navigate("/quality")}>
          Open My Projects
        </button>
      </Panel>
    </>
  );
}

/* 2. What FlowCode extracted and planned, its own checks, and what a person's review found. */
function RequirementsStage({ view }: { view?: RunView }) {
  const plan = useResource<ProtoPlan>(`/projects/${PROJECT}/plan`, []);
  const [confirmed, setConfirmed] = useState<Record<number, boolean>>({});
  const checks = view?.run.plan?.compliance ?? [];
  const r = plan.data?.requirements;
  const features = (plan.data?.steps ?? []).filter((x) => x.kind === "feature");
  return (
    <>
      <Panel kinds={["working"]} title="What FlowCode read from the PRD" source="The build's prototype plan, version 1.">
        {r ? (
          <dl className="wt-stats">
            <div>
              <dt>Requirements found</dt>
              <dd>{r.total}</dd>
            </div>
            <div>
              <dt>Planned into build steps</dt>
              <dd>{r.inSteps}</dd>
            </div>
            <div>
              <dt>For a person to check</dt>
              <dd>{r.forPeople}</dd>
            </div>
            <div>
              <dt>Left for later</dt>
              <dd>{r.later}</dd>
            </div>
          </dl>
        ) : (
          <p className="wt-note">Loading the plan…</p>
        )}
        <p className="wt-label">Feature steps in the plan</p>
        <ol className="wt-list wt-list--tight">
          {features.map((x) => (
            <li key={x.n}>
              {x.title} <span className="wt-dim">({x.items.length} items)</span>
            </li>
          ))}
        </ol>
      </Panel>
      <Panel kinds={["working"]} title="FlowCode's own plan checks" source="13 checks run on every plan; a failed hard check marks the plan not ready to approve.">
        <ul className="wt-checks">
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? "is-ok" : "is-bad"}>
              <Icon name={c.ok ? "check" : "x"} size={14} />
              <span>
                {c.label}
                {c.problems.map((p) => (
                  <span key={p} className="wt-checks__problem">
                    {p}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel kinds={["simulated"]} title="Confirm before building" source="Recorded in the build's plan review (REVIEW.md). Ticking here saves nothing.">
        <p>A person's review found tests in the plan that contradict the PRD. FlowCode's checks caught 2 of these 6:</p>
        <ul className="wt-confirm">
          {[
            "Searching \"portrait\" filters the photos (no title contains it)",
            "A \"Portrait\" category filter (the only filters are All, Outdoor, Studio)",
            "Selection progress shows \"30%\" (the PRD counts photos out of five)",
            "Searching a list of galleries (the PRD has one gallery)",
            "Selecting five photos sets \"Submitted\" (only confirming submits)",
            "Removing a photo clears its note (notes stay attached)",
          ].map((t, i) => (
            <li key={t}>
              <label>
                <input type="checkbox" checked={!!confirmed[i]} onChange={(e) => setConfirmed((c) => ({ ...c, [i]: e.target.checked }))} />
                <span>{t}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="wt-dim">{Object.values(confirmed).filter(Boolean).length} of 6 marked to correct. Correcting tests inside a running build is a future capability.</p>
      </Panel>
    </>
  );
}

/* 3. The Look: the PRD's direction drawn as a sample, and the build's real Look state. */
function LookStage() {
  const state = useResource<{ label: string; base?: { detail: string }; selected?: { appearance: { primary: string; fonts?: { body?: string } }; version: number } }>(`/projects/${PROJECT}/design/state`, []);
  return (
    <>
      <Panel kinds={["simulated"]} title="Editorial contact sheet" source="Drawn from the PRD's visual direction (section 7). A sample, not the app.">
        <div className="wt-look" aria-label="Sample of the editorial contact sheet direction">
          <div className="wt-look__sheet">
            {["Golden Hour", "Window Light", "Walking Together", "Quiet Smile", "Garden Steps", "Soft Shadows"].map((t, i) => (
              <figure key={t} className={`wt-look__frame${i === 1 ? " is-picked" : ""}`}>
                <span className="wt-look__img" aria-hidden="true" />
                <figcaption>
                  {t}
                  {i === 1 ? <span className="wt-look__picked">Selected</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
          <ul className="wt-look__swatches" aria-label="Palette">
            <li>
              <span style={{ background: "#f6f3ec" }} /> Warm off-white
            </li>
            <li>
              <span style={{ background: "#1c1b19" }} /> Near-black
            </li>
            <li>
              <span style={{ background: "#3d5a99" }} /> Muted cobalt
            </li>
          </ul>
        </div>
      </Panel>
      <Panel kinds={["working"]} title="The build's Look right now" source="From the project's design state. Choosing and applying a Look is yours: the walkthrough changes nothing.">
        <p className="wt-big">{state.data?.label ?? "Loading…"}</p>
        {state.data?.base ? <p className="wt-dim">{state.data.base.detail}</p> : null}
        {state.data?.selected ? (
          <p>
            Version {state.data.selected.version} is selected: primary <code className="mono">{state.data.selected.appearance.primary}</code>
            {state.data.selected.appearance.fonts?.body ? `, ${state.data.selected.appearance.fonts.body}` : ""}. It is not the editorial direction yet.
          </p>
        ) : null}
        <button type="button" className="btn btn--sm" onClick={() => navigate(`/projects/${PROJECT}`)}>
          Open the build to change its Look
        </button>
      </Panel>
    </>
  );
}

/* 4. The build's real steps and events, replayed at speed. */
function BuildStage({ view }: { view?: RunView }) {
  const events = useResource<RunEvent[] | { events: RunEvent[] }>(`/runs/${RUN}/events/list?limit=9000`, []);
  const KEY = /^(task\.(started|verified|blocked)|run\.interrupted|preview\.ready)$/;
  const timeline = useMemo(() => {
    const all = Array.isArray(events.data) ? events.data : (events.data?.events ?? []);
    return all.filter((e) => KEY.test(e.type) && !/Retry requested/.test(e.message ?? ""));
  }, [events.data]);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    if (shown >= timeline.length) return setPlaying(false);
    const t = setTimeout(() => setShown((n) => n + 1), 420);
    return () => clearTimeout(t);
  }, [playing, shown, timeline.length]);
  const list = useRef<HTMLOListElement>(null);
  // The list follows the newest event inside its own box (scrollIntoView would move the page, and returns a promise).
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown]);
  const tasks = [...(view?.tasks ?? [])].sort((a, b) => a.ordinal - b.ordinal);
  const models = view?.run.modelAssignments ?? {};
  return (
    <>
      <Panel kinds={["working"]} title="The build's steps" source={`Every step of the Frameproof build and where it stands now. The run is ${view?.run.status ?? "…"}.`}>
        <ol className="wt-tasks">
          {tasks.map((t) => (
            <li key={t.id}>
              <StatusChip status={t.status} />
              <span>{t.title}</span>
              {t.attempts > 1 ? <span className="wt-dim">{t.attempts} tries</span> : null}
            </li>
          ))}
        </ol>
        <div className="wt-agents" aria-label="Who works on it">
          {(["planner", "coder", "debugger"] as const).map((role) => (
            <span key={role} className="wt-agent">
              <RobotHead color={ROLE_COLOR[role]!} id={`wt-${role}`} size={22} />
              {ROLE_LABEL[role]} <span className="wt-dim">{models[role]?.model ?? ""}</span>
            </span>
          ))}
        </div>
      </Panel>
      <Panel kinds={["working", "simulated"]} title="Replay of what happened" source="Real recorded events from this build; only the playback speed is made up.">
        <div className="wt-replay__bar">
          <button type="button" className="btn btn--sm btn--primary" onClick={() => (shown >= timeline.length ? (setShown(0), setPlaying(true)) : setPlaying((p) => !p))} disabled={!timeline.length}>
            <Icon name={playing ? "pause" : "play"} size={14} /> {playing ? "Pause" : shown >= timeline.length && shown ? "Replay" : "Play"}
          </button>
          <button type="button" className="btn btn--sm" onClick={() => (setPlaying(false), setShown(timeline.length))} disabled={!timeline.length}>
            Show all
          </button>
          <span className="wt-dim">
            {shown} of {timeline.length} events
          </span>
        </div>
        <ol className="wt-events" ref={list}>
          {timeline.slice(0, shown).map((e) => (
            <li key={e.id} className={`wt-event wt-event--${e.type.split(".")[1]}`}>
              <time dateTime={e.createdAt}>{time(e.createdAt)}</time>
              <span>{(e.message ?? e.type).slice(0, 220)}</span>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}

/* 5. The app FlowCode made, live, beside the hand-built reference (labelled as such). */
function PreviewStage() {
  const preview = useResource<{ url?: string } | null>(`/projects/${PROJECT}/preview`, []);
  const [which, setWhich] = useState<"flowcode" | "manual">("flowcode");
  const url = which === "flowcode" ? preview.data?.url : HAND_BUILT_URL;
  return (
    <Panel
      wide
      kinds={which === "flowcode" ? ["working"] : ["manual"]}
      title={which === "flowcode" ? "Frameproof as FlowCode built it (incomplete)" : "Hand-built reference, not made by FlowCode"}
      source={
        which === "flowcode"
          ? "The live preview of the build's workspace. Design and the selection features haven't run yet: it has the 12 photo records, search and filters, and a record view; no photos, selection or notes."
          : "Built by hand from the same PRD, outside FlowCode, as a reference for the target. Its tests passing say nothing about FlowCode."
      }
    >
      <div className="wt-seg" role="radiogroup" aria-label="Which app">
        <button type="button" role="radio" aria-checked={which === "flowcode"} onClick={() => setWhich("flowcode")}>
          FlowCode's build
        </button>
        <button type="button" role="radio" aria-checked={which === "manual"} onClick={() => setWhich("manual")}>
          Hand-built reference
        </button>
      </div>
      {url ? (
        <div className="wt-frame">
          <div className="wt-frame__bar">
            <span className="mono wt-dim">{url}</span>
            <a className="btn btn--sm" href={url} target="_blank" rel="noreferrer">
              <Icon name="external" size={13} /> Open in a tab
            </a>
          </div>
          <iframe key={url} src={url} title={which === "flowcode" ? "FlowCode's Frameproof build" : "Hand-built Frameproof reference"} sandbox="allow-scripts allow-same-origin allow-forms" />
        </div>
      ) : (
        <p className="wt-note">{which === "flowcode" ? "No preview is running for this build. Start it from the build's Preview tab." : "The hand-built reference isn't running."}</p>
      )}
    </Panel>
  );
}

/* 6. Asking for a change: the flow FlowCode has (follow-ups, Point & Edit), shown without sending anything. */
function ChangeStage() {
  const [text, setText] = useState("Show the photos larger in the Gallery, three to a row on desktop.");
  const [sent, setSent] = useState(false);
  return (
    <>
      <Panel kinds={["simulated"]} title="Describe the change" source="Nothing is sent from here: the build is paused and this is a stand-in for the follow-up box.">
        <label className="wt-field">
          <span>What should change?</span>
          <textarea rows={3} value={text} onChange={(e) => (setText(e.target.value), setSent(false))} />
        </label>
        <button type="button" className="btn btn--primary" disabled={!text.trim()} onClick={() => setSent(true)}>
          Plan this change
        </button>
        {sent ? (
          <div className="wt-plan" role="status">
            <p className="wt-agent">
              <RobotHead color={ROLE_COLOR.planner!} id="wt-change-planner" size={22} /> Planner (example of the plan you would review)
            </p>
            <ol className="wt-steps">
              <li>Change the photo grid in src/screens/GalleryScreen.tsx and its card styles.</li>
              <li>Check: type check, lint, build, the Gallery journey in the browser, screenshots at desktop and phone width.</li>
              <li>Ask you to approve the plan before anything is edited; save a version first so it can be undone.</li>
            </ol>
          </div>
        ) : null}
      </Panel>
      <Panel kinds={["working"]} title="Where this lives in FlowCode" source="In the build's workspace today.">
        <ul className="wt-list">
          <li>A follow-up request on a finished build, planned and approved like the first one.</li>
          <li>Point &amp; Edit in the Preview tab: click what should change on a fresh picture of the app, then say how.</li>
          <li>Retry a stopped step with your own instructions, from that step's Troubleshoot.</li>
        </ul>
        <p className="wt-dim">Correcting a planned step's tests, or splitting a step to fit a small local model, from here: Future.</p>
        <Badge kind="future" />
      </Panel>
    </>
  );
}

/* 7. The real checks, a real change with its diff, and every saved version. */
function VerifyStage({ view }: { view?: RunView }) {
  const fix = view?.snapshots.filter((x) => x.relativePath === "src/sections/RecordDetail.tsx" && x.createdAt > "2026-10-18T22:54").at(0);
  const [diff, setDiff] = useState<{ before: string; after: string }>();
  useEffect(() => {
    if (!fix) return;
    get<{ before: string; after: string }>(`/snapshots/${fix.id}/diff`)
      .then((d) => {
        const around = (s: string) => {
          const lines = s.split("\n");
          // The "Copy record id" action, from its label to the next action, in both versions.
          const at = lines.findIndex((l) => l.includes('label: "Copy record id"'));
          const end = lines.findIndex((l, i) => i > at && l.includes('id: "delete"'));
          return lines.slice(Math.max(0, at - 1), end > at ? end : at + 14).join("\n");
        };
        setDiff({ before: around(d.before), after: around(d.after) });
      })
      .catch(() => undefined);
  }, [fix?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The latest result of each check: the fixed step's own checks, and the whole build's.
  const latest = (rows: RunView["checks"]) => [...rows.reduce((m, c) => (m.has(c.kind) && m.get(c.kind)!.updatedAt > c.updatedAt ? m : m.set(c.kind, c)), new Map<string, RunView["checks"][number]>()).values()];
  const fixChecks = latest((view?.checks ?? []).filter((c) => c.taskId === fix?.taskId));
  const runChecks = latest((view?.checks ?? []).filter((c) => !c.taskId));
  const versions = [...(view?.checkpoints ?? [])].reverse();
  const [picked, setPicked] = useState<string>();
  return (
    <>
      <Panel kinds={["working"]} title="A real fix, and what checked it" source={fix ? `Change made by FlowCode's coder at ${time(fix.createdAt)} (${fix.operation} on ${fix.relativePath}), after one guided retry.` : "Loading the change…"}>
        <p className="wt-agent">
          <RobotHead color={ROLE_COLOR.coder!} id="wt-fix-coder" size={22} /> Coder, qwen3:8b: fixed the lint error in "Copy record id", keeping all three outcomes.
        </p>
        {diff ? <DiffView before={diff.before} after={diff.after} /> : <p className="wt-note">Loading the diff…</p>}
        <p className="wt-dim">Then: type check, lint, build, tests and the Gallery journey passed, and the step was verified.</p>
      </Panel>
      <Panel kinds={["working"]} title="The build's checks" source="Latest results from the run. The whole-build checks wait on steps that haven't run, because the build stopped before design.">
        <p className="wt-label">After the fix, on its step</p>
        <ul className="wt-checklist">
          {fixChecks.map((c) => (
            <li key={c.id}>
              <StatusChip status={c.status} />
              <span className="mono">{c.kind}</span>
              <span className="wt-dim">{c.summary.slice(0, 90)}</span>
            </li>
          ))}
        </ul>
        <p className="wt-label">Whole build</p>
        <ul className="wt-checklist">
          {runChecks.map((c) => (
            <li key={c.id}>
              <StatusChip status={c.status} />
              <span className="mono">{c.kind}</span>
              <span className="wt-dim">{c.summary.slice(0, 90)}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel kinds={["working"]} title="Saved versions" source={`${versions.length} checkpoints. Restoring one is a real action in the build's workspace; it is not run from here.`}>
        <ol className="wt-versions">
          {versions.map((v) => (
            <li key={v.id}>
              <button type="button" aria-pressed={picked === v.id} onClick={() => setPicked(v.id)}>
                <span className={`wt-dot${v.safe ? " is-safe" : ""}`} aria-hidden="true" />
                <span>{v.label}</span>
                <time dateTime={v.createdAt} className="wt-dim">
                  {time(v.createdAt)}
                </time>
              </button>
            </li>
          ))}
        </ol>
        {picked ? <p className="wt-note">Restore "{versions.find((v) => v.id === picked)?.label}" from the build's Overview. A green dot marks a version whose checks passed.</p> : null}
      </Panel>
    </>
  );
}
