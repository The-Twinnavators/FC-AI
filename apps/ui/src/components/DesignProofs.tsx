/**
 * Design proofs (agent-led design, daemon orchestrator/designProofs.ts): the designer's custom concepts of the build's
 * main screen, drawn by FlowCode (proof-preview.html). The review is a page of its own (#/proofs/:runId), so each proof
 * shows large: one at a time beside its rationale, settings and skills, or all side by side to compare. Progress shows
 * while they're made (saved as they finish, so leaving loses nothing); a failed one has its own Retry. Choose this
 * design, Refine this design, or None of these fit; earlier rounds stay to compare. Choosing shows the design's
 * settings, changes and locks for an explicit approval. The plan card shows a summary and opens the review.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { proofById, type DesignProof, type DesignProofs as Proofs } from "@flowcode/contracts";
import { post, useResource } from "../api";
import { navigate } from "../router";
import { Icon } from "./ui";
import "../styles/design-proofs.css";

const LOCK_NAME: Record<string, string> = { colors: "Colors", type: "Type", shape: "Layout", surface: "Buttons", motion: "Motion" };

/** One proof drawn in its slot: the page is drawn 1280px wide and scaled to fit. Large ones scroll inside. */
function ProofFrame({ proof, size = "thumb" }: { proof: DesignProof; size?: "thumb" | "large" }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty("--pp-scale", String(el.clientWidth / 1280)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const message = useMemo(() => ({ type: "fl-proof", screen: proof.screen, tokens: proof.tokens ?? {} }), [proof]);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data?.type !== "fl-proof-ready") return;
      frame.current?.contentWindow?.postMessage(message, location.origin);
    };
    addEventListener("message", on);
    frame.current?.contentWindow?.postMessage(message, location.origin);
    return () => removeEventListener("message", on);
  }, [message]);
  return (
    <div className={`pp-frame pp-frame--${size}`} ref={slot}>
      <iframe ref={frame} src="proof-preview.html" title={`${proof.label}: ${proof.name ?? ""} (design proposal)`} tabIndex={size === "large" ? 0 : -1} />
      <span className="pp-frame__tag">Design proposal</span>
    </div>
  );
}

