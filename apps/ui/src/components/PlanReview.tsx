/**
 * Plan review: the plan approval as a step-by-step review in a wide card (Scope → Look and layout → Permissions →
 * Review and decide), with the actions always in view.
 *
 *  - The approval binds to the exact plan version and hash shown, and to the look shown: unconfirmed look edits need
 *    an explicit choice (use them, discard them, or go back to editing). The daemon refuses anything else.
 *  - Request changes (before any step starts) sends written revisions: the version is kept, the planner plans again,
 *    and the next version comes back for a fresh approval with what changed.
 *  - After approving, the card says what was approved and what happens next; the next gate (e.g. installing
 *    dependencies) is a separate decision the person opens on purpose (orchestrated by the parent).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Approval, ImplementationPlan } from "@flowcode/contracts";
import { ApiError, api, post, useResource } from "../api";
import { ErrorNotice, Icon } from "./ui";
import { HomeConcepts } from "./HomeConcepts";

interface PlanVersion {
  version: number;
  hash: string;
  plan: ImplementationPlan;
  createdAt: string;
  status: "current" | "superseded" | "approved";
  revision?: { request: string; requestedAt: string };
  outcome?: { from: number; request: string; addedSteps: string[]; removedSteps: string[]; keptSteps: number; riskFrom: string; riskTo: string; scopeDecisionsFrom: number; scopeDecisionsTo: number };
}
interface Bound {
  planVersion: number;
  planHash: string;
  look: { version: number | null; choice: "selected" | "base" | "use-edits" | "discard-edits" };
}
interface DesignStateView {
  selected?: { version: number; appearance: { surface: string; primary: string; fonts: { display: string; body: string }; motion?: { level: string } } };
  draft?: { appearance: unknown };
  label: string;
}
interface PlanView {
  hasPlan: boolean;
  runId?: string;
  requirements?: { total: number; inSteps: number; forPeople: number; later: number };
  steps: Array<{ key: string; n: number; title: string; kind: "setup" | "feature"; items: Array<{ id: string; title: string; covers: Array<{ id: string; text: string }>; tests: Array<{ behaviour: string; expect: string }> }> }>;
  review: Array<{ id: string; title: string; covers: Array<{ id: string }> }>;
  later: Array<{ id: string; title: string; reason?: string; covers: Array<{ id: string }> }>;
}
interface Concepts {
  offered: boolean;
  chosen?: { conceptId: string };
  concepts: Array<{ id: string; name: string }>;
}

type Step = "scope" | "look" | "permissions" | "review";
const STEPS: Array<{ id: Step; name: string }> = [
  { id: "scope", name: "Scope" },
  { id: "look", name: "Look and layout" },
  { id: "permissions", name: "Permissions" },
  { id: "review", name: "Review and decide" },
];
const SURFACE = (s?: string) => (s === "skeuomorphism" ? "Tactile" : s === "flat" ? "Flat" : s ?? "");

export function PlanReview({ approval, onDecided }: { approval: Approval; onDecided?: (result?: { bound?: Bound; requested?: boolean }) => void }) {
  const runId = approval.runId!;
  const projectId = approval.projectId;
  const versions = useResource<{ versions: PlanVersion[] }>(`/runs/${runId}/plan/versions`, [runId, approval.id]);
  const design = useResource<DesignStateView>(`/projects/${projectId}/design/state`, [projectId]);
  const planView = useResource<PlanView>(`/projects/${projectId}/plan`, [projectId, approval.id]);
  const concepts = useResource<Concepts>(`/runs/${runId}/concepts`, [runId]);
  const [step, setStep] = useState<Step>("scope");
  const [lookChoice, setLookChoice] = useState<"use-edits" | "discard-edits" | undefined>();
  const [asking, setAsking] = useState(false);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Guidance from this card, and the daemon's own refusals (a superseded version, an unconfirmed look): shown as written.
  const [notice, setNotice] = useState<string>();
  const done = useRef(false);
  const main = useRef<HTMLDivElement>(null);

  const all = versions.data?.versions ?? [];
  const version = all.find((v) => v.version === approval.planVersion) ?? all[all.length - 1];
  const plan = version?.plan;
  const hasEdits = !!design.data?.draft;
  const look = design.data?.selected;
  const pv = planView.data?.hasPlan && planView.data.runId === runId ? planView.data : undefined;
  const conceptName = concepts.data?.chosen ? (concepts.data.chosen.conceptId === "default" ? "Generic default Home" : concepts.data.concepts.find((c) => c.id === concepts.data!.chosen!.conceptId)?.name ?? concepts.data.chosen.conceptId) : undefined;

  // The look can change while this is open (the editor saves drafts as you go): keep the summary current.
  useEffect(() => {
    const t = window.setInterval(() => design.reload(), 2500);
    return () => window.clearInterval(t);
  }, [design]);
  useEffect(() => {
    design.reload();
    concepts.reload();
    main.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => {
    if (!hasEdits) setLookChoice(undefined);
  }, [hasEdits]);

  const installs = useMemo(() => (plan?.tasks ?? []).filter((t) => (t.verification ?? []).includes("install")), [plan]);

  const approve = async () => {
    if (done.current || busy) return;
    // The look as it is now (the editor saves drafts as you go; the poll can be a moment behind).
    const fresh = await api<DesignStateView>("GET", `/projects/${projectId}/design/state`).catch(() => design.data);
    const edits = !!fresh?.draft;
    if (edits !== hasEdits) design.reload();
    if (edits && !lookChoice) {
      setStep("review");
      setNotice("Your Look has edits you haven't confirmed. Choose what to do with them first.");
      return;
    }
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await post<{ bound?: Bound }>(`/approvals/${approval.id}/decision`, {
        decision: "once",
        action: approval.action,
        kind: "plan",
        planVersion: approval.planVersion,
        planHash: approval.planHash,
        lookVersion: fresh?.selected?.version ?? look?.version ?? 0,
        ...(edits ? { look: lookChoice } : {}),
      });
      done.current = true;
      onDecided?.({ bound: res.bound });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code) setNotice((e as Error).message);
      else setError((e as Error).message);
      if (code === "unconfirmed_look" || code === "look_changed") setStep("review");
      versions.reload();
      design.reload();
    } finally {
      setBusy(false);
    }
  };
  const sendRequest = async () => {
    if (done.current || busy || request.trim().length < 3) return;
    setBusy(true);
    setError(undefined);
    try {
      await post(`/runs/${runId}/plan/request-changes`, { request: request.trim(), planVersion: approval.planVersion, planHash: approval.planHash });
      done.current = true;
      onDecided?.({ requested: true });
    } catch (e) {
      if (e instanceof ApiError && e.code) setNotice(e.message);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const deny = async () => {
    if (done.current || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await post(`/approvals/${approval.id}/decision`, { decision: "deny", action: approval.action, kind: "plan" });
      done.current = true;
      onDecided?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Contradictions with the PRD (planChecks.ts): the plan isn't approval-ready while they stand.
  const contradictions = (plan?.compliance ?? []).filter((c) => c.hard && !c.ok);
  const lookLine = hasEdits ? "Unconfirmed edits: choose before approving" : look ? `Version ${look.version}: ${SURFACE(look.appearance.surface)}, ${look.appearance.primary}, ${look.appearance.fonts.display}${look.appearance.motion ? `, ${look.appearance.motion.level} motion` : ""}` : "Base styling: no brand direction selected";
  const stepState: Record<Step, string> = {
    scope: plan ? `${plan.tasks.length} steps${contradictions.length ? ` · ${contradictions.length} contradict${contradictions.length === 1 ? "s" : ""} the PRD` : ""}${plan.scopeDecisions?.length ? ` · ${plan.scopeDecisions.length} decision${plan.scopeDecisions.length === 1 ? "" : "s"}` : ""}` : "Loading…",
    look: hasEdits ? "Edits not confirmed" : look ? `Look v${look.version}${conceptName ? ` · ${conceptName}` : ""}` : `Base styling${conceptName ? ` · ${conceptName}` : ""}`,
    permissions: `${approval.risk} risk${installs.length ? " · install asks separately" : ""}`,
    review: contradictions.length ? "Not approval-ready" : hasEdits && !lookChoice ? "Choice needed" : "Ready",
  };

  return (
    <article className="approval plan-review reveal" aria-labelledby={`apr-${approval.id}`}>
      <header className="approval__head">
        <span className={`chip ${approval.risk === "high" ? "chip--bad" : "chip--warn"}`}>{approval.risk} risk</span>
        <span className="label">Plan approval</span>
        <span id={`apr-${approval.id}`} className="plan-review__title">
          Plan version {approval.planVersion ?? 1}
          {version ? <span className="mono dim"> · {version.hash}</span> : null}
        </span>
        <span className="label" style={{ marginLeft: "auto" }}>
          Nothing is built until you approve
        </span>
      </header>
      <div className="plan-review__grid">
        <nav className="plan-review__steps" aria-label="Review steps">
          <ol>
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button type="button" aria-current={step === s.id ? "step" : undefined} onClick={() => setStep(s.id)}>
                  <span className="plan-review__n">{i + 1}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <span className="dim">{stepState[s.id]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <dl className="plan-review__summary" aria-label="What approving binds to">
            <dt>Plan</dt>
            <dd>
              Version {approval.planVersion ?? 1}
              {all.length > 1 ? <span className="dim"> ({all.length - 1} earlier kept)</span> : null}
            </dd>
            <dt>Look</dt>
            <dd className={hasEdits ? "plan-review__warn" : undefined}>{lookLine}</dd>
            <dt>Home layout</dt>
            <dd>{conceptName ?? (concepts.data?.offered ? "Not chosen (the design requirement stays open)" : "The build's own")}</dd>
          </dl>
        </nav>

        <div className="plan-review__main" ref={main}>
          {step === "scope" ? (
            <section aria-label="Scope">
              <p className="plan-review__goal">{plan?.goal ?? approval.action}</p>
              {contradictions.length ? (
                <div className="notice notice--bad plan-review__block" role="alert" data-plan-contradictions={contradictions.length}>
                  <h3>
                    Not approval-ready: {contradictions.length} contradiction{contradictions.length === 1 ? "" : "s"} with the PRD
                  </h3>
                  <ul>
                    {contradictions.map((c) => (
                      <li key={c.id}>
                        <strong>{c.label}</strong>
                        <ul>
                          {c.problems.slice(0, 6).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                          {c.problems.length > 6 ? <li className="dim">and {c.problems.length - 6} more</li> : null}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <p>Use Request changes, or deny. Approving builds the plan with these contradictions.</p>
                </div>
              ) : null}
              {plan?.compliance?.length ? (
                <details className="plan-review__block">
                  <summary>
                    Checks: compliance with the PRD {plan.compliance.filter((c) => c.kind === "compliance" && c.ok).length} of {plan.compliance.filter((c) => c.kind === "compliance").length} pass · structure {plan.compliance.filter((c) => c.kind === "structural" && c.ok).length} of {plan.compliance.filter((c) => c.kind === "structural").length} pass
                  </summary>
                  {(["compliance", "structural"] as const).map((kind) => (
                    <div key={kind}>
                      <h3>{kind === "compliance" ? "Compliance with the PRD" : "Structure (how the plan is put together; not proof it meets the PRD)"}</h3>
                      <ul>
                        {plan.compliance!
                          .filter((c) => c.kind === kind)
                          .map((c) => (
                            <li key={c.id}>
                              {c.ok ? "Pass" : "Fails"}: {c.label}
                              {c.problems.length ? <span className="dim"> ({c.problems.slice(0, 2).join("; ")})</span> : null}
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
                </details>
              ) : null}
              {version?.outcome ? (
                <div className="plan-review__outcome" role="status">
                  <strong>
                    Version {version.version} answers your request on version {version.outcome.from}:
                  </strong>
                  <q>{version.outcome.request}</q>
                  <ul>
                    <li>{version.outcome.addedSteps.length ? `Added: ${version.outcome.addedSteps.join("; ")}` : "No steps added"}</li>
                    <li>{version.outcome.removedSteps.length ? `Removed: ${version.outcome.removedSteps.join("; ")}` : "No steps removed"}</li>
                    <li>
                      {version.outcome.keptSteps} kept · risk {version.outcome.riskFrom} → {version.outcome.riskTo} · decisions for you {version.outcome.scopeDecisionsFrom} → {version.outcome.scopeDecisionsTo}
                    </li>
                  </ul>
                  <p className="dim">Check the result against what you asked: a revised plan can still miss part of a request.</p>
                </div>
              ) : null}
              {plan?.scopeDecisions?.length ? (
                <div className="plan-review__block">
                  <h3>Decisions for you</h3>
                  <ul>
                    {plan.scopeDecisions.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <p className="dim">Answer them with Request changes, or approve the plan as it is.</p>
                </div>
              ) : null}
              {pv?.requirements ? (
                <div className="plan-review__block">
                  <h3>Requirements</h3>
                  <p>
                    {pv.requirements.total} from the PRD: <strong>{pv.requirements.inSteps}</strong> built in steps · <strong>{pv.requirements.forPeople}</strong> for you to sign off · <strong>{pv.requirements.later}</strong> not in this release
                  </p>
                  {pv.later.length ? (
                    <details>
                      <summary>Not in this release ({pv.later.length})</summary>
                      <ul>
                        {pv.later.map((l) => (
                          <li key={l.id}>
                            {l.title}
                            {l.reason ? <span className="dim"> · {l.reason}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ) : null}
              <div className="plan-review__block">
                <h3>Build steps and what they must show</h3>
                <ol className="plan-review__tasks">
                  {(pv?.steps.length ? pv.steps : (plan?.tasks ?? []).map((t, i) => ({ key: t.key, n: i + 1, title: t.title, kind: "feature" as const, items: [] }))).map((s) => (
                    <li key={s.key} className={s.kind === "setup" ? "is-setup" : undefined}>
                      {s.items.some((i) => i.tests.length || i.covers.length) ? (
                        <details>
                          <summary>
                            {s.title}
                            {s.items.flatMap((i) => i.covers).length ? <span className="dim"> · {[...new Set(s.items.flatMap((i) => i.covers.map((c) => c.id)))].join(", ")}</span> : null}
                          </summary>
                          <ul>
                            {s.items.flatMap((i) => i.tests).map((t, k) => (
                              <li key={k}>
                                {t.behaviour} → <span className="dim">{t.expect}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : (
                        <span>
                          {s.title}
                          {s.kind === "setup" ? <span className="dim"> · setup</span> : null}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              <details className="plan-review__block">
                <summary>The full plan, as written</summary>
                <pre className="codeblock" style={{ whiteSpace: "pre-wrap" }}>
                  {approval.detail}
                </pre>
              </details>
            </section>
          ) : null}

          {step === "look" ? (
            <section aria-label="Look and layout">
              <HomeConcepts runId={runId} projectId={projectId} />
            </section>
          ) : null}

          {step === "permissions" ? (
            <section aria-label="Permissions">
              <div className="plan-review__block">
                <h3>Approving this plan allows</h3>
                <ul>
                  <li>Starting the build right away: the first step copies the starter into this project's folder.</li>
                  <li>
                    Changes in <span className="mono">{approval.affected.join(", ") || "the project"}</span>, each one saved as a snapshot you can undo.
                  </li>
                  {plan?.riskNotes.length ? <li>Risk: {plan.riskNotes.join("; ")}</li> : null}
                </ul>
              </div>
              <div className="plan-review__block">
                <h3>Still asked separately, later</h3>
                <ul>
                  {installs.length ? <li>Installing dependencies ({installs.map((t) => t.title).join(", ")}): uses the network and runs package scripts. It is its own decision, shown after this one.</li> : null}
                  <li>Any change outside the plan's files, and anything the project's autonomy level doesn't cover.</li>
                  <li>The design review step, once the app exists.</li>
                </ul>
              </div>
            </section>
          ) : null}

          {step === "review" ? (
            <section aria-label="Review and decide">
              <dl className="plan-review__bind">
                <dt>Plan</dt>
                <dd>
                  Version {approval.planVersion ?? 1} <span className="mono dim">{version?.hash}</span> · {plan?.tasks.length ?? "?"} steps
                </dd>
                <dt>Look</dt>
                <dd>{look ? `Version ${look.version}` : "Base styling (no brand direction)"}</dd>
                <dt>Home layout</dt>
                <dd>{conceptName ?? "Not chosen"}</dd>
                <dt>Next</dt>
                <dd>{installs.length ? "The build starts; installing dependencies then asks you separately" : "The build starts"}</dd>
              </dl>
              {hasEdits ? (
                <fieldset className="plan-review__choice">
                  <legend>Your Look has edits you haven't confirmed. What should this approval use?</legend>
                  <label>
                    <input type="radio" name={`look-${approval.id}`} checked={lookChoice === "use-edits"} onChange={() => setLookChoice("use-edits")} /> Use my edits: they become the look this plan is approved with
                  </label>
                  <label>
                    <input type="radio" name={`look-${approval.id}`} checked={lookChoice === "discard-edits"} onChange={() => setLookChoice("discard-edits")} /> Discard my edits: approve with {look ? `look version ${look.version}` : "the base styling"}
                  </label>
                  <button type="button" className="btn btn--sm" onClick={() => setStep("look")}>
                    Go back to editing
                  </button>
                </fieldset>
              ) : null}
            </section>
          ) : null}

          {asking ? (
            <div className="plan-review__request">
              <label className="label" htmlFor={`req-${approval.id}`}>
                What should change in this plan?
              </label>
              <textarea id={`req-${approval.id}`} className="textarea" rows={5} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="For example: keep only the save journey; don't add working lists or ratings." />
              <p className="dim">The planner plans again with this. This version is kept, and the new version comes back here for your approval. Only possible before any step has started.</p>
              <div className="plan-review__row">
                <button type="button" className="btn btn--primary btn--sm" disabled={busy || request.trim().length < 3} onClick={() => void sendRequest()}>
                  Send and plan again
                </button>
                <button type="button" className="btn btn--sm" onClick={() => setAsking(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {notice ? (
            <p className="notice notice--warn plan-review__notice" role="alert">
              {notice}
            </p>
          ) : null}
          {error ? <ErrorNotice error={error} doing="record your decision" /> : null}
        </div>
      </div>
      <footer className="approval__actions plan-review__actions">
        <button className="btn btn--primary" data-cp="approval-allow" disabled={busy} onClick={() => void approve()}>
          {contradictions.length ? `Approve version ${approval.planVersion ?? 1} despite ${contradictions.length} contradiction${contradictions.length === 1 ? "" : "s"}` : `Approve plan version ${approval.planVersion ?? 1}`}
        </button>
        <button className="btn" disabled={busy} aria-expanded={asking} onClick={() => setAsking((v) => !v)}>
          <Icon name="edit" size={14} /> Request changes
        </button>
        <button className="btn btn--danger" disabled={busy} onClick={() => void deny()}>
          Deny
        </button>
        {step !== "review" ? (
          <button className="btn btn--ghost" style={{ marginLeft: "auto" }} onClick={() => setStep(STEPS[STEPS.findIndex((s) => s.id === step) + 1]!.id)}>
            Next: {STEPS[STEPS.findIndex((s) => s.id === step) + 1]!.name}
          </button>
        ) : null}
      </footer>
    </article>
  );
}

/** After a plan is approved: what was approved, and what happens next. The next decision opens only when asked for. */
export function PlanApproved({ bound, next, onNext, onClose }: { bound: Bound; next?: Approval; onNext: () => void; onClose: () => void }) {
  return (
    <article className="approval plan-approved" aria-labelledby="plan-approved-h" role="status" aria-live="polite">
      <header className="approval__head">
        <span className="chip chip--ok">
          <Icon name="check" size={12} /> Approved
        </span>
        <span className="label">Plan approval</span>
      </header>
      <div className="approval__body">
        <h2 id="plan-approved-h" className="plan-approved__title">
          Plan version {bound.planVersion} approved. The build has started.
        </h2>
        <dl className="plan-review__bind">
          <dt>Plan</dt>
          <dd>
            Version {bound.planVersion} <span className="mono dim">{bound.planHash}</span>
          </dd>
          <dt>Look</dt>
          <dd>
            {bound.look.version ? `Version ${bound.look.version}` : "Base styling (no brand direction)"}
            {bound.look.choice === "use-edits" ? " · your edits, confirmed with this approval" : bound.look.choice === "discard-edits" ? " · unconfirmed edits discarded" : ""}
          </dd>
        </dl>
        {next ? (
          <div className="plan-approved__next">
            <strong>Next decision: {next.kind === "dependency_install" ? "permission to install dependencies" : next.action}</strong>
            <p className="dim">A separate permission, not part of the plan. It waits until you open it.</p>
          </div>
        ) : (
          <p className="dim">Nothing else needs you right now. The build's progress is on this page.</p>
        )}
      </div>
      {/* Buttons on the right: where Approve was is empty, so a late press there does nothing. */}
      <footer className="approval__actions plan-approved__actions">
        {next ? (
          <button className="btn" onClick={onNext}>
            Review the next decision
          </button>
        ) : null}
        <button className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </footer>
    </article>
  );
}
