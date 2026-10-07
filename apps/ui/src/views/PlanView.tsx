/**
 * Prototype plan: what a build from a PRD follows. Its steps (setup steps, then the screen and feature steps), each with
 * the PRD requirements it covers and the acceptance tests that prove it, with live status from the build. Below them,
 * the requirements a person checks the prototype against and the ones left out (for a later release or the real app).
 * The review step ("Review the prototype plan and the design") points here.
 */
import { useState } from "react";
import { useResource } from "../api";
import { navigate } from "../router";
import { Empty, Icon, ago } from "../components/ui";
import { SkeletonBlock } from "../components/motion";

type Status = "completed" | "in_progress" | "needs_review" | "blocked" | "not_started" | "not_applicable";
interface Covered {
  id: string;
  text: string;
}
interface StepItem {
  id: string;
  title: string;
  description: string;
  section: string;
  covers: Covered[];
  tests: Array<{ behaviour: string; expect: string }>;
  files: string[];
}
interface Step {
  key: string;
  n: number;
  title: string;
  kind: "setup" | "feature";
  status: Status;
  taskStatus?: string;
  evidence: string;
  runId?: string;
  taskId?: string;
  items: StepItem[];
}
interface Note {
  id: string;
  title: string;
  description: string;
  section: string;
  covers: Covered[];
  reason?: string;
  realApp?: boolean;
}
interface Plan {
  projectId: string;
  hasPlan: boolean;
  runId?: string;
  createdAt?: string;
  requirements?: { total: number; inSteps: number; forPeople: number; later: number; filledIn: number };
  steps: Step[];
  review: Note[];
  later: Note[];
}

