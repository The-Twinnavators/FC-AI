/**
 * A project's setup after Home: /new/:id/describe (the composer again), /new/:id/look (Look and Feel: the Look editor,
 * whose selected direction the build applies) and /new/:id/build (build level, who writes the code, Extras, and the
 * summary with Start Build). Every choice is saved to the draft project as it is made (POST /projects/:id/setup), so
 * Back, Next and a reload keep it. Start Build makes the first run once (the daemon returns the same run on a repeat).
 */
import { useState } from "react";
import { AUTONOMY_LEVELS, BUILD_EXTRAS, BUILD_LEVELS, PRODUCT_TYPES, type Appearance, type AutonomyLevel, type Project, type ProjectSetup } from "@flowcode/contracts";
import { get, post, useResource } from "../api";
import { navigate } from "../router";
import { Icon } from "../components/ui";
import { ProductComposer } from "../components/ProductComposer";
import { DirectionEditor } from "../components/DirectionEditor";

type Step = "describe" | "look" | "build";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "describe", label: "Describe your product" },
  { id: "look", label: "Look and Feel" },
  { id: "build", label: "Build levels and Extras" },
];

interface DesignStateView {
  draft?: { appearance: Appearance };
  selected?: { appearance: Appearance; version: number };
}

export function SetupView({ projectId, step }: { projectId: string; step: string }) {
  const res = useResource<{ project: Project; setup: ProjectSetup }>(`/projects/${projectId}/setup`, [projectId]);
  const at: Step = step === "look" || step === "build" ? step : "describe";
  if (res.error) return <div className="page"><p className="psetup__err" role="alert">{res.error}</p></div>;
  if (!res.data) return <div className="page"><p className="dim">Loading the setup…</p></div>;
  const { project, setup } = res.data;
  if (setup.status === "started" && setup.runId)
    return (
      <div className="page psetup">
        <p>This build has started.</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate(`/projects/${projectId}/runs/${setup.runId}`)}>Open the build</button>
      </div>
    );
  return (
    <div className="page psetup">
      <ol className="psetup__steps" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li key={s.id} className={s.id === at ? "is-on" : STEPS.findIndex((x) => x.id === at) > i ? "is-done" : ""}>
            <button type="button" aria-current={s.id === at ? "step" : undefined} onClick={() => navigate(`/new/${projectId}/${s.id}`)}>
              <b>{i + 1}</b>
              {s.label}
            </button>
          </li>
        ))}
      </ol>
      {at === "describe" ? (
        <div className="psetup__describe">
          <h1 className="psetup__title" id="composer-title">What would you like to build?</h1>
          <ProductComposer projectId={projectId} initial={{ name: project.name, setup }} />
        </div>
      ) : at === "look" ? (
        <LookStep projectId={projectId} />
      ) : (
        <BuildStep projectId={projectId} project={project} setup={setup} onSaved={res.reload} />
      )}
    </div>
  );
}

/** Look and Feel: the Look editor (draft, selected, applied kept apart). Next selects a draft so the build applies it. */
function LookStep({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const next = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const st = await get<DesignStateView>(`/projects/${projectId}/design/state`);
      if (st.draft) await post(`/projects/${projectId}/design/select`, {});
      navigate(`/new/${projectId}/build`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <section className="psetup__look" aria-labelledby="look-title">
      <header className="psetup__head">
        <h1 className="psetup__title" id="look-title">Look and Feel</h1>
        <p className="psetup__lede">Start from a theme or your own colours, then adjust. The preview beside the controls updates as you go. Nothing is built until Start Build.</p>
      </header>
      <DirectionEditor projectId={projectId} where="plan" />
      <footer className="psetup__foot">
        {error ? <span className="psetup__err" role="alert">{error}</span> : null}
        <button type="button" className="btn" onClick={() => navigate(`/new/${projectId}/describe`)}>Back</button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void next()}>
          {busy ? "Saving…" : "Next: Agentic Build Levels"} <Icon name="chevron" size={13} />
        </button>
      </footer>
    </section>
  );
}

