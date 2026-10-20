/**
 * A project's setup after Home: /new/:id/describe (the composer again), /new/:id/look (Look and Feel: the Look editor,
 * whose selected direction the build applies) and /new/:id/build (build level, who writes the code, Extras, and the
 * summary with Start Build). Every choice is saved to the draft project as it is made (POST /projects/:id/setup), so
 * Back, Next and a reload keep it. Start Build makes the first run once (the daemon returns the same run on a repeat).
 */
import { useState } from "react";
import { AUTONOMY_LEVELS, BUILD_EXTRAS, BUILD_LEVELS, PRODUCT_TYPES, type Appearance, type AutonomyLevel, type Project, type ProjectSetup } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { navigate } from "../router";
import { Icon } from "../components/ui";
import { HomeView } from "./HomeView";
import { LookStudio } from "../components/LookStudio";

type Step = "describe" | "look" | "build";
const STEPS: Array<{ id: Step; label: string }> = [
  { id: "describe", label: "Describe" },
  { id: "look", label: "Look and Feel" },
  { id: "build", label: "Build" },
];

interface DesignStateView {
  draft?: { appearance: Appearance };
  selected?: { appearance: Appearance; version: number };
}

export function SetupView({ projectId, step }: { projectId: string; step: string }) {
  const at: Step = step === "look" || step === "build" ? step : "describe";
  // Read again on every step: a step shown again must show what was saved since, not what was loaded first.
  const res = useResource<{ project: Project; setup: ProjectSetup }>(`/projects/${projectId}/setup`, [projectId, at]);
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
  // Describe is Home again, for this draft: the same page, background and composer.
  if (at === "describe") return <HomeView draft={{ projectId, name: project.name, setup }} />;
  return (
    <div className="page psetup">
      <SetupSteps projectId={projectId} at={at} />
      {at === "look" ? (
        <LookStudio projectId={projectId} site={`${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "")  || "yourapp"}.com`} template={setup.template} productType={setup.productType} onTemplate={(template) => void post(`/projects/${projectId}/setup`, { template })} onBack={() => navigate(`/new/${projectId}/describe`)} onNext={() => navigate(`/new/${projectId}/build`)} />
      ) : (
        <BuildStep key={setup.updatedAt} projectId={projectId} project={project} setup={setup} onSaved={res.reload} />
      )}
    </div>
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
      <h1 className="psetup__title" id="build-title">How hands-on?</h1>
      <fieldset className="psetup-levels">
        <legend className="sr-only">Build level</legend>
        {BUILD_LEVELS.map((l) => (
          <label key={l.id} className={`psetup-card${autonomy === l.id ? " is-on" : ""}`} title={AUTONOMY_LEVELS.find((a) => a.id === l.id)?.forYou.join(" ")}>
            <input type="radio" name="build-level" checked={autonomy === l.id} onChange={() => (setAutonomy(l.id), save({ autonomy: l.id }))} />
            <span className="psetup-card__name">{l.name}</span>
            <span className="psetup-card__text">{LEVEL_LINE[l.id]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="psetup-coder">
        <legend>Code written by</legend>
        <div className="psetup-seg">
          <label className={coder === "local" ? "is-on" : ""}>
            <input type="radio" name="setup-coder" checked={coder === "local"} onChange={() => (setCoder("local"), save({ coder: "local" }))} /> This computer
          </label>
          <label className={coder === "cloud" ? "is-on" : ""} title={cloud.data?.ready ? "Sends this project's code and screenshots to the provider, which charges per use" : `Not set up: ${cloud.data?.problem ?? "checking"}`}>
            <input type="radio" name="setup-coder" checked={coder === "cloud"} disabled={!cloud.data?.ready} onChange={() => (setCoder("cloud"), save({ coder: "cloud" }))} /> Cloud
          </label>
        </div>
        <span className="psetup-coder__model">{coder === "cloud" ? cloud.data?.model : roles.data?.coder?.assignment?.model}</span>
      </fieldset>

      <fieldset className="psetup-extras">
        <legend>
          Extras <span className="psetup-extras__count">{chosen.length ? `${chosen.length} in this build` : "optional"}</span>
        </legend>
        <div className="psetup-chips">
          {BUILD_EXTRAS.map((x) => {
            const on = extras.includes(x.id);
            return (
              <label key={x.id} className={`psetup-chip${on ? " is-on" : ""}`} title={x.hint}>
                <input type="checkbox" checked={on} onChange={() => toggle(x.id)} aria-description={x.hint} />
                {on ? <Icon name="check" size={13} /> : null}
                {x.label}
                {on ? <span className="sr-only"> (in this build)</span> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <section className="psetup-summary" aria-label="Summary">
        <span><b>{project.name}</b>{setup.productType ? ` · ${PRODUCT_TYPES.find((t) => t.id === setup.productType)?.label}` : ""}</span>
        <span>{setup.references.length ? `${setup.references.length} file${setup.references.length === 1 ? "" : "s"}` : "No files"}</span>
        <span>{look ? `Look v${design.data?.selected?.version}` : "Base look"}</span>
        <span>{level.name}</span>
        <span>{chosen.length ? chosen.map((x) => x.label).join(", ") : "No extras"}</span>
      </section>
      {extras.includes("installable") ? <p className="psetup__note">Install as an app: installing depends on the browser; only the app's own screens work offline.</p> : null}

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

/** One line each; the full policy is the card's tooltip. */
const LEVEL_LINE: Record<AutonomyLevel, string> = {
  supervised: "You approve each step.",
  assisted: "Asks only about risky choices.",
  autonomous: "Runs on its own. Asks before anything leaves this computer.",
};

/** The three steps; before a draft exists (Home), the later ones can't be opened yet. */
export function SetupSteps({ projectId, at }: { projectId?: string; at: Step }) {
  return (
    <ol className="psetup__steps" aria-label="Setup steps">
      {STEPS.map((s, i) => (
        <li key={s.id} className={s.id === at ? "is-on" : STEPS.findIndex((x) => x.id === at) > i ? "is-done" : ""}>
          <button type="button" aria-current={s.id === at ? "step" : undefined} disabled={!projectId && s.id !== at} onClick={() => projectId && navigate(`/new/${projectId}/${s.id}`)}>
            <b>{i + 1}</b>
            {s.label}
          </button>
        </li>
      ))}
    </ol>
  );
}