const STATUS_LABEL: Record<Status, string> = { completed: "Done", in_progress: "Building", needs_review: "Needs a look", blocked: "Needs fixing", not_started: "Not started", not_applicable: "Skipped" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type ScreenStates = {
  screens: Array<{ id: string; label?: string; file?: string }>;
  specs: Record<string, { states: { loading: string; empty: string; error: string; success?: string } }>;
};

/**
 * D10: each screen's loading, empty and error states, from its screen spec (the coder builds to these). A screen with
 * no spec says so, so the gap is visible before the build rather than discovered after it.
 */
function ScreenStatesSection({ projectId }: { projectId: string }) {
  const { data } = useResource<ScreenStates>(`/projects/${projectId}/screens`, [projectId]);
  if (!data?.screens.length) return null;
  const missing = data.screens.filter((s) => !data.specs[s.id]).length;
  const openDesign = () => {
    navigate(`/projects/${projectId}`);
    setTimeout(() => window.dispatchEvent(new CustomEvent("fc:show-tab", { detail: "styles" })), 400);
  };
  return (
    <section className="pp-states" data-cp="screen-states" data-reveal aria-labelledby="pp-states-h">
      <div className="pp-states__head">
        <h3 id="pp-states-h">Screen states</h3>
        <span className="muted">
          {missing ? `${missing} of ${data.screens.length} screens have no spec: their loading, empty and error states are left to the build.` : "Every screen has its states specified."}
        </span>
        {missing ? (
          <button type="button" className="btn btn--sm" onClick={openDesign} title="Screen specs are drafted on the builder's Design tab, under Screens">
            Write screen specs
          </button>
        ) : null}
      </div>
      <table className="pp-states__table">
        <thead>
          <tr>
            <th scope="col">Screen</th>
            <th scope="col">Loading</th>
            <th scope="col">Empty</th>
            <th scope="col">Error</th>
          </tr>
        </thead>
        <tbody>
          {data.screens.map((s) => {
            const st = data.specs[s.id]?.states;
            return (
              <tr key={s.id}>
                <th scope="row">{s.label ?? s.id}</th>
                {st ? (
                  <>
                    <td>{st.loading}</td>
                    <td>{st.empty}</td>
                    <td>{st.error}</td>
                  </>
                ) : (
                  <td colSpan={3} className="muted">Not specified: no screen spec yet.</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function PlanView({ projectId }: { projectId: string }) {
  const { data, error } = useResource<Plan>(`/projects/${projectId}/plan`, [projectId], 5000);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (error && !data)
    return (
      <p className="notice notice--bad" role="alert">
        {error}
      </p>
    );
  if (!data) return <SkeletonBlock rows={5} label="Loading the prototype plan" />;
  if (!data.hasPlan)
    return (
      <Empty title="No prototype plan">This project was built before prototype plans; its next build from a PRD will have one.</Empty>
    );

  const features = data.steps.filter((s) => s.kind === "feature");
  const done = data.steps.filter((s) => s.status === "completed").length;
  const r = data.requirements;
  const allOpen = data.steps.length > 0 && data.steps.every((s) => open[s.key]);
  return (
    <div className="lrc lrc--embedded pp">
      <header className="lrc__head" data-reveal>
        <div>
          <h2 className="lrc__title lrc__title--sub">Prototype plan</h2>
          <p className="lrc__sub">What the build follows: each screen and feature step, the PRD requirements it covers and the acceptance tests that prove it. Set the look on the Styles page.</p>
          <p className="lrc__meta">
            {plural(data.steps.length, "step")} ({plural(features.length, "feature step")}), {done} done.
            {data.createdAt ? ` Written ${ago(data.createdAt)}.` : ""}
          </p>
        </div>
        <div className="lrc__actions">
          {data.runId ? (
            <button className="btn" onClick={() => navigate(`/projects/${projectId}/runs/${data.runId}`)}>
              Open the build
            </button>
          ) : null}
          <button className="btn btn--ghost btn--sm" onClick={() => setOpen(allOpen ? {} : Object.fromEntries(data.steps.map((s) => [s.key, true])))} aria-pressed={allOpen}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      </header>

      {r ? (
        <p className="lrc__plan" data-reveal>
          <Icon name="checklist" size={15} />
          <span>
            Your PRD has {plural(r.total, "requirement")}. {r.inSteps} {r.inSteps === 1 ? "is" : "are"} built in the steps below, {r.forPeople} {r.forPeople === 1 ? "is" : "are"} for a person to check and {r.later} {r.later === 1 ? "is" : "are"} left out of the prototype.
            {r.filledIn ? ` FlowCode placed ${plural(r.filledIn, "requirement")} the planner left out.` : ""}
          </span>
        </p>
      ) : null}

      <ol className="pp-steps" aria-label="Build steps">
        {data.steps.map((s) => {
          const expanded = !!open[s.key];
          const tests = s.items.reduce((n, i) => n + i.tests.length, 0);
          const reqs = s.items.reduce((n, i) => n + i.covers.length, 0);
          return (
            <li key={s.key} className={`pp-step pp-step--${s.status}${s.kind === "setup" ? " pp-step--setup" : ""}${expanded ? " is-open" : ""}`}>
              <button type="button" className="pp-step__head" aria-expanded={expanded} aria-controls={`pp-${s.key}`} onClick={() => setOpen((o) => ({ ...o, [s.key]: !expanded }))}>
                <span className="pp-step__n mono">{s.n}</span>
                <span className={`pp-dot pp-dot--${s.status}`} aria-hidden="true" />
                <span className="pp-step__text">
                  <span className="pp-step__title">{s.title}</span>
                  <span className="pp-step__meta">
                    {s.kind === "setup" ? "Setup" : [plural(reqs, "requirement"), plural(tests, "acceptance test")].join(" · ")}
                  </span>
                </span>
                <span className="pp-step__status">{STATUS_LABEL[s.status]}</span>
                <span className="pp-step__chev" aria-hidden="true">
                  <Icon name="chevron" size={13} />
                </span>
              </button>
              {expanded ? (
                <div id={`pp-${s.key}`} className="pp-step__body">
                  <p className="pp-step__evidence">{s.evidence}</p>
                  {s.items.map((i) => (
                    <div key={i.id} className="pp-part">
                      {s.items.length > 1 || i.title !== s.title ? <h4 className="pp-part__title">{i.title}</h4> : null}
                      {i.description ? <p className="pp-part__desc">{i.description}</p> : null}
                      {i.covers.length ? (
                        <>
                          <p className="label">Requirements</p>
                          <ul className="pp-reqs">
                            {i.covers.map((c) => (
                              <li key={c.id}>
                                <span className="mono pp-reqs__id">{c.id}</span> {c.text}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      {i.tests.length ? (
                        <>
                          <p className="label">Acceptance tests</p>
                          <table className="pp-tests">
                            <thead>
                              <tr>
                                <th scope="col">When the user</th>
                                <th scope="col">The app shows</th>
                              </tr>
                            </thead>
                            <tbody>
                              {i.tests.map((t, k) => (
                                <tr key={k}>
                                  <td>{t.behaviour}</td>
                                  <td className="mono">{t.expect}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      ) : null}
                      {i.files.length ? <p className="pp-part__files mono">{i.files.join(", ")}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <ScreenStatesSection projectId={projectId} />

      {data.review.length ? <Notes title="A person checks the prototype against these" items={data.review} /> : null}
      {data.later.length ? <Notes title="Not in the prototype" hint="Not for this release, or for the real app (Launch readiness lists those)." items={data.later} /> : null}
    </div>
  );
}

function Notes({ title, hint, items }: { title: string; hint?: string; items: Note[] }) {
  return (
    <section className="pp-notes" data-reveal>
      <h3 className="pp-notes__title">
        {title} <span className="pp-notes__n mono">{items.length}</span>
      </h3>
      {hint ? <p className="lrc-cat__desc">{hint}</p> : null}
      <ul className="pp-notes__list">
        {items.map((n) => (
          <li key={n.id}>
            <span className="pp-notes__text">{n.title}</span>
            <span className="pp-notes__meta">
              {n.section}
              {n.reason ? ` · ${n.realApp ? "For the real app" : `Later: ${n.reason}`}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