function elapsed(from?: string) {
  if (!from) return "";
  const s = Math.max(0, Math.round((Date.now() - Date.parse(from)) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min ${s % 60}s`;
}

/** A proof's picture, or where it stands while it isn't ready (with Retry when it failed). */
function ProofSlot({ x, size, busy, onRetry }: { x: DesignProof; size: "thumb" | "large"; busy?: boolean; onRetry: () => void }) {
  if (x.status === "ready") return <ProofFrame proof={x} size={size} />;
  return (
    <div className={`pp-wait pp-wait--${size}${x.status === "failed" ? " is-failed" : ""}`} role="status">
      {x.status === "failed" ? (
        <>
          <strong>{x.label} couldn't be made</strong>
          <span>{x.error}</span>
          <button type="button" className="btn btn--sm" disabled={busy} onClick={onRetry}>Retry {x.label}</button>
        </>
      ) : (
        <>
          <span className="pp-spin" aria-hidden="true" />
          <strong>{x.status === "working" ? `Designing ${x.label}…` : `${x.label} is next`}</strong>
          <span>{x.status === "working" ? elapsed(x.startedAt) : "After the one before it"}</span>
        </>
      )}
    </div>
  );
}

/** Polls a build's proofs while any is being made. */
function useProofs(runId: string) {
  const res = useResource<Proofs>(`/runs/${runId}/proofs`, [runId]);
  const pending = !!res.data?.rounds.some((r) => r.proofs.some((x) => x.status === "queued" || x.status === "working"));
  const [, tick] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(() => (res.reload(), tick((n) => n + 1)), 2500);
    return () => window.clearInterval(t);
  }, [pending, res]);
  return { ...res, pending };
}

/** The design review page: one proof large with its details, or all side by side. */
export function DesignReview({ runId }: { runId: string }) {
  const { data: p, reload, pending, error: loadError } = useProofs(runId);
  const runRes = useResource<{ run: { projectId: string } }>(`/runs/${runId}`, [runId]);
  const projectId = runRes.data?.run.projectId;
  const design = useResource<{ locks?: string[] }>(projectId ? `/projects/${projectId}/design/state` : null, [projectId]);
  const [round, setRound] = useState<number>();
  const [view, setView] = useState<string>("compare");
  const [refining, setRefining] = useState<string | "none">();
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  if (loadError) return <div className="page"><p className="psetup__err" role="alert">{loadError}</p></div>;
  if (!p) return <div className="page"><p className="dim">Loading the design proposals…</p></div>;
  const back = () => navigate(projectId ? `/projects/${projectId}/runs/${runId}` : "/");
  if (!p.rounds.length) return <div className="page"><p>This build has no design proposals.</p><button type="button" className="btn" onClick={back}>Back to the build</button></div>;
  const at = Math.min(round ?? p.rounds.length - 1, p.rounds.length - 1);
  const shown = p.rounds[at]!;
  const one = shown.proofs.find((x) => x.id === view);
  const chosen = proofById(p, p.chosen);
  const approved = proofById(p, p.approved?.proofId);
  const all = p.rounds.flatMap((r) => r.proofs);
  const ready = all.filter((x) => x.status === "ready");
  const locks = design.data?.locks ?? [];
  const act = async (label: string, f: () => Promise<unknown>) => {
    setBusy(label);
    setError(undefined);
    try {
      await f();
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  };
  const retry = (x: DesignProof) => void act("Retrying…", () => post(`/runs/${runId}/proofs/retry`, { proof: x.id }));
  const choose = (x: DesignProof) => void act("Choosing…", () => post(`/runs/${runId}/proofs/choose`, { proof: x.id }));
  const revise = () =>
    act("Asking for a revision…", async () => {
      await post(`/runs/${runId}/proofs/revise`, { feedback, ...(refining && refining !== "none" ? { from: refining } : {}) });
      setFeedback("");
      setRefining(undefined);
      setRound(undefined);
      setView("compare");
    });
  const actions = (x: DesignProof) =>
    x.status === "ready" && !p.approved ? (
      <div className="pp-card__actions">
        <button type="button" className="btn btn--primary btn--sm" disabled={!!busy} onClick={() => choose(x)}>{x.id === p.chosen ? "Chosen" : "Choose this design"}</button>
        <button type="button" className="btn btn--sm" disabled={!!busy} onClick={() => (setRefining(x.id), setFeedback(""))}>Refine this design</button>
      </div>
    ) : null;

  return (
    <div className="page pr-page">
      <header className="pr-head">
        <button type="button" className="link-btn pr-back" onClick={back}><Icon name="chevron" size={12} /> Back to the build</button>
        <div className="pr-head__row">
          <div>
            <h1 className="pr-title">{approved ? "Design approved" : "Design proposals"}</h1>
            <p className="pr-lede">
              {approved
                ? `${approved.label}, ${approved.name}: its specification is the reference for the build. Go back to the build to approve the plan.`
                : pending
                  ? `The designer is making custom concepts of your main screen: ${ready.length} of ${all.length} ready. They're saved as they finish; you can leave and come back.`
                  : "Custom concepts of your main screen, made for this project. Proposals, not a built app: choose one and approve it before anything is built."}
            </p>
          </div>
          {p.rounds.length > 1 ? (
            <div className="ls-seg" role="radiogroup" aria-label="Rounds">
              {p.rounds.map((r, i) => (
                <button key={r.id} type="button" role="radio" aria-checked={i === at} className={i === at ? "is-on" : ""} title={r.feedback ? `From: "${r.feedback}"` : "The first proposals"} onClick={() => (setRound(i), setView("compare"))}>
                  {i === 0 ? "First" : `Revision ${i}`}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {shown.feedback ? <p className="pp__feedback">Your note: “{shown.feedback}”</p> : null}
        <div className="pr-tabs" role="tablist" aria-label="Proposals">
          {shown.proofs.length > 1 ? (
            <button type="button" role="tab" aria-selected={view === "compare"} className={view === "compare" ? "is-on" : ""} onClick={() => setView("compare")}>Side by side</button>
          ) : null}
          {shown.proofs.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={view === x.id || (shown.proofs.length === 1 && !one)} className={view === x.id || (shown.proofs.length === 1 && !one) ? "is-on" : ""} onClick={() => setView(x.id)}>
              {x.label}{x.name ? ` · ${x.name}` : ""}
              {x.id === p.approved?.proofId ? " ✓" : x.id === p.chosen ? " ·  chosen" : ""}
            </button>
          ))}
        </div>
      </header>

      {one || shown.proofs.length === 1 ? (
        (() => {
          const x = one ?? shown.proofs[0]!;
          return (
            <div className="pr-single">
              <ProofSlot x={x} size="large" busy={!!busy} onRetry={() => retry(x)} />
              <aside className="pr-side">
                <strong className="pp-card__label">{x.label}{x.name ? ` · ${x.name}` : ""}</strong>
                {x.rationale ? <p className="pp-card__why">{x.rationale}</p> : null}
                {x.settings?.length ? (
                  <dl className="pr-settings">
                    {x.settings.map((s) => (
                      <div key={s.label}><dt>{s.label}</dt><dd>{s.value}</dd></div>
                    ))}
                  </dl>
                ) : null}
                {x.skills?.length ? <p className="pp-card__skills" title="Skills from your library the designer followed">Skills: {x.skills.join(", ")}</p> : null}
                {actions(x)}
              </aside>
            </div>
          );
        })()
      ) : (
        <ul className={`pr-compare pr-compare--${shown.proofs.length}`}>
          {shown.proofs.map((x) => (
            <li key={x.id} className={`pp-card${x.id === p.chosen ? " is-chosen" : ""}${x.id === p.approved?.proofId ? " is-approved" : ""}`}>
              {x.status === "ready" ? (
                <button type="button" className="pr-compare__pic" onClick={() => setView(x.id)} aria-label={`Open ${x.label} large`}>
                  <ProofSlot x={x} size="thumb" busy={!!busy} onRetry={() => retry(x)} />
                </button>
              ) : (
                // Not a button while it isn't ready: its Retry has to be clickable.
                <div className="pr-compare__pic">
                  <ProofSlot x={x} size="thumb" busy={!!busy} onRetry={() => retry(x)} />
                </div>
              )}
              <div className="pp-card__body">
                <strong className="pp-card__label">{x.label}{x.name ? ` · ${x.name}` : ""}</strong>
                {x.rationale ? <p className="pp-card__why">{x.rationale}</p> : null}
                {x.skills?.length ? <p className="pp-card__skills">Skills: {x.skills.join(", ")}</p> : null}
                {actions(x)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!p.approved ? (
        <div className="pp__none">
          {refining ? (
            <form className="pp__revise" onSubmit={(e) => (e.preventDefault(), feedback.trim() && void revise())}>
              <label htmlFor={`pp-fb-${runId}`} className="pp__revise-k">{refining === "none" ? "Describe what you want to change" : `What should change in ${proofById(p, refining)?.label}?`}</label>
              <textarea id={`pp-fb-${runId}`} className="ls-ask__input pp__revise-input" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="e.g. the schedule first and bigger, warmer colors, less text in the intro" autoFocus />
              <div className="pp__revise-actions">
                <button type="button" className="btn btn--sm" onClick={() => setRefining(undefined)}>Cancel</button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={!feedback.trim() || !!busy}>{busy ?? "Make a revised proposal"}</button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn btn--sm" disabled={pending} onClick={() => (setRefining("none"), setFeedback(""))}>None of these fit</button>
          )}
        </div>
      ) : null}

      {chosen && !p.approved ? (
        <section className="pp-approve" aria-label="Approve the design">
          <h2>Approve {chosen.label}, {chosen.name}?</h2>
          <dl className="ls-approve__list">
            {(chosen.settings ?? []).map((s) => (
              <div key={s.label} className="pp-approve__row"><dt>{s.label}</dt><dd>{s.value}</dd></div>
            ))}
            <div className="pp-approve__row"><dt>Your changes</dt><dd>{[p.brief?.preferences, chosen.feedback].filter(Boolean).join(" · ") || "None"}</dd></div>
            <div className="pp-approve__row"><dt>Avoid</dt><dd>{p.brief?.avoid || "Nothing named"}</dd></div>
            <div className="pp-approve__row"><dt>Locked</dt><dd>{locks.length ? locks.map((l) => LOCK_NAME[l] ?? l).join(", ") : "Nothing"}</dd></div>
          </dl>
          <div className="pp-approve__actions">
            <button type="button" className="btn btn--primary" data-cp="proof-approve" disabled={!!busy} onClick={() => void act("Approving…", () => post(`/runs/${runId}/proofs/approve`, {}))}>
              {busy === "Approving…" ? busy : "Approve this design"}
            </button>
          </div>
        </section>
      ) : null}
      {approved ? (
        <div className="pp-approve">
          <p>Approved. The build applies this design once you approve the plan.</p>
          <div className="pp-approve__actions"><button type="button" className="btn btn--primary" onClick={back}>Back to the plan</button></div>
        </div>
      ) : null}
      {error ? <p className="psetup__err" role="alert">{error}</p> : null}
    </div>
  );
}

/** On the plan card: where the design proposals stand, small pictures, and the way into the review. */
export function ProofSummary({ runId, onChange }: { runId: string; onChange?: (p: Proofs) => void }) {
  const { data: p, pending } = useProofs(runId);
  useEffect(() => {
    if (p) onChange?.(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);
  if (!p?.rounds.length) return null;
  const latest = p.rounds[p.rounds.length - 1]!;
  const all = p.rounds.flatMap((r) => r.proofs);
  const ready = all.filter((x) => x.status === "ready").length;
  const failed = all.filter((x) => x.status === "failed").length;
  const approved = proofById(p, p.approved?.proofId);
  const chosen = proofById(p, p.chosen);
  return (
    <section className="pp-sum" aria-label="Design proposals">
      <div className="pp-sum__text">
        <h3 className="pp__title">{approved ? `Design approved: ${approved.name}` : "Design proposals"}</h3>
        <p className="pp__lede">
          {approved
            ? "Its specification is the build's design reference."
            : pending
              ? `The designer is working: ${ready} of ${all.length} ready.`
              : chosen
                ? `${chosen.label}, ${chosen.name} is chosen. Approve it in the review, then approve the plan.`
                : `${ready} ready${failed ? `, ${failed} to retry` : ""}. Choose one and approve it before the plan.`}
        </p>
        <button type="button" className="btn btn--primary btn--sm" data-cp="open-design-review" onClick={() => navigate(`/proofs/${runId}`)}>
          {approved ? "See the design" : "Open the design review"}
        </button>
      </div>
      <ul className="pp-sum__pics">
        {latest.proofs.map((x) => (
          <li key={x.id} className={x.id === p.approved?.proofId || x.id === p.chosen ? "is-chosen" : ""}>
            <ProofSlot x={x} size="thumb" onRetry={() => navigate(`/proofs/${runId}`)} />
            <span>{x.label}{x.name ? ` · ${x.name}` : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A one-line status of a build's design proofs, in the run's activity while the build is planned. */
export function ProofProgress({ runId }: { runId: string }) {
  const { data: p, pending } = useProofs(runId);
  const all = p?.rounds.flatMap((r) => r.proofs) ?? [];
  if (!p || !all.length || p.approved) return null;
  const ready = all.filter((x) => x.status === "ready").length;
  const failed = all.filter((x) => x.status === "failed").length;
  return (
    <p className="pp-progress" role="status">
      <strong>Design proposals:</strong> {ready} of {all.length} ready{failed ? `, ${failed} to retry` : ""}
      {pending ? " · the designer is working" : " · "}
      {!pending ? <button type="button" className="link-btn" onClick={() => navigate(`/proofs/${p.runId}`)}>Open the design review</button> : null}
    </p>
  );
}
