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
import { RobotHead, ROLE_COLOR } from "../components/RobotHead";

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
        <LookStudio projectId={projectId} extras={setup.extras} onExtras={(extras) => void post(`/projects/${projectId}/setup`, { extras })} site={`${project.name.toLowerCase().replace(/[^a-z0-9]+/g, "")  || "yourapp"}.com`} template={setup.template} productType={setup.productType} onTemplate={(template) => void post(`/projects/${projectId}/setup`, { template })} onBack={() => navigate(`/new/${projectId}/describe`)} onNext={() => navigate(`/new/${projectId}/build`)} />
      ) : (
        <BuildStep key={setup.updatedAt} projectId={projectId} project={project} setup={setup} onSaved={res.reload} />
      )}
    </div>
  );
}

/** Build level, who writes the code, Extras, and the summary with Start Build. */
function BuildStep({ projectId, project, setup, onSaved }: { projectId: string; project: Project; setup: ProjectSetup; onSaved: () => void }) {
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(setup.autonomy);
  const extras = setup.extras;
  const [coder, setCoder] = useState(setup.coder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cloud = useResource<{ ready: boolean; model: string; problem: string }>("/models/cloud-coder");
  const roles = useResource<{ coder?: { assignment?: { model: string } } }>("/models/roles");
  const design = useResource<DesignStateView>(`/projects/${projectId}/design/state`, [projectId]);

  // Each choice is saved as it is made.
  const save = (patch: Partial<Pick<ProjectSetup, "autonomy" | "coder">>) => {
    setError(undefined);
    post(`/projects/${projectId}/setup`, patch).catch((e: Error) => setError(`Not saved: ${e.message}`));
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
          <label key={l.id} className={`psetup-card psetup-level${autonomy === l.id ? " is-on" : ""}`} title={AUTONOMY_LEVELS.find((a) => a.id === l.id)?.forYou.join(" ")}>
            <input type="radio" name="build-level" checked={autonomy === l.id} onChange={() => (setAutonomy(l.id), save({ autonomy: l.id }))} />
            <span className="psetup-level__art" aria-hidden="true">
              <RobotHead color={ROLE_COLOR.coder} id={`lvl-${l.id}`} size={40} />
              <span className="psetup-stops">
                {STOPS[l.id].map((stop, i) => (
                  <span key={i} className={stop ? "is-stop" : ""} />
                ))}
              </span>
            </span>
            <span className="psetup-card__name">{l.name}</span>
            <span className="psetup-card__text">{LEVEL_LINE[l.id]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="psetup-coder">
        <legend>Code written by</legend>
        <div className="psetup-seg">
          {(["local", "cloud"] as const).map((c) => {
            const ready = c === "local" || !!cloud.data?.ready;
            return (
              <label key={c} className={coder === c ? "is-on" : ""} title={c === "local" ? "Runs on this computer. Code, design and screenshots stay here." : ready ? "Sends this project's code and screenshots to the provider, which charges per use." : `Not set up: ${cloud.data?.problem ?? "checking"}. Set it up on the Models page.`}>
                <input type="radio" name="setup-coder" checked={coder === c} disabled={!ready} onChange={() => (setCoder(c), save({ coder: c }))} />
                {c === "local" ? (
                  <svg width="16" height="14" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="2" width="18" height="12" rx="2" /><path d="M1 18h22" /></svg>
                ) : (
                  <svg width="16" height="14" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17h10a4.5 4.5 0 0 0 .6-8.96A6 6 0 0 0 6.1 9.2 4 4 0 0 0 7 17Z" /></svg>
                )}
                {c === "local" ? "Local AI" : "Cloud AI"}
              </label>
            );
          })}
        </div>
        <span className="psetup-coder__model">{coder === "cloud" ? cloud.data?.model : roles.data?.coder?.assignment?.model}</span>
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

/** Where each level stops for your OK, as four steps (plan, code, packages, risky changes); a filled dot is a stop. */
const STOPS: Record<AutonomyLevel, number[]> = { supervised: [1, 1, 1, 1], assisted: [0, 0, 1, 1], autonomous: [0, 0, 0, 0] };

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