/** Build level, who writes the code, Extras, and the summary with Start Build. */
function BuildStep({ projectId, project, setup, onSaved }: { projectId: string; project: Project; setup: ProjectSetup; onSaved: () => void }) {
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(setup.autonomy);
  const [extras, setExtras] = useState<string[]>(setup.extras);
  const [coder, setCoder] = useState(setup.coder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cloud = useResource<{ ready: boolean; model: string; problem: string }>("/models/cloud-coder");
  const roles = useResource<{ coder?: { assignment?: { model: string } } }>("/models/roles");
  const design = useResource<DesignStateView>(`/projects/${projectId}/design/state`, [projectId]);

  // Each choice is saved as it is made.
  const save = (patch: Partial<Pick<ProjectSetup, "autonomy" | "extras" | "coder">>) => {
    setError(undefined);
    post(`/projects/${projectId}/setup`, patch).catch((e: Error) => setError(`Not saved: ${e.message}`));
  };
  const toggle = (id: string) => {
    // Several at once: each card adds or removes only itself.
    const next = extras.includes(id) ? extras.filter((x) => x !== id) : BUILD_EXTRAS.map((x) => x.id).filter((x) => x === id || extras.includes(x));
    setExtras(next);
    save({ extras: next });
  };
  const start = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const r = await post<{ run: { id: string } }>(`/projects/${projectId}/setup/start`, {});
      onSaved();
      navigate(`/projects/${projectId}/runs/${r.run.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const look = design.data?.selected?.appearance;
  const level = BUILD_LEVELS.find((l) => l.id === autonomy)!;
  const chosen = BUILD_EXTRAS.filter((x) => extras.includes(x.id));
  return (
    <section className="psetup__build" aria-labelledby="build-title">
      <header className="psetup__head">
        <h1 className="psetup__title" id="build-title">Agentic Build Levels</h1>
        <p className="psetup__lede">How much FlowCode does on its own. Every level keeps your requirements and locked choices, shows progress, can be paused, keeps every version, and asks before anything leaves this computer.</p>
      </header>
      <fieldset className="psetup-levels">
        <legend className="sr-only">Build level</legend>
        {BUILD_LEVELS.map((l) => {
          const policy = AUTONOMY_LEVELS.find((a) => a.id === l.id)!;
          return (
            <label key={l.id} className={`psetup-card${autonomy === l.id ? " is-on" : ""}`}>
              <input type="radio" name="build-level" checked={autonomy === l.id} onChange={() => (setAutonomy(l.id), save({ autonomy: l.id }))} />
              <span className="psetup-card__name">{l.name}</span>
              <span className="psetup-card__text">{l.experience}</span>
              <ul className="psetup-card__list">
                {policy.forYou.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="psetup-coder">
        <legend>Who writes the code</legend>
        <label className="check">
          <input type="radio" name="psetup-coder" checked={coder === "local"} onChange={() => (setCoder("local"), save({ coder: "local" }))} /> Local model <span className="muted">· {roles.data?.coder?.assignment?.model ?? "the local coder"} on this computer. Code, design and screenshots stay here</span>
        </label>
        <label className="check">
          <input type="radio" name="psetup-coder" checked={coder === "cloud"} disabled={!cloud.data?.ready} onChange={() => (setCoder("cloud"), save({ coder: "cloud" }))} /> Cloud model{" "}
          <span className="muted">{cloud.data?.ready ? `· ${cloud.data.model}. This project's code and screenshots are sent to that provider, which charges per use` : `· not set up yet (${cloud.data?.problem ?? "checking"}); set it up on the Models page`}</span>
        </label>
      </fieldset>

      <section className="psetup-extras" aria-labelledby="extras-title">
        <header className="psetup-extras__head">
          <h2 className="psetup-extras__title" id="extras-title">Extras</h2>
          <span className="psetup-extras__count" role="status">{chosen.length ? `${chosen.length} selected` : "None selected"}</span>
        </header>
        <p className="psetup__lede">Optional enhancements, any combination. They add to the build; they never replace basic usability.</p>
        <div className="psetup-extras__grid">
          {BUILD_EXTRAS.map((x) => {
            const on = extras.includes(x.id);
            return (
              <label key={x.id} className={`psetup-card psetup-card--extra${on ? " is-on" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(x.id)} />
                <span className="psetup-card__name">
                  {x.label}
                  {on ? <span className="psetup-card__in">In this build</span> : null}
                </span>
                <span className="psetup-card__text">{x.hint}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="psetup-summary" aria-labelledby="summary-title">
        <h2 className="psetup-extras__title" id="summary-title">Start Build</h2>
        <dl className="psetup-summary__list">
          <dt>Project</dt>
          <dd>{project.name}{setup.productType ? ` · ${PRODUCT_TYPES.find((t) => t.id === setup.productType)?.label}` : ""}</dd>
          <dt>Requirements</dt>
          <dd>
            {setup.description.length > 220 ? `${setup.description.slice(0, 220)}…` : setup.description}
            {setup.references.length ? <span className="muted"> · {setup.references.length} attached: {setup.references.map((r) => r.name).join(", ")}</span> : null}
          </dd>
          <dt>Design</dt>
          <dd>
            {look ? `Selected direction, version ${design.data?.selected?.version}: ${look.fonts.display} / ${look.fonts.body}, primary ${look.primary}, ${look.surface === "skeuomorphism" ? "Tactile" : "Flat"} surfaces` : "No direction selected: the app keeps FlowCode's base styling, or the PRD's if it sets one."}
            {design.data?.draft ? <span className="muted"> · an unselected draft is waiting in Look and Feel</span> : null}
          </dd>
          <dt>Build level</dt>
          <dd>{level.name} · {coder === "cloud" ? "cloud model" : "local model"}</dd>
          <dt>Extras</dt>
          <dd>{chosen.length ? chosen.map((x) => x.label).join(", ") : "None"}</dd>
        </dl>
        {extras.includes("installable") ? <p className="psetup__note">Install as an app: FlowCode adds a manifest and an offline cache for the app's own screens. Installing depends on the browser, and nothing that needs a server works offline.</p> : null}
        {coder === "cloud" ? <p className="psetup__note">The cloud model receives this project's code and screenshots.</p> : null}
      </section>

      <footer className="psetup__foot">
        {error ? <span className="psetup__err" role="alert">{error}</span> : null}
        <button type="button" className="btn" onClick={() => navigate(`/new/${projectId}/look`)}>Back: Look and Feel</button>
        <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void start()}>
          {busy ? "Starting…" : "Start Build"} <Icon name="chevron" size={13} />
        </button>
      </footer>
    </section>
  );
}
